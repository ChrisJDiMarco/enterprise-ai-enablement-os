import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Gauge,
  MailCheck,
  Route,
  Send,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Badge, Button, MiniMetric, Panel, SectionTitle, StatusNotice, type BadgeTone } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { downloadTextFile, filenameFromContentDisposition, safeExportFilename } from "@/lib/ui/export-utils";
import {
  buildReportingCommandCenter,
  reportTemplates,
  type ReportTemplateId,
  type ReportMetricSnapshot,
} from "@/lib/report-generator";
import type { EvalResult, GovernanceReview, Run, Skill, UseCase, WorkSignal } from "@/lib/enterprise-ai-data";

export type ReportGenerationMeta = {
  mode: "ai_assisted" | "deterministic_fallback";
  templateTitle: string;
  generatedAt: string;
  provider: string;
  modelRef: string;
  routeReason: string;
  localFallback: boolean;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  evidence: {
    useCases: number;
    skills: number;
    governanceReviews: number;
    workSignals: number;
  };
};

type ReportBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

function parseReportMarkdown(content: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";

    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index]?.trim() ?? "";
        const currentUnordered = current.match(/^[-*]\s+(.+)$/);
        const currentOrdered = current.match(/^\d+\.\s+(.+)$/);
        if (isOrdered && currentOrdered) {
          items.push(currentOrdered[1].trim());
          index += 1;
          continue;
        }
        if (!isOrdered && currentUnordered) {
          items.push(currentUnordered[1].trim());
          index += 1;
          continue;
        }
        break;
      }

      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index]?.trim() ?? "";
      if (
        !current ||
        /^(#{1,3})\s+/.test(current) ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={`${token}-${index}`} className="font-semibold text-slate-950">{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={`${token}-${index}`} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800">
          {token.slice(1, -1)}
        </code>
      );
    }

    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a key={`${token}-${index}`} href={link[2]} className="font-semibold text-[#5147e8] underline-offset-4 hover:underline">
          {link[1]}
        </a>
      );
    }

    return token;
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInlineMarkdownHtml(text: string) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);

  return tokens
    .map((token) => {
      if (token.startsWith("**") && token.endsWith("**")) {
        return `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
      }

      if (token.startsWith("`") && token.endsWith("`")) {
        return `<code>${escapeHtml(token.slice(1, -1))}</code>`;
      }

      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = link[2].trim();
        const safeHref = /^(https?:|mailto:|#|\/)/i.test(href) ? href : "#";
        return `<a href="${escapeHtml(safeHref)}">${escapeHtml(link[1])}</a>`;
      }

      return escapeHtml(token);
    })
    .join("");
}

function reportMarkdownToHtml(content: string) {
  return parseReportMarkdown(content)
    .map((block) => {
      if (block.type === "heading") {
        return `<h${block.level}>${renderInlineMarkdownHtml(block.text)}</h${block.level}>`;
      }

      if (block.type === "list") {
        const listTag = block.ordered ? "ol" : "ul";
        const items = block.items.map((item) => `<li>${renderInlineMarkdownHtml(item)}</li>`).join("");
        return `<${listTag}>${items}</${listTag}>`;
      }

      return `<p>${renderInlineMarkdownHtml(block.text)}</p>`;
    })
    .join("\n");
}

function buildPrintableReportHtml(content: string, title: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
    }
    .page {
      width: min(880px, calc(100vw - 48px));
      margin: 40px auto;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 18px 56px rgba(15, 23, 42, 0.08);
      padding: 48px;
    }
    .eyebrow {
      color: #64748b;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .meta {
      margin-top: 4px;
      color: #64748b;
      font-size: 14px;
    }
    .document {
      margin-top: 28px;
      border-top: 1px solid #e2e8f0;
      padding-top: 24px;
    }
    h1, h2, h3 {
      margin: 0 0 12px;
      color: #0f172a;
      line-height: 1.2;
      letter-spacing: 0;
    }
    h1 { font-size: 30px; }
    h2 { margin-top: 28px; font-size: 21px; }
    h3 { margin-top: 22px; font-size: 17px; }
    p { margin: 0 0 14px; color: #334155; font-size: 15px; }
    ul, ol { margin: 0 0 18px; padding-left: 24px; color: #334155; font-size: 15px; }
    li { margin: 7px 0; }
    strong { color: #0f172a; font-weight: 700; }
    code { border-radius: 6px; background: #f1f5f9; padding: 2px 6px; font-family: "SFMono-Regular", Consolas, monospace; }
    a { color: #5147e8; font-weight: 700; text-decoration: none; }
    .footer {
      margin-top: 36px;
      border-top: 1px solid #e2e8f0;
      padding-top: 18px;
      color: #64748b;
      font-size: 12px;
    }
    @media print {
      body { background: #ffffff; }
      .page {
        width: auto;
        margin: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="eyebrow">Enterprise AI Enablement OS</div>
    <div class="meta">${escapeHtml(title)} - printable executive packet</div>
    <section class="document">
      ${reportMarkdownToHtml(content)}
    </section>
    <div class="footer">Generated from governed workspace data. Review before external distribution.</div>
  </main>
</body>
</html>`;
}

function reportFilename(title: string) {
  return `${safeExportFilename(title, "enterprise-ai-report")}.html`;
}

function reportNoticeTone(message: string): BadgeTone {
  const lower = message.toLowerCase();
  if (lower.includes("failed") || lower.includes("unavailable") || lower.includes("not available") || lower.includes("could not")) {
    return "red";
  }
  if (lower.includes("deterministic") || lower.includes("fallback") || lower.includes("no live") || lower.includes("generate a report")) {
    return "amber";
  }
  if (lower.includes("copied") || lower.includes("downloaded") || lower.includes("generated")) {
    return "green";
  }
  return "blue";
}

function toneTextClass(tone: ReportMetricSnapshot["tone"]) {
  if (tone === "green") return "text-emerald-700";
  if (tone === "amber") return "text-amber-700";
  if (tone === "red") return "text-red-700";
  if (tone === "blue") return "text-sky-700";
  if (tone === "purple") return "text-indigo-700";
  return "text-slate-700";
}

function toneBarClass(tone: ReportMetricSnapshot["tone"]) {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "red") return "bg-red-500";
  if (tone === "blue") return "bg-sky-500";
  if (tone === "purple") return "bg-indigo-500";
  return "bg-slate-400";
}

function MetricSnapshotTile({ metric }: { metric: ReportMetricSnapshot }) {
  return (
    <div className="rounded-lg border border-slate-200/72 bg-white/74 p-3 shadow-[var(--shadow-button)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{metric.label}</div>
          <div className={`mt-2 text-xl font-semibold tracking-tight ${toneTextClass(metric.tone)}`}>{metric.value}</div>
        </div>
        <Badge tone={metric.tone}>{metric.progress}%</Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{metric.helper}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${toneBarClass(metric.tone)}`} style={{ width: `${metric.progress}%` }} />
      </div>
    </div>
  );
}

function MetricSnapshotPill({ metric }: { metric: ReportMetricSnapshot }) {
  return (
    <div className="rounded-lg border border-slate-200/72 bg-white/76 px-3 py-2.5 shadow-[var(--shadow-button)]" title={metric.helper}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{metric.label}</div>
          <div className={`mt-1 truncate text-lg font-semibold leading-none ${toneTextClass(metric.tone)}`}>{metric.value}</div>
        </div>
        <span className="shrink-0 text-xs font-semibold text-slate-400">{metric.progress}%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${toneBarClass(metric.tone)}`} style={{ width: `${metric.progress}%` }} />
      </div>
    </div>
  );
}

function VisualBars({
  bars,
}: {
  bars: { label: string; value: number; tone: ReportMetricSnapshot["tone"] }[];
}) {
  return (
    <div className="space-y-2">
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="flex items-center justify-between gap-3 text-xs font-semibold">
            <span className="text-slate-600">{bar.label}</span>
            <span className={toneTextClass(bar.tone)}>{bar.value}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${toneBarClass(bar.tone)}`} style={{ width: `${bar.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RenderedReport({ content }: { content: string }) {
  const blocks = useMemo(() => parseReportMarkdown(content), [content]);

  return (
    <article className="report-document mx-auto max-w-3xl text-slate-700">
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Executive Artifact</div>
          <div className="mt-1 text-sm font-medium text-slate-500">Rendered from governed workspace data</div>
        </div>
        <Badge tone="green">rich text</Badge>
      </div>

      <div className="space-y-5">
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            const headingClass =
              block.level === 1
                ? "text-2xl font-semibold tracking-normal text-slate-950"
                : block.level === 2
                  ? "pt-3 text-lg font-semibold tracking-normal text-slate-950"
                  : "pt-2 text-base font-semibold tracking-normal text-slate-900";
            const HeadingTag = `h${block.level}` as "h1" | "h2" | "h3";
            return (
              <HeadingTag key={`${block.text}-${index}`} className={headingClass}>
                {renderInlineMarkdown(block.text)}
              </HeadingTag>
            );
          }

          if (block.type === "list") {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag
                key={`${block.ordered ? "ol" : "ul"}-${index}`}
                className={`space-y-2 pl-6 text-sm leading-6 text-slate-700 ${block.ordered ? "list-decimal" : "list-disc"}`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`} className="pl-1">
                    {renderInlineMarkdown(item)}
                  </li>
                ))}
              </ListTag>
            );
          }

          return (
            <p key={`${block.text}-${index}`} className="text-sm leading-7 text-slate-600">
              {renderInlineMarkdown(block.text)}
            </p>
          );
        })}
      </div>
    </article>
  );
}

export function Reports({
  report,
  onGenerate,
  onCopy,
  generationMeta,
  useCases,
  skills,
  governanceReviews,
  workSignals,
  runs,
  evalResults,
}: {
  report: string;
  onGenerate: (templateId: ReportTemplateId) => ReportGenerationMeta | null | void | Promise<ReportGenerationMeta | null | void>;
  onCopy: () => Promise<string>;
  generationMeta?: ReportGenerationMeta | null;
  useCases: UseCase[];
  skills: Skill[];
  governanceReviews: GovernanceReview[];
  workSignals: WorkSignal[];
  runs: Run[];
  evalResults: EvalResult[];
}) {
  const [selectedType, setSelectedType] = useState<ReportTemplateId>("weekly_ai_enablement_brief");
  const [exportNotice, setExportNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const reportingCenter = useMemo(
    () =>
      buildReportingCommandCenter({
        useCases,
        skills,
        governanceReviews,
        workSignals,
        runs,
        evalResults,
        report,
        generatedAt: generationMeta?.generatedAt,
      }),
    [evalResults, generationMeta?.generatedAt, governanceReviews, report, runs, skills, useCases, workSignals],
  );
  const selectedTemplate = reportTemplates.find((template) => template.id === selectedType) ?? reportTemplates[0];
  const reportReady = report.trim().length > 0;
  const reportExportDisabledReasonId = "report-export-disabled-reason";
  const reportExportDisabledReason = "Generate a report before copying or exporting. Choose an update type, then generate the first report.";
  const currentReportTitle = useMemo(
    () => {
      const heading = parseReportMarkdown(report).find(
        (block): block is Extract<ReportBlock, { type: "heading" }> => block.type === "heading" && block.level === 1,
      );
      return heading?.text ?? "";
    },
    [report],
  );
  const currentArtifactTitle = reportReady
    ? currentReportTitle || generationMeta?.templateTitle || selectedTemplate.title
    : selectedTemplate.title;
  const evidenceCounts = generationMeta?.evidence ?? {
    useCases: 0,
    skills: 0,
    governanceReviews: 0,
    workSignals: 0,
  };
  const evidenceTotal = evidenceCounts.useCases + evidenceCounts.skills + evidenceCounts.governanceReviews + evidenceCounts.workSignals;
  const shareReadinessChecks: {
    label: string;
    helper: string;
    complete: boolean;
    tone: BadgeTone;
  }[] = [
    {
      label: "Audience selected",
      helper: selectedTemplate.audience,
      complete: Boolean(selectedTemplate),
      tone: "green",
    },
    {
      label: "Evidence attached",
      helper: evidenceTotal
        ? `${evidenceTotal} portfolio, Skill, governance, or work-signal evidence points.`
        : "No portfolio, Skill, governance, or work-signal evidence is attached yet.",
      complete: evidenceTotal > 0,
      tone: evidenceTotal > 0 ? "green" : "amber",
    },
    {
      label: "Artifact generated",
      helper: reportReady ? currentReportTitle || selectedTemplate.title : "Generate the report before sharing.",
      complete: reportReady,
      tone: reportReady ? "green" : "slate",
    },
    {
      label: "Export path",
      helper: reportReady ? "Copy, printable export, and launch packet export are available." : "Export unlocks after generation.",
      complete: reportReady,
      tone: reportReady ? "green" : "slate",
    },
  ];
  const shareReady = shareReadinessChecks.every((check) => check.complete);
  const shareReadyPercent = Math.round(
    (shareReadinessChecks.filter((check) => check.complete).length / shareReadinessChecks.length) * 100,
  );
  const nextReportAction =
    !reportReady
      ? {
          label: "No brief yet",
          headline: `Next: generate ${selectedTemplate.title}`,
          body: `${selectedTemplate.purpose} The report will use the current portfolio, Skill, governance, adoption, and ROI state.`,
          tone: "amber" as const,
          button: "Generate report",
        }
      : evidenceTotal === 0
        ? {
            label: "Needs evidence",
            headline: "Next: attach proof before sharing",
            body: "A report exists, but it has no portfolio, Skill, governance, or work-signal evidence attached. Treat it as a setup draft until workspace evidence is connected or regenerated.",
            tone: "amber" as const,
            button: "Regenerate",
          }
      : generationMeta?.mode === "ai_assisted"
        ? {
            label: "Brief ready",
            headline: "Next: review and share the executive update",
            body: `${generationMeta.templateTitle} was generated with ${generationMeta.modelRef}. Review the narrative, then copy or export it for the intended audience.`,
            tone: "green" as const,
            button: "Regenerate",
          }
        : {
            label: "Draft ready",
            headline: "Next: review the executive packet",
            body: generationMeta
              ? `${generationMeta.templateTitle} was generated from deterministic workspace data. Review before sharing; configure a live report model for AI-assisted narrative polish.`
              : "A report exists in the workspace. Review it, then copy or export it for the right audience.",
            tone: "amber" as const,
            button: "Regenerate",
          };

  async function handleGenerate(templateIdInput?: ReportTemplateId) {
    const templateId = templateIdInput ?? selectedType;
    setSelectedType(templateId);
    setIsGenerating(true);
    setExportNotice("");
    try {
      const result = await onGenerate(templateId);
      const generatedTemplate = reportTemplates.find((template) => template.id === templateId) ?? selectedTemplate;
      if (result?.mode) {
        setExportNotice(
          result.mode === "ai_assisted"
            ? `AI-assisted ${result.templateTitle} generated with ${result.modelRef}.`
            : `${result.templateTitle} generated from deterministic workspace data because no live report model is configured.`,
        );
      } else {
        setExportNotice(`${generatedTemplate.title} generated from workspace data. Review the artifact before sharing.`);
      }
    } catch {
      setExportNotice("Report generation failed. The current artifact was preserved; check model routing or server availability and try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    const result = await onCopy();
    setExportNotice(result);
  }

  function handlePrintableExport() {
    if (!report.trim()) {
      setExportNotice("Generate a report before exporting.");
      return;
    }

    const html = buildPrintableReportHtml(report, currentArtifactTitle);
    const downloaded = downloadTextFile({
      contents: html,
      filename: reportFilename(currentArtifactTitle),
      mimeType: "text/html;charset=utf-8",
    });
    setExportNotice(
      downloaded
        ? "Printable report package downloaded. Open it and use Print or Save as PDF for board distribution."
      : "Printable export is unavailable in this browser session.",
    );
  }

  async function handleLaunchPacketExport() {
    try {
      const response = await fetch("/api/launch/packet?format=markdown", {
        headers: { Accept: "text/markdown" },
      });
      const contents = await response.text();
      if (!response.ok || !contents.trim()) {
        setExportNotice("Launch packet is not available yet. Check Admin launch readiness and try again.");
        return;
      }

      const fallbackFilename = `${safeExportFilename(currentArtifactTitle, "customer-launch-packet")}-launch-packet.md`;
      const downloaded = downloadTextFile({
        contents,
        filename: filenameFromContentDisposition(response.headers.get("content-disposition"), fallbackFilename),
        mimeType: "text/markdown;charset=utf-8",
      });
      setExportNotice(
        downloaded
          ? "Customer launch packet downloaded with readiness, evidence, manual actions, and next steps."
          : "Launch packet export is unavailable in this browser session.",
      );
    } catch {
      setExportNotice("Launch packet export failed. Confirm the API is reachable and you are signed in.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Create executive-ready updates from portfolio, risk, proof, adoption, and ROI data."
        action={
          <div className="flex gap-2">
            {!reportReady ? (
              <span id={reportExportDisabledReasonId} className="sr-only">
                {reportExportDisabledReason}
              </span>
            ) : null}
            <Button
              variant="secondary"
              onClick={handleCopy}
              disabled={!reportReady}
              aria-describedby={!reportReady ? reportExportDisabledReasonId : undefined}
              title={reportReady ? "Copy the current report markdown." : reportExportDisabledReason}
            >
              <FileText size={16} />
              Copy
            </Button>
            <Button onClick={() => void handleGenerate()} disabled={isGenerating}>
              <Sparkles size={16} />
              {isGenerating ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        }
      />

      {exportNotice ? (
        <StatusNotice tone={reportNoticeTone(exportNotice)} compact className="mb-4" testId="report-export-status">
          {exportNotice}
        </StatusNotice>
      ) : null}

      <Panel className="mb-4 overflow-hidden" data-testid="automated-reporting-command-center">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-w-0 bg-[linear-gradient(135deg,rgba(248,250,252,.96),rgba(239,246,255,.7)_48%,rgba(236,253,245,.58))] p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={reportingCenter.readinessScore >= 75 ? "green" : reportingCenter.readinessScore >= 50 ? "amber" : "red"}>
                {reportingCenter.readinessScore}% reporting ready
              </Badge>
              <Badge tone="blue">automated reporting layer</Badge>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                daily · weekly · monthly · board-ready
              </span>
            </div>
            <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <CalendarClock size={16} className="text-[var(--primary)]" />
                  {reportingCenter.dailyBrief.title}
                </div>
                <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-[34px]">
                  {reportingCenter.headline}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  {reportingCenter.dailyBrief.body} {reportingCenter.summary}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button onClick={() => void handleGenerate(reportingCenter.dailyBrief.templateId)} disabled={isGenerating}>
                    <Sparkles size={16} />
                    {isGenerating ? "Generating..." : "Generate today's digest"}
                  </Button>
                  <Button variant="secondary" onClick={() => void handleGenerate("weekly_ai_enablement_brief")} disabled={isGenerating}>
                    <MailCheck size={16} />
                    Generate weekly brief
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-white/80 bg-white/74 p-4 shadow-[var(--shadow-button)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Morning packet</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">8:00 AM</div>
                  </div>
                  <Gauge size={34} className="text-[var(--primary)]" />
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${reportingCenter.readinessScore}%` }} />
                </div>
                <div className="mt-3 space-y-2">
                  {reportingCenter.dailyBrief.bullets.map((bullet) => (
                    <div key={bullet} className="flex gap-2 text-xs leading-5 text-slate-600">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
              {reportingCenter.metricSnapshots.slice(0, 4).map((metric) => (
                <MetricSnapshotPill key={metric.id} metric={metric} />
              ))}
            </div>
          </section>

          <aside className="border-t border-slate-200/70 bg-white/78 p-5 lg:border-l lg:border-t-0 sm:p-6">
            <SectionTitle title="Automated Delivery" helper="Reports the OS should prepare without waiting for a prompt" compact />
            <div className="mt-4 space-y-2">
              {reportingCenter.automations.slice(0, 3).map((plan) => (
                <div key={plan.id} className="rounded-lg border border-slate-200/72 bg-slate-50/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold leading-5 text-slate-950">{plan.title}</div>
                        <Badge tone={plan.tone}>{plan.status.replace("_", " ")}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-slate-500">{plan.audience}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-500">{plan.readiness}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200/70">
                    <div className={`h-full rounded-full ${toneBarClass(plan.tone)}`} style={{ width: `${plan.readiness}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarClock size={13} className="text-slate-400" />
                      {plan.nextRunLabel}
                    </div>
                    <div className="flex items-center gap-2">
                      <MailCheck size={13} className="text-slate-400" />
                      {plan.cadence}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-3 w-full"
                    onClick={() => void handleGenerate(plan.templateId)}
                    disabled={isGenerating}
                  >
                    <Sparkles size={15} />
                    Generate packet
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-slate-200/72 bg-white/74 px-3 py-2 text-xs leading-5 text-slate-600">
              {reportingCenter.automations.length - 3} more audience packet{reportingCenter.automations.length - 3 === 1 ? "" : "s"} are available in the template picker below.
            </div>
          </aside>
        </div>
      </Panel>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
        <Panel className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle title="Visual Reporting System" helper="The graphics and snapshots leaders expect before approving scale" compact />
            <Badge tone="purple">visuals ready</Badge>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {reportingCenter.visuals.map((visual) => (
              <div key={visual.id} className="rounded-lg border border-slate-200/72 bg-white/70 p-4 shadow-[var(--shadow-button)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <BarChart3 size={16} className="text-[var(--primary)]" />
                      {visual.title}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{visual.helper}</p>
                  </div>
                  <Badge tone="blue">{visual.value}</Badge>
                </div>
                <div className="mt-4">
                  <VisualBars bars={visual.bars} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {reportingCenter.stakeholderPackets.slice(0, 3).map((packet) => (
              <button
                key={packet.role}
                type="button"
                onClick={() => void handleGenerate(packet.templateId)}
                className="rounded-lg border border-slate-200/72 bg-slate-50/66 p-3 text-left transition hover:border-[var(--primary)]/35 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <UsersRound size={15} className="text-slate-500" />
                  {packet.role}
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--primary)]">{packet.packet}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{packet.why}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <SectionTitle title="Evidence Coverage" helper="What the reporting engine can safely cite today" compact />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {reportingCenter.evidenceCoverage.map((metric) => (
              <MetricSnapshotTile key={metric.id} metric={metric} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={nextReportAction.tone}>{nextReportAction.label}</Badge>
              <Badge tone={generationMeta?.mode === "ai_assisted" ? "purple" : "slate"}>
                {generationMeta?.mode === "ai_assisted" ? "AI-assisted" : "workspace data"}
              </Badge>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {selectedTemplate.audience}
              </span>
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{nextReportAction.headline}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{nextReportAction.body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => void handleGenerate()} disabled={isGenerating}>
                <Sparkles size={15} />
                {isGenerating ? "Generating..." : nextReportAction.button}
              </Button>
              {reportReady ? (
                <>
                  <Button variant="secondary" onClick={handleCopy}>
                    <FileText size={15} />
                    Copy markdown
                  </Button>
                  <Button variant="secondary" onClick={handlePrintableExport}>
                    <Download size={15} />
                    Stage PDF export
                  </Button>
                </>
              ) : null}
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-4">
              {[
                { label: "Use cases", value: String(evidenceCounts.useCases), helper: "portfolio proof" },
                { label: "AI Skills", value: String(evidenceCounts.skills), helper: "reusable assets" },
                { label: "Reviews", value: String(evidenceCounts.governanceReviews), helper: "risk decisions" },
                { label: "Signals", value: String(evidenceCounts.workSignals), helper: "work evidence" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white/62 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{item.value}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.helper}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/56 p-5 xl:border-l xl:border-t-0">
            <SectionTitle title="Brief health" helper="Audience, evidence, and export readiness" compact />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniMetric label="Evidence" value={String(evidenceTotal)} />
              <MiniMetric label="Sections" value={String(selectedTemplate.expectedSections.length)} />
              <MiniMetric label="Mode" value={generationMeta?.mode === "ai_assisted" ? "AI" : "Fallback"} />
              <MiniMetric label="Share" value={shareReady ? "Ready" : `${shareReadyPercent}%`} />
            </div>
            <div className="mt-4 rounded-lg border border-white bg-white/72 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Share readiness</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {shareReady
                      ? "This artifact has audience, evidence, generation, and export coverage."
                      : "Finish these checks before sending the report outside the working team."}
                  </p>
                </div>
                <Badge tone={shareReady ? "green" : "amber"}>{shareReady ? "ready" : `${shareReadyPercent}%`}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {shareReadinessChecks.map((check) => (
                  <div key={check.label} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        check.complete ? "bg-green-600 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200"
                      }`}
                      aria-hidden="true"
                    >
                      {check.complete ? <CheckCircle2 size={12} /> : "!"}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                        {check.label}
                        <Badge tone={check.tone}>{check.complete ? "done" : "open"}</Badge>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{check.helper}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-white bg-white/72 p-4">
              <div className="text-sm font-semibold text-slate-950">{reportReady ? "Current artifact" : "Next update type"}</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{currentArtifactTitle}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {reportReady
                  ? `Next generation is set to ${selectedTemplate.title}. Change the update type below before regenerating.`
                  : selectedTemplate.purpose}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedTemplate.expectedSections.slice(0, 4).map((section) => (
                  <span key={section} className="rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                    {section}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-[310px_minmax(0,1fr)_320px]">
        <Panel className="p-5">
          <SectionTitle title="Choose update type" helper="Pick the audience before generating." compact />
          <div className="mt-4 space-y-2">
            {reportTemplates.map((template) => (
              <button
                type="button"
                key={template.id}
                aria-label={`Select report template: ${template.title}`}
                aria-pressed={selectedType === template.id}
                onClick={() => setSelectedType(template.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                  selectedType === template.id ? "bg-indigo-50 text-[#5147e8]" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{template.title}</span>
                  {selectedType === template.id ? <Badge tone="purple">selected</Badge> : null}
                </span>
                <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{template.audience}</span>
                {selectedType === template.id ? (
                  <span className="mt-2 block text-xs font-medium leading-5 text-slate-600">{template.purpose}</span>
                ) : null}
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          {report ? (
            <RenderedReport content={report} />
          ) : (
            <div className="flex min-h-[440px] flex-col items-center justify-center text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-[#5147e8]">
                <FileText size={22} />
              </div>
              <h2 className="mt-4 text-lg font-semibold">No report generated yet</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Generate a {selectedTemplate.title.toLowerCase()} from current portfolio, Skill, governance, adoption, and ROI data.
              </p>
              <Button className="mt-5" onClick={() => void handleGenerate()} disabled={isGenerating}>
                <Sparkles size={16} />
                {isGenerating ? "Generating..." : "Generate first report"}
              </Button>
            </div>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel className="p-5">
            <SectionTitle title="Report Intelligence" helper="Grounded generation with visible model provenance" />
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Sparkles size={16} className="text-[#5147e8]" />
                    Generation mode
                  </div>
                  <Badge tone={generationMeta?.mode === "ai_assisted" ? "purple" : "slate"}>
                    {generationMeta?.mode === "ai_assisted" ? "AI-assisted" : "Data fallback"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {generationMeta
                    ? generationMeta.routeReason
                    : "Generate a report to see provider route, token use, and fallback status."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Use cases", generationMeta?.evidence.useCases ?? 0],
                  ["Skills", generationMeta?.evidence.skills ?? 0],
                  ["Reviews", generationMeta?.evidence.governanceReviews ?? 0],
                  ["Signals", generationMeta?.evidence.workSignals ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
                  </div>
                ))}
              </div>
              {generationMeta ? (
                <div className="rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-200">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Route size={14} />
                    {generationMeta.modelRef}
                  </div>
                  <div className="mt-2 text-slate-400">
                    {generationMeta.inputTokens.toLocaleString()} input tokens / {generationMeta.outputTokens.toLocaleString()} output tokens / {generationMeta.latencyMs} ms
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="Briefing Workflow" helper="Turn live platform data into an executive artifact" />
            <div className="mt-4 space-y-3">
              {[
                [ClipboardCheck, "Gather evidence", "Portfolio, governance, adoption, ROI, Harness traces."],
                [Sparkles, "Draft narrative", "Generate crisp summary, wins, blockers, and decisions."],
                [FileText, "Review and edit", "Keep the report human-owned before sharing."],
                [Send, "Share decision memo", "Copy/export for ELT, board, or function leaders."],
              ].map(([Icon, title, body], index) => {
                const StepIcon = Icon as typeof FileText;
                return (
                  <div key={String(title)} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {index < (report ? 4 : 1) ? (
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" />
                    ) : (
                      <StepIcon size={17} className="mt-0.5 shrink-0 text-[#5147e8]" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        {title as string}
                        <Badge tone={index < (report ? 4 : 1) ? "green" : "slate"}>{index < (report ? 4 : 1) ? "Ready" : "Next"}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{body as string}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle title="Export Controls" helper="Prepare the report for the audience" />
            <div className="mt-4 space-y-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleCopy}
                disabled={!reportReady}
                aria-describedby={!reportReady ? reportExportDisabledReasonId : undefined}
                title={reportReady ? "Copy the current report markdown." : reportExportDisabledReason}
              >
                <FileText size={16} />
                Copy Markdown
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={handlePrintableExport}
                disabled={!reportReady}
                aria-describedby={!reportReady ? reportExportDisabledReasonId : undefined}
                title={reportReady ? "Download a printable report package." : reportExportDisabledReason}
              >
                <Download size={16} />
                Stage PDF Export
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => void handleLaunchPacketExport()}
                disabled={!reportReady}
                aria-describedby={!reportReady ? reportExportDisabledReasonId : undefined}
                title={reportReady ? "Download the launch packet tied to this report." : reportExportDisabledReason}
              >
                <Download size={16} />
                Download Launch Packet
              </Button>
              <Button className="w-full" onClick={() => void handleGenerate()} disabled={isGenerating}>
                <Sparkles size={16} />
                {isGenerating ? "Generating..." : reportReady ? "Regenerate" : "Generate Report"}
              </Button>
            </div>
            {!reportReady ? (
              <div className="mt-3 rounded-lg border border-amber-200/76 bg-amber-50/82 px-3 py-2 text-xs font-medium leading-5 text-amber-800">
                {reportExportDisabledReason}
              </div>
            ) : null}
            {exportNotice ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-medium text-[#5147e8]"
              >
                {exportNotice}
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
