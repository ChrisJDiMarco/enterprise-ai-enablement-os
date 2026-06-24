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
  Search,
  ShieldCheck,
  SquareTerminal,
  Trash2,
  UserRound,
  Workflow,
  X,
} from "lucide-react";
import { tools, type Skill } from "@/lib/enterprise-ai-data";
import { copyTextOrDownload, downloadTextFile, timestampedExportFilename } from "@/lib/ui/export-utils";
import { Badge, Button, EmptyState, Field, MiniMetric, Panel, SectionTitle, Tabs } from "@/components/ui";
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

const builderTabs: [string, string][] = [
  ["Builder", "Builder"],
  ["Runs", "Runs"],
  ["Versions", "Versions"],
  ["Settings", "Settings"],
];

const inspectorTabs: [string, string][] = [
  ["configuration", "Configuration"],
  ["advanced", "Advanced"],
];

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

export type WorkflowClearRequest = {
  title?: string;
  description?: string;
  detail?: string;
  confirmLabel?: string;
  notice?: string;
  testId?: string;
  onCleared?: () => void;
};

export function WorkflowBuilder({
  mode,
  setMode,
  skills,
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
  onOpenSkills,
  onManageTools,
  onPublish,
  output,
}: {
  mode: "overview" | "editor";
  setMode: (mode: "overview" | "editor") => void;
  skills: Skill[];
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
  onClearWorkflow: (request?: WorkflowClearRequest) => void;
  onOpenSkills: () => void;
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
  const runnableSkills = useMemo(
    () => skills.filter((skill) => !["archived", "deprecated"].includes(skill.status)),
    [skills],
  );
  const hasRunnableSkill = runnableSkills.length > 0;
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
    if (!hasRunnableSkill) {
      setWorkflowNotice("Create or select a governed AI Skill before running a workflow test.");
      onOpenSkills();
      return;
    }

    await onTest();
    window.setTimeout(() => {
      void refreshWorkflowJobs();
    }, 500);
  }

  function publishOrRequestSkill() {
    if (!hasRunnableSkill) {
      setWorkflowNotice("Create or select a governed AI Skill before publishing this workflow.");
      onOpenSkills();
      return;
    }

    onPublish();
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
  const graphReady = validation.valid && nodes.length > 0;
  const isReady = graphReady && hasRunnableSkill;
  const validationLabel = validation.issues.length
    ? `${validation.issues.length} blocking issue${validation.issues.length === 1 ? "" : "s"}`
    : graphReady && !hasRunnableSkill
      ? "Skill needed"
    : validation.warnings.length
      ? `${validation.warnings.length} warning${validation.warnings.length === 1 ? "" : "s"}`
      : nodes.length
        ? "Ready to test"
        : "Setup needed";
  const workflowReadiness = [
    {
      label: "Governed Skill",
      complete: hasRunnableSkill,
      helper: hasRunnableSkill
        ? `${runnableSkills.length} active Skill${runnableSkills.length === 1 ? "" : "s"} available`
        : "Create or select a Skill before testing",
    },
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
      complete: graphReady,
      helper: graphReady ? (hasRunnableSkill ? "Spec can be tested" : "Graph is ready; Skill binding is missing") : validationLabel,
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
    ? !hasRunnableSkill
      ? "Next: attach this workflow to an AI Skill"
      : isReady
      ? "Next: run the workflow test"
      : "Next: fix the workflow blockers"
    : hasRunnableSkill
      ? "Start with a workflow template"
      : "Create an AI Skill before building runtime";
  const nextWorkflowBody = workflowSummary
    ? !hasRunnableSkill
      ? "This graph is useful, but it needs a governed Skill before test or publish."
      : isReady
      ? "The execution plan has the required structure. Run a test job so the Harness can produce trace evidence before publish."
      : "This blueprint is useful, but it is not ready to run yet. Open the canvas or validate it to see the exact missing trigger, connection, prompt, tool, or approval."
    : hasRunnableSkill
      ? "Choose a governed starter flow for retrieval or approval-gated action. The OS will turn it into blocks, gates, and a runtime spec you can test."
      : "Start from AI Skills so the workflow inherits a business reason, owner, data boundary, tool policy, and evidence path.";
  const nextWorkflowAction = !hasRunnableSkill ? "Open AI Skills" : workflowSummary ? (isReady ? "Run test" : "Open canvas") : "Load approval flow";
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
    ? !hasRunnableSkill
      ? [
          ["1", "Create or select a Skill", "Give the workflow a governed capability, owner, prompt contract, context boundary, and tool policy."],
          ["2", "Bind execution to the Skill", "Keep the graph as the runtime path behind that Skill instead of a loose automation."],
          ["3", "Test after binding", "Run the Harness only after the Skill and workflow can produce one connected proof trail."],
        ]
      : isReady
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
        ["1", hasRunnableSkill ? "Choose a starter" : "Start in AI Skills", hasRunnableSkill ? "Use Knowledge for cited answers or Approval for risky tool actions." : "Create the governed capability before designing its execution path."],
        ["2", "Review the blocks", "The starter creates trigger, reasoning, approval, and output boundaries for you."],
        ["3", "Test before publish", "Run a Harness test only after a Skill and workflow are connected."],
      ];
  const workflowProblems = [
    ...(!hasRunnableSkill
      ? [
          {
            severity: "error" as const,
            message: "No active AI Skill is available. Create or select a governed Skill before test or publish.",
          },
        ]
      : []),
    ...validation.issues,
    ...validation.warnings,
  ];
  const topWorkflowProblem = workflowProblems[0]?.message ?? "";
  const workflowReleaseGateNotice = workflowProblems.length
    ? `Workflow release gates opened. ${workflowProblems.length} blocker${workflowProblems.length === 1 ? " remains" : "s remain"}. Next: ${topWorkflowProblem}`
    : "Workflow release gates are clear. No blocking issues or warnings are currently detected.";
  const editorGuide = !nodes.length
    ? {
        tone: "blue" as const,
        title: "Start with a governed workflow",
        body: "Load a starter so the OS creates the trigger, action path, approval gate, and end boundary for you. You can tune the blocks afterward.",
        primary: "Load approval flow",
        secondary: "Load knowledge flow",
      }
    : !hasRunnableSkill
      ? {
          tone: "amber" as const,
          title: "Attach a Skill before runtime",
          body: "The canvas can be edited, but tests and publish actions need a governed Skill so trace evidence has an owner, purpose, tool policy, and proof path.",
          primary: "Open AI Skills",
          secondary: "Validate graph",
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
    "grid min-h-[760px] gap-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.04)] xl:h-[calc(100svh-210px)] xl:min-h-[620px] xl:max-h-[920px]",
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
    if (!hasRunnableSkill) {
      setWorkflowNotice("Create or select a governed AI Skill before running workflow tests.");
      onOpenSkills();
      return;
    }
    if (isReady) {
      void runTestAndRefresh();
      return;
    }
    setSpecOpen(false);
    setIssuesOpen(true);
    setWorkflowNotice(workflowReleaseGateNotice);
  }

  function runEditorSecondaryAction() {
    if (!nodes.length) {
      onLoadTemplate("knowledge");
      setPaletteOpen(false);
      setInspectorOpen(true);
      setWorkflowNotice("Knowledge workflow starter loaded");
      return;
    }
    if (!hasRunnableSkill) {
      onValidate();
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
                onClearWorkflow({
                  title: "Start a new workflow?",
                  description: workflowSummary
                    ? "This clears the current execution blueprint and opens a blank canvas."
                    : "This opens a blank execution canvas for the next governed workflow.",
                  detail: workflowSummary
                    ? "Current blocks and connections will be removed from this browser workspace. Use export first if this version should be kept."
                    : "No existing workflow blocks will be removed because the canvas is already empty.",
                  confirmLabel: "Start New Workflow",
                  notice: "Blank execution blueprint ready",
                  testId: "new-workflow-confirmation",
                  onCleared: () => {
                    setBuilderTab("Builder");
                    setMode("editor");
                    setWorkflowNotice("Blank execution blueprint ready");
                  },
                });
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
                <Badge tone={isReady ? "green" : !hasRunnableSkill ? "amber" : workflowSummary ? "amber" : "blue"}>
                  {workflowSummary ? validationLabel : hasRunnableSkill ? "start here" : "skill needed"}
                </Badge>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)] tabular-nums">
                  {nodes.length} blocks · {edges.length} connections · {status}
                </span>
              </div>
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">{nextWorkflowTitle}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">{nextWorkflowBody}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => {
                  if (!hasRunnableSkill) {
                    onOpenSkills();
                    return;
                  }
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

              <div className="mt-5 rounded-xl border border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[var(--text)]">
                    {isReady ? "What the test will do" : !hasRunnableSkill ? "How to make this runnable" : workflowSummary ? "How to make this runnable" : "How to start safely"}
                  </div>
                  <Badge tone={isReady ? "green" : !hasRunnableSkill ? "amber" : workflowSummary ? "amber" : "blue"}>
                    {isReady ? "safe test path" : !hasRunnableSkill ? "skill prerequisite" : workflowSummary ? "fix path" : "starter path"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {workflowNextGuide.map(([step, title, body]) => (
                    <div key={title} className="rounded-lg bg-[var(--surface)] px-3 py-3 ring-1 ring-[var(--border)]/70">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">
                          {step}
                        </span>
                        <span className="text-sm font-semibold text-[var(--text)]">{title}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-4">
                {workflowReadiness.map((item, index) => (
                  <div key={item.label} className="border-l border-[var(--border)] pl-4">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${item.complete ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[color-mix(in_srgb,var(--success)_28%,var(--border))]" : "bg-[var(--surface-muted)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"}`}>
                        {item.complete ? <Check size={14} /> : index + 1}
                      </span>
                      <div className="font-semibold text-[var(--text)]">{item.label}</div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-5 xl:border-l xl:border-t-0">
              <SectionTitle title="Workflow health" helper="What this execution plan can prove" compact />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {workflowHealth.map(([label, value]) => (
                  <MiniMetric key={label} label={label} value={value} />
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <ShieldCheck size={16} className={isReady ? "text-[var(--success)]" : "text-[var(--warning)]"} />
                  {isReady ? "Ready for a Harness test" : "Not ready to run yet"}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {isReady
                    ? "The graph has the required entry point, output boundary, connections, and policy-ready spec."
                    : !hasRunnableSkill
                      ? "Create or select a governed Skill before the workflow can run, publish, or produce a meaningful proof trail."
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
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
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
              <div className="divide-y divide-[var(--border)]">
                <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_150px_150px] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                        <Workflow size={21} />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-[var(--text)]">{workflowSummary.name}</div>
                        <div className="mt-1 text-sm text-[var(--text-muted)]">{workflowSummary.description}</div>
                      </div>
                    </div>
                  </div>
                  <MiniMetric label="Status" value={workflowSummary.status} />
                  <MiniMetric label="Graph" value={`${workflowSummary.blocks} blocks`} />
                </div>
                <WorkflowPlanPreview nodes={nodes} edges={edges} />
                <div className="flex flex-wrap justify-end gap-2 bg-[var(--surface-muted)] px-5 py-4">
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
            <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-[var(--primary-soft)]/60 p-4 text-sm leading-6 text-[var(--text-muted)]">
              <div className="font-semibold text-[var(--text)]">Where this fits</div>
              <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                Process Redesign defines the human handoff. AI Skills owns the capability. Workflow Builder defines the governed execution path the Harness can run, trace, evaluate, and prove.
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {lifecycleSteps.map(([step, title, body]) => (
                <div key={step} className="flex gap-3 rounded-xl border border-[var(--border)] px-3 py-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)]">{step}</span>
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text)]">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{body}</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <details className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="font-semibold text-[var(--text)]">Templates, readiness details, and Harness contract</div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">Open for starter flows, full readiness gates, runtime spec details, and connector policy management.</div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)]" />
          </summary>
          <div className="grid gap-4 border-t border-[var(--border)] p-5 xl:grid-cols-3">
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
                  <div key={item.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-6 items-center justify-center rounded-full ${item.complete ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"}`}>
                        {item.complete ? <Check size={14} /> : <AlertTriangle size={14} />}
                      </span>
                      <span className="text-sm font-semibold text-[var(--text)]">{item.label}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle title="Harness contract" helper="What Workflow Builder compiles for runtime" compact />
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-muted)]">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <div className="font-semibold text-[var(--text)]">Executable spec</div>
                  <div className="mt-1 text-xs">Every block exports runtime config, model route, prompt contract, connector binding, approval policy, retry policy, timeout, and output schema.</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <div className="font-semibold text-[var(--text)]">Evidence chain</div>
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
	          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
	            <button
	              type="button"
	              data-testid="workflow-overview-breadcrumb"
	              title="Back to Workflow Builder overview"
	              onClick={() => setMode("overview")}
	              className="-mx-2 flex min-h-8 items-center rounded-md px-2 font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
	            >
	              Workflow Builder
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
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Build the execution path behind a Skill. Keep the canvas focused, then open blocks, configuration, runs, and specs only when you need them.
          </p>
          <div className="mt-5" data-testid="workflow-builder-tabs">
            <Tabs
              tabs={builderTabs}
              active={builderTab}
              onChange={(tab) => openBuilderTab(tab as "Builder" | "Runs" | "Versions" | "Settings")}
              ariaLabel="Workflow builder sections"
              idBase="workflow-builder"
              panelId={(id) => `workflow-builder-panel-${id.toLowerCase()}`}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Check size={15} className="text-[var(--success)]" />
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
          <Button onClick={publishOrRequestSkill}>
            <Rocket size={16} />
            Publish
          </Button>
        </div>
      </div>

      {workflowNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-center justify-between rounded-xl border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-[var(--primary-soft)] px-4 py-3 text-sm font-medium text-[var(--primary)]"
          data-testid="workflow-builder-notice"
        >
          <span>{workflowNotice}</span>
          <button
            type="button"
            aria-label="Dismiss workflow notice"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--primary)] hover:bg-[var(--surface)]/70 hover:text-[var(--primary-strong)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
            onClick={() => setWorkflowNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div
        data-testid="workflow-builder-shell"
        className={shellGridClass}
      >
        {paletteOpen ? (
        <aside className="order-2 flex min-h-0 max-h-[520px] flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] xl:order-none xl:max-h-none">
          <div className="shrink-0 border-b border-[var(--border)] p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={15} />
              <input
                className="input h-9 !pl-9"
                aria-label="Search workflow blocks"
                placeholder="Search blocks..."
                value={blockSearch}
                onChange={(event) => setBlockSearch(event.target.value)}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                onClick={() => onLoadTemplate("knowledge")}
              >
                Knowledge
              </button>
              <button type="button"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                onClick={() => onLoadTemplate("approval")}
              >
                Approval
              </button>
            </div>
          </div>
          <div data-testid="workflow-block-palette" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 pr-3">
            {filteredGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-normal text-[var(--text-muted)]">{group.title}</div>
                <div className="space-y-2">
                  {group.items.map((block) => {
                    const Icon = blockIcons[block.id] ?? Workflow;

                    return (
                    <button type="button"
                      key={block.id}
                      onClick={() => onAddBlock(block.id)}
                      className="flex w-full items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm font-medium text-[var(--text-muted)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary-soft)]"
                    >
                      <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${blockTone(block.tone)}`}>
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block leading-5">{block.label}</span>
                        <span className="mt-0.5 block max-h-8 overflow-hidden text-[11px] font-normal leading-4 text-[var(--text-muted)]">
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
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-muted)]">
                No blocks match this search.
              </div>
            ) : null}
          </div>
          <div className="shrink-0 space-y-2 border-t border-[var(--border)] bg-[var(--surface)] p-4">
            <button type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              onClick={copyWorkflowSpec}
            >
              <Copy size={15} />
              Copy spec
            </button>
            <button type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              onClick={downloadWorkflowSpec}
            >
              <Download size={15} />
              Download spec
            </button>
            <button type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              onClick={() => onClearWorkflow({ testId: "clear-workflow-confirmation" })}
            >
              <Trash2 size={15} />
              Clear canvas
            </button>
          </div>
        </aside>
        ) : null}

        <section
          id={`workflow-builder-panel-${builderTab.toLowerCase()}`}
          role="tabpanel"
          aria-labelledby={`workflow-builder-${builderTab}-tab`}
          data-testid={`workflow-builder-panel-${builderTab.toLowerCase()}`}
          className="relative order-1 min-h-[620px] min-w-0 overflow-hidden bg-[var(--surface)] xl:order-none xl:min-h-0"
        >
          {builderTab === "Builder" ? (
            <>
          <div
            data-testid="workflow-editor-guidance"
            className="relative z-20 m-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]/94 px-4 py-3 shadow-[0_12px_36px_rgba(15,23,42,0.10)] backdrop-blur"
          >
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={editorGuide.tone}>{nodes.length ? validationLabel : "starter path"}</Badge>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)] tabular-nums">
                    {nodes.length} blocks · {edges.length} connections
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--text)]">{editorGuide.title}</div>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--text-muted)]">{editorGuide.body}</p>
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
          <div className="relative z-10 mx-5 mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 p-1 shadow-sm backdrop-blur">
              {[
                { icon: Search, label: "Show block palette", notice: "Block search is available in the palette", action: () => setPaletteOpen(true) },
                { icon: FileText, label: "Toggle workflow spec panel", notice: "Workflow spec panel toggled", action: () => {
                  setIssuesOpen(false);
                  setSpecOpen((open) => !open);
                } },
                { icon: ShieldCheck, label: "Show workflow release gates", notice: workflowReleaseGateNotice, action: () => {
                  setSpecOpen(false);
                  setIssuesOpen(true);
                } },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                <button type="button"
                  key={index}
                  aria-label={item.label}
                  title={item.label}
                  className="flex size-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
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
          </div>
          {specOpen ? (
            <div className="absolute inset-x-5 bottom-5 z-20 flex max-h-[60%] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">Executable WorkflowSpec</div>
                  <div className="text-xs text-[var(--text-muted)]">Versioned JSON compiled from the live canvas</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="whitespace-nowrap rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-semibold"
                    onClick={() => {
                      setSpecOpen(false);
                      setIssuesOpen(true);
                      setWorkflowNotice(workflowReleaseGateNotice);
                    }}
                  >
                    Release gates
                  </button>
                  <button type="button" className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-semibold" onClick={copyWorkflowSpec}>
                    Copy
                  </button>
                  <button
                    type="button"
                    aria-label="Close workflow spec panel"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                    onClick={() => setSpecOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto bg-slate-950 p-4 text-xs leading-5 text-slate-100">{specText}</pre>
            </div>
          ) : null}
          {issuesOpen ? (
            <div
              data-testid="workflow-issues-panel"
              className="absolute inset-x-5 bottom-5 z-20 flex max-h-[60%] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">Workflow release gates</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {workflowProblems.length ? "Fix these before test or publish." : "No blocking issues or warnings are currently detected."}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close workflow release gates panel"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={() => setIssuesOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                {workflowProblems.length ? (
                  <div className="space-y-2">
                    {workflowProblems.map((issue, index) => (
                      <div key={`${issue.severity}-${issue.message}`} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm">
                        <span className={`mt-1 size-2 shrink-0 rounded-full ${issue.severity === "error" ? "bg-[var(--danger)]" : "bg-[var(--warning)]"}`} />
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--text)]">
                            {issue.severity === "error" ? "Blocking issue" : "Warning"} {index + 1}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{issue.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]">
                    This workflow is structurally ready for a Harness test.
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <div
            data-testid="workflow-validation-strip"
            className="relative z-10 mx-5 mb-3 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] backdrop-blur 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:px-5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-[var(--text)]">Workflow validation</div>
                <Badge tone={isReady ? "green" : "amber"}>{isReady ? "ready to test" : validationLabel}</Badge>
              </div>
              <div className="mt-1 text-xs leading-5 text-[var(--text-muted)] tabular-nums">
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
                  setWorkflowNotice(workflowReleaseGateNotice);
                }}
              >
                {isReady ? <Play size={15} /> : <AlertTriangle size={15} />}
                {isReady ? "Run test" : "Show issues"}
              </Button>
            </div>
          </div>
          <div className="relative h-[620px] xl:h-full">
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
              <div className="pointer-events-none absolute inset-x-6 top-[280px] z-10 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/92 p-6 text-center shadow-sm backdrop-blur sm:inset-x-12 lg:top-32">
                <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Workflow size={22} />
                </div>
                <h2 className="mt-4 text-base font-semibold text-[var(--text)]">No blueprint blocks yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
                  Add a trigger from the left panel, then connect action and control blocks to create an executable governed blueprint.
                </p>
              </div>
            ) : null}
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
                    <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr] border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs font-bold uppercase text-[var(--text-muted)]">
                      <span>Job</span>
                      <span>Status</span>
                      <span>Workflow</span>
                      <span>Updated</span>
                    </div>
                    {workflowJobs.length ? (
                      workflowJobs.map((job) => (
                        <div key={job.id} className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr] items-center border-b border-[var(--border)] px-4 py-3 text-sm last:border-b-0">
                          <span className="font-mono text-xs font-semibold text-[var(--text)]">{job.id}</span>
                          <span>
                            <Badge tone={jobTone(job.status)}>{job.status}</Badge>
                          </span>
                          <span className="truncate text-[var(--text-muted)]">{job.workflowId ?? "workflow-builder-current"}</span>
                          <span className="text-[var(--text-muted)]">{job.updatedAt ?? job.createdAt ?? "Not recorded"}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
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
                    <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
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
                        {workflowProblems.length ? (
                          workflowProblems.map((issue) => (
                            <div key={`${issue.severity}-${issue.message}`} className="flex items-start gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                              <span className={`mt-1 size-2 rounded-full ${issue.severity === "error" ? "bg-[var(--danger)]" : "bg-[var(--warning)]"}`} />
                              <span>{issue.message}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg bg-[var(--success-soft)] px-3 py-2 text-[var(--success)]">All release gates pass for the current workflow.</div>
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
                        <Button onClick={publishOrRequestSkill}>
                          <Rocket size={16} />
                          Publish
                        </Button>
                        <Button variant="danger" onClick={() => onClearWorkflow({ testId: "clear-workflow-confirmation" })}>
                          <Trash2 size={16} />
                          Clear
                        </Button>
                      </div>
                    </Panel>
                    <Panel className="p-5">
                      <SectionTitle title="Persistence" compact helper="Stored in browser workspace and exportable as workspace JSON" />
                      <div className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
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
                          <button
                            type="button"
                            className="-mx-1.5 inline-flex min-h-8 items-center rounded-md px-1.5 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                            onClick={downloadWorkflowSpec}
                          >
                            Download JSON
                          </button>
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
        <aside className="order-3 min-h-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 xl:order-none">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle title="Block Details" helper={selectedSubtitle} />
            <button
              type="button"
              aria-label="Close block inspector"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
              onClick={() => setInspectorOpen(false)}
            >
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
                  <div className="truncate text-xs text-[var(--text-muted)]">{selectedNode.id}</div>
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
              <div className="mt-5" data-testid="workflow-inspector-tabs">
                <Tabs
                  tabs={inspectorTabs}
                  active={inspectorTab}
                  onChange={(tab) => setInspectorTab(tab as "configuration" | "advanced")}
                  ariaLabel="Block inspector sections"
                  idBase="workflow-inspector"
                  panelId={(id) => `workflow-inspector-panel-${id}`}
                />
              </div>

              {inspectorTab === "configuration" ? (
                <div
                  id="workflow-inspector-panel-configuration"
                  role="tabpanel"
                  aria-labelledby="workflow-inspector-configuration-tab"
                  data-testid="workflow-inspector-panel-configuration"
                  className="mt-4 space-y-4"
                >
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
                        className="w-full accent-[var(--primary)]"
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
                      <div className="text-xs font-semibold text-[var(--text-muted)]">Connector Binding</div>
                      <button
                        type="button"
                        className="-mx-1.5 inline-flex min-h-8 items-center rounded-md px-1.5 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                        onClick={onManageTools}
                      >
                        Manage Tools
                      </button>
                    </div>
                    <select
                      className="input"
                      aria-label="Connector binding"
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
                    <div className="mt-2 rounded-lg border border-[var(--border)]">
                      {(tools.length ? tools : []).slice(0, 6).map((tool) => (
                        <button type="button"
                          key={tool.id}
                          className={`flex w-full items-center justify-between border-b border-[var(--border)] px-3 py-2 text-left text-xs last:border-0 ${
                            selectedData.toolId === tool.id ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--text-muted)]"
                          }`}
                          onClick={() => updateSelectedNode({ toolId: tool.id })}
                        >
                          <span className="font-mono">{tool.id}</span>
                          <span className={`size-2 rounded-full ${tool.enabled ? "bg-[var(--success)]" : "bg-[var(--border-strong)]"}`} />
                        </button>
                      ))}
                      {!tools.length ? (
                        <div className="px-3 py-3 text-xs leading-5 text-[var(--text-muted)]">
                          No tools configured. Add connector policies in Admin before binding tools to workflow blocks.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  id="workflow-inspector-panel-advanced"
                  role="tabpanel"
                  aria-labelledby="workflow-inspector-advanced-tab"
                  data-testid="workflow-inspector-panel-advanced"
                  className="mt-4 space-y-4"
                >
                  <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 accent-[var(--primary)]"
                      checked={Boolean(selectedData.requiresApproval)}
                      onChange={(event) => updateSelectedNode({ requiresApproval: event.target.checked })}
                    />
                    <span>
                      <span className="block font-semibold text-[var(--text)]">Require human approval</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">Pause execution before this block performs a governed action.</span>
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
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                    <div className="text-xs font-semibold text-[var(--text-muted)]">Selected Block JSON</div>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-[var(--surface)] p-3 text-[11px] leading-5 text-[var(--text-muted)]">
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
            <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-5 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <Workflow size={20} />
              </div>
              <div className="mt-3 text-sm font-semibold text-[var(--text)]">No block selected</div>
              <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Add or select a block to configure runtime, policy, connector, and output settings.</div>
            </div>
          )}
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <SectionTitle title="Test Output" compact />
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--text-muted)]">
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
            <div key={node.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex size-8 items-center justify-center rounded-lg ${blockTone(String(data.tone ?? definition?.tone ?? "slate"))}`}>
                  <Icon size={15} />
                </span>
                <Badge tone={connected ? "green" : "amber"}>{connected ? "connected" : "needs link"}</Badge>
              </div>
              <div className="mt-3 text-sm font-semibold text-[var(--text)]">{getWorkflowNodeTitle(node)}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">{getWorkflowNodeSubtitle(node)}</div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{String(data.description ?? definition?.description ?? "Workflow block")}</p>
            </div>
          );
        })}
      </div>
      {nodes.length > previewNodes.length ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">
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
      aria-label={`Load workflow starter template: ${title}`}
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--text)]">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{description}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
          Load {blocks}-block pattern
          <ChevronRight size={13} />
        </span>
      </span>
    </button>
  );
}

function blockTone(tone: string) {
  const tones: Record<string, string> = {
    green: "bg-[var(--success-soft)] text-[var(--success)]",
    blue: "bg-[var(--info-soft)] text-[var(--info)]",
    purple: "bg-[var(--primary-soft)] text-[var(--primary)]",
    amber: "bg-[var(--warning-soft)] text-[var(--warning)]",
    red: "bg-[var(--danger-soft)] text-[var(--danger)]",
    slate: "bg-[var(--surface-subtle)] text-[var(--text-muted)]",
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
