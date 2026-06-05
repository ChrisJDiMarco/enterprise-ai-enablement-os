import type React from "react";
import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  Activity,
  AlertTriangle,
  Bell,
  BrainCircuit,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  FileCheck2,
  FileText,
  GitBranch,
  Network,
  Play,
  Plus,
  RefreshCcw,
  Rocket,
  Save,
  Search,
  ShieldCheck,
  SquareTerminal,
  Trash2,
  UserRound,
  Workflow,
  X,
} from "lucide-react";
import { tools } from "@/lib/enterprise-ai-data";
import { copyTextOrDownload, downloadTextFile, timestampedExportFilename } from "@/lib/ui/export-utils";
import { Badge, Button, EmptyState, Field, MessageCircleIcon, MiniMetric, Panel, SectionTitle } from "@/components/ui";
import { PageHeader } from "@/components/shell";

export const initialWorkflowNodes: Node[] = [];

export const initialWorkflowEdges: Edge[] = [];

type WorkflowBlockDefinition = {
  id: string;
  label: string;
  group: "Triggers" | "Actions" | "Controls";
  tone: "green" | "blue" | "purple" | "amber" | "red" | "slate";
  description: string;
  defaultPrompt?: string;
  terminal?: boolean;
};

type WorkflowNodeData = Record<string, unknown> & {
  label?: string;
  blockType?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  tone?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  toolId?: string;
  requiresApproval?: boolean;
  approvalRole?: string;
  timeoutSeconds?: number;
  retryCount?: number;
  outputSchema?: string;
};

type WorkflowValidationIssue = {
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
};

const workflowBlockCatalog: WorkflowBlockDefinition[] = [
  {
    id: "manual_trigger",
    label: "Manual Trigger",
    group: "Triggers",
    tone: "green",
    description: "Starts the workflow from a user action or approved request.",
  },
  {
    id: "schedule_trigger",
    label: "Schedule Trigger",
    group: "Triggers",
    tone: "slate",
    description: "Starts the workflow on a configured schedule.",
  },
  {
    id: "retrieve_documents",
    label: "Retrieve Documents",
    group: "Actions",
    tone: "blue",
    description: "Retrieves approved context sources with permission filtering.",
  },
  {
    id: "extract_data",
    label: "Extract Data",
    group: "Actions",
    tone: "purple",
    description: "Extracts structured fields from documents, records, or messages.",
    defaultPrompt: "Extract the required fields. Preserve source references and flag missing or ambiguous values.",
  },
  {
    id: "llm_analysis",
    label: "LLM Analysis",
    group: "Actions",
    tone: "purple",
    description: "Runs a model step with policy-aware instructions.",
    defaultPrompt: "Analyze the input using approved context only. Separate source facts from model inference and flag uncertainty.",
  },
  {
    id: "tool_call",
    label: "Tool Call",
    group: "Actions",
    tone: "amber",
    description: "Requests an enterprise connector action through the MCP Broker.",
  },
  {
    id: "transform_data",
    label: "Transform Data",
    group: "Actions",
    tone: "blue",
    description: "Transforms, maps, or normalizes data between workflow steps.",
  },
  {
    id: "send_notification",
    label: "Send Notification",
    group: "Actions",
    tone: "amber",
    description: "Prepares or sends a notification according to policy.",
  },
  {
    id: "condition",
    label: "Condition",
    group: "Controls",
    tone: "amber",
    description: "Branches execution using a deterministic policy condition.",
  },
  {
    id: "human_approval",
    label: "Human Approval",
    group: "Controls",
    tone: "red",
    description: "Pauses the workflow until an approved reviewer decides.",
  },
  {
    id: "parallel_branch",
    label: "Parallel Branch",
    group: "Controls",
    tone: "blue",
    description: "Runs multiple approved branches before continuing.",
  },
  {
    id: "delay",
    label: "Delay",
    group: "Controls",
    tone: "slate",
    description: "Waits for a configured duration or external signal.",
  },
  {
    id: "end",
    label: "End",
    group: "Controls",
    tone: "green",
    description: "Marks the workflow terminal state and final output boundary.",
    terminal: true,
  },
];

function nodeStyle(color: string) {
  return {
    border: `1.5px solid ${color}`,
    color: "#0f172a",
    background: "#ffffff",
    borderRadius: 8,
    boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
    fontSize: 12,
    fontWeight: 650,
    lineHeight: 1.35,
    padding: "10px 12px",
    whiteSpace: "pre-line",
    width: 156,
  };
}

function getWorkflowNodeData(node?: Node | null): WorkflowNodeData {
  return (node?.data ?? {}) as WorkflowNodeData;
}

function getWorkflowNodeTitle(node?: Node | null) {
  const data = getWorkflowNodeData(node);
  return typeof data.title === "string" && data.title ? data.title : String(data.label ?? "Workflow Block").split("\n")[0];
}

function getWorkflowNodeSubtitle(node?: Node | null) {
  const data = getWorkflowNodeData(node);
  return typeof data.subtitle === "string" ? data.subtitle : String(data.label ?? "").split("\n")[1] ?? "Configured block";
}

function workflowNodeLabel(title: string, subtitle: string) {
  return subtitle ? `${title}\n${subtitle}` : title;
}

export function getBlockDefinition(labelOrId: string) {
  return workflowBlockCatalog.find((block) => block.id === labelOrId || block.label === labelOrId);
}

export function createWorkflowNode(blockIdOrLabel: string, index: number): Node {
  const definition = getBlockDefinition(blockIdOrLabel) ?? workflowBlockCatalog[0];
  const subtitle = definition.group === "Triggers" ? "Trigger" : definition.terminal ? "Workflow complete" : "Configure step";
  const x = 100 + (index % 4) * 210;
  const y = 120 + Math.floor(index / 4) * 140;

  return {
    id: `block-${definition.id}-${Date.now()}-${index}`,
    position: { x, y },
    data: {
      label: workflowNodeLabel(definition.label, subtitle),
      blockType: definition.id,
      title: definition.label,
      subtitle,
      description: definition.description,
      tone: definition.tone,
      provider: "local",
      model: "local-enterprise-reasoner",
      temperature: 0.2,
      maxTokens: 4096,
      systemPrompt: definition.defaultPrompt ?? "",
      toolId: "",
      requiresApproval: definition.id === "human_approval",
      approvalRole: "ai_enablement_director",
      timeoutSeconds: 120,
      retryCount: 1,
      outputSchema: definition.terminal ? "WorkflowResult" : "",
    } satisfies WorkflowNodeData,
    style: nodeStyle(blockColor(definition.tone)),
  };
}

export function createWorkflowTemplate(template: "knowledge" | "approval"): { nodes: Node[]; edges: Edge[] } {
  const blockIds =
    template === "knowledge"
      ? ["manual_trigger", "retrieve_documents", "llm_analysis", "end"]
      : ["manual_trigger", "llm_analysis", "condition", "human_approval", "tool_call", "end"];
  const nodes = blockIds.map((blockId, index) => ({
    ...createWorkflowNode(blockId, index),
    position: template === "knowledge"
      ? { x: 120 + index * 220, y: 220 }
      : {
          x: index < 3 ? 100 + index * 220 : 210 + (index - 3) * 220,
          y: index < 3 ? 170 : 370,
        },
  }));
  const edges: Edge[] = nodes.slice(0, -1).map((node, index) => ({
    id: `edge-${node.id}-${nodes[index + 1].id}`,
    source: node.id,
    target: nodes[index + 1].id,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

  return { nodes, edges };
}

export function analyzeWorkflow(nodes: Node[], edges: Edge[]): {
  valid: boolean;
  issues: WorkflowValidationIssue[];
  warnings: WorkflowValidationIssue[];
  triggerCount: number;
  terminalCount: number;
  conditionCount: number;
  configuredCount: number;
} {
  const issues: WorkflowValidationIssue[] = [];
  const warnings: WorkflowValidationIssue[] = [];
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  edges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
  });

  const triggerNodes = nodes.filter((node) => String(getWorkflowNodeData(node).blockType ?? "").includes("trigger"));
  const terminalNodes = nodes.filter((node) => getWorkflowNodeData(node).blockType === "end");
  const conditionNodes = nodes.filter((node) => getWorkflowNodeData(node).blockType === "condition");

  if (!nodes.length) {
    issues.push({ severity: "error", message: "Add at least one trigger, one action, and one terminal End block." });
  }
  if (!triggerNodes.length) {
    issues.push({ severity: "error", message: "Add a trigger block so the workflow has a controlled entry point." });
  }
  if (!terminalNodes.length) {
    issues.push({ severity: "error", message: "Add an End block so the workflow has a clear output boundary." });
  }
  if (nodes.length > 1 && !edges.length) {
    issues.push({ severity: "error", message: "Connect blocks before validating or publishing." });
  }

  nodes.forEach((node) => {
    const data = getWorkflowNodeData(node);
    const blockType = String(data.blockType ?? "");
    const title = getWorkflowNodeTitle(node);
    const isTrigger = blockType.includes("trigger");
    const isEnd = blockType === "end";

    if (!isTrigger && nodes.length > 1 && !incoming.get(node.id)) {
      issues.push({ severity: "error", message: `${title} has no incoming connection.`, nodeId: node.id });
    }
    if (!isEnd && nodes.length > 1 && !outgoing.get(node.id)) {
      warnings.push({ severity: "warning", message: `${title} has no outgoing connection.`, nodeId: node.id });
    }
    if (["llm_analysis", "extract_data"].includes(blockType) && !String(data.systemPrompt ?? "").trim()) {
      issues.push({ severity: "error", message: `${title} needs a system prompt before publish.`, nodeId: node.id });
    }
    if (blockType === "tool_call" && !String(data.toolId ?? "").trim()) {
      warnings.push({ severity: "warning", message: "Tool Call has no bound connector yet.", nodeId: node.id });
    }
    if (blockType === "human_approval" && !String(data.approvalRole ?? "").trim()) {
      issues.push({ severity: "error", message: "Human Approval needs an approver role.", nodeId: node.id });
    }
  });

  return {
    valid: !issues.length,
    issues,
    warnings,
    triggerCount: triggerNodes.length,
    terminalCount: terminalNodes.length,
    conditionCount: conditionNodes.length,
    configuredCount: nodes.filter((node) => getWorkflowNodeSubtitle(node) !== "Configure step").length,
  };
}

export function compileWorkflowSpec(nodes: Node[], edges: Edge[], status: string) {
  return {
    schema: "enterprise-ai-enablement-os.workflow-spec.v1",
    status,
    generatedAt: new Date().toISOString(),
    blocks: nodes.map((node) => {
      const data = getWorkflowNodeData(node);
      return {
        id: node.id,
        type: data.blockType ?? "custom",
        title: getWorkflowNodeTitle(node),
        description: data.description ?? "",
        position: node.position,
        config: {
          provider: data.provider,
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          systemPrompt: data.systemPrompt,
          toolId: data.toolId,
          requiresApproval: data.requiresApproval,
          approvalRole: data.approvalRole,
          timeoutSeconds: data.timeoutSeconds,
          retryCount: data.retryCount,
          outputSchema: data.outputSchema,
        },
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label ?? "",
    })),
  };
}

export function formatWorkflowValidationSummary(validation: ReturnType<typeof analyzeWorkflow>) {
  const errorLines = validation.issues.map((issue, index) => `${index + 1}. ${issue.message}`);
  const warningLines = validation.warnings.map((issue, index) => `${index + 1}. ${issue.message}`);

  return [
    validation.valid ? "Workflow validation passed." : "Workflow validation needs attention.",
    `Blocks: ${validation.configuredCount} configured, ${validation.triggerCount} trigger, ${validation.terminalCount} terminal, ${validation.conditionCount} condition.`,
    errorLines.length ? `Errors:\n${errorLines.join("\n")}` : "Errors: none.",
    warningLines.length ? `Warnings:\n${warningLines.join("\n")}` : "Warnings: none.",
  ].join("\n\n");
}

export function WorkflowBuilder({
  mode,
  setMode,
  nodes,
  edges,
  setNodes,
  setEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  status,
  onTest,
  onValidate,
  onAddBlock,
  onLoadTemplate,
  onClearWorkflow,
  onManageTools,
  onPublish,
  output,
}: {
  mode: "overview" | "editor";
  setMode: (mode: "overview" | "editor") => void;
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChange: Parameters<typeof ReactFlow>[0]["onNodesChange"];
  onEdgesChange: Parameters<typeof ReactFlow>[0]["onEdgesChange"];
  onConnect: (connection: Connection) => void;
  status: string;
  onTest: () => void | Promise<void>;
  onValidate: () => void;
  onAddBlock: (blockIdOrLabel: string) => void;
  onLoadTemplate: (template: "knowledge" | "approval") => void;
  onClearWorkflow: () => void;
  onManageTools: () => void;
  onPublish: () => void;
  output: string;
}) {
  const [workflowNotice, setWorkflowNotice] = useState("");
  const [inspectorTab, setInspectorTab] = useState<"configuration" | "advanced">("configuration");
  const [builderTab, setBuilderTab] = useState<"Builder" | "Runs" | "Versions" | "Settings">("Builder");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [blockSearch, setBlockSearch] = useState("");
  const [specOpen, setSpecOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [workflowJobs, setWorkflowJobs] = useState<
    { id: string; status: string; workflowId?: string; createdAt?: string; updatedAt?: string }[]
  >([]);
  const [jobLoadStatus, setJobLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null,
    [nodes, selectedNodeId],
  );
  const selectedData = getWorkflowNodeData(selectedNode);
  const selectedBlockType = String(selectedData.blockType ?? "");
  const selectedDefinition = getBlockDefinition(selectedBlockType);
  const validation = useMemo(() => analyzeWorkflow(nodes, edges), [nodes, edges]);
  const workflowSpec = useMemo(() => compileWorkflowSpec(nodes, edges, status), [edges, nodes, status]);
  const specText = useMemo(() => JSON.stringify(workflowSpec, null, 2), [workflowSpec]);
  const visibleNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        style: {
          ...node.style,
          boxShadow:
            node.id === selectedNode?.id
              ? "0 0 0 3px rgba(99,91,255,0.18), 0 12px 28px rgba(15,23,42,0.12)"
              : "0 1px 2px rgba(15,23,42,0.06)",
        },
      })),
    [nodes, selectedNode?.id],
  );

  const blockIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    manual_trigger: Play,
    schedule_trigger: ClipboardCheck,
    retrieve_documents: FileText,
    extract_data: FileCheck2,
    llm_analysis: BrainCircuit,
    tool_call: SquareTerminal,
    transform_data: RefreshCcw,
    send_notification: Bell,
    condition: GitBranch,
    human_approval: UserRound,
    parallel_branch: Network,
    delay: Activity,
    end: Check,
  };

  const filteredGroups = (["Triggers", "Actions", "Controls"] as WorkflowBlockDefinition["group"][])
    .map((group) => ({
      title: group,
      items: workflowBlockCatalog.filter((block) => {
        const query = blockSearch.trim().toLowerCase();
        return block.group === group && (!query || `${block.label} ${block.description}`.toLowerCase().includes(query));
      }),
    }))
    .filter((group) => group.items.length);

  function updateSelectedNode(patch: Partial<WorkflowNodeData>) {
    if (!selectedNode) return;

    setNodes((current) =>
      current.map((node) => {
        if (node.id !== selectedNode.id) return node;

        const currentData = getWorkflowNodeData(node);
        const nextTitle = String(patch.title ?? currentData.title ?? getWorkflowNodeTitle(node));
        const nextSubtitle = String(patch.subtitle ?? currentData.subtitle ?? getWorkflowNodeSubtitle(node));
        const nextTone = String(patch.tone ?? currentData.tone ?? "slate");
        const nextData: WorkflowNodeData = {
          ...currentData,
          ...patch,
          title: nextTitle,
          subtitle: nextSubtitle,
          label: workflowNodeLabel(nextTitle, nextSubtitle),
        };

        return {
          ...node,
          data: nextData,
          style: {
            ...node.style,
            border: `1.5px solid ${blockColor(nextTone)}`,
          },
        };
      }),
    );
  }

  function changeSelectedBlockType(blockType: string) {
    const definition = getBlockDefinition(blockType);
    if (!definition) return;

    updateSelectedNode({
      blockType: definition.id,
      title: definition.label,
      subtitle: definition.group === "Triggers" ? "Trigger" : definition.terminal ? "Workflow complete" : "Configured step",
      description: definition.description,
      tone: definition.tone,
      systemPrompt: definition.defaultPrompt ?? String(selectedData.systemPrompt ?? ""),
      requiresApproval: definition.id === "human_approval" || Boolean(selectedData.requiresApproval),
      outputSchema: definition.terminal ? "WorkflowResult" : String(selectedData.outputSchema ?? ""),
    });
  }

  function duplicateSelectedNode() {
    if (!selectedNode) return;

    const cloneId = `${selectedNode.id}-copy-${Date.now()}`;
    const clone: Node = {
      ...selectedNode,
      id: cloneId,
      position: {
        x: selectedNode.position.x + 48,
        y: selectedNode.position.y + 48,
      },
      data: {
        ...getWorkflowNodeData(selectedNode),
        title: `${getWorkflowNodeTitle(selectedNode)} Copy`,
        label: workflowNodeLabel(`${getWorkflowNodeTitle(selectedNode)} Copy`, getWorkflowNodeSubtitle(selectedNode)),
      },
      selected: false,
    };

    setNodes((current) => [...current, clone]);
    setSelectedNodeId(cloneId);
    setWorkflowNotice("Block duplicated");
  }

  function deleteSelectedNode() {
    if (!selectedNode) return;

    setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setEdges((current) => current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedNodeId("");
    setWorkflowNotice("Block removed");
  }

  function copyWorkflowSpec() {
    void copyTextOrDownload({
      contents: specText,
      copiedMessage: "Workflow spec copied",
      fallbackFilename: timestampedExportFilename("enterprise ai workflow spec", "json"),
      fallbackMimeType: "application/json;charset=utf-8",
      downloadedMessage: "Clipboard permission blocked. Workflow spec JSON downloaded instead.",
    }).then((result) => setWorkflowNotice(result.message));
  }

  function downloadWorkflowSpec() {
    const downloaded = downloadTextFile({
      contents: specText,
      filename: timestampedExportFilename("enterprise ai workflow spec", "json"),
      mimeType: "application/json;charset=utf-8",
    });
    setWorkflowNotice(downloaded ? "Workflow spec downloaded" : "Workflow spec download is unavailable in this browser session");
  }

  function numberFromInput(value: string, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async function refreshWorkflowJobs() {
    setJobLoadStatus("loading");
    try {
      const response = await fetch("/api/workflows/jobs");
      if (!response.ok) {
        throw new Error(`Workflow jobs returned ${response.status}`);
      }
      const payload = await response.json();
      setWorkflowJobs(Array.isArray(payload?.jobs) ? payload.jobs : []);
      setJobLoadStatus("ready");
    } catch {
      setJobLoadStatus("error");
      setWorkflowNotice("Workflow jobs are unavailable for the current session");
    }
  }

  async function runTestAndRefresh() {
    await onTest();
    window.setTimeout(() => {
      void refreshWorkflowJobs();
    }, 500);
  }

  function openBuilderTab(tab: "Builder" | "Runs" | "Versions" | "Settings") {
    setBuilderTab(tab);
    if (tab === "Runs") {
      void refreshWorkflowJobs();
    }
  }

  function jobTone(jobStatus: string): "slate" | "green" | "amber" | "red" {
    if (jobStatus === "completed") return "green";
    if (jobStatus === "failed" || jobStatus === "cancelled") return "red";
    if (jobStatus === "queued" || jobStatus === "running" || jobStatus === "waiting_for_approval") return "amber";
    return "slate";
  }

  const SelectedIcon = blockIcons[selectedBlockType] ?? Workflow;
  const selectedTitle = selectedNode ? getWorkflowNodeTitle(selectedNode) : "No block selected";
  const selectedSubtitle = selectedNode ? getWorkflowNodeSubtitle(selectedNode) : "Select or add a block";
  const isReady = validation.valid && nodes.length > 0;
  const validationLabel = validation.issues.length
    ? `${validation.issues.length} blocking issue${validation.issues.length === 1 ? "" : "s"}`
    : validation.warnings.length
      ? `${validation.warnings.length} warning${validation.warnings.length === 1 ? "" : "s"}`
      : nodes.length
        ? "Ready to test"
        : "Setup needed";
  const workflowReadiness = [
    {
      label: "Controlled trigger",
      complete: validation.triggerCount > 0,
      helper: validation.triggerCount ? `${validation.triggerCount} trigger configured` : "Add Manual or Schedule Trigger",
    },
    {
      label: "Output boundary",
      complete: validation.terminalCount > 0,
      helper: validation.terminalCount ? "Terminal End block present" : "Add an End block",
    },
    {
      label: "Graph connected",
      complete: nodes.length > 1 ? edges.length > 0 && !validation.issues.some((issue) => issue.message.includes("incoming")) : false,
      helper: nodes.length > 1 ? `${edges.length} connection${edges.length === 1 ? "" : "s"}` : "Add and connect blocks",
    },
    {
      label: "Policy-ready spec",
      complete: validation.valid && nodes.length > 0,
      helper: validation.valid && nodes.length ? "Spec can be tested" : validationLabel,
    },
  ];
  const workflowProgress = Math.round((workflowReadiness.filter((item) => item.complete).length / workflowReadiness.length) * 100);
  const workflowSummary = nodes.length
    ? {
        name: "Current execution blueprint",
        description: "A Harness-ready graph that binds triggers, context, model steps, tools, approvals, and output boundaries.",
        status,
        blocks: nodes.length,
        connections: edges.length,
        validation: validationLabel,
      }
    : null;
  const nextWorkflowTitle = workflowSummary
    ? isReady
      ? "Next: run the workflow test"
      : "Next: fix the workflow blockers"
    : "Start with a workflow template";
  const nextWorkflowBody = workflowSummary
    ? isReady
      ? "The execution plan has the required structure. Run a test job so the Harness can produce trace evidence before publish."
      : "This blueprint is useful, but it is not ready to run yet. Open the canvas or validate it to see the exact missing trigger, connection, prompt, tool, or approval."
    : "Choose a governed starter flow for retrieval or approval-gated action. The OS will turn it into blocks, gates, and a runtime spec you can test.";
  const nextWorkflowAction = workflowSummary ? (isReady ? "Run test" : "Open canvas") : "Load approval flow";
  const workflowHealth = [
    ["Blocks", String(nodes.length)],
    ["Connections", String(edges.length)],
    ["Readiness", `${workflowProgress}%`],
    ["Jobs", String(workflowJobs.length)],
  ];
  const lifecycleSteps = [
    ["1", "Anchor to outcome", "Tie the workflow to an approved Skill, owner, and business value target."],
    ["2", "Add context and reasoning", "Retrieve approved data, extract facts, and analyze safely."],
    ["3", "Gate risky actions", "Insert conditions, policy checks, and human approvals."],
    ["4", "Test with Harness", "Compile the spec, run a job, inspect trace evidence, and fix blockers."],
    ["5", "Publish controlled runtime", "Version the workflow and make it available as governed execution infrastructure."],
  ];
  const workflowNextGuide = workflowSummary
    ? isReady
      ? [
          ["1", "Compile the spec", "The OS turns the visible blocks into a versioned runtime contract."],
          ["2", "Run a test job", "The workflow executes in the Harness path and records trace evidence."],
          ["3", "Inspect proof", "Open Runs or Evidence to confirm outputs, approvals, costs, and blockers."],
        ]
      : [
          ["1", "Validate the graph", "Find missing triggers, terminal boundaries, connections, prompts, tools, or approvals."],
          ["2", "Open the canvas", "Fix only the blocked blocks; the rest of the plan can stay intact."],
          ["3", "Test after green", "Run a Harness job only after validation says the plan is safe enough to execute."],
        ]
    : [
        ["1", "Choose a starter", "Use Knowledge for cited answers or Approval for risky tool actions."],
        ["2", "Review the blocks", "The starter creates trigger, reasoning, approval, and output boundaries for you."],
        ["3", "Test before publish", "Run a Harness test before any workflow becomes reusable infrastructure."],
      ];
  const workflowProblems = [...validation.issues, ...validation.warnings];
  const topWorkflowProblem = workflowProblems[0]?.message ?? "";
  const editorGuide = !nodes.length
    ? {
        tone: "blue" as const,
        title: "Start with a governed workflow",
        body: "Load a starter so the OS creates the trigger, action path, approval gate, and end boundary for you. You can tune the blocks afterward.",
        primary: "Load approval flow",
        secondary: "Load knowledge flow",
      }
    : isReady
      ? {
          tone: "green" as const,
          title: "Ready for a Harness test",
          body: "This blueprint has a controlled trigger, connected graph, output boundary, and policy-ready spec. Run one test before publishing.",
          primary: "Run test",
          secondary: "View spec",
        }
      : {
          tone: "amber" as const,
          title: "Fix the next blocker",
          body: topWorkflowProblem || "Validation found a release gate that needs attention before this workflow can run.",
          primary: "Show issues",
          secondary: "Validate",
        };
  const shellGridClass = [
    "grid min-h-[760px] gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.04)] xl:h-[calc(100vh-210px)] xl:min-h-[620px] xl:max-h-[920px]",
    paletteOpen && inspectorOpen
      ? "xl:grid-cols-[280px_minmax(0,1fr)_380px]"
      : paletteOpen
        ? "xl:grid-cols-[280px_minmax(0,1fr)]"
        : inspectorOpen
          ? "xl:grid-cols-[minmax(0,1fr)_380px]"
          : "xl:grid-cols-[minmax(0,1fr)]",
  ].join(" ");

  function runEditorPrimaryAction() {
    if (!nodes.length) {
      onLoadTemplate("approval");
      setPaletteOpen(false);
      setInspectorOpen(true);
      setWorkflowNotice("Approval-gated workflow starter loaded");
      return;
    }
    if (isReady) {
      void runTestAndRefresh();
      return;
    }
    setSpecOpen(false);
    setIssuesOpen(true);
    setWorkflowNotice(formatWorkflowValidationSummary(validation));
  }

  function runEditorSecondaryAction() {
    if (!nodes.length) {
      onLoadTemplate("knowledge");
      setPaletteOpen(false);
      setInspectorOpen(true);
      setWorkflowNotice("Knowledge workflow starter loaded");
      return;
    }
    if (isReady) {
      setIssuesOpen(false);
      setSpecOpen(true);
      return;
    }
    onValidate();
  }

  if (mode === "overview") {
    return (
      <div>
        <PageHeader
          title="Workflow Builder"
          subtitle="Turn an approved Skill into a clear, testable execution plan with gates, tools, approvals, and evidence."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => {
                setBuilderTab("Builder");
                setMode("editor");
              }}>
                <Workflow size={16} />
                Advanced canvas
              </Button>
              <Button onClick={() => {
                onClearWorkflow();
                setBuilderTab("Builder");
                setMode("editor");
                setWorkflowNotice("Blank execution blueprint ready");
              }}>
                <Plus size={16} />
                New workflow
              </Button>
            </div>
          }
        />

        <Panel className="overflow-hidden">
          <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={isReady ? "green" : workflowSummary ? "amber" : "blue"}>
                  {workflowSummary ? validationLabel : "start here"}
                </Badge>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {nodes.length} blocks · {edges.length} connections · {status}
                </span>
              </div>
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{nextWorkflowTitle}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{nextWorkflowBody}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => {
                  if (!workflowSummary) {
                    onLoadTemplate("approval");
                    setBuilderTab("Builder");
                    setMode("editor");
                    return;
                  }
                  if (isReady) {
                    void runTestAndRefresh();
                    return;
                  }
                  setBuilderTab("Builder");
                  setMode("editor");
                }}>
                  {isReady ? <Play size={15} /> : <Workflow size={15} />}
                  {nextWorkflowAction}
                </Button>
                <Button variant="secondary" onClick={onValidate}>
                  <ShieldCheck size={15} />
                  Validate
                </Button>
                <Button variant="secondary" onClick={() => {
                  setSpecOpen(true);
                  setBuilderTab("Versions");
                  setMode("editor");
                }}>
                  View spec
                  <ChevronRight size={14} />
                </Button>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-950">
                    {isReady ? "What the test will do" : workflowSummary ? "How to make this runnable" : "How to start safely"}
                  </div>
                  <Badge tone={isReady ? "green" : workflowSummary ? "amber" : "blue"}>
                    {isReady ? "safe test path" : workflowSummary ? "fix path" : "starter path"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {workflowNextGuide.map(([step, title, body]) => (
                    <div key={title} className="rounded-lg bg-white px-3 py-3 ring-1 ring-slate-200/70">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
                          {step}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">{title}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-4">
                {workflowReadiness.map((item, index) => (
                  <div key={item.label} className="border-l border-slate-200 pl-4">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${item.complete ? "bg-green-50 text-green-700 ring-1 ring-green-100" : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"}`}>
                        {item.complete ? <Check size={14} /> : index + 1}
                      </span>
                      <div className="font-semibold text-slate-950">{item.label}</div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50/56 p-5 xl:border-l xl:border-t-0">
              <SectionTitle title="Workflow health" helper="What this execution plan can prove" compact />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {workflowHealth.map(([label, value]) => (
                  <MiniMetric key={label} label={label} value={value} />
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-white bg-white/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <ShieldCheck size={16} className={isReady ? "text-green-600" : "text-amber-600"} />
                  {isReady ? "Ready for a Harness test" : "Not ready to run yet"}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {isReady
                    ? "The graph has the required entry point, output boundary, connections, and policy-ready spec."
                    : validationLabel === "Setup needed"
                      ? "Start from a template so the workflow has a controlled trigger, actions, approval gates, and an end boundary."
                      : "Run validation or open the canvas to resolve the blocking items before test or publish."}
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <SectionTitle
                title={workflowSummary ? "Current workflow plan" : "Choose a starter workflow"}
                helper={workflowSummary ? "The business-readable execution plan before you edit runtime blocks." : "Load a governed pattern, then customize every block in the advanced canvas."}
                compact
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => {
                  openBuilderTab("Runs");
                  setMode("editor");
                }}>
                  <Activity size={16} />
                  Runs
                </Button>
              </div>
            </div>

            {workflowSummary ? (
              <div className="divide-y divide-slate-100">
                <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_150px_150px] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-[#5147e8]">
                        <Workflow size={21} />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-slate-950">{workflowSummary.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{workflowSummary.description}</div>
                      </div>
                    </div>
                  </div>
                  <MiniMetric label="Status" value={workflowSummary.status} />
                  <MiniMetric label="Graph" value={`${workflowSummary.blocks} blocks`} />
                </div>
                <WorkflowPlanPreview nodes={nodes} edges={edges} />
                <div className="flex flex-wrap justify-end gap-2 bg-slate-50 px-5 py-4">
                  <Button variant="secondary" onClick={runTestAndRefresh}>
                    <Play size={16} />
                    Test workflow
                  </Button>
                  <Button variant="secondary" onClick={onValidate}>
                    <ShieldCheck size={16} />
                    Validate
                  </Button>
                  <Button onClick={() => {
                    setBuilderTab("Builder");
                    setMode("editor");
                  }}>
                    Open Canvas
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-8">
                <EmptyState
                  title="No workflow has been started"
                  body="Load a template or start from a blank canvas. Workflows become executable only after triggers, actions, approvals, and output boundaries are configured."
                  action="Load approval flow"
                  onAction={() => {
                    onLoadTemplate("approval");
                    setBuilderTab("Builder");
                    setMode("editor");
                  }}
                />
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="How this becomes safe to run" helper="A production workflow should move through this sequence before publish" />
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-6 text-slate-700">
              <div className="font-semibold text-slate-950">Where this fits</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">
                Process Redesign defines the human handoff. AI Skills owns the capability. Workflow Builder defines the governed execution path the Harness can run, trace, evaluate, and prove.
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {lifecycleSteps.map(([step, title, body]) => (
                <div key={step} className="flex gap-3 rounded-xl border border-slate-200 px-3 py-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-[#5147e8]">{step}</span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{body}</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <details className="mt-4 overflow-hidden rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="font-semibold text-slate-950">Templates, readiness details, and Harness contract</div>
              <div className="mt-1 text-sm text-slate-500">Open for starter flows, full readiness gates, runtime spec details, and connector policy management.</div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </summary>
          <div className="grid gap-4 border-t border-slate-200 p-5 xl:grid-cols-3">
            <div>
              <SectionTitle title="Starter flows" helper="Load a governed pattern, then customize every block" compact />
              <div className="mt-4 space-y-3">
                <WorkflowStarterCard
                  icon={FileText}
                  title="Knowledge Retrieval Flow"
                  description="Trigger, retrieve approved context, analyze with a model step, and end with a cited response boundary."
                  blocks={4}
                  onClick={() => {
                    onLoadTemplate("knowledge");
                    setBuilderTab("Builder");
                    setMode("editor");
                  }}
                />
                <WorkflowStarterCard
                  icon={ShieldCheck}
                  title="Approval-Gated Action Flow"
                  description="Trigger, analyze, branch on risk, require human approval, then execute a brokered tool action."
                  blocks={6}
                  onClick={() => {
                    onLoadTemplate("approval");
                    setBuilderTab("Builder");
                    setMode("editor");
                  }}
                />
              </div>
            </div>

            <div>
              <SectionTitle title="Readiness details" helper="Current workflow gates" compact />
              <div className="mt-4 space-y-3">
                {workflowReadiness.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-6 items-center justify-center rounded-full ${item.complete ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                        {item.complete ? <Check size={14} /> : <AlertTriangle size={14} />}
                      </span>
                      <span className="text-sm font-semibold text-slate-950">{item.label}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle title="Harness contract" helper="What Workflow Builder compiles for runtime" compact />
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-semibold text-slate-900">Executable spec</div>
                  <div className="mt-1 text-xs">Every block exports runtime config, model route, prompt contract, connector binding, approval policy, retry policy, timeout, and output schema.</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-semibold text-slate-900">Evidence chain</div>
                  <div className="mt-1 text-xs">Tests, validation, workflow jobs, and publish events create audit records that feed the Evidence Ledger.</div>
                </div>
                <Button variant="secondary" className="w-full" onClick={onManageTools}>
                  <Network size={16} />
                  Manage Connector Policies
                </Button>
              </div>
            </div>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
	        <div>
	          <div className="flex items-center gap-2 text-sm text-slate-500">
	            <button
	              type="button"
	              onClick={() => setMode("overview")}
	              className="-mx-1.5 -my-0.5 rounded-md px-1.5 py-0.5 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
	            >
	              Workflow Studio
	            </button>
	            <ChevronRight size={14} />
	            <span>Guided builder</span>
            <ChevronRight size={14} />
            <span>{status}</span>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <h1 className="text-[26px] font-semibold tracking-normal">Guided Workflow Builder</h1>
            <Badge tone="slate">Draft</Badge>
            <Badge tone={status === "Published" ? "green" : status === "Testing" ? "amber" : "slate"}>{status}</Badge>
            <Badge tone={isReady ? "green" : "amber"}>{validationLabel}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Build the execution path behind a Skill. Keep the canvas focused, then open blocks, configuration, runs, and specs only when you need them.
          </p>
          <div className="mt-5 flex flex-wrap gap-5 border-b border-slate-200">
            {["Builder", "Runs", "Versions", "Settings"].map((tab) => (
              <button type="button"
                key={tab}
                className={`border-b-2 pb-3 text-sm font-semibold ${
                  builderTab === tab ? "border-[#635bff] text-[#5147e8]" : "border-transparent text-slate-500"
                }`}
                onClick={() => openBuilderTab(tab as "Builder" | "Runs" | "Versions" | "Settings")}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-2 flex items-center gap-2 text-sm text-slate-500">
            <Check size={15} className="text-green-600" />
            Saved to workspace
          </div>
          <Button variant="secondary" onClick={() => setPaletteOpen((open) => !open)}>
            <Plus size={16} />
            {paletteOpen ? "Hide blocks" : "Blocks"}
          </Button>
          <Button variant="secondary" onClick={() => setInspectorOpen((open) => !open)}>
            <FileText size={16} />
            {inspectorOpen ? "Hide inspector" : "Inspector"}
          </Button>
          <Button variant="secondary" onClick={() => {
            setIssuesOpen(false);
            setSpecOpen((open) => !open);
          }}>
            <SquareTerminal size={16} />
            Spec
          </Button>
          <Button variant="secondary" onClick={runTestAndRefresh}>
            <Play size={16} />
            Test Run
          </Button>
          <Button variant="secondary" onClick={onValidate}>
            <ShieldCheck size={16} />
            Validate
          </Button>
          <Button onClick={onPublish}>
            <Rocket size={16} />
            Publish
          </Button>
        </div>
      </div>

      {workflowNotice ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-[#5147e8]">
          <span>{workflowNotice}</span>
          <button type="button" onClick={() => setWorkflowNotice("")} className="text-indigo-500 hover:text-indigo-700">
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div
        data-testid="workflow-builder-shell"
        className={shellGridClass}
      >
        {paletteOpen ? (
        <aside className="order-2 flex min-h-0 max-h-[520px] flex-col overflow-hidden border-r border-slate-200 bg-white xl:order-none xl:max-h-none">
          <div className="shrink-0 border-b border-slate-100 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                className="input h-9 pl-9"
                placeholder="Search blocks..."
                value={blockSearch}
                onChange={(event) => setBlockSearch(event.target.value)}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button"
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => onLoadTemplate("knowledge")}
              >
                Knowledge
              </button>
              <button type="button"
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => onLoadTemplate("approval")}
              >
                Approval
              </button>
            </div>
          </div>
          <div data-testid="workflow-block-palette" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 pr-3">
            {filteredGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-normal text-slate-500">{group.title}</div>
                <div className="space-y-2">
                  {group.items.map((block) => {
                    const Icon = blockIcons[block.id] ?? Workflow;

                    return (
                    <button type="button"
                      key={block.id}
                      onClick={() => onAddBlock(block.id)}
                      className="flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:border-[#c7d2fe] hover:bg-indigo-50"
                    >
                      <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${blockTone(block.tone)}`}>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block leading-5">{block.label}</span>
                        <span className="mt-0.5 block max-h-8 overflow-hidden text-[11px] font-normal leading-4 text-slate-500">
                          {block.description}
                        </span>
                      </span>
                    </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!filteredGroups.length ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                No blocks match this search.
              </div>
            ) : null}
          </div>
          <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-4">
            <button type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={copyWorkflowSpec}
            >
              <Copy size={15} />
              Copy spec
            </button>
            <button type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={downloadWorkflowSpec}
            >
              <Download size={15} />
              Download spec
            </button>
            <button type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              onClick={onClearWorkflow}
            >
              <Trash2 size={15} />
              Clear canvas
            </button>
          </div>
        </aside>
        ) : null}

        <section className="relative order-1 min-h-[620px] min-w-0 overflow-hidden bg-white xl:order-none xl:min-h-0">
          {builderTab === "Builder" ? (
            <>
          <div
            data-testid="workflow-editor-guidance"
            className="absolute left-5 right-5 top-4 z-20 rounded-xl border border-slate-200 bg-white/94 px-4 py-3 shadow-[0_12px_36px_rgba(15,23,42,0.10)] backdrop-blur"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={editorGuide.tone}>{nodes.length ? validationLabel : "starter path"}</Badge>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {nodes.length} blocks · {edges.length} connections
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{editorGuide.title}</div>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{editorGuide.body}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button className="h-9 px-3 text-sm" onClick={runEditorPrimaryAction}>
                  {isReady ? <Play size={15} /> : !nodes.length ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
                  {editorGuide.primary}
                </Button>
                <Button variant="secondary" className="h-9 px-3 text-sm" onClick={runEditorSecondaryAction}>
                  {editorGuide.secondary}
                </Button>
                {!paletteOpen ? (
                  <Button variant="secondary" className="h-9 px-3 text-sm" onClick={() => setPaletteOpen(true)}>
                    <Plus size={15} />
                    Blocks
                  </Button>
                ) : null}
                {!inspectorOpen ? (
                  <Button variant="secondary" className="h-9 px-3 text-sm" onClick={() => setInspectorOpen(true)}>
                    <FileText size={15} />
                    Inspector
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="absolute left-5 top-[214px] z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur lg:top-[142px]">
            {[
              { icon: Search, notice: "Block search is available in the palette", action: () => setPaletteOpen(true) },
              { icon: MessageCircleIcon, notice: "Reviewer comments will attach to selected blocks" },
              { icon: FileText, notice: "Workflow spec panel toggled", action: () => {
                setIssuesOpen(false);
                setSpecOpen((open) => !open);
              } },
              { icon: ShieldCheck, notice: formatWorkflowValidationSummary(validation), action: () => {
                setSpecOpen(false);
                setIssuesOpen(true);
              } },
              { icon: Save, notice: "Workflow persists automatically in the workspace snapshot" },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
              <button type="button"
                key={index}
                className="flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  item.action?.();
                  setWorkflowNotice(item.notice);
                }}
              >
                <Icon size={15} />
              </button>
              );
            })}
          </div>
          <div className="absolute right-5 top-[214px] z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-2 py-1 text-sm shadow-sm backdrop-blur lg:top-[142px]">
            <button type="button" className="px-2 text-lg leading-none" onClick={() => setWorkflowNotice("Zoomed blueprint canvas out")}>-</button>
            <span>100%</span>
            <button type="button" className="px-2 text-lg leading-none" onClick={() => setWorkflowNotice("Zoomed blueprint canvas in")}>+</button>
          </div>
          {specOpen ? (
            <div className="absolute left-5 right-5 top-[260px] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] lg:top-[190px]">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Executable WorkflowSpec</div>
                  <div className="text-xs text-slate-500">Versioned JSON compiled from the live canvas</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold" onClick={copyWorkflowSpec}>
                    Copy
                  </button>
                  <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setSpecOpen(false)}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <pre className="max-h-[280px] overflow-auto bg-slate-950 p-4 text-xs leading-5 text-slate-100">{specText}</pre>
            </div>
          ) : null}
          {issuesOpen ? (
            <div
              data-testid="workflow-issues-panel"
              className="absolute left-5 right-5 top-[260px] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] lg:top-[190px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Workflow release gates</div>
                  <div className="text-xs text-slate-500">
                    {workflowProblems.length ? "Fix these before test or publish." : "No blocking issues or warnings are currently detected."}
                  </div>
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => setIssuesOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[280px] overflow-auto p-4">
                {workflowProblems.length ? (
                  <div className="space-y-2">
                    {workflowProblems.map((issue, index) => (
                      <div key={`${issue.severity}-${issue.message}`} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                        <span className={`mt-1 size-2 shrink-0 rounded-full ${issue.severity === "error" ? "bg-red-500" : "bg-amber-500"}`} />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-950">
                            {issue.severity === "error" ? "Blocking issue" : "Warning"} {index + 1}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-600">{issue.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                    This workflow is structurally ready for a Harness test.
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <div className="h-[620px] xl:h-full">
            <ReactFlow
              nodes={visibleNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setInspectorOpen(true);
              }}
              onPaneClick={() => setSelectedNodeId("")}
              fitView
            >
              <Background color="#e2e8f0" gap={18} />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
            {!nodes.length ? (
              <div className="pointer-events-none absolute inset-x-6 top-[280px] z-10 rounded-lg border border-dashed border-slate-200 bg-white/92 p-6 text-center shadow-sm backdrop-blur sm:inset-x-12 lg:top-32">
                <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-[#5147e8]">
                  <Workflow size={22} />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-950">No blueprint blocks yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Add a trigger from the left panel, then connect action and control blocks to create an executable governed blueprint.
                </p>
              </div>
            ) : null}
          </div>
          <div
            data-testid="workflow-validation-strip"
            className="absolute bottom-5 left-5 right-5 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-slate-950">Workflow validation</div>
                <Badge tone={isReady ? "green" : "amber"}>{isReady ? "ready to test" : validationLabel}</Badge>
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                {nodes.length} blocks · {edges.length} connections · {validation.conditionCount} conditions
                {topWorkflowProblem ? ` · Next fix: ${topWorkflowProblem}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="secondary" className="h-9 px-3 text-sm" onClick={onValidate}>
                <ShieldCheck size={15} />
                Validate
              </Button>
              <Button
                className="h-9 px-3 text-sm"
                onClick={() => {
                  if (isReady) {
                    void runTestAndRefresh();
                    return;
                  }
                  setSpecOpen(false);
                  setIssuesOpen(true);
                  setWorkflowNotice(formatWorkflowValidationSummary(validation));
                }}
              >
                {isReady ? <Play size={15} /> : <AlertTriangle size={15} />}
                {isReady ? "Run test" : "Show issues"}
              </Button>
            </div>
          </div>
            </>
          ) : (
            <div className="h-full overflow-y-auto p-6">
              {builderTab === "Runs" ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <SectionTitle title="Workflow Runs" helper="Jobs persisted through the workflow job repository" />
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={refreshWorkflowJobs}>
                        <RefreshCcw size={16} />
                        Refresh
                      </Button>
                      <Button onClick={runTestAndRefresh}>
                        <Play size={16} />
                        Test Run
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Panel className="p-4">
                      <MiniMetric label="Recorded Jobs" value={String(workflowJobs.length)} />
                    </Panel>
                    <Panel className="p-4">
                      <MiniMetric label="Current Blocks" value={String(nodes.length)} />
                    </Panel>
                    <Panel className="p-4">
                      <MiniMetric label="Connections" value={String(edges.length)} />
                    </Panel>
                    <Panel className="p-4">
                      <MiniMetric label="Load State" value={jobLoadStatus} />
                    </Panel>
                  </div>
                  <Panel className="overflow-hidden">
                    <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-500">
                      <span>Job</span>
                      <span>Status</span>
                      <span>Workflow</span>
                      <span>Updated</span>
                    </div>
                    {workflowJobs.length ? (
                      workflowJobs.map((job) => (
                        <div key={job.id} className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                          <span className="font-mono text-xs font-semibold text-slate-800">{job.id}</span>
                          <span>
                            <Badge tone={jobTone(job.status)}>{job.status}</Badge>
                          </span>
                          <span className="truncate text-slate-600">{job.workflowId ?? "workflow-builder-current"}</span>
                          <span className="text-slate-500">{job.updatedAt ?? job.createdAt ?? "Not recorded"}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-10 text-center text-sm text-slate-500">
                        {jobLoadStatus === "error"
                          ? "Workflow jobs could not be loaded for this session."
                          : "No workflow jobs recorded yet. Run a test to enqueue the first job."}
                      </div>
                    )}
                  </Panel>
                </div>
              ) : null}

              {builderTab === "Versions" ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <SectionTitle title="Blueprint Versions" helper="Compiled spec and release readiness for the current execution blueprint" />
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={copyWorkflowSpec}>
                        <Copy size={16} />
                        Copy
                      </Button>
                      <Button variant="secondary" onClick={downloadWorkflowSpec}>
                        <Download size={16} />
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Panel className="p-4">
                      <MiniMetric label="Schema" value="workflow-spec.v1" />
                    </Panel>
                    <Panel className="p-4">
                      <MiniMetric label="Status" value={status} />
                    </Panel>
                    <Panel className="p-4">
                      <MiniMetric label="Publish Gate" value={isReady ? "ready" : "blocked"} />
                    </Panel>
                  </div>
                  <Panel className="overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                      <SectionTitle title="Current Spec" compact helper={`${nodes.length} blocks, ${edges.length} connections`} />
                      <Badge tone={isReady ? "green" : "amber"}>{validationLabel}</Badge>
                    </div>
                    <pre className="max-h-[520px] overflow-auto bg-slate-950 p-4 text-xs leading-5 text-slate-100">{specText}</pre>
                  </Panel>
                </div>
              ) : null}

              {builderTab === "Settings" ? (
                <div className="space-y-4">
                  <SectionTitle title="Workflow Settings" helper="Canvas operations, release gates, and governance checks" />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Panel className="p-5">
                      <SectionTitle title="Templates" compact helper="Replace the canvas with a governed starter workflow" />
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <Button variant="secondary" onClick={() => onLoadTemplate("knowledge")}>
                          <FileText size={16} />
                          Knowledge Flow
                        </Button>
                        <Button variant="secondary" onClick={() => onLoadTemplate("approval")}>
                          <ShieldCheck size={16} />
                          Approval Flow
                        </Button>
                      </div>
                    </Panel>
                    <Panel className="p-5">
                      <SectionTitle title="Release Gates" compact helper={validationLabel} />
                      <div className="mt-4 space-y-2 text-sm">
                        {[...validation.issues, ...validation.warnings].length ? (
                          [...validation.issues, ...validation.warnings].map((issue) => (
                            <div key={`${issue.severity}-${issue.message}`} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                              <span className={`mt-1 size-2 rounded-full ${issue.severity === "error" ? "bg-red-500" : "bg-amber-500"}`} />
                              <span>{issue.message}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg bg-green-50 px-3 py-2 text-green-700">All release gates pass for the current workflow.</div>
                        )}
                      </div>
                    </Panel>
                    <Panel className="p-5">
                      <SectionTitle title="Actions" compact helper="Validate, test, publish, or reset the current workflow" />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={onValidate}>
                          <ShieldCheck size={16} />
                          Validate
                        </Button>
                        <Button variant="secondary" onClick={runTestAndRefresh}>
                          <Play size={16} />
                          Test Run
                        </Button>
                        <Button onClick={onPublish}>
                          <Rocket size={16} />
                          Publish
                        </Button>
                        <Button variant="danger" onClick={onClearWorkflow}>
                          <Trash2 size={16} />
                          Clear
                        </Button>
                      </div>
                    </Panel>
                    <Panel className="p-5">
                      <SectionTitle title="Persistence" compact helper="Stored in browser workspace and exportable as workspace JSON" />
                      <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Workspace snapshot</span>
                          <Badge tone="green">automatic</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Workflow job repository</span>
                          <Badge tone={jobLoadStatus === "error" ? "red" : "blue"}>{jobLoadStatus}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Spec export</span>
                          <button type="button" className="font-semibold text-[#5147e8]" onClick={downloadWorkflowSpec}>Download JSON</button>
                        </div>
                      </div>
                    </Panel>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {inspectorOpen ? (
        <aside className="order-3 min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-5 xl:order-none">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Block Details" helper={selectedSubtitle} />
            <button type="button" className="text-slate-400" onClick={() => setInspectorOpen(false)}>
              <X size={16} />
            </button>
          </div>
          {selectedNode ? (
            <>
              <div className="mt-5 flex items-center gap-3">
                <div className={`flex size-11 items-center justify-center rounded-xl ${blockTone(String(selectedData.tone ?? selectedDefinition?.tone ?? "slate"))}`}>
                  <SelectedIcon size={22} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{selectedTitle}</div>
                  <div className="truncate text-xs text-slate-500">{selectedNode.id}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" className="h-8 px-2 text-xs" onClick={duplicateSelectedNode}>
                  <Copy size={14} />
                  Duplicate
                </Button>
                <Button variant="danger" className="h-8 px-2 text-xs" onClick={deleteSelectedNode}>
                  <Trash2 size={14} />
                  Delete
                </Button>
              </div>
              <div className="mt-5 flex gap-5 border-b border-slate-200">
                <button type="button"
                  className={`border-b-2 pb-3 text-sm font-semibold ${inspectorTab === "configuration" ? "border-[#635bff] text-[#5147e8]" : "border-transparent text-slate-500"}`}
                  onClick={() => setInspectorTab("configuration")}
                >
                  Configuration
                </button>
                <button type="button"
                  className={`border-b-2 pb-3 text-sm font-semibold ${inspectorTab === "advanced" ? "border-[#635bff] text-[#5147e8]" : "border-transparent text-slate-500"}`}
                  onClick={() => setInspectorTab("advanced")}
                >
                  Advanced
                </button>
              </div>

              {inspectorTab === "configuration" ? (
                <div className="mt-4 space-y-4">
                  <Field label="Block Type">
                    <select className="input" value={selectedBlockType} onChange={(event) => changeSelectedBlockType(event.target.value)}>
                      {workflowBlockCatalog.map((block) => (
                        <option key={block.id} value={block.id}>
                          {block.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Name">
                    <input className="input" value={String(selectedData.title ?? "")} onChange={(event) => updateSelectedNode({ title: event.target.value })} />
                  </Field>
                  <Field label="Subtitle">
                    <input className="input" value={String(selectedData.subtitle ?? "")} onChange={(event) => updateSelectedNode({ subtitle: event.target.value })} />
                  </Field>
                  <Field label="Description">
                    <textarea
                      className="input min-h-[72px] text-sm leading-5"
                      value={String(selectedData.description ?? "")}
                      onChange={(event) => updateSelectedNode({ description: event.target.value })}
                    />
                  </Field>
                  <div className="text-sm font-semibold">Model Configuration</div>
                  <Field label="Model Provider">
                    <select className="input" value={String(selectedData.provider ?? "local")} onChange={(event) => updateSelectedNode({ provider: event.target.value })}>
                      <option value="local">Local Runtime</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google Gemini</option>
                      <option value="azure_openai">Azure OpenAI</option>
                      <option value="kimi">Kimi</option>
                      <option value="glm">GLM</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </Field>
                  <Field label="Model">
                    <input
                      className="input"
                      value={String(selectedData.model ?? "")}
                      placeholder="Provider model id"
                      onChange={(event) => updateSelectedNode({ model: event.target.value })}
                    />
                  </Field>
                  <Field label="Temperature">
                    <div className="flex items-center gap-3">
                      <input
                        className="input w-20"
                        value={String(selectedData.temperature ?? 0)}
                        onChange={(event) => updateSelectedNode({ temperature: numberFromInput(event.target.value, 0.2) })}
                      />
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.1}
                        className="w-full accent-[#635bff]"
                        value={Number(selectedData.temperature ?? 0.2)}
                        onChange={(event) => updateSelectedNode({ temperature: numberFromInput(event.target.value, 0.2) })}
                      />
                    </div>
                  </Field>
                  <Field label="Max Tokens">
                    <input
                      className="input"
                      value={String(selectedData.maxTokens ?? "")}
                      onChange={(event) => updateSelectedNode({ maxTokens: Math.max(1, Math.round(numberFromInput(event.target.value, 4096))) })}
                    />
                  </Field>
                  <Field label="System Prompt">
                    <textarea
                      className="input min-h-[120px] font-mono text-xs leading-5"
                      value={String(selectedData.systemPrompt ?? "")}
                      placeholder="Add the system prompt or policy instruction for this workflow block."
                      onChange={(event) => updateSelectedNode({ systemPrompt: event.target.value })}
                    />
                  </Field>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">Connector Binding</div>
                      <button type="button" className="text-xs font-semibold text-[#5147e8]" onClick={onManageTools}>Manage Tools</button>
                    </div>
                    <select
                      className="input"
                      value={String(selectedData.toolId ?? "")}
                      onChange={(event) => updateSelectedNode({ toolId: event.target.value })}
                    >
                      <option value="">No connector bound</option>
                      {tools.map((tool) => (
                        <option key={tool.id} value={tool.id}>
                          {tool.id}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 rounded-lg border border-slate-200">
                      {(tools.length ? tools : []).slice(0, 6).map((tool) => (
                        <button type="button"
                          key={tool.id}
                          className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 ${
                            selectedData.toolId === tool.id ? "bg-indigo-50 text-[#5147e8]" : "text-slate-700"
                          }`}
                          onClick={() => updateSelectedNode({ toolId: tool.id })}
                        >
                          <span className="font-mono">{tool.id}</span>
                          <span className={`size-2 rounded-full ${tool.enabled ? "bg-green-600" : "bg-slate-300"}`} />
                        </button>
                      ))}
                      {!tools.length ? (
                        <div className="px-3 py-3 text-xs leading-5 text-slate-500">
                          No tools configured. Add connector policies in Admin before binding tools to workflow blocks.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 accent-[#635bff]"
                      checked={Boolean(selectedData.requiresApproval)}
                      onChange={(event) => updateSelectedNode({ requiresApproval: event.target.checked })}
                    />
                    <span>
                      <span className="block font-semibold text-slate-800">Require human approval</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">Pause execution before this block performs a governed action.</span>
                    </span>
                  </label>
                  <Field label="Approver Role">
                    <select className="input" value={String(selectedData.approvalRole ?? "")} onChange={(event) => updateSelectedNode({ approvalRole: event.target.value })}>
                      <option value="ai_enablement_director">AI Enablement Director</option>
                      <option value="governance_reviewer">Governance Reviewer</option>
                      <option value="security_reviewer">Security Reviewer</option>
                      <option value="legal_reviewer">Legal Reviewer</option>
                      <option value="privacy_reviewer">Privacy Reviewer</option>
                      <option value="function_leader">Function Leader</option>
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Timeout Sec.">
                      <input
                        className="input"
                        value={String(selectedData.timeoutSeconds ?? "")}
                        onChange={(event) => updateSelectedNode({ timeoutSeconds: Math.max(1, Math.round(numberFromInput(event.target.value, 120))) })}
                      />
                    </Field>
                    <Field label="Retries">
                      <input
                        className="input"
                        value={String(selectedData.retryCount ?? "")}
                        onChange={(event) => updateSelectedNode({ retryCount: Math.max(0, Math.round(numberFromInput(event.target.value, 1))) })}
                      />
                    </Field>
                  </div>
                  <Field label="Output Schema">
                    <input
                      className="input"
                      value={String(selectedData.outputSchema ?? "")}
                      placeholder="Schema or contract name"
                      onChange={(event) => updateSelectedNode({ outputSchema: event.target.value })}
                    />
                  </Field>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700">Selected Block JSON</div>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-white p-3 text-[11px] leading-5 text-slate-700">
                      {JSON.stringify(
                        {
                          id: selectedNode.id,
                          type: selectedData.blockType,
                          position: selectedNode.position,
                          config: selectedData,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-[#5147e8]">
                <Workflow size={20} />
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-900">No block selected</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">Add or select a block to configure runtime, policy, connector, and output settings.</div>
            </div>
          )}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <SectionTitle title="Test Output" compact />
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
              {output || "Run a workflow test after adding blocks to inspect the execution path, policy checks, and generated output."}
            </p>
          </div>
        </aside>
        ) : null}
      </div>
    </div>
  );
}

function WorkflowPlanPreview({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const previewNodes = nodes.slice(0, 6);

  return (
    <div className="px-5 py-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {previewNodes.map((node, index) => {
          const data = getWorkflowNodeData(node);
          const definition = getBlockDefinition(String(data.blockType ?? ""));
          const connectedOut = edges.some((edge) => edge.source === node.id);
          const connectedIn = edges.some((edge) => edge.target === node.id);
          const connected = index === 0 ? connectedOut || nodes.length === 1 : connectedIn;
          const Icon = definition
            ? {
                manual_trigger: Play,
                schedule_trigger: ClipboardCheck,
                retrieve_documents: FileText,
                extract_data: FileCheck2,
                llm_analysis: BrainCircuit,
                tool_call: SquareTerminal,
                transform_data: RefreshCcw,
                send_notification: Bell,
                condition: GitBranch,
                human_approval: UserRound,
                parallel_branch: Network,
                delay: Activity,
                end: Check,
              }[definition.id] ?? Workflow
            : Workflow;

          return (
            <div key={node.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex size-8 items-center justify-center rounded-lg ${blockTone(String(data.tone ?? definition?.tone ?? "slate"))}`}>
                  <Icon size={15} />
                </span>
                <Badge tone={connected ? "green" : "amber"}>{connected ? "connected" : "needs link"}</Badge>
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-950">{getWorkflowNodeTitle(node)}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{getWorkflowNodeSubtitle(node)}</div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{String(data.description ?? definition?.description ?? "Workflow block")}</p>
            </div>
          );
        })}
      </div>
      {nodes.length > previewNodes.length ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {nodes.length - previewNodes.length} more block{nodes.length - previewNodes.length === 1 ? "" : "s"} in the advanced canvas.
        </div>
      ) : null}
    </div>
  );
}

function WorkflowStarterCard({
  icon: Icon,
  title,
  description,
  blocks,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  blocks: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#5147e8]">
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-950">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#5147e8]">
          Load {blocks}-block pattern
          <ChevronRight size={13} />
        </span>
      </span>
    </button>
  );
}

function blockTone(tone: string) {
  const tones: Record<string, string> = {
    green: "bg-green-50 text-green-700",
    blue: "bg-sky-50 text-sky-700",
    purple: "bg-indigo-50 text-[#5147e8]",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return tones[tone] ?? tones.slate;
}

function blockColor(tone: string) {
  const colors: Record<string, string> = {
    green: "#16a34a",
    blue: "#2563eb",
    purple: "#7c3aed",
    amber: "#d97706",
    red: "#dc2626",
    slate: "#64748b",
  };
  return colors[tone] ?? colors.slate;
}
