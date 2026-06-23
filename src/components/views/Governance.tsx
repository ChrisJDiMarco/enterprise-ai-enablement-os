import { useRef, useState } from "react";
import { AlertTriangle, Check, ChevronRight, ClipboardCheck, FileText, Library, ShieldCheck, UsersRound } from "lucide-react";
import { Badge, Button, DataTable, MiniMetric, Panel, SectionTitle, riskTone, statusTone, type BadgeTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { compliancePacks, incidentResponsePlays } from "@/lib/enterprise-ai-control-plane";
import { statusLabels } from "@/lib/ui/constants";
import { type EvalResult, type GovernanceReview, type Run, type Skill } from "@/lib/enterprise-ai-data";
import { deriveGovernanceProof } from "@/lib/governance-proof";
import { openClawIntegration, openClawRiskScore, openClawStatusTone } from "@/lib/openclaw-integration";
import type { View } from "@/lib/ui/types";

function isOpenReview(review: GovernanceReview) {
  return !["approved", "rejected"].includes(review.status);
}

function itemTypeLabel(review: GovernanceReview) {
  return review.itemType === "skill" ? "AI Skill" : "Use case";
}

function gateForReview(review: GovernanceReview | null): {
  label: string;
  helper: string;
  tone: BadgeTone;
  className: string;
} {
  if (!review) {
    return {
      label: "No packet yet",
      helper: "Submit an AI Skill or use case before launch review can begin.",
      tone: "slate",
      className: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
    };
  }

  if (review.blockers.length) {
    return {
      label: "Launch paused",
      helper: "Request changes until blockers are cleared. Approval should wait for a cleaner packet.",
      tone: "red",
      className: "border-[color-mix(in_srgb,var(--danger)_26%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
    };
  }

  if (review.status === "approved") {
    return {
      label: "Ready to launch",
      helper: "The approval is recorded. Keep the decision evidence attached to launch planning.",
      tone: "green",
      className: "border-[color-mix(in_srgb,var(--success)_26%,var(--border))] bg-[var(--success-soft)] text-[var(--success)]",
    };
  }

  if (review.status === "approved_with_conditions") {
    return {
      label: "Launch with conditions",
      helper: "The work can move forward only while the conditions stay visible to the owner.",
      tone: "amber",
      className: "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
    };
  }

  if (review.status === "changes_requested") {
    return {
      label: "Needs resubmission",
      helper: "The owner needs to update the packet before this can return to decision.",
      tone: "red",
      className: "border-[color-mix(in_srgb,var(--danger)_26%,var(--border))] bg-[var(--danger-soft)] text-[var(--danger)]",
    };
  }

  return {
    label: "Needs decision",
    helper: "The packet is unblocked. Approve it, approve with conditions, or request changes.",
    tone: "amber",
    className: "border-[color-mix(in_srgb,var(--warning)_26%,var(--border))] bg-[var(--warning-soft)] text-[var(--warning)]",
  };
}

function openClawRiskControlView(controlId: string): View {
  if (controlId === "gateway-exposure") return "connectors";
  if (controlId === "skill-provenance") return "skills";
  if (controlId === "credential-scope") return "admin";
  if (controlId === "update-gate") return "harness";
  return "broker";
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDueDate(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? dateOnly(parsed) : null;
}

function dueStatusForReview(review: GovernanceReview, now = new Date()): {
  label: string;
  helper: string;
  tone: BadgeTone;
  overdue: boolean;
} {
  const dueDate = parseDueDate(review.dueDate);
  if (!dueDate) {
    return {
      label: "No due date",
      helper: "Assign a decision date before routing this packet.",
      tone: "amber",
      overdue: false,
    };
  }

  if (!isOpenReview(review)) {
    return {
      label: "closed",
      helper: `Decision recorded. Original due date: ${review.dueDate}.`,
      tone: "green",
      overdue: false,
    };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const deltaDays = Math.round((dueDate.getTime() - dateOnly(now).getTime()) / dayMs);
  if (deltaDays < 0) {
    const daysLate = Math.abs(deltaDays);
    return {
      label: `${daysLate}d overdue`,
      helper: `Due ${review.dueDate}. Escalate the owner or request changes before this enters launch planning.`,
      tone: "red",
      overdue: true,
    };
  }
  if (deltaDays === 0) {
    return {
      label: "due today",
      helper: `Due ${review.dueDate}. Decide today or send the packet back with concrete blockers.`,
      tone: "amber",
      overdue: false,
    };
  }
  if (deltaDays <= 3) {
    return {
      label: `${deltaDays}d left`,
      helper: `Due ${review.dueDate}. Keep reviewer evidence and blockers visible.`,
      tone: "amber",
      overdue: false,
    };
  }

  return {
    label: "on track",
    helper: `Due ${review.dueDate}.`,
    tone: "blue",
    overdue: false,
  };
}

export function Governance({
  reviews,
  skills,
  runs,
  evalResults,
  onDecision,
  onOpenSkills,
  onOpenView,
}: {
  reviews: GovernanceReview[];
  skills: Skill[];
  runs: Run[];
  evalResults: EvalResult[];
  onDecision: (review: GovernanceReview, status: GovernanceReview["status"]) => void;
  onOpenSkills: () => void;
  onOpenView: (view: View) => void;
}) {
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [selectedCompliancePackName, setSelectedCompliancePackName] = useState(compliancePacks[0]?.name ?? "");
  const primaryDecisionRef = useRef<HTMLDivElement>(null);
  const selectedReview =
    reviews.find((review) => review.id === selectedReviewId) ??
    reviews.find((review) => isOpenReview(review) && review.blockers.length > 0) ??
    reviews.find((review) => isOpenReview(review)) ??
    reviews[0] ??
    null;
  const selectedProof = selectedReview
    ? deriveGovernanceProof({ review: selectedReview, skills, runs, evalResults })
    : null;
  const openReviews = reviews.filter(isOpenReview);
  const highRiskReviews = reviews.filter((review) => ["high", "restricted"].includes(review.riskLevel));
  const blockedReviews = reviews.filter((review) => review.blockers.length > 0);
  const approvedReviews = reviews.filter((review) => ["approved", "approved_with_conditions"].includes(review.status));
  const selectedDueStatus = selectedReview ? dueStatusForReview(selectedReview) : null;
  const overdueReviews = reviews.filter((review) => dueStatusForReview(review).overdue);
  const selectedGate = gateForReview(selectedReview);
  const selectedReviewHasBlockers = Boolean(selectedReview?.blockers.length);
  const fullApprovalBlockedReason = selectedReviewHasBlockers
    ? `Full approval is locked until ${selectedReview?.blockers.length ?? 0} blocker${selectedReview?.blockers.length === 1 ? "" : "s"} are cleared. Request changes or approve with conditions instead.`
    : "";
  const nextTitle = selectedReview
    ? selectedReview.blockers.length
      ? `Next: clear blockers before launch`
      : selectedReview.status === "changes_requested"
        ? `Next: resubmit ${selectedReview.title}`
      : isOpenReview(selectedReview)
        ? `Next: decide ${selectedReview.title}`
        : `Next: keep proof attached`
    : "Submit the first risk review";
  const nextBody = selectedReview
    ? selectedReview.blockers.length
      ? `${selectedReview.title} has ${selectedReview.blockers.length} blocker${selectedReview.blockers.length === 1 ? "" : "s"}. Send it back with a concrete fix list before approving.`
      : selectedReview.status === "changes_requested"
        ? `${selectedReview.title} is waiting on an updated packet from the owner. Keep it out of launch planning until the evidence is resubmitted.`
      : isOpenReview(selectedReview)
        ? `${itemTypeLabel(selectedReview)} for ${selectedReview.department} is ready for a decision. Confirm risk, owner, due date, and evidence before choosing a path.`
        : `${selectedReview.title} is ${statusLabels[selectedReview.status] ?? selectedReview.status}. Keep the decision evidence available for the proof ledger.`
    : "Risk Review starts when a Skill or use case is submitted for approval. Open AI Skills to submit the first review packet.";
  const readinessSteps = [
    {
      label: "Reviewer",
      complete: Boolean(selectedReview?.reviewer),
      helper: selectedReview?.reviewer || "Assign a reviewer before decision.",
    },
    {
      label: "Risk",
      complete: Boolean(selectedReview),
      helper: selectedReview ? `${selectedReview.riskLevel} risk classification.` : "No review packet yet.",
    },
    {
      label: "Blockers",
      complete: Boolean(selectedReview && selectedReview.blockers.length === 0),
      helper: selectedReview?.blockers.length ? `${selectedReview.blockers.length} blocker${selectedReview.blockers.length === 1 ? "" : "s"} recorded.` : "No blockers recorded.",
    },
    {
      label: "Decision",
      complete: Boolean(selectedReview && !isOpenReview(selectedReview)),
      helper: selectedReview ? statusLabels[selectedReview.status] ?? selectedReview.status : "Waiting for first review.",
    },
  ];
  const evidenceItems = [
    ["Business justification", true],
    ["Data classification", true],
    ["Tool and access review", reviews.some((review) => review.status !== "not_submitted")],
    ["Eval suite evidence", reviews.some((review) => ["approved", "approved_with_conditions", "in_review"].includes(review.status))],
    ["Human oversight plan", reviews.some((review) => review.riskLevel !== "low")],
    ["Rollback and monitoring", reviews.some((review) => ["approved", "approved_with_conditions"].includes(review.status))],
  ] as const;
  const decisionGuide = selectedReview
    ? [
        {
          label: "What you are approving",
          value: `${itemTypeLabel(selectedReview)} launch gate`,
          helper: `${selectedReview.title} for ${selectedReview.department}.`,
        },
        {
          label: "Main risk",
          value: `${selectedReview.riskLevel} risk`,
          helper: selectedReview.blockers[0] ?? "No blocker is recorded in this packet.",
        },
        {
          label: "Approve when",
          value: selectedReview.blockers.length ? "Not yet" : "Evidence is enough",
          helper: selectedReview.blockers.length
            ? "Clear the blocker list before full approval."
            : "Owner, risk, due date, eval evidence, tool controls, and oversight are acceptable.",
        },
        {
          label: "Send back when",
          value: selectedReview.blockers.length ? "Use request changes" : "Evidence is missing",
          helper: "Ask for concrete updates when evals, controls, rollback, owner, or privacy evidence are incomplete.",
        },
      ]
    : [];
  const completedReadinessSteps = readinessSteps.filter((step) => step.complete).length;
  const reviewHealth = [
    { label: "Open reviews", value: String(openReviews.length), helper: `${reviews.length} total packets` },
    { label: "High risk", value: String(highRiskReviews.length), helper: "restricted or high risk" },
    { label: "Blockers", value: String(blockedReviews.length), helper: "need owner follow-up" },
    { label: "Overdue", value: String(overdueReviews.length), helper: "need reviewer escalation" },
  ];
  const assuranceScore = Math.round(
    ([
      reviews.length > 0,
      approvedReviews.length > 0,
      evidenceItems.filter(([, complete]) => complete).length >= 4,
      blockedReviews.length === 0 && reviews.length > 0,
      highRiskReviews.length === 0 || approvedReviews.length > 0,
    ].filter(Boolean).length /
      5) *
      100,
  );
  const selectedCompliancePack =
    compliancePacks.find((pack) => pack.name === selectedCompliancePackName) ??
    compliancePacks[0] ??
    null;
  const selectedCompliancePackCompleteCount = selectedCompliancePack
    ? Math.min(selectedCompliancePack.evidence.length, evidenceItems.filter(([, complete]) => complete).length)
    : 0;
  function compliancePackActionLabel(pack: (typeof compliancePacks)[number]) {
    if (pack.targetView === "evidence") return "Open Proof Ledger";
    return reviews.length ? "Review current packet" : "Start first review";
  }

  function compliancePackActionTestId(pack: (typeof compliancePacks)[number]) {
    const packSlug = pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `compliance-pack-action-${packSlug}`;
  }

  function handleCompliancePackSelect(pack: (typeof compliancePacks)[number]) {
    setSelectedCompliancePackName(pack.name);
  }

  function handleCompliancePackAction(pack: (typeof compliancePacks)[number]) {
    setSelectedCompliancePackName(pack.name);

    if (pack.targetView === "evidence") {
      onOpenView("evidence");
      return;
    }

    if (!reviews.length) {
      onOpenSkills();
      return;
    }

    if (selectedReview) {
      setSelectedReviewId(selectedReview.id);
    }

    window.requestAnimationFrame(() => {
      primaryDecisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleSelectedCompliancePackAction() {
    if (!selectedCompliancePack) return;
    handleCompliancePackAction(selectedCompliancePack);
  }

  const governanceAssurancePanels = (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
      <Panel className="overflow-hidden" data-testid="governance-compliance-packs">
        <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title="Compliance Packs"
              helper="Map each AI launch packet to the assurance evidence enterprise reviewers and auditors expect."
              compact
            />
            <Badge tone={assuranceScore >= 80 ? "green" : assuranceScore >= 45 ? "amber" : "red"}>{assuranceScore}% ready</Badge>
          </div>
        </div>
        <div className="grid gap-px bg-[var(--border)]/70 md:grid-cols-2 xl:grid-cols-4">
          {compliancePacks.map((pack) => {
            const isSelected = selectedCompliancePack?.name === pack.name;

            return (
              <div
                key={pack.name}
                className={`min-h-[150px] bg-[var(--surface)] p-4 text-left transition focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] ${
                  isSelected
                    ? "relative z-[1] bg-[var(--primary-soft)]/30 ring-2 ring-[var(--primary)]/45"
                    : "hover:bg-[var(--primary-soft)]/35"
                }`}
              >
                <button
                  type="button"
                  aria-controls="selected-compliance-pack-detail"
                  aria-label={`View compliance pack details: ${pack.name}`}
                  aria-pressed={isSelected}
                  onClick={() => handleCompliancePackSelect(pack)}
                  className="block w-full rounded-lg text-left outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-soft)]"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                      <FileText size={16} className="text-[var(--primary)]" />
                      {pack.name}
                    </span>
                    <Badge tone={pack.name.includes("Board") && approvedReviews.length ? "green" : reviews.length ? "blue" : "amber"}>
                      {pack.owner}
                    </Badge>
                  </span>
                  <span className="mt-2 line-clamp-2 block text-xs leading-5 text-[var(--text-muted)]">{pack.purpose}</span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {pack.evidence.slice(0, 3).map((item) => (
                      <span key={item} className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                        {item}
                      </span>
                    ))}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                    {isSelected ? "Pack details open" : "View pack details"}
                    <ChevronRight size={13} />
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${compliancePackActionLabel(pack)} for ${pack.name}`}
                  onClick={() => handleCompliancePackAction(pack)}
                  data-testid={compliancePackActionTestId(pack)}
                  className="mt-3 inline-flex items-center gap-1 rounded-full px-0 py-1 text-xs font-semibold text-[var(--primary)] outline-none transition hover:text-[var(--primary-strong)] focus-visible:ring-4 focus-visible:ring-[var(--primary-soft)]"
                >
                  {compliancePackActionLabel(pack)}
                  <ChevronRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
        {selectedCompliancePack ? (
          <div
            id="selected-compliance-pack-detail"
            className="border-t border-[var(--border)] bg-[var(--surface-muted)]/72 p-4"
            data-testid="governance-compliance-pack-detail"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={selectedCompliancePack.targetView === "evidence" ? "purple" : "blue"}>
                    {selectedCompliancePack.targetView === "evidence" ? "audit packet" : "risk review"}
                  </Badge>
                  <Badge tone={selectedCompliancePackCompleteCount === selectedCompliancePack.evidence.length ? "green" : "amber"}>
                    {selectedCompliancePackCompleteCount}/{selectedCompliancePack.evidence.length} evidence mapped
                  </Badge>
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-[var(--text)]">{selectedCompliancePack.name}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{selectedCompliancePack.purpose}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {selectedCompliancePack.evidence.map((item, index) => {
                    const isMapped = index < selectedCompliancePackCompleteCount;

                    return (
                      <div key={item} className="flex items-start gap-2 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-3">
                        <span
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            isMapped ? "bg-[var(--success)] text-white" : "bg-[var(--surface-subtle)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                          }`}
                        >
                          {isMapped ? <Check size={13} /> : index + 1}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[var(--text)]">{item}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
                            {isMapped ? "Mapped from current workspace evidence." : "Needs a reviewer-owned artifact."}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/82 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">Owner</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text)]">{selectedCompliancePack.owner}</div>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
                  {selectedCompliancePack.targetView === "evidence"
                    ? "This pack is assembled in the Proof Ledger so auditors can inspect the final evidence packet."
                    : reviews.length
                      ? "This pack is reviewed against the current decision packet and blocker list on this page."
                      : "Create or submit a Skill review packet before this pack can move through approval."}
                </p>
                <Button className="mt-4 w-full" onClick={handleSelectedCompliancePackAction}>
                  {compliancePackActionLabel(selectedCompliancePack)}
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel className="p-5" data-testid="governance-incident-response">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            title="AI Incident Response"
            helper="Response plays for the AI-specific failures that normal software incident plans often miss."
          />
          <Badge tone={blockedReviews.length ? "amber" : "green"}>
            {blockedReviews.length ? "watch blockers" : "ready to drill"}
          </Badge>
        </div>
        <div className="mt-4 space-y-3">
          {incidentResponsePlays.map((play) => (
            <button
              key={play.trigger}
              type="button"
              aria-label={`Open incident response play: ${play.trigger}`}
              onClick={() => onOpenView(play.targetView)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]/78 p-4 text-left transition hover:border-[var(--primary)]/25 hover:bg-[var(--surface)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <AlertTriangle size={16} className="text-[var(--warning)]" />
                  {play.trigger}
                </div>
                <ChevronRight size={15} className="text-[var(--text-soft)]" />
              </div>
              <div className="mt-3 grid gap-2 text-xs leading-5 text-[var(--text-muted)] sm:grid-cols-3">
                <div><span className="font-semibold text-[var(--text)]">Contain:</span> {play.contain}</div>
                <div><span className="font-semibold text-[var(--text)]">Investigate:</span> {play.investigate}</div>
                <div><span className="font-semibold text-[var(--text)]">Restore:</span> {play.restore}</div>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );

  if (!reviews.length) {
    return (
      <div>
        <PageHeader
          title="Risk Review"
          subtitle="A decision console for approving, conditioning, or sending AI work back before launch."
          action={
            <Button onClick={onOpenSkills}>
              <Library size={16} />
              Open AI Skills
            </Button>
          }
        />

        <Panel className="overflow-hidden" data-testid="governance-empty-primary">
          <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 p-5 sm:p-6">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">start here</span>
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">
                Submit the first risk review
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                A review packet gives approvers the risk classification, owner, blockers, tool permissions, eval evidence, human oversight, and rollback plan before launch.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={onOpenSkills}>
                  <Library size={15} />
                  Open AI Skills
                </Button>
              </div>
              <div className="mt-7 grid gap-5 md:grid-cols-4">
                {[
                  ["1", "Submit", "Send a Skill or use case into review."],
                  ["2", "Check risk", "Confirm data, tools, autonomy, and human impact."],
                  ["3", "Resolve blockers", "Request missing evals, policies, owners, or rollback evidence."],
                  ["4", "Decide", "Approve, approve with conditions, or request changes."],
                ].map(([step, label, helper]) => (
                  <div key={label} className="border-l border-[var(--border)] pl-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--text-muted)] ring-1 ring-[var(--border)]">{step}</span>
                      <div className="font-semibold text-[var(--text)]">{label}</div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{helper}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-5 xl:border-l xl:border-t-0">
              <SectionTitle title="Review health" helper="Waiting for the first packet" compact />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniMetric label="Open" value="0" />
                <MiniMetric label="High risk" value="0" />
                <MiniMetric label="Blockers" value="0" />
                <MiniMetric label="Approved" value="0" />
              </div>
              <div className="mt-4 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <ShieldCheck size={16} className="text-[var(--primary)]" />
                  Approval evidence starts here
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  Review decisions become launch proof for the evidence ledger, reports, and production readiness.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        {governanceAssurancePanels}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Risk Review"
        subtitle="A decision console for approving, conditioning, or sending AI work back before launch."
        action={
          <Button variant="secondary" onClick={onOpenSkills}>
            <Library size={16} />
            Open AI Skills
          </Button>
        }
      />

      <div ref={primaryDecisionRef}>
        <Panel className="overflow-hidden" data-testid="governance-primary-decision">
          <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={selectedGate.tone}>{selectedGate.label}</Badge>
              {selectedReview ? <Badge tone={riskTone(selectedReview.riskLevel)}>{selectedReview.riskLevel} risk</Badge> : null}
              {selectedReview ? <Badge tone="slate">{itemTypeLabel(selectedReview)}</Badge> : null}
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] tabular-nums text-[var(--text-soft)]">
                {openReviews.length} open · {highRiskReviews.length} high risk · {blockedReviews.length} with blockers
              </span>
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">{nextTitle}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">{nextBody}</p>

            {selectedReview && selectedProof && selectedReview.itemType === "skill" ? (
              <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4" data-testid="governance-decision-proof">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--text)]">
                  <ClipboardCheck size={15} className="text-[var(--primary)]" />
                  Decision proof
                  {!selectedProof.skillFound ? <Badge tone="amber">no linked Skill evidence</Badge> : null}
                </div>
                {selectedProof.skillFound ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MiniMetric label="Runs" value={`${selectedProof.completedRuns}/${selectedProof.totalRuns} done`} />
                      <MiniMetric
                        label="Evals"
                        value={
                          selectedProof.evalCount
                            ? `${selectedProof.latestEvalScore ?? selectedProof.evalPassRate ?? 0}%${selectedProof.simulatedEvalCount ? " (sim)" : ""}`
                            : "None"
                        }
                      />
                      <MiniMetric label="Tools" value={String(selectedProof.toolCount)} />
                      <MiniMetric label="Context" value={String(selectedProof.contextCount)} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                      {selectedProof.skillName} · {selectedProof.skillStatus} · autonomy {selectedProof.autonomyTier ?? "n/a"} · latest run{" "}
                      {selectedProof.latestRunStatus ?? "none"}
                      {selectedProof.blockedRuns ? ` · ${selectedProof.blockedRuns} blocked run(s)` : ""}.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                    No linked Skill runs, evals, or tools were found for this review yet. Approving without proof is high-risk —
                    have the owner run the Harness and evals first.
                  </p>
                )}
              </div>
            ) : null}

            {selectedReview ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {selectedReviewHasBlockers ? (
                  <>
                    <Button variant="danger" onClick={() => onDecision(selectedReview, "changes_requested")}>
                      <AlertTriangle size={15} />
                      Request changes
                    </Button>
                    <Button variant="secondary" onClick={() => onDecision(selectedReview, "approved_with_conditions")}>
                      <ShieldCheck size={15} />
                      Approve with conditions
                    </Button>
                    <Button
                      disabled
                      aria-describedby="governance-full-approval-blocked-reason"
                      onClick={() => onDecision(selectedReview, "approved")}
                      title={fullApprovalBlockedReason}
                    >
                      <Check size={15} />
                      Approve
                    </Button>
                    <div
                      id="governance-full-approval-blocked-reason"
                      className="basis-full rounded-lg border border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] px-3 py-2 text-xs font-medium leading-5 text-[var(--warning)]"
                    >
                      {fullApprovalBlockedReason}
                    </div>
                  </>
                ) : (
                  <>
                    <Button onClick={() => onDecision(selectedReview, "approved")} title="Approve this review packet.">
                      <Check size={15} />
                      Approve
                    </Button>
                    <Button variant="secondary" onClick={() => onDecision(selectedReview, "approved_with_conditions")}>
                      <ShieldCheck size={15} />
                      Approve with conditions
                    </Button>
                    <Button variant="danger" onClick={() => onDecision(selectedReview, "changes_requested")}>
                      Request changes
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            <details
              className="group mt-6 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-muted)]/72"
              data-testid="governance-review-proof"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text)]">Review checklist and proof</span>
                  <span className="mt-0.5 block truncate text-xs tabular-nums text-[var(--text-muted)]">
                    {completedReadinessSteps}/{readinessSteps.length} checks complete · {blockedReviews.length} packet{blockedReviews.length === 1 ? "" : "s"} blocked · {approvedReviews.length} approved
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={selectedReviewHasBlockers ? "red" : completedReadinessSteps === readinessSteps.length ? "green" : "amber"}>
                    {selectedReviewHasBlockers ? "blocked" : `${completedReadinessSteps}/${readinessSteps.length}`}
                  </Badge>
                  <ChevronRight size={16} className="text-[var(--text-soft)] transition group-open:rotate-90" />
                </span>
              </summary>
              <div className="hidden border-t border-[var(--border)]/70 group-open:block">
                <div className="grid gap-px bg-[var(--border)]/70 md:grid-cols-2 xl:grid-cols-4">
                  {readinessSteps.map((step, index) => (
                    <div key={step.label} className="min-h-[112px] bg-[var(--surface)] p-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            step.complete ? "bg-[var(--success)] text-white" : "bg-[var(--surface-subtle)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                          }`}
                        >
                          {step.complete ? <Check size={14} /> : index + 1}
                        </span>
                        <div className="text-sm font-semibold text-[var(--text)]">{step.label}</div>
                      </div>
                      <p className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{step.helper}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-px border-t border-[var(--border)]/70 bg-[var(--border)]/70 lg:grid-cols-2">
                  {decisionGuide.map((item) => (
                    <div key={item.label} className="bg-[var(--surface)] p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{item.label}</div>
                      <div className="mt-1 text-sm font-semibold text-[var(--text)]">{item.value}</div>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.helper}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-px border-t border-[var(--border)]/70 bg-[var(--border)]/70 sm:grid-cols-2 xl:grid-cols-4">
                  {reviewHealth.map((item) => (
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

          <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/56 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Current packet" helper="The minimum context needed to decide" compact />
            {selectedReview ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-lg font-semibold leading-6 text-[var(--text)]">{selectedReview.title}</div>
                  <div className="mt-1 text-sm text-[var(--text-muted)]">
                    {itemTypeLabel(selectedReview)} · {selectedReview.department}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={riskTone(selectedReview.riskLevel)}>{selectedReview.riskLevel} risk</Badge>
                  <Badge tone={statusTone(selectedReview.status)}>{statusLabels[selectedReview.status]}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/72 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Reviewer</div>
                    <div className="mt-1 font-semibold text-[var(--text)]">{selectedReview.reviewer || "Unassigned"}</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/72 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Due</div>
                      {selectedDueStatus ? <Badge tone={selectedDueStatus.tone}>{selectedDueStatus.label}</Badge> : null}
                    </div>
                    <div className="mt-1 font-semibold text-[var(--text)]">{selectedReview.dueDate}</div>
                    {selectedDueStatus ? (
                      <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{selectedDueStatus.helper}</div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/72 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text)]">Blockers</div>
                    <Badge tone={selectedReviewHasBlockers ? "red" : "green"}>
                      {selectedReviewHasBlockers ? selectedReview.blockers.length : "none"}
                    </Badge>
                  </div>
                  {selectedReviewHasBlockers ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--text-muted)]">
                      {selectedReview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">No blockers are recorded for this packet.</p>
                  )}
                </div>
              </div>
            ) : null}
            <div className={`mt-4 rounded-lg border p-4 ${selectedGate.className}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                {selectedReview?.blockers.length ? <AlertTriangle size={16} className="text-[var(--danger)]" /> : <ShieldCheck size={16} className="text-[var(--success)]" />}
                {selectedGate.label}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{selectedGate.helper}</p>
            </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4 overflow-hidden" data-testid="openclaw-risk-template">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">Agent runtime risk review</span>
              <Badge tone={openClawRiskScore >= 80 ? "green" : "amber"}>{openClawRiskScore}% controls passing</Badge>
              <Badge tone="amber">review required</Badge>
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--text)]">
              Review every agent runtime like an operating surface, not a single app connector
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
              The review template covers gateway exposure, Skill provenance, credential scope, DM pairing,
              sandbox enforcement, update gates, and the evidence each owner must provide before launch.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {openClawIntegration.riskControls.map((control) => (
                <button
                  key={control.id}
                  type="button"
                  aria-label={`Open agent runtime control ${control.label}: ${control.status}`}
                  onClick={() => onOpenView(openClawRiskControlView(control.id))}
                  className={`rounded-lg border p-4 text-left transition ${
                    control.status === "pass"
                      ? "border-[color-mix(in_srgb,var(--success)_24%,var(--border))] bg-[var(--success-soft)] hover:border-[color-mix(in_srgb,var(--success)_38%,var(--border))]"
                      : control.status === "warn"
                        ? "border-[color-mix(in_srgb,var(--warning)_28%,var(--border))] bg-[var(--warning-soft)] hover:border-[color-mix(in_srgb,var(--warning)_42%,var(--border))]"
                        : "border-[color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[var(--danger-soft)] hover:border-[color-mix(in_srgb,var(--danger)_42%,var(--border))]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{control.label}</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{control.owner}</div>
                    </div>
                    <Badge tone={openClawStatusTone(control.status)}>{control.status}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--text-muted)]">{control.why}</p>
                  <p className="mt-3 text-xs font-semibold leading-5 text-[var(--text-muted)]">{control.action}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/62 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Approval packet" helper="Minimum content reviewers should expect." compact />
            <div className="mt-4 space-y-2">
              {[
                ["Gateway", "URL, version, auth mode, sandbox mode, denied origins."],
                ["Agents", "Owner, purpose, channels, tools, autonomy, active sessions."],
                ["Skills", "Source, status, pass rate, risk labels, allowed agent list."],
                ["Proof", "Latest run, approval, policy, eval, and update evidence."],
                ["Rollback", "Gateway policy snapshot and owner for rollback decision."],
              ].map(([label, body], index) => (
                <div key={label} className="flex gap-3 rounded-lg border border-[var(--border)]/72 bg-[var(--surface)]/78 p-3">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index < 2 ? "bg-[var(--success)] text-white" : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"}`}>
                    {index < 2 ? <Check size={14} /> : index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text)]">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{body}</span>
                  </span>
                </div>
              ))}
            </div>
            <Button className="mt-4 w-full" variant="secondary" onClick={onOpenSkills}>
              <Library size={15} />
              Open Skill evidence
            </Button>
          </div>
        </div>
      </Panel>

      <details
        className="group mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
        data-testid="governance-review-queue"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="font-semibold text-[var(--text)]">Change review packet</div>
            <div className="mt-1 truncate text-sm text-[var(--text-muted)]">
              {reviews.length} packets · {openReviews.length} open · {blockedReviews.length} blocked
            </div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
        </summary>
        <div className="hidden border-t border-[var(--border)] group-open:block">
          <DataTable
            caption="Risk review queue"
            columns={["Review", "Risk", "Decision", "Blockers"]}
            minWidth={640}
            rows={reviews.map((review) => {
              const due = dueStatusForReview(review);
              return [
                <div key={review.id + "-title"}>
                  <button
                    type="button"
                    aria-label={`Select risk review packet: ${review.title}`}
                    className="text-left font-semibold text-[var(--text)] hover:text-[var(--primary)]"
                    onClick={() => setSelectedReviewId(review.id)}
                  >
                    {review.title}
                  </button>
                  <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    {itemTypeLabel(review)} · {review.department} · {review.reviewer || "Unassigned"} · due {review.dueDate}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={due.tone}>{due.label}</Badge>
                    <span className="text-xs text-[var(--text-muted)]">{due.helper}</span>
                  </div>
                </div>,
                <Badge key={review.id + "-risk"} tone={riskTone(review.riskLevel)}>{review.riskLevel}</Badge>,
                <Badge key={review.id + "-status"} tone={statusTone(review.status)}>{statusLabels[review.status]}</Badge>,
                <span key={review.id + "-blockers"} className={review.blockers.length ? "font-semibold text-[var(--danger)]" : "text-[var(--text-muted)]"}>
                  {review.blockers.length ? `${review.blockers.length} blocker${review.blockers.length === 1 ? "" : "s"}` : "None"}
                </span>,
              ];
            })}
          />
        </div>
      </details>

      {governanceAssurancePanels}

      <details
        className="group mt-4 overflow-hidden rounded-lg border border-[var(--border)]/52 bg-[var(--surface)]/[0.76] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/40 backdrop-blur-xl"
        data-testid="governance-risk-model"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="font-semibold text-[var(--text)]">Risk taxonomy, approval matrix, and required evidence</div>
            <div className="mt-1 truncate text-sm text-[var(--text-muted)]">Open for the full review model and minimum approval packet.</div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-[var(--text-soft)] transition group-open:rotate-90" />
        </summary>
        <div className="hidden gap-4 border-t border-[var(--border)] p-5 group-open:grid xl:grid-cols-3">
          <div>
            <SectionTitle title="Risk taxonomy" helper="Reviewers classify every AI capability against these categories" compact />
            <div className="mt-4 space-y-2">
              {[
                "Data privacy",
                "Security",
                "Prompt injection",
                "Hallucination",
                "Bias/fairness",
                "Employee impact",
                "Customer impact",
                "Legal exposure",
                "Financial exposure",
                "External communication",
                "Excessive autonomy",
              ].map((risk, index) => (
                <div key={risk} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                  <span className="font-medium text-[var(--text-muted)]">{risk}</span>
                  <Badge tone={index < 2 ? "amber" : index < 5 ? "blue" : "slate"}>{index < 2 ? "Core" : index < 5 ? "AI" : "Business"}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle title="Approval matrix" helper="Who must decide before pilot or production launch" compact />
            <div className="mt-4 space-y-3">
              {[
                [ShieldCheck, "Security", "Tool access, identity, connector boundaries, and runtime monitoring."],
                [ClipboardCheck, "Legal / Compliance", "External commitments, regulated decisions, documentation, and exceptions."],
                [UsersRound, "Privacy / People", "PII, employee impact, retention, redaction, and human oversight."],
                [AlertTriangle, "Function Owner", "Pilot scope, value baseline, adoption plan, and rollback owner."],
              ].map(([Icon, title, body]) => {
                const MatrixIcon = Icon as typeof ShieldCheck;
                return (
                  <div key={String(title)} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                    <MatrixIcon size={17} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">{title as string}</div>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{body as string}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <SectionTitle title="Evidence required" helper="Minimum packet before approval" compact />
            <div className="mt-4 space-y-3">
              {evidenceItems.map(([label, complete]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                  <span className="font-medium text-[var(--text-muted)]">{label}</span>
                  <Badge tone={complete ? "green" : "amber"}>{complete ? "Present" : "Needed"}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
