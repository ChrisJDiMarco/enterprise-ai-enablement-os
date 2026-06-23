/**
 * Workflow spec interpreter. Walks a published workflow's node/edge graph in
 * execution order, delegating "actionable" steps (LLM analysis, retrieval,
 * extraction, tool calls) to a pluggable executor and handling control flow
 * (trigger, condition, human-approval gate, end) itself. Pure + deterministic so
 * it can be unit-tested; the worker supplies a real executor that runs Skills.
 *
 * A human-approval block stops the run (status "waiting_for_approval") — the
 * human-in-the-loop gate is honored, not auto-completed.
 */

export type WorkflowExecNode = {
  id: string;
  blockType: string;
  title: string;
  systemPrompt?: string;
  toolId?: string;
  requiresApproval: boolean;
  outputSchema?: string;
};

export type WorkflowStepStatus = "completed" | "waiting" | "failed" | "skipped";

export type WorkflowExecStep = {
  nodeId: string;
  blockType: string;
  title: string;
  status: WorkflowStepStatus;
  detail: string;
  output?: unknown;
};

export type WorkflowExecResult = {
  status: "completed" | "waiting_for_approval" | "failed";
  steps: WorkflowExecStep[];
  output: Record<string, unknown>;
  pendingNodeId?: string;
  error?: string;
};

export type WorkflowStepExecutor = (
  node: WorkflowExecNode,
  input: Record<string, unknown>,
) => Promise<{ status?: "completed" | "failed"; detail?: string; output?: unknown }>;

const CONTROL_BLOCK_TYPES = new Set(["manual_trigger", "end", "human_approval"]);

function parseNode(raw: unknown): WorkflowExecNode | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { id?: unknown; data?: unknown };
  const id = typeof record.id === "string" && record.id ? record.id : null;
  if (!id) return null;
  const data = (record.data && typeof record.data === "object" ? record.data : {}) as Record<string, unknown>;
  const blockType = typeof data.blockType === "string" ? data.blockType : "unknown";
  return {
    id,
    blockType,
    title: typeof data.title === "string" && data.title ? data.title : id,
    systemPrompt: typeof data.systemPrompt === "string" && data.systemPrompt ? data.systemPrompt : undefined,
    toolId: typeof data.toolId === "string" && data.toolId ? data.toolId : undefined,
    requiresApproval: data.requiresApproval === true || blockType === "human_approval",
    outputSchema: typeof data.outputSchema === "string" && data.outputSchema ? data.outputSchema : undefined,
  };
}

function parseEdges(raw: unknown[]): { source: string; target: string }[] {
  return raw
    .map((edge) => {
      if (!edge || typeof edge !== "object") return null;
      const record = edge as { source?: unknown; target?: unknown };
      if (typeof record.source !== "string" || typeof record.target !== "string") return null;
      return { source: record.source, target: record.target };
    })
    .filter((edge): edge is { source: string; target: string } => edge !== null);
}

/** Execution order: follow edges from the trigger; fall back to array order when there are no edges. */
export function orderWorkflowNodes(nodes: WorkflowExecNode[], edges: { source: string; target: string }[]): WorkflowExecNode[] {
  if (!nodes.length) return [];
  if (!edges.length) return [...nodes];

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();
  const hasIncoming = new Set<string>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
    hasIncoming.add(edge.target);
  }

  const start =
    nodes.find((node) => node.blockType === "manual_trigger") ??
    nodes.find((node) => !hasIncoming.has(node.id)) ??
    nodes[0]!;

  const ordered: WorkflowExecNode[] = [];
  const visited = new Set<string>();
  const queue: string[] = [start.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (node) ordered.push(node);
    for (const target of adjacency.get(id) ?? []) {
      if (!visited.has(target)) queue.push(target);
    }
  }
  // Append any nodes unreachable from the start so they aren't silently dropped.
  for (const node of nodes) {
    if (!visited.has(node.id)) ordered.push(node);
  }
  return ordered;
}

export async function interpretWorkflow(params: {
  nodes: unknown[];
  edges?: unknown[];
  input?: Record<string, unknown>;
  executeStep?: WorkflowStepExecutor;
}): Promise<WorkflowExecResult> {
  const nodes = params.nodes.map(parseNode).filter((node): node is WorkflowExecNode => node !== null);
  if (!nodes.length) {
    return { status: "failed", steps: [], output: {}, error: "Workflow has no executable blocks." };
  }
  const ordered = orderWorkflowNodes(nodes, parseEdges(params.edges ?? []));
  const input = params.input ?? {};
  const steps: WorkflowExecStep[] = [];
  const output: Record<string, unknown> = {};

  for (const node of ordered) {
    if (node.requiresApproval) {
      steps.push({
        nodeId: node.id,
        blockType: node.blockType,
        title: node.title,
        status: "waiting",
        detail: `Awaiting human approval at "${node.title}".`,
      });
      return { status: "waiting_for_approval", steps, output, pendingNodeId: node.id };
    }

    if (node.blockType === "manual_trigger") {
      steps.push({ nodeId: node.id, blockType: node.blockType, title: node.title, status: "completed", detail: "Workflow triggered." });
      continue;
    }
    if (node.blockType === "end") {
      steps.push({ nodeId: node.id, blockType: node.blockType, title: node.title, status: "completed", detail: "Workflow complete." });
      break;
    }
    if (CONTROL_BLOCK_TYPES.has(node.blockType)) {
      steps.push({ nodeId: node.id, blockType: node.blockType, title: node.title, status: "completed", detail: `${node.blockType} evaluated.` });
      continue;
    }

    if (!params.executeStep) {
      steps.push({
        nodeId: node.id,
        blockType: node.blockType,
        title: node.title,
        status: "skipped",
        detail: `${node.blockType} step recorded (no executor available).`,
      });
      continue;
    }

    try {
      const result = await params.executeStep(node, input);
      const status: WorkflowStepStatus = result.status === "failed" ? "failed" : "completed";
      steps.push({
        nodeId: node.id,
        blockType: node.blockType,
        title: node.title,
        status,
        detail: result.detail ?? `${node.blockType} executed.`,
        output: result.output,
      });
      if (result.output !== undefined) output[node.id] = result.output;
      if (status === "failed") {
        return { status: "failed", steps, output, error: result.detail ?? `Step "${node.title}" failed.` };
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Step execution failed.";
      steps.push({ nodeId: node.id, blockType: node.blockType, title: node.title, status: "failed", detail });
      return { status: "failed", steps, output, error: detail };
    }
  }

  return { status: "completed", steps, output };
}
