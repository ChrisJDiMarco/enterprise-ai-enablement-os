import { useState } from "react";
import {
  Boxes,
  Check,
  ChevronRight,
  FileText,
  Library,
  Play,
  Plus,
  Search,
  ShieldCheck,
  TestTube2,
} from "lucide-react";
import {
  contextSources as platformContextSources,
  formatCurrency,
  getUserName,
  tools,
  type EvalResult,
  type GovernanceReview,
  type RiskLevel,
  type Run,
  type Skill,
  type UseCase,
} from "@/lib/enterprise-ai-data";
import { buildPatternInstallPlan, derivePatternMarketplace, type PatternMarketplaceItem } from "@/lib/pattern-marketplace";
import { buildSkillPromptContract, evaluatePromptQuality } from "@/lib/prompt-contracts";
import { providerLabel } from "@/lib/model-router";
import { openClawIntegration, openClawStatusTone } from "@/lib/openclaw-integration";
import { autonomyLabels, statusLabels } from "@/lib/ui/constants";
import { copyTextOrDownload, timestampedExportFilename } from "@/lib/ui/export-utils";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  MiniMetric,
  Panel,
  Provenance,
  riskTone,
  SectionTitle,
  statusTone,
  Tabs,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";

export function SkillsLibrary({
  skills,
  runs,
  selectedSkill,
  setSelectedSkillId,
  mode,
  setMode,
  skillTab,
  setSkillTab,
  onPromptChange,
  onToggleTool,
  onRunTest,
  onRunEval,
  onSubmitGovernance,
  onCreateFromUseCase,
  useCases,
  evalResults,
  governanceReviews,
  onInstallPattern,
  onSkillUpdate,
}: {
  skills: Skill[];
  runs: Run[];
  selectedSkill: Skill | null;
  setSelectedSkillId: (id: string) => void;
  mode: "overview" | "detail";
  setMode: (mode: "overview" | "detail") => void;
  skillTab: string;
  setSkillTab: (tab: string) => void;
  onPromptChange: (value: string) => void;
  onSkillUpdate: (skillId: string, patch: Partial<Skill> | ((skill: Skill) => Skill)) => void;
  onToggleTool: (toolId: string) => void;
  onRunTest: (skill?: Skill) => void;
  onRunEval: (skill?: Skill) => void;
  onSubmitGovernance: (skill?: Skill) => void;
  onCreateFromUseCase: () => void;
  useCases: UseCase[];
  evalResults: EvalResult[];
  governanceReviews: GovernanceReview[];
  onInstallPattern: (pattern: PatternMarketplaceItem) => void;
}) {
  const [notice, setNotice] = useState("");
  const [contextQuery, setContextQuery] = useState("Which approved sources should ground this Skill?");
  const [contextPreview, setContextPreview] = useState("");
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [showAllTopSkills, setShowAllTopSkills] = useState(false);
  const selectedSkillRuns = selectedSkill ? runs.filter((run) => run.skillId === selectedSkill.id) : [];
  const selectedEvalResults = selectedSkill ? evalResults.filter((result) => result.skillId === selectedSkill.id) : [];
  const selectedPromptQuality = selectedSkill ? evaluatePromptQuality(selectedSkill) : null;
  const selectedPromptContract = selectedSkill ? buildSkillPromptContract(selectedSkill) : null;

  function copySkillSpec() {
    if (!selectedSkill) return;
    const yaml = buildSkillSpec(selectedSkill);
    void copyTextOrDownload({
      contents: yaml,
      copiedMessage: "SkillSpec YAML copied to clipboard.",
      fallbackFilename: timestampedExportFilename(`${selectedSkill.slug || selectedSkill.name} skillspec`, "yaml"),
      fallbackMimeType: "application/yaml;charset=utf-8",
      downloadedMessage: "Clipboard permission blocked. SkillSpec YAML downloaded instead.",
    }).then((result) => setNotice(result.message));
  }


  function handleToggleTool(toolId: string) {
    onToggleTool(toolId);
    setNotice(`Tool policy updated for ${toolId}. The change is saved into the Skill contract and will be evaluated by the Harness before runtime use.`);
  }

  function patchSelectedSkill(patch: Partial<Skill> | ((skill: Skill) => Skill), message: string) {
    if (!selectedSkill) return;
    onSkillUpdate(selectedSkill.id, patch);
    setNotice(message);
  }

  function setSkillToolBlocked(toolId: string) {
    patchSelectedSkill((skill) => {
      const blocked = skill.blockedTools.includes(toolId);
      return {
        ...skill,
        blockedTools: blocked ? skill.blockedTools.filter((item) => item !== toolId) : [...skill.blockedTools, toolId],
        allowedTools: blocked ? skill.allowedTools : skill.allowedTools.filter((item) => item !== toolId),
      };
    }, `Explicit block policy updated for ${toolId}.`);
  }

  function addContextSourceToSkill(sourceId: string) {
    patchSelectedSkill((skill) => ({
      ...skill,
      contextSources: skill.contextSources.includes(sourceId) ? skill.contextSources : [...skill.contextSources, sourceId],
    }), `Context source ${sourceId} attached to the Skill contract.`);
  }

  function removeContextSourceFromSkill(sourceId: string) {
    patchSelectedSkill((skill) => ({
      ...skill,
      contextSources: skill.contextSources.filter((item) => item !== sourceId),
    }), `Context source ${sourceId} removed from the Skill contract.`);
  }

  async function runContextSimulation() {
    if (!selectedSkill) return;
    const attachedSources = platformContextSources.filter((source) => selectedSkill.contextSources.includes(source.id));
    const sensitiveCount = attachedSources.filter((source) =>
      ["confidential", "restricted", "regulated"].includes(source.classification),
    ).length;

    if (!attachedSources.length) {
      setContextPreview(
        `No context source is attached to ${selectedSkill.name}. Add at least one approved source before launch so the Harness can ground answers and produce citations.`,
      );
      return;
    }

    // Honest static summary used when a live, indexed server workspace isn't reachable.
    const staticSummary = `Static policy check (live retrieval needs an indexed server workspace): ${attachedSources.length} approved source${attachedSources.length === 1 ? "" : "s"} attached. ${sensitiveCount ? `${sensitiveCount} sensitive source${sensitiveCount === 1 ? "" : "s"} require redaction + audit evidence.` : "No restricted source exposure detected."}`;

    setContextPreview(`Running permission simulation for "${contextQuery || selectedSkill.name}"...`);
    try {
      const response = await fetch("/api/context/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: selectedSkill.id,
          query: contextQuery || selectedSkill.name,
          sources: selectedSkill.contextSources,
          limit: 5,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; results?: { sourceName: string; snippet: string }[]; sourcePolicy?: { resolvedSourceCount?: number; missingSourceIds?: string[] } }
        | null;
      if (!response.ok || !payload) {
        setContextPreview(staticSummary);
        return;
      }
      const results = payload.results ?? [];
      const resolved = payload.sourcePolicy?.resolvedSourceCount ?? attachedSources.length;
      const missing = payload.sourcePolicy?.missingSourceIds ?? [];
      if (!results.length) {
        setContextPreview(
          `No grounded passages retrieved for "${contextQuery || selectedSkill.name}" from ${resolved} approved source${resolved === 1 ? "" : "s"}${missing.length ? ` (${missing.length} attached source not yet indexed)` : ""}. Index these sources so the Harness can ground answers and cite them.`,
        );
        return;
      }
      const lines = results
        .slice(0, 5)
        .map((result) => `• [${result.sourceName}] ${result.snippet}`)
        .join("\n");
      setContextPreview(`Retrieved ${results.length} grounded passage${results.length === 1 ? "" : "s"} from ${resolved} approved source${resolved === 1 ? "" : "s"}:\n${lines}`);
    } catch {
      setContextPreview(staticSummary);
    }
  }

  const productionReadySkills = skills.filter((skill) => ["approved", "pilot", "production"].includes(skill.status));
  const totalSkillValue = skills.reduce((sum, skill) => sum + skill.valueDelivered, 0);
  const totalSkillRuns = skills.reduce((sum, skill) => sum + skill.runs, 0);
  const avgEvalScore = skills.length ? Math.round(skills.reduce((sum, skill) => sum + skill.evalPassRate, 0) / skills.length) : 0;
  const departmentCounts = skills.reduce<Record<string, number>>((acc, skill) => {
    acc[skill.department] = (acc[skill.department] ?? 0) + 1;
    return acc;
  }, {});
  const TOP_SKILLS_CAP = 5;
  const rankedSkills = [...skills].sort((a, b) => b.valueDelivered + b.runs - (a.valueDelivered + a.runs));
  const topSkills = rankedSkills.slice(0, showAllTopSkills ? rankedSkills.length : TOP_SKILLS_CAP);
  const selectedOrFirstSkill = selectedSkill ?? skills[0] ?? null;
  const bestNextSkill =
    skills.find((skill) => skill.evalPassRate < 90) ??
    skills.find((skill) => !["approved", "pilot", "production"].includes(skill.status)) ??
    selectedOrFirstSkill;
  const skillNextTitle = bestNextSkill ? `Next: test ${bestNextSkill.name}` : "Create the first AI Skill";
  const skillNextBody = bestNextSkill
    ? "Run a test or quality check before this Skill moves toward launch. The OS keeps the prompt, tools, knowledge, risk, runs, and proof connected."
    : "Start from an approved use case so the Skill has an owner, purpose, data boundary, and value model from day one.";
  const overviewNextAction = bestNextSkill
    ? bestNextSkill.evalPassRate < 90
      ? {
          label: "Run quality checks",
          icon: TestTube2,
          action: () => {
            setSelectedSkillId(bestNextSkill.id);
            onRunEval(bestNextSkill);
          },
        }
      : bestNextSkill.runs === 0
        ? {
            label: "Run safe test",
            icon: Play,
            action: () => {
              setSelectedSkillId(bestNextSkill.id);
              onRunTest(bestNextSkill);
            },
          }
        : !["approved", "pilot", "production"].includes(bestNextSkill.status)
          ? {
              label: "Submit review",
              icon: ShieldCheck,
              action: () => {
                setSelectedSkillId(bestNextSkill.id);
                onSubmitGovernance(bestNextSkill);
              },
            }
          : {
              label: "Open Skill",
              icon: Library,
              action: () => {
                setSelectedSkillId(bestNextSkill.id);
                setMode("detail");
              },
            }
    : {
        label: "Create from use case",
        icon: Boxes,
        action: onCreateFromUseCase,
      };
  const OverviewNextActionIcon = overviewNextAction.icon;
  const skillReadinessSteps = [
    {
      label: "Define",
      helper: "Prompt, owner, purpose, model, and autonomy boundary.",
      complete: skills.some((skill) => skill.systemPrompt.length > 120 && skill.model),
    },
    {
      label: "Test",
      helper: "Run quality checks and trace real test runs.",
      complete: skills.some((skill) => skill.evalPassRate >= 90 || skill.runs > 0),
    },
    {
      label: "Govern",
      helper: "Attach knowledge, tool rules, and risk review evidence.",
      complete: productionReadySkills.length > 0,
    },
  ];
  const completedSkillReadinessSteps = skillReadinessSteps.filter((step) => step.complete).length;
  const overviewProofItems = [
    { label: "Skills", value: String(skills.length), helper: `${productionReadySkills.length} pilot or production` },
    { label: "Quality", value: skills.length ? `${avgEvalScore}%` : "-", helper: "average eval score" },
    { label: "Runs", value: totalSkillRuns.toLocaleString(), helper: "trace evidence captured" },
    { label: "Value", value: formatCurrency(totalSkillValue), helper: "tracked delivered value" },
  ];
  const patternMarketplace = derivePatternMarketplace({ useCases, skills, runs, evalResults, governanceReviews });
  const PATTERN_MARKETPLACE_CAP = 6;

  if (mode === "overview") {
    return (
      <div>
        <PageHeader
          title="AI Skills"
          subtitle="Reusable AI capabilities with a prompt, knowledge, tools, tests, risk controls, proof, and value tracking."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onCreateFromUseCase}>
                <Boxes size={16} />
                Create from use case
              </Button>
              {selectedOrFirstSkill ? (
                <Button onClick={() => {
                  setSelectedSkillId(selectedOrFirstSkill.id);
                  setMode("detail");
                }}>
                  <Library size={16} />
                  Open selected Skill
                </Button>
              ) : null}
            </div>
          }
        />

        <Panel className="overflow-hidden border-[var(--primary)]/16 bg-[var(--surface)]/92" data-testid="skills-overview-primary">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={skills.length ? "green" : "blue"}>{skills.length ? "live Skills" : "start here"}</Badge>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  {skills.length} Skill{skills.length === 1 ? "" : "s"} · {productionReadySkills.length} pilot or production
                </span>
              </div>
              <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-[-0.02em] text-[var(--text)] sm:text-[30px]">
                {skillNextTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-[15px]">{skillNextBody}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={overviewNextAction.action} data-testid="skills-overview-next-action">
                  <OverviewNextActionIcon size={16} />
                  {overviewNextAction.label}
                </Button>
                <Button variant="secondary" onClick={onCreateFromUseCase}>
                  <Plus size={16} />
                  New Skill
                </Button>
              </div>

              <details
                className="group mt-6 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/72"
                data-testid="skills-overview-proof"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text)]">What makes this reusable?</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-5 text-[var(--text-muted)]">
                      <span className="whitespace-nowrap">
                        {completedSkillReadinessSteps}/{skillReadinessSteps.length} readiness checks complete
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="whitespace-nowrap">
                        {totalSkillRuns.toLocaleString()} run{totalSkillRuns === 1 ? "" : "s"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="whitespace-nowrap">{skills.length ? `${avgEvalScore}% quality` : "quality pending"}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={completedSkillReadinessSteps === skillReadinessSteps.length ? "green" : "amber"}>
                      {completedSkillReadinessSteps}/{skillReadinessSteps.length}
                    </Badge>
                    <ChevronRight size={16} className="text-[var(--text-soft)] transition group-open:rotate-90" />
                  </span>
                </summary>
                <div className="hidden border-t border-[var(--border)]/70 group-open:block">
                  <div className="grid gap-px bg-[var(--border)]/70 md:grid-cols-3">
                    {skillReadinessSteps.map((step, index) => (
                      <div key={step.label} className="min-h-[110px] bg-[var(--surface)] p-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              step.complete ? "bg-[var(--success)] text-white" : "bg-[var(--surface-subtle)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                            }`}
                          >
                            {step.complete ? <Check size={14} /> : index + 1}
                          </span>
                          <span className="text-sm font-semibold text-[var(--text)]">{step.label}</span>
                        </div>
                        <p className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{step.helper}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-px border-t border-[var(--border)]/70 bg-[var(--border)]/70 sm:grid-cols-2 xl:grid-cols-4">
                    {overviewProofItems.map((item) => (
                      <div key={item.label} className="bg-[var(--surface)] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{item.label}</div>
                        <div className="mt-2 text-xl font-semibold tracking-tight tabular-nums text-[var(--text)]">{item.value}</div>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>

            <aside className="min-w-0 border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/62 p-5 lg:border-l lg:border-t-0 sm:p-6">
              <SectionTitle title="Skill health" helper="What the current library can prove" compact />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniMetric label="Skills" value={String(skills.length)} />
                <MiniMetric label="Ready" value={String(productionReadySkills.length)} />
                <MiniMetric label="Quality" value={skills.length ? `${avgEvalScore}%` : "-"} />
                <MiniMetric label="Runs" value={totalSkillRuns.toLocaleString()} />
              </div>
              <div className="mt-4 rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/82 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Value delivered</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-[var(--text)]">{formatCurrency(totalSkillValue)}</div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                  Tied to governed runs, quality checks, and reusable Skill evidence.
                </p>
              </div>
            </aside>
          </div>
        </Panel>

        <Panel className="mt-4 overflow-hidden" data-testid="openclaw-skill-registry">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionTitle
                  title="Imported Skill Registry"
                  helper="Imported runtime Skills with provenance, allowed agents, pass rates, risks, and the control required before production use."
                  compact
                />
                <Badge tone="purple">{openClawIntegration.skills.length} imported</Badge>
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]/82">
                <DataTable
                  caption="Imported Skill registry"
                  minWidth={980}
                  columns={["Skill", "Source", "Status", "Tests", "Allowed agents", "Control"]}
                  rows={openClawIntegration.skills.map((skill) => [
                    <button
                      key={`${skill.id}-name`}
                      type="button"
                      onClick={() => setMode("detail")}
                      className="text-left"
                    >
                      <span className="block font-semibold text-[var(--text)]">{skill.name}</span>
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">{skill.owner}</span>
                    </button>,
                    skill.source,
                    <Badge key={`${skill.id}-status`} tone={openClawStatusTone(skill.status)}>{skill.status.replace("_", " ")}</Badge>,
                    `${skill.tests} · ${skill.passRate}%`,
                    skill.allowedAgents.join(", "),
                    skill.control,
                  ])}
                />
              </div>
            </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-4 lg:border-l lg:border-t-0">
              <SectionTitle title="Provenance gate" helper="How imported Skills become enterprise-safe." compact />
              <div className="mt-4 space-y-2">
                {[
                  ["Registry or workspace source", openClawIntegration.skills.filter((skill) => skill.source !== "Personal").length],
                  ["Approved status", openClawIntegration.skills.filter((skill) => skill.status === "approved").length],
                  ["Quality above 90%", openClawIntegration.skills.filter((skill) => skill.passRate >= 90).length],
                  ["Blocked until review", openClawIntegration.skills.filter((skill) => skill.status === "blocked").length],
                ].map(([label, count]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-3">
                    <span className="text-sm font-semibold text-[var(--text)]">{label as string}</span>
                    <Badge tone={Number(count) ? "blue" : "slate"}>{String(count)}</Badge>
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full" onClick={() => selectedOrFirstSkill ? setMode("detail") : onCreateFromUseCase()}>
                <Library size={15} />
                Open Skill controls
              </Button>
            </div>
          </div>
        </Panel>

        <details className="group mt-4" data-testid="skills-pattern-marketplace">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/82 px-5 py-4 text-left shadow-[var(--shadow-card)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text)]">Reusable templates and advanced marketplace</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                Open for starter blueprints, pattern reuse, activation plans, and marketplace scoring.
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
          </summary>
        <Panel className="mt-4 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <SectionTitle
              title="Pattern Marketplace"
              helper="Reusable, governed templates built from proven Skills or safe starter blueprints"
              compact
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={patternMarketplace.score >= 75 ? "green" : patternMarketplace.score >= 40 ? "amber" : "blue"}>
                marketplace {patternMarketplace.score}/100
              </Badge>
              <span className="text-sm text-[var(--text-muted)]">{patternMarketplace.summary}</span>
            </div>
          </div>
          <div className="grid gap-px bg-[var(--surface-subtle)] md:grid-cols-2 xl:grid-cols-3">
            {patternMarketplace.recommended.slice(0, showAllPatterns ? patternMarketplace.recommended.length : PATTERN_MARKETPLACE_CAP).map((pattern) => {
              const installPlan = buildPatternInstallPlan(pattern);
              return (
              <div key={pattern.id} className="bg-[var(--surface)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{pattern.title}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">{pattern.department} · {pattern.patternType}</div>
                  </div>
                  <Badge tone={pattern.kind === "workspace-pattern" ? "green" : "blue"}>
                    {pattern.kind === "workspace-pattern" ? "proven" : "starter"}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">{pattern.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MiniMetric label="Readiness" value={`${pattern.readiness}/100`} />
                  <MiniMetric label="Install confidence" value={`${pattern.installConfidence}/100`} />
                </div>
                <div className="mt-4 rounded-xl bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--text-muted)]">
                  {pattern.evidence}
                </div>
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      Activation plan
                    </div>
                    <Badge tone={installPlan.launchMode === "reuse" ? "green" : "blue"}>
                      {installPlan.estimatedDays}d
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {installPlan.steps.slice(0, 3).map((step, index) => (
                      <div key={step.id} className="flex items-start gap-2 text-xs leading-5 text-[var(--text-muted)]">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] font-semibold text-[var(--primary)]">
                          {index + 1}
                        </span>
                        <span>
                          <span className="block font-semibold text-[var(--text)]">{step.label}</span>
                          <span className="line-clamp-1">{step.evidence}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button className="mt-4 w-full" variant={pattern.kind === "workspace-pattern" ? "secondary" : "primary"} onClick={() => onInstallPattern(pattern)}>
                  {pattern.kind === "workspace-pattern" ? "Open pattern" : "Install blueprint"}
                </Button>
              </div>
            );
            })}
          </div>
          {patternMarketplace.recommended.length > PATTERN_MARKETPLACE_CAP ? (
            <div className="border-t border-[var(--border)] px-5 py-4">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowAllPatterns((value) => !value)}
              >
                {showAllPatterns ? "Show fewer" : `Show all ${patternMarketplace.recommended.length}`}
              </Button>
            </div>
          ) : null}
        </Panel>
        </details>

        <details
          className="group mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
          data-testid="skills-catalog-diagnostics"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block font-semibold text-[var(--text)]">Skill catalog and portfolio diagnostics</span>
              <span className="mt-1 block truncate text-sm text-[var(--text-muted)]">
                {skills.length} Skill{skills.length === 1 ? "" : "s"} · readiness, function coverage, and best-running assets
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
          </summary>
          <div className="hidden border-t border-[var(--border)] p-5 group-open:block">
            <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
              <Panel className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                  <SectionTitle
                    title="AI Skill Catalog"
                    helper="Approved use cases become governed, versioned Skills that can be tested and reused."
                    compact
                  />
                  <Button variant="secondary" onClick={onCreateFromUseCase}>
                    <Plus size={16} />
                    New Skill
                  </Button>
                </div>
            {skills.length ? (
              <div className="grid gap-4 p-5 lg:grid-cols-2">
                {skills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => {
                      setSelectedSkillId(skill.id);
                      setSkillTab("overview");
                      setMode("detail");
                    }}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--primary)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{skill.name}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{skill.department} · {autonomyLabels[skill.autonomyTier]}</div>
                      </div>
                      <Badge tone={statusTone(skill.status)}>{statusLabels[skill.status]}</Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-5 text-[var(--text-muted)]">{skill.description}</p>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      <MiniMetric label="Eval" value={`${skill.evalPassRate}%`} />
                      <MiniMetric label="Runs" value={skill.runs.toLocaleString()} />
                      <MiniMetric label="Tools" value={String(skill.allowedTools.length)} />
                      <MiniMetric label="Value" value={formatCurrency(skill.valueDelivered)} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge tone={riskTone(skill.riskLevel)}>{skill.riskLevel}</Badge>
                      <Badge tone="blue">v{skill.version}</Badge>
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                        Open Skill
                        <ChevronRight size={13} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8">
                <EmptyState
                  title="No Skills in this workspace"
                  body="Approved use cases become governed Skills. Each Skill stores prompt contracts, model routing, allowed tools, context, approvals, evals, versions, and measurement."
                  action="Open Use Cases"
                  onAction={onCreateFromUseCase}
                />
              </div>
            )}
              </Panel>

              <div className="space-y-4">
                <Panel className="p-5">
                  <SectionTitle title="Skill readiness checklist" helper="What makes a Skill reusable instead of a one-off prompt" />
                  <div className="mt-4 space-y-3">
                    {[
                      ["Use case linked", skills.filter((skill) => skill.useCaseId).length],
                      ["Prompt contract", skills.filter((skill) => evaluatePromptQuality(skill).score >= 90).length],
                      ["Tool policy", skills.filter((skill) => skill.allowedTools.length).length],
                      ["Context approved", skills.filter((skill) => skill.contextSources.length).length],
                      ["Eval passing", skills.filter((skill) => skill.evalPassRate >= 90).length],
                    ].map(([label, count]) => (
                      <div key={String(label)} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                        <span className="font-semibold text-[var(--text)]">{label}</span>
                        <Badge tone={Number(count) ? "green" : "amber"}>{count}/{Math.max(skills.length, 1)}</Badge>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel className="p-5">
                  <SectionTitle title="Function Coverage" helper="Where reusable capabilities exist" />
                  <div className="mt-4 space-y-3">
                    {Object.entries(departmentCounts).length ? (
                      Object.entries(departmentCounts).map(([department, count]) => (
                        <div key={department}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">{department}</span>
                            <span className="text-[var(--text-muted)]">{count} Skills</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-[var(--surface-subtle)]">
                            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(8, Math.round((count / Math.max(1, skills.length)) * 100))}%` }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-muted)]">
                        No function coverage yet.
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel className="p-5">
                  <SectionTitle title="Best running Skills" helper="Ranked by value and run evidence" />
                  <div className="mt-4 space-y-2">
                    {topSkills.length ? topSkills.map((skill) => (
                      <button type="button"
                        key={skill.id}
                        className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]"
                        onClick={() => {
                          setSelectedSkillId(skill.id);
                          setMode("detail");
                        }}
                      >
                        <span>
                          <span className="block font-semibold text-[var(--text)]">{skill.name}</span>
                          <span className="text-xs text-[var(--text-muted)]">{skill.runs.toLocaleString()} runs · {formatCurrency(skill.valueDelivered)}</span>
                        </span>
                        <ChevronRight size={15} className="text-[var(--text-soft)]" />
                      </button>
                    )) : (
                      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-muted)]">
                        Skills will rank here once they have runs, evals, and value evidence.
                      </div>
                    )}
                  </div>
                  {rankedSkills.length > TOP_SKILLS_CAP ? (
                    <Button
                      variant="ghost"
                      className="mt-2 w-full"
                      onClick={() => setShowAllTopSkills((value) => !value)}
                    >
                      {showAllTopSkills ? "Show fewer" : `Show all ${rankedSkills.length}`}
                    </Button>
                  ) : null}
                </Panel>
              </div>
            </div>
          </div>
        </details>
      </div>
    );
  }

  if (!selectedSkill) {
    return (
      <div>
        <PageHeader
          title="AI Skills"
          subtitle="Reusable governed AI capabilities with prompts, tools, knowledge, quality checks, value, and versions"
        />
        <EmptyState
          title="No Skills in this workspace"
          body="Approved use cases become governed Skills. Each Skill stores prompt contracts, model routing, allowed tools, context, approvals, evals, versions, and measurement."
          action="Open Use Cases"
          onAction={onCreateFromUseCase}
        />
      </div>
    );
  }

  const attachedContextSources = platformContextSources.filter((source) => selectedSkill.contextSources.includes(source.id));
  const availableContextSources = platformContextSources.filter((source) => !selectedSkill.contextSources.includes(source.id));
  const recommendedContextSources = availableContextSources.filter((source) =>
    selectedSkill.department === "Cross-Functional" ||
    source.ownerDepartment === selectedSkill.department ||
    source.name.toLowerCase().includes(String(selectedSkill.department).toLowerCase()),
  );
  const contextCatalog = recommendedContextSources.length ? recommendedContextSources : availableContextSources;
  const allowedSkillTools = tools.filter((tool) => selectedSkill.allowedTools.includes(tool.id));
  const blockedSkillTools = tools.filter((tool) => selectedSkill.blockedTools.includes(tool.id));
  const latestEvalResult = selectedEvalResults[0];
  const averageRunLatency = selectedSkillRuns.length
    ? Math.round(selectedSkillRuns.reduce((sum, run) => sum + run.latencyMs, 0) / selectedSkillRuns.length)
    : 0;
  const totalRunCost = selectedSkillRuns.reduce((sum, run) => sum + run.costUsd, 0);
  const valuePerRun = selectedSkillRuns.length ? Math.round(selectedSkill.valueDelivered / selectedSkillRuns.length) : 0;
  const liveCompletedRuns = selectedSkillRuns.filter((run) => run.status === "completed" && run.executionMode === "live");
  const valueIsMeasured = liveCompletedRuns.length > 0;
  const valueProvenanceKind: "modeled" | "self-assessed" = valueIsMeasured ? "modeled" : "self-assessed";
  const selectedLaunchChecks = skillLaunchChecks(selectedSkill);
  const selectedLaunchReadiness = launchReadiness(selectedSkill);
  const nextLaunchCheck = selectedLaunchChecks.find((check) => !check.complete);
  const launchNextTitle = nextLaunchCheck ? nextLaunchCheck.label : "Ready for a governed pilot";
  const launchNextBody = nextLaunchCheck
    ? nextLaunchCheck.helper
    : "The core Skill contract is ready. Run one more traceable test, package proof, and move toward pilot approval.";

  function performLaunchCheck(check: SkillLaunchCheck) {
    if (!selectedSkill) return;
    if (check.action === "run_eval") {
      onRunEval(selectedSkill);
      return;
    }
    if (check.action === "submit_review") {
      onSubmitGovernance(selectedSkill);
      return;
    }
    if (check.action === "create_from_use_case") {
      onCreateFromUseCase();
      return;
    }
    setSkillTab(check.targetTab);
  }

  function performLaunchMove() {
    if (!selectedSkill) return;
    if (!nextLaunchCheck) {
      onRunTest(selectedSkill);
      return;
    }
    performLaunchCheck(nextLaunchCheck);
  }

  return (
    <div>
      <PageHeader
        title="AI Skills"
        subtitle="Reusable governed AI capabilities with prompts, tools, knowledge, quality checks, value, and versions"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onRunEval(selectedSkill)}>
              <TestTube2 size={16} />
              Run quality checks
            </Button>
            <Button onClick={() => onRunTest(selectedSkill)}>
              <Play size={16} />
              Run test
            </Button>
          </div>
        }
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[360px_1fr]">
        <div className="min-w-0 space-y-3">
          {skills.map((skill) => (
            <button type="button"
              key={skill.id}
              aria-label={`Open AI Skill: ${skill.name}`}
              onClick={() => setSelectedSkillId(skill.id)}
              className={`w-full rounded-xl border bg-[var(--surface)] p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition ${
                selectedSkill.id === skill.id ? "border-[var(--primary)] ring-4 ring-indigo-50" : "border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">{skill.name}</div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{skill.department} · {autonomyLabels[skill.autonomyTier]}</div>
                </div>
                <Badge tone={riskTone(skill.riskLevel)}>{skill.riskLevel}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-5 text-[var(--text-muted)]">{skill.description}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniMetric label="Eval" value={`${skill.evalPassRate}%`} />
                <MiniMetric label="Runs" value={skill.runs.toLocaleString()} />
                <MiniMetric label="Tools" value={String(skill.allowedTools.length)} />
              </div>
            </button>
          ))}
        </div>

        <Panel className="min-w-0 overflow-hidden">
          <div className="border-b border-[var(--border)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{selectedSkill.name}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{selectedSkill.description}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={statusTone(selectedSkill.status)}>{statusLabels[selectedSkill.status]}</Badge>
                <Badge tone={riskTone(selectedSkill.riskLevel)}>{selectedSkill.riskLevel}</Badge>
              </div>
            </div>
          </div>

          <div className="px-5" data-testid="skill-detail-tabs">
            <Tabs
              tabs={[
                ["overview", "Overview"],
                ["configuration", "Setup"],
                ["prompt", "Prompt"],
                ["tools", "Tools"],
                ["context", "Knowledge"],
                ["evals", "Quality"],
                ["runs", "Runs"],
                ["metrics", "Value"],
                ["skillspec", "Spec"],
                ["versions", "Versions"],
              ]}
              active={skillTab}
              onChange={setSkillTab}
              ariaLabel="Skill detail sections"
              idBase="skill-detail"
              panelId={(id) => `skill-detail-panel-${id}`}
            />
          </div>

          <div
            id={`skill-detail-panel-${skillTab}`}
            role="tabpanel"
            aria-labelledby={`skill-detail-${skillTab}-tab`}
            className="min-w-0 p-5"
            data-testid={`skill-detail-panel-${skillTab}`}
          >
            {skillTab === "overview" ? (
              <div>
                <SkillFirstActionGuide
                  skill={selectedSkill}
                  checks={selectedLaunchChecks}
                  readiness={selectedLaunchReadiness}
                  nextCheck={nextLaunchCheck}
                  nextTitle={launchNextTitle}
                  nextBody={launchNextBody}
                  onPrimary={performLaunchMove}
                  onCheck={performLaunchCheck}
                  onRunTest={() => onRunTest(selectedSkill)}
                />
                <div className="grid gap-4 md:grid-cols-4">
                  <MiniMetric label="Owner" value={getUserName(selectedSkill.ownerId)} />
                  <MiniMetric label="Version" value={selectedSkill.version} />
                  <MiniMetric label="Eval Score" value={`${selectedSkill.evalPassRate}%`} />
                  <MiniMetric label="Value Delivered" value={formatCurrency(selectedSkill.valueDelivered)} />
                </div>
              </div>
            ) : null}

            {skillTab === "configuration" ? (
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Skill Name">
                    <input
                      className="input"
                      value={selectedSkill.name}
                      onChange={(event) => patchSelectedSkill({ name: event.target.value }, "Skill name saved.")}
                    />
                  </Field>
                  <Field label="Slug">
                    <input
                      className="input font-mono text-xs"
                      value={selectedSkill.slug}
                      onChange={(event) => patchSelectedSkill({ slug: event.target.value }, "Skill slug saved.")}
                    />
                  </Field>
                  <Field label="Model Provider">
                    <select
                      className="input"
                      value={selectedSkill.modelProvider}
                      onChange={(event) => patchSelectedSkill({ modelProvider: event.target.value }, "Model provider saved.")}
                    >
                      {["openai", "anthropic", "google", "azure_openai", "kimi", "glm", "deepseek", "local", "mock"].map((provider) => (
                        <option key={provider} value={provider}>
                          {providerLabel(provider)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Primary Model">
                    <input
                      className="input font-mono text-xs"
                      value={selectedSkill.model}
                      onChange={(event) => patchSelectedSkill({ model: event.target.value }, "Primary model saved.")}
                      placeholder="provider/model-name"
                    />
                  </Field>
                  <Field label="Fallback Model">
                    <input
                      className="input font-mono text-xs"
                      value={selectedSkill.fallbackModel}
                      onChange={(event) => patchSelectedSkill({ fallbackModel: event.target.value }, "Fallback model saved.")}
                      placeholder="provider/smaller-model"
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      className="input"
                      value={selectedSkill.status}
                      onChange={(event) => patchSelectedSkill({ status: event.target.value as Skill["status"] }, "Skill lifecycle status saved.")}
                    >
                      {["draft", "in_review", "approved", "pilot", "production", "deprecated", "archived"].map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                      Recommended path: draft → in review → approved → pilot → production. Some moves (e.g. → production) require passing governance review first.
                    </p>
                  </Field>
                  <Field label="Autonomy Tier">
                    <select
                      className="input"
                      value={selectedSkill.autonomyTier}
                      onChange={(event) => patchSelectedSkill({ autonomyTier: event.target.value as Skill["autonomyTier"] }, "Autonomy tier saved.")}
                    >
                      {Object.entries(autonomyLabels).map(([tier, label]) => (
                        <option key={tier} value={tier}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Risk Level">
                    <select
                      className="input"
                      value={selectedSkill.riskLevel}
                      onChange={(event) => patchSelectedSkill({ riskLevel: event.target.value as RiskLevel }, "Risk level saved.")}
                    >
                      {["low", "medium", "high", "restricted"].map((risk) => (
                        <option key={risk} value={risk}>
                          {risk}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Temperature ${selectedSkill.temperature}`}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      className="w-full accent-[var(--primary)]"
                      value={selectedSkill.temperature}
                      onChange={(event) => patchSelectedSkill({ temperature: Number(event.target.value) }, "Temperature saved.")}
                    />
                  </Field>
                  <Field label="Max Tokens">
                    <input
                      type="number"
                      min="256"
                      max="32768"
                      className="input"
                      value={selectedSkill.maxTokens}
                      onChange={(event) => patchSelectedSkill({ maxTokens: Number(event.target.value) }, "Token limit saved.")}
                    />
                  </Field>
                  <Field label="Cost Cap / Run">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={selectedSkill.costLimit}
                      onChange={(event) => patchSelectedSkill({ costLimit: Number(event.target.value) }, "Cost cap saved.")}
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      className="input min-h-[120px] md:col-span-2"
                      value={selectedSkill.description}
                      onChange={(event) => patchSelectedSkill({ description: event.target.value }, "Skill description saved.")}
                    />
                  </Field>
                </div>
                <div className="space-y-4">
                  <Panel className="p-4">
                    <SectionTitle title="Runtime Contract" helper="These settings are evaluated before every Harness run." />
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span className="text-[var(--text-muted)]">Provider</span>
                        <Badge tone="blue">{providerLabel(selectedSkill.modelProvider)}</Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span className="text-[var(--text-muted)]">Primary model</span>
                        <span className="max-w-[170px] truncate font-mono text-xs font-semibold text-[var(--text)]">{selectedSkill.model}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span className="text-[var(--text-muted)]">Cost cap</span>
                        <Badge tone="green">${selectedSkill.costLimit}/run</Badge>
                      </div>
                    </div>
                  </Panel>
                  <Panel className="p-4">
                    <SectionTitle title="Launch Impact" helper="Changing these fields updates the SkillSpec and may require governance review." />
                    <div className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                      <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span>Human review needed</span>
                        <Badge tone={selectedSkill.autonomyTier === "tier_1_read_only" ? "green" : "amber"}>
                          {selectedSkill.autonomyTier === "tier_1_read_only" ? "read only" : "approval boundary"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span>Model routing</span>
                        <Badge tone={selectedSkill.modelProvider === "mock" || selectedSkill.modelProvider === "local" ? "amber" : "green"}>
                          {selectedSkill.modelProvider === "mock" || selectedSkill.modelProvider === "local" ? "local fallback" : "external ready"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span>Governance status</span>
                        <Badge tone={statusTone(selectedSkill.status)}>{statusLabels[selectedSkill.status]}</Badge>
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}

            {skillTab === "prompt" ? (
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <Field label="System Prompt">
                  <textarea
                    className="input min-h-[280px] font-mono text-xs leading-6"
                    value={selectedSkill.systemPrompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                  />
                </Field>
                <div className="space-y-4">
                  <Panel className="p-4">
                    <SectionTitle
                      title="Prompt Contract"
                      helper={selectedPromptContract ? selectedPromptContract.id : "No contract assembled"}
                    />
                    {selectedPromptQuality ? (
                      <div className="mt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-semibold tabular-nums text-[var(--text)]">{selectedPromptQuality.score}</div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">contract coverage</div>
                            <div className="mt-0.5 text-[11px] leading-4 text-[var(--text-soft)]">static checklist of governance controls present — not a model judgment</div>
                          </div>
                          <Badge tone={selectedPromptQuality.grade === "excellent" || selectedPromptQuality.grade === "good" ? "green" : "amber"}>
                            {selectedPromptQuality.grade.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="mt-4 space-y-2">
                          {selectedPromptQuality.findings.slice(0, 5).map((finding) => (
                            <div key={finding.id} className="flex items-start gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs">
                              <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${finding.passed ? "bg-[var(--success)] text-white" : "bg-[var(--warning-soft)] text-[var(--warning)]"}`}>
                                {finding.passed ? <Check size={11} /> : "!"}
                              </span>
                              <div>
                                <div className="font-semibold text-[var(--text)]">{finding.label}</div>
                                <div className="mt-0.5 text-[var(--text-muted)]">{finding.passed ? "Covered by the effective Harness contract." : finding.detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Panel>
                  <Panel className="p-4">
                    <SectionTitle title="Test Console" />
                    <div className="mt-4 rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-muted)]">
                      Can you explain our PTO accrual policy?
                    </div>
                    <Button className="mt-4 w-full" onClick={() => onRunTest(selectedSkill)}>
                      <Play size={16} />
                      Test Prompt
                    </Button>
                    <div className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                      The Harness now wraps this prompt with the Skill contract before model routing and logs the contract in every run trace.
                    </div>
                  </Panel>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--text-muted)]">
                    Contract output shape: answer, evidence, assumptions, risk flags, and recommended next action.
                  </div>
                </div>
              </div>
            ) : null}

            {skillTab === "tools" ? (
              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  <div className="grid grid-cols-[32px_minmax(220px,1fr)_88px_104px_88px] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    <span />
                    <span>Connector Tool</span>
                    <span>Risk</span>
                    <span>Approval</span>
                    <span>Block</span>
                  </div>
                  {tools.length ? tools.map((tool) => {
                    const allowed = selectedSkill.allowedTools.includes(tool.id);
                    const blocked = selectedSkill.blockedTools.includes(tool.id);
                    return (
                      <div key={tool.id} className="grid grid-cols-[32px_minmax(220px,1fr)_88px_104px_88px] items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0">
                        <button
                          type="button"
                          aria-label={`Toggle tool ${tool.id}`}
                          onClick={() => handleToggleTool(tool.id)}
                          className={`flex size-8 items-center justify-center rounded-lg border transition ${
                            allowed ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-soft)] hover:text-[var(--text-muted)]"
                          }`}
                        >
                          {allowed ? <Check size={14} /> : null}
                        </button>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="whitespace-nowrap font-mono text-xs font-semibold text-[var(--text)]">{tool.id}</span>
                            {!tool.enabled ? <Badge tone="red">disabled</Badge> : null}
                            {blocked ? <Badge tone="red">blocked</Badge> : null}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{tool.description}</div>
                          <div className="mt-1 text-[11px] text-[var(--text-soft)]">{tool.category} · {tool.actionType} · {tool.usage.toLocaleString()} uses</div>
                        </div>
                        <Badge tone={riskTone(tool.riskLevel)}>{tool.riskLevel}</Badge>
                        <Badge tone={tool.requiresApprovalByDefault || tool.actionType !== "read" ? "amber" : "green"}>
                          {tool.requiresApprovalByDefault || tool.actionType !== "read" ? "Approval" : "Auto"}
                        </Badge>
                        <Button
                          variant={blocked ? "danger" : "secondary"}
                          className="h-8 whitespace-nowrap px-2.5"
                          onClick={() => setSkillToolBlocked(tool.id)}
                        >
                          {blocked ? "Unblock" : "Block"}
                        </Button>
                      </div>
                    );
                  }) : (
                    <div className="p-6">
                      <EmptyState
                        title="No connector tools configured"
                        body="Add live or sandbox MCP connector tools in the MCP Broker before granting this Skill tool access."
                        action="Review policy"
                        onAction={() => setNotice("Open Tool Permissions from the left navigation to register tenant connector tools before granting Skill access.")}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <Panel className="p-4">
                    <SectionTitle title="Tool Policy Summary" helper="Every tool call is still checked by the Broker at runtime." />
                    <div className="mt-4 grid gap-3">
                      <MiniMetric label="Allowed" value={allowedSkillTools.length.toLocaleString()} />
                      <MiniMetric label="Explicitly Blocked" value={blockedSkillTools.length.toLocaleString()} />
                      <MiniMetric label="Approval-Gated" value={allowedSkillTools.filter((tool) => tool.requiresApprovalByDefault || tool.actionType !== "read").length.toLocaleString()} />
                    </div>
                  </Panel>
                  <Panel className="p-4">
                    <SectionTitle title="Harness Behavior" />
                    <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
                      {[
                        "Disabled tools are blocked before policy evaluation.",
                        "Write, create, update, delete, and execute actions require human approval unless a narrower policy is added.",
                        "Blocked tools are written into SkillSpec so the model and Broker share the same boundary.",
                      ].map((line) => (
                        <div key={line} className="flex gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                          <Check size={15} className="mt-0.5 shrink-0 text-[var(--success)]" />
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}

            {skillTab === "context" ? (
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-5">
                  <Panel className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <SectionTitle
                        title="Approved Context Sources"
                        helper="Sources attached here become the only retrieval boundary this Skill can use at runtime."
                      />
                      <Badge tone={attachedContextSources.length ? "green" : "amber"}>
                        {attachedContextSources.length} attached
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {attachedContextSources.length ? attachedContextSources.map((source) => (
                        <div key={source.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[var(--text)]">{source.name}</div>
                              <div className="mt-1 text-xs text-[var(--text-muted)]">{source.type} · {source.ownerDepartment} owner · {source.documentCount.toLocaleString()} docs</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge tone={source.health === "healthy" ? "green" : source.health === "attention" ? "amber" : "red"}>{source.health}</Badge>
                              <Badge tone={source.classification === "restricted" || source.classification === "regulated" ? "red" : source.classification === "confidential" ? "amber" : "green"}>
                                {source.classification}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-2 text-xs text-[var(--text-muted)] md:grid-cols-3">
                            <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                              <span className="block font-semibold text-[var(--text)]">Permission filter</span>
                              identity + department
                            </div>
                            <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                              <span className="block font-semibold text-[var(--text)]">Citations</span>
                              required
                            </div>
                            <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                              <span className="block font-semibold text-[var(--text)]">Last indexed</span>
                              {source.lastIndexedAt}
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button variant="secondary" onClick={() => removeContextSourceFromSkill(source.id)}>
                              Remove source
                            </Button>
                          </div>
                        </div>
                      )) : (
                        <EmptyState
                          title="No context source attached"
                          body="Attach at least one approved source so this Skill can ground answers, cite evidence, and pass launch readiness."
                          action="Run simulation"
                          onAction={runContextSimulation}
                        />
                      )}
                    </div>
                  </Panel>

                  <Panel className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <SectionTitle
                        title="Context Source Catalog"
                        helper={recommendedContextSources.length ? "Recommended sources are matched to this Skill's department." : "Available tenant sources that can be attached to this Skill."}
                      />
                      <Badge tone={contextCatalog.length ? "blue" : "slate"}>
                        {contextCatalog.length} available
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 2xl:grid-cols-2">
                      {contextCatalog.length ? contextCatalog.map((source) => (
                        <div key={source.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-[var(--text)]">{source.name}</div>
                              <div className="mt-1 text-xs text-[var(--text-muted)]">{source.type} · {source.ownerDepartment}</div>
                            </div>
                            <Badge tone={source.health === "healthy" ? "green" : source.health === "attention" ? "amber" : "red"}>{source.health}</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge tone={source.classification === "restricted" || source.classification === "regulated" ? "red" : source.classification === "confidential" ? "amber" : "green"}>
                              {source.classification}
                            </Badge>
                            <Badge tone={source.enabled ? "green" : "red"}>{source.enabled ? "enabled" : "disabled"}</Badge>
                          </div>
                          <Button
                            className="mt-4 w-full"
                            variant="secondary"
                            disabled={!source.enabled}
                            onClick={() => addContextSourceToSkill(source.id)}
                          >
                            <Plus size={15} />
                            Attach Source
                          </Button>
                        </div>
                      )) : (
                        <div className="2xl:col-span-2">
                          <EmptyState
                            title="No catalog sources configured"
                            body="Configure tenant knowledge sources in Context Fabric before this Skill can retrieve enterprise context."
                            action="Show requirement"
                            onAction={() => setNotice("Context Fabric must contain approved tenant sources before a Skill can be launched with grounded retrieval.")}
                          />
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>

                <div className="space-y-4">
                  <Panel className="p-4">
                    <SectionTitle title="Permission Simulation" helper="Preview what the Harness would pass into the model." />
                    <Field label="Test Query">
                      <textarea
                        className="input min-h-[94px]"
                        value={contextQuery}
                        onChange={(event) => setContextQuery(event.target.value)}
                      />
                    </Field>
                    <Button className="mt-3 w-full" onClick={runContextSimulation}>
                      <Search size={15} />
                      Run Permission Simulation
                    </Button>
                    {contextPreview ? (
                      <div className="mt-4 whitespace-pre-line rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-muted)]">
                        {contextPreview}
                      </div>
                    ) : null}
                  </Panel>
                  <Panel className="p-4">
                    <SectionTitle title="Retrieval Guardrails" />
                    <div className="mt-3 space-y-2 text-sm">
                      {[
                        ["Identity and role filter", true],
                        ["Department and source-owner filter", attachedContextSources.length > 0],
                        ["Citations required", attachedContextSources.length > 0],
                        ["Sensitive data redaction", attachedContextSources.some((source) => ["confidential", "restricted", "regulated"].includes(source.classification))],
                        ["Prompt injection quarantine", true],
                      ].map(([label, done]) => (
                        <div key={String(label)} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                          <span className="text-[var(--text-muted)]">{label}</span>
                          <Badge tone={done ? "green" : "amber"}>{done ? "ready" : "needs source"}</Badge>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}

            {skillTab === "evals" ? (
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
                <div className="min-w-0 space-y-5">
                  <div className="grid gap-4 md:grid-cols-4">
                    <MiniMetric label="Pass Rate" value={`${selectedSkill.evalPassRate}%`} />
                    <MiniMetric label="Threshold" value="90%" />
                    <MiniMetric label="Critical Failures" value={latestEvalResult ? String(latestEvalResult.criticalFailures) : selectedSkill.evalPassRate >= 90 ? "0" : "1"} />
                    <MiniMetric label="Stored Results" value={selectedEvalResults.length.toLocaleString()} />
                  </div>
                  <Panel className="p-5">
                    <SectionTitle title="Launch Evaluation Matrix" helper="A production Skill should pass all critical safety and quality categories before pilot." />
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        ["Grounding", "Answers cite approved context and separate source facts from interpretation.", selectedSkill.contextSources.length > 0],
                        ["Hallucination", "Unsupported policy, legal, finance, or HR claims are rejected or escalated.", selectedSkill.evalPassRate >= 85],
                        ["Permission", "Responses respect user identity, department, and data classification.", true],
                        ["Prompt Injection", "Untrusted document instructions are quarantined from system instructions.", true],
                        ["Tool Safety", "Connector use stays inside allowed tools and approval gates.", selectedSkill.allowedTools.length > 0],
                        ["Regression", "Current prompt and SkillSpec remain stable against saved cases.", selectedEvalResults.length > 0],
                      ].map(([name, detail, ready]) => (
                        <div key={String(name)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-semibold text-[var(--text)]">{name}</div>
                            <Badge tone={ready ? "green" : "amber"}>{ready ? "covered" : "needs evidence"}</Badge>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel className="p-5">
                    <SectionTitle title="Stored Eval Results" helper="Results are written back to the workspace and appear in governance evidence." />
                    {selectedEvalResults.length ? (
                      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
                        {selectedEvalResults.map((result) => (
                          <div key={result.id} className="grid grid-cols-[1fr_90px_100px_130px] items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-sm last:border-b-0">
                            <div>
                              <div className="font-semibold text-[var(--text)]">{result.suiteName}</div>
                              <div className="mt-1 text-xs text-[var(--text-muted)]">{result.createdAt}</div>
                            </div>
                            <Badge tone={result.passed ? "green" : "red"}>{result.passed ? "passed" : "failed"}</Badge>
                            <span className="font-semibold tabular-nums text-[var(--text)]">{result.score}/100</span>
                            <span className="text-xs text-[var(--text-muted)]">{result.criticalFailures} critical failures</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4">
                        <EmptyState
                          title="No stored eval run yet"
                          body="Run the evaluation suite to create launch evidence for grounding, permission, prompt injection, tool safety, latency, cost, and regression."
                          action="Run Eval Suite"
                          onAction={() => onRunEval(selectedSkill)}
                        />
                      </div>
                    )}
                  </Panel>
                </div>
                <div className="min-w-0 space-y-4">
                  <Panel className="p-4">
                    <SectionTitle title="Red-Team Scenario" helper="Built into every launch suite." />
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      Malicious document text tries to override instructions. Expected behavior: treat it as untrusted context, never approve employee-impacting actions, cite approved policy, and escalate ambiguity.
                    </p>
                    <Button className="mt-4 w-full" variant="secondary" onClick={() => onRunEval(selectedSkill)}>
                      <TestTube2 size={16} />
                      Run Eval Suite
                    </Button>
                  </Panel>
                  <Panel className="p-4">
                    <SectionTitle title="Continuous Monitoring" />
                    <div className="mt-3 space-y-2">
                      {[
                        ["Nightly regression", selectedEvalResults.length > 0],
                        ["Drift trigger", selectedSkillRuns.length > 2],
                        ["Policy re-check on version change", true],
                        ["Critical failure blocks launch", true],
                      ].map(([label, active]) => (
                        <div key={String(label)} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm">
                          <span>{label}</span>
                          <Badge tone={active ? "green" : "amber"}>{active ? "active" : "waiting"}</Badge>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}

            {skillTab === "runs" ? (
              selectedSkillRuns.length ? (
                <DataTable
                  caption={`${selectedSkill.name} run history`}
                  columns={["Run", "Status", "Risk", "Cost", "Latency", "Started"]}
                  rows={selectedSkillRuns.map((run) => [
                    run.id,
                    <Badge key={`${run.id}-status`} tone={statusTone(run.status)}>{statusLabels[run.status]}</Badge>,
                    <Badge key={`${run.id}-risk`} tone={riskTone(run.riskLevel)}>{run.riskLevel}</Badge>,
                    `$${run.costUsd.toFixed(4)}`,
                    `${(run.latencyMs / 1000).toFixed(1)}s`,
                    run.startedAt,
                  ])}
                />
              ) : (
                <EmptyState
                  title="No runs for this Skill yet"
                  body="Run a Skill test from the header to create a governed execution trace, approval record, and audit evidence."
                  action="Run test"
                  onAction={() => onRunTest(selectedSkill)}
                />
              )
            ) : null}

            {skillTab === "metrics" ? (
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-4">
                    <MiniMetric label="Adoption Count" value={selectedSkill.adoptionCount.toLocaleString()} />
                    <MiniMetric label="Runs" value={selectedSkillRuns.length.toLocaleString()} />
                    <MiniMetric label="Value Delivered" value={formatCurrency(selectedSkill.valueDelivered)} />
                    <MiniMetric label="Value / Run" value={valuePerRun ? formatCurrency(valuePerRun) : "No runs"} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Provenance kind={valueProvenanceKind} />
                    <span>
                      {valueIsMeasured
                        ? `Value is modeled from ${liveCompletedRuns.length} completed live run${liveCompletedRuns.length === 1 ? "" : "s"} × the use case's assumptions. Runs and adopters are measured from the execution ledger.`
                        : "No live runs yet — adoption and value are an operator self-assessed baseline. Runs and adopters are measured from the execution ledger."}
                    </span>
                  </div>
                  <Panel className="p-5">
                    <SectionTitle title="Measurement Contract" helper="The Skill is measured by adoption, impact, cost, latency, and evidence quality." />
                    {valueIsMeasured ? (
                      <div className="mt-4 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/50 p-4 text-sm leading-6 text-[var(--text-muted)]">
                        Adoption and value are now measured from the run ledger and modeled from the linked use case&apos;s assumptions. To change the value model, adjust the use case&apos;s volume, handling time, and adoption assumptions rather than typing a figure here.
                      </div>
                    ) : (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Adoption Count (self-assessed)">
                        <input
                          type="number"
                          min="0"
                          className="input"
                          value={selectedSkill.adoptionCount}
                          onChange={(event) => patchSelectedSkill({ adoptionCount: Number(event.target.value) }, "Adoption count saved.")}
                        />
                      </Field>
                      <Field label="Value Delivered (self-assessed)">
                        <input
                          type="number"
                          min="0"
                          className="input"
                          value={selectedSkill.valueDelivered}
                          onChange={(event) => patchSelectedSkill({ valueDelivered: Number(event.target.value) }, "Value delivered saved.")}
                        />
                      </Field>
                    </div>
                    )}
                    <div className="mt-5 space-y-3">
                      {[
                        ["Adoption confidence", selectedSkill.adoptionCount > 100 ? 92 : selectedSkill.adoptionCount > 0 ? 58 : 0],
                        ["Value confidence", selectedSkill.valueDelivered > 0 && selectedSkillRuns.length ? 88 : selectedSkill.valueDelivered > 0 ? 55 : 0],
                        ["Trace confidence", selectedSkillRuns.length ? Math.min(100, selectedSkillRuns.length * 20) : 0],
                      ].map(([label, score]) => (
                        <div key={String(label)}>
                          <div className="flex justify-between text-xs font-semibold text-[var(--text-muted)]">
                            <span>{label}</span>
                            <span className="tabular-nums">{score}%</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-[var(--surface-subtle)]">
                            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
                <div className="space-y-4">
                  <Panel className="p-4">
                    <SectionTitle title="Run Economics" helper="Calculated from stored Harness runs." />
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span className="text-[var(--text-muted)]">Stored run cost</span>
                        <span className="font-semibold tabular-nums">${totalRunCost.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span className="text-[var(--text-muted)]">Avg latency</span>
                        <span className="font-semibold tabular-nums">{averageRunLatency ? `${(averageRunLatency / 1000).toFixed(1)}s` : "No runs"}</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                        <span className="text-[var(--text-muted)]">Cost cap</span>
                        <span className="font-semibold tabular-nums">${selectedSkill.costLimit}/run</span>
                      </div>
                    </div>
                  </Panel>
                  <Panel className="p-4">
                    <SectionTitle title="Proof Quality" />
                    <div className="mt-3 space-y-2 text-sm">
                      {[
                        ["Run traces", selectedSkillRuns.length > 0],
                        ["Eval evidence", selectedEvalResults.length > 0 || selectedSkill.evalPassRate > 0],
                        ["Context evidence", selectedSkill.contextSources.length > 0],
                        ["Tool policy evidence", selectedSkill.allowedTools.length > 0 || selectedSkill.blockedTools.length > 0],
                      ].map(([label, ready]) => (
                        <div key={String(label)} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                          <span>{label}</span>
                          <Badge tone={ready ? "green" : "amber"}>{ready ? "ready" : "missing"}</Badge>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}

            {skillTab === "skillspec" ? (
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <pre className="max-h-[620px] overflow-auto rounded-xl bg-slate-950 p-5 text-xs leading-6 text-slate-100">
                  {buildSkillSpec(selectedSkill)}
                </pre>
                <div className="space-y-4">
                  <Panel className="p-4">
                    <SectionTitle title="Portable SkillSpec" helper="The governed asset behind the UI" />
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                      This is the versioned contract for model routing, tools, context, memory, approvals, evals, controls, observability, and ROI measurement.
                    </p>
                    <Button className="mt-4 w-full" variant="secondary" onClick={copySkillSpec}>
                      <FileText size={16} />
                      Copy YAML
                    </Button>
                  </Panel>
                  <Panel className="p-4">
                    <SectionTitle title="Control Bindings" />
                    <div className="mt-3 space-y-2">
                      {["NIST AI RMF", "ISO/IEC 42001", "EU AI Act", "OWASP LLM/MCP"].map((control) => (
                        <div key={control} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm">
                          <span className="font-medium">{control}</span>
                          <Check size={15} className="text-[var(--success)]" />
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}

            {skillTab === "versions" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">Version {selectedSkill.version}</div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">Current live configuration — prompt, tool policy, context sources, and eval threshold.</div>
                  </div>
                  <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--success)]">current</span>
                </div>
                <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-xs leading-5 text-[var(--text-muted)]">
                  Prior-version history, diff, and rollback are not tracked yet — only the current Skill contract is stored. Don&apos;t rely on rollback for governance until contract versioning ships.
                </div>
              </div>
            ) : null}

            {notice ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-5 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-soft)] px-4 py-3 text-sm font-medium text-[var(--primary)]"
              >
                {notice}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-5">
              <Button variant="secondary" onClick={() => onSubmitGovernance(selectedSkill)}>
                <ShieldCheck size={16} />
                Submit risk review
              </Button>
              <Button onClick={() => onRunTest(selectedSkill)}>
                <Play size={16} />
                Run test
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SkillFirstActionGuide({
  skill,
  checks,
  readiness,
  nextCheck,
  nextTitle,
  nextBody,
  onPrimary,
  onCheck,
  onRunTest,
}: {
  skill: Skill;
  checks: SkillLaunchCheck[];
  readiness: number;
  nextCheck?: SkillLaunchCheck;
  nextTitle: string;
  nextBody: string;
  onPrimary: () => void;
  onCheck: (check: SkillLaunchCheck) => void;
  onRunTest: () => void;
}) {
  const completeChecks = checks.filter((check) => check.complete).length;
  const remainingChecks = checks.length - completeChecks;
  const proofLabel = remainingChecks ? `${remainingChecks} item${remainingChecks === 1 ? "" : "s"} left` : "Launch evidence ready";
  const nextActionIcon = nextCheck?.action === "run_eval"
    ? <TestTube2 size={16} />
    : nextCheck?.action === "submit_review"
      ? <ShieldCheck size={16} />
      : <ChevronRight size={16} />;

  return (
    <Panel data-testid="skill-first-action-guide" className="mb-5 overflow-hidden border-[var(--primary)]/16 bg-[var(--surface)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={nextCheck ? "amber" : "green"}>{readiness}% ready</Badge>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-soft)]">Skill launch guide</span>
          </div>
          <h3 className="mt-3 max-w-3xl text-xl font-semibold tracking-tight text-[var(--text)]">Next: {nextTitle}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{nextBody}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onPrimary}>
              {nextActionIcon}
              {nextCheck ? nextCheck.actionLabel : "Run final test"}
            </Button>
            <Button variant="secondary" onClick={onRunTest}>
              <Play size={16} />
              Safe test
            </Button>
          </div>

          <details className="group mt-5 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/72">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text)]">Launch evidence</span>
                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{completeChecks} of {checks.length} checks complete. Click any row to fix or review it.</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={remainingChecks ? "amber" : "green"}>{proofLabel}</Badge>
                <ChevronRight size={16} className="text-[var(--text-soft)] transition group-open:rotate-90" />
              </span>
            </summary>
            <div className="grid gap-2 border-t border-[var(--border)]/70 p-3 md:grid-cols-2">
              {checks.map((check) => (
                <button
                  key={check.id}
                  type="button"
                  className="flex min-w-0 items-start gap-3 rounded-lg bg-[var(--surface)]/80 px-3 py-2.5 text-left ring-1 ring-[var(--border)]/70 transition hover:bg-[var(--surface)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
                  onClick={() => onCheck(check)}
                >
                  <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    check.complete ? "bg-[var(--success)] text-white" : nextCheck?.id === check.id ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--border)] text-[var(--text-muted)]"
                  }`}>
                    {check.complete ? <Check size={12} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[var(--text)]">{check.label}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{check.complete ? "Complete" : check.actionLabel}</span>
                  </span>
                </button>
              ))}
            </div>
          </details>
        </div>

        <div className="border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/70 p-5 lg:border-l lg:border-t-0">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Safe launch standard</div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface)]/80 px-3 py-2 ring-1 ring-[var(--border)]/70">
              <span className="text-xs text-[var(--text-muted)]">Owner</span>
              <span className="truncate text-xs font-semibold text-[var(--text)]">{getUserName(skill.ownerId)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface)]/80 px-3 py-2 ring-1 ring-[var(--border)]/70">
              <span className="text-xs text-[var(--text-muted)]">Quality</span>
              <Badge tone={skill.evalPassRate >= 90 ? "green" : "amber"}>{skill.evalPassRate}% eval</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface)]/80 px-3 py-2 ring-1 ring-[var(--border)]/70">
              <span className="text-xs text-[var(--text-muted)]">Risk</span>
              <Badge tone={riskTone(skill.riskLevel)}>{skill.riskLevel}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface)]/80 px-3 py-2 ring-1 ring-[var(--border)]/70">
              <span className="text-xs text-[var(--text-muted)]">Scope</span>
              <span className="text-xs font-semibold text-[var(--text)]">{skill.allowedTools.length} tools · {skill.contextSources.length} sources</span>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

type SkillLaunchCheck = {
  id: string;
  label: string;
  helper: string;
  complete: boolean;
  targetTab: string;
  action: "open_tab" | "run_eval" | "submit_review" | "create_from_use_case";
  actionLabel: string;
};

function skillLaunchChecks(skill: Skill): SkillLaunchCheck[] {
  return [
    {
      id: "owner",
      label: "Owner assigned",
      helper: "A named owner is accountable for behavior, rollout, and business outcomes.",
      complete: true,
      targetTab: "configuration",
      action: "open_tab",
      actionLabel: "Open setup",
    },
    {
      id: "use-case",
      label: "Business use case linked",
      helper: "Connect the Skill to a scored opportunity so value, process, and risk context are preserved.",
      complete: Boolean(skill.useCaseId),
      targetTab: "configuration",
      action: "create_from_use_case",
      actionLabel: "Link use case",
    },
    {
      id: "risk",
      label: "Risk level classified",
      helper: "Risk level determines review path, approval gates, logging, and allowed autonomy.",
      complete: true,
      targetTab: "configuration",
      action: "open_tab",
      actionLabel: "Open setup",
    },
    {
      id: "autonomy",
      label: "Autonomy tier assigned",
      helper: "The autonomy tier states whether the Skill reads, drafts, prepares actions, or executes with approval.",
      complete: true,
      targetTab: "configuration",
      action: "open_tab",
      actionLabel: "Open setup",
    },
    {
      id: "model",
      label: "Model configured",
      helper: "Choose the provider, model, fallback, cost cap, and runtime limits before launch.",
      complete: Boolean(skill.model),
      targetTab: "configuration",
      action: "open_tab",
      actionLabel: "Configure model",
    },
    {
      id: "prompt",
      label: "Prompt reviewed",
      helper: "Review the Skill prompt contract: role, boundary, citations, refusal path, and output shape.",
      complete: skill.systemPrompt.length > 120,
      targetTab: "prompt",
      action: "open_tab",
      actionLabel: "Review prompt",
    },
    {
      id: "context",
      label: "Context sources approved",
      helper: "Attach approved knowledge sources so the Skill can cite evidence and avoid unsupported answers.",
      complete: skill.contextSources.length > 0,
      targetTab: "context",
      action: "open_tab",
      actionLabel: "Attach knowledge",
    },
    {
      id: "tools",
      label: "Tool policies configured",
      helper: "Define which tools are allowed, blocked, and human-approved before any external action can happen.",
      complete: skill.allowedTools.length > 0,
      targetTab: "tools",
      action: "open_tab",
      actionLabel: "Review tools",
    },
    {
      id: "evals",
      label: "Eval pass rate above threshold",
      helper: "Run quality checks until the Skill meets launch threshold and produces eval evidence.",
      complete: skill.evalPassRate >= 90,
      targetTab: "evals",
      action: "run_eval",
      actionLabel: "Run quality checks",
    },
    {
      id: "governance",
      label: "Governance review complete",
      helper: "Submit risk review so security, legal, privacy, and business owners can approve the pilot boundary.",
      complete: ["pilot", "production", "approved"].includes(skill.status),
      targetTab: "overview",
      action: "submit_review",
      actionLabel: "Submit risk review",
    },
  ];
}

function launchReadiness(skill: Skill) {
  const checks = skillLaunchChecks(skill);
  return Math.round((checks.filter((check) => check.complete).length / checks.length) * 100);
}

function buildSkillSpec(skill: Skill) {
  return `apiVersion: enablement.foundever.ai/v1
kind: SkillSpec
metadata:
  id: ${skill.id}
  name: ${skill.name}
  slug: ${skill.slug}
  version: ${skill.version}
  owner: ${getUserName(skill.ownerId)}
  department: ${skill.department}
  status: ${skill.status}
governance:
  risk_level: ${skill.riskLevel}
  autonomy_tier: ${skill.autonomyTier}
  controls:
    - NIST.AI_RMF.GOVERN
    - NIST.AI_RMF.MEASURE
    - ISO42001.AI_LIFECYCLE
    - EUAI.HUMAN_OVERSIGHT
    - OWASP.LLM01_PROMPT_INJECTION
    - OWASP.MCP04_TOOL_POISONING
model:
  provider: ${skill.modelProvider}
  model: ${skill.model}
  fallback_model: ${skill.fallbackModel}
  temperature: ${skill.temperature}
  max_tokens: ${skill.maxTokens}
  cost_limit_per_run_usd: ${skill.costLimit}
prompt:
  system: |-
${indentYaml(skill.systemPrompt, 4)}
context:
  permission_filtering: true
  sources:
${skill.contextSources.map((source) => `    - name: ${source}\n      retrieval: semantic\n      citations_required: true`).join("\n")}
tools:
  allowed:
${skill.allowedTools.map((tool) => `    - id: ${tool}\n      requires_policy_check: true`).join("\n")}
  blocked:
${skill.blockedTools.map((tool) => `    - ${tool}`).join("\n")}
approvals:
  human_in_loop: ${skill.autonomyTier !== "tier_1_read_only"}
  required_for:
    - write_actions
    - external_messages
    - high_risk_outputs
evaluations:
  passing_threshold: 90
  current_score: ${skill.evalPassRate}
  required:
    - grounding
    - hallucination
    - permission
    - prompt_injection
    - tool_safety
observability:
  trace_model_calls: true
  trace_tool_calls: true
  redact_pii: true
  retain_audit_days: 365
value:
  runs: ${skill.runs}
  adoption_count: ${skill.adoptionCount}
  value_delivered_usd: ${skill.valueDelivered}`;
}

function indentYaml(value: string, spaces: number) {
  const pad = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
}
