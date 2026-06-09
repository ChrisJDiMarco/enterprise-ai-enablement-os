import type { HarnessMode, View } from "@/lib/ui/types";

export type WorkspaceUrlState = {
  view?: View;
  factoryTab?: string;
  skillMode?: "overview" | "detail";
  skillTab?: string;
  harnessMode?: HarnessMode;
  workflowMode?: "overview" | "editor";
  useCaseId?: string;
  skillId?: string;
  runId?: string;
};

type SkillUrlMode = NonNullable<WorkspaceUrlState["skillMode"]>;
type WorkflowUrlMode = NonNullable<WorkspaceUrlState["workflowMode"]>;

const urlStateKeys = [
  "view",
  "factoryTab",
  "skillMode",
  "skillTab",
  "harnessMode",
  "workflowMode",
  "useCaseId",
  "skillId",
  "runId",
];

const views = new Set<View>([
  "command",
  "blueprint",
  "strategy",
  "process",
  "work",
  "factory",
  "harness",
  "skills",
  "workflow",
  "broker",
  "context",
  "evals",
  "governance",
  "launch",
  "roi",
  "training",
  "reports",
  "admin",
  "evidence",
  "orchestrator",
  "estate",
  "connectors",
  "session",
]);

const factoryTabs = new Set(["overview", "intake", "backlog", "scoring", "detail", "pilot", "value"]);
const skillModes = new Set<SkillUrlMode>(["overview", "detail"]);
const skillTabs = new Set([
  "overview",
  "configuration",
  "prompt",
  "tools",
  "context",
  "evals",
  "runs",
  "metrics",
  "skillspec",
  "versions",
]);
const harnessModes = new Set<HarnessMode>(["overview", "runs", "detail"]);
const workflowModes = new Set<WorkflowUrlMode>(["overview", "editor"]);
const factoryRecordTabs = new Set(["detail", "pilot", "value"]);

function readEnum<T extends string>(params: URLSearchParams, key: string, allowed: Set<T>): T | undefined {
  const value = params.get(key);
  if (!value || !allowed.has(value as T)) return undefined;
  return value as T;
}

function readRecordId(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();
  if (!value || value.length > 140 || !/^[a-zA-Z0-9._:-]+$/.test(value)) return undefined;
  return value;
}

export function parseWorkspaceUrlState(search: string): WorkspaceUrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    view: readEnum(params, "view", views),
    factoryTab: readEnum(params, "factoryTab", factoryTabs),
    skillMode: readEnum(params, "skillMode", skillModes),
    skillTab: readEnum(params, "skillTab", skillTabs),
    harnessMode: readEnum(params, "harnessMode", harnessModes),
    workflowMode: readEnum(params, "workflowMode", workflowModes),
    useCaseId: readRecordId(params, "useCaseId"),
    skillId: readRecordId(params, "skillId"),
    runId: readRecordId(params, "runId"),
  };
}

export function buildWorkspaceUrlState(params: {
  view: View;
  factoryTab: string;
  skillMode: "overview" | "detail";
  skillTab: string;
  harnessMode: HarnessMode;
  workflowMode: "overview" | "editor";
  selectedUseCaseId: string;
  selectedSkillId: string;
  selectedRunId: string;
}): WorkspaceUrlState {
  const state: WorkspaceUrlState = { view: params.view };

  if (params.view === "factory") {
    state.factoryTab = factoryTabs.has(params.factoryTab) ? params.factoryTab : "overview";
    if (factoryRecordTabs.has(state.factoryTab) && params.selectedUseCaseId) state.useCaseId = params.selectedUseCaseId;
  }

  if (params.view === "skills") {
    state.skillMode = params.skillMode;
    if (params.skillMode === "detail") {
      state.skillTab = skillTabs.has(params.skillTab) ? params.skillTab : "overview";
      if (params.selectedSkillId) state.skillId = params.selectedSkillId;
    }
  }

  if (params.view === "session" || params.view === "evals") {
    state.skillMode = "detail";
    state.skillTab = skillTabs.has(params.skillTab) ? params.skillTab : "overview";
    if (params.selectedSkillId) state.skillId = params.selectedSkillId;
  }

  if (params.view === "harness") {
    state.harnessMode = params.harnessMode;
    if (params.harnessMode === "detail" && params.selectedRunId) state.runId = params.selectedRunId;
  }

  if (params.view === "broker" && params.selectedRunId) {
    state.runId = params.selectedRunId;
  }

  if (params.view === "workflow") {
    state.workflowMode = params.workflowMode;
  }

  return state;
}

export function serializeWorkspaceUrlState(state: WorkspaceUrlState, currentSearch = "") {
  const params = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch);
  urlStateKeys.forEach((key) => params.delete(key));

  if (state.view) params.set("view", state.view);
  if (state.factoryTab) params.set("factoryTab", state.factoryTab);
  if (state.skillMode) params.set("skillMode", state.skillMode);
  if (state.skillTab) params.set("skillTab", state.skillTab);
  if (state.harnessMode) params.set("harnessMode", state.harnessMode);
  if (state.workflowMode) params.set("workflowMode", state.workflowMode);
  if (state.useCaseId) params.set("useCaseId", state.useCaseId);
  if (state.skillId) params.set("skillId", state.skillId);
  if (state.runId) params.set("runId", state.runId);

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
