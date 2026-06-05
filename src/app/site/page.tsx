import Link from "next/link";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  FileSearch,
  GitBranch,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { FinalCta, SiteCard, SiteSection } from "@/components/marketing/MarketingShell";
import { platformPillars, proofLoop } from "@/lib/marketing-site";

export const metadata: Metadata = {
  title: "Enterprise AI Enablement OS",
};

const heroMetrics = [
  ["90 days", "to first governed launch packet"],
  ["10 layers", "from strategy to executive report"],
  ["4 controls", "NIST, ISO, EU AI Act, OWASP"],
];

const buyerOutcomes = [
  {
    title: "AI leaders get a morning command center",
    body: "See what is ready, blocked, risky, valuable, and worth scaling across the company.",
  },
  {
    title: "Builders get governed paths to production",
    body: "Turn approved use cases into Skills, workflows, evals, tool policies, and Harness traces.",
  },
  {
    title: "Reviewers get evidence instead of promises",
    body: "Inspect controls, approvals, context access, model routing, eval results, and audit provenance.",
  },
];

const enterpriseProof: Array<{ title: string; body: string; icon: LucideIcon }> = [
  { title: "Opportunity portfolio", body: "Capture, structure, score, and prioritize AI work across departments.", icon: FileSearch },
  { title: "Governed Skills", body: "Package prompts, context, tools, approval gates, evals, and versions.", icon: Sparkles },
  { title: "Harness runtime", body: "Run policy-aware AI workflows with traces, approvals, and rollback paths.", icon: ShieldCheck },
  { title: "Measured value", body: "Connect adoption, productivity, cost, quality, risk, and executive reporting.", icon: BarChart3 },
];

const operatingModes: Array<{ title: string; body: string; icon: LucideIcon }> = [
  { title: "Strategy", body: "Exec roadmap and function priorities", icon: LockKeyhole },
  { title: "Operate", body: "Use cases, Skills, workflow, Harness", icon: Workflow },
  { title: "Trust", body: "Governance, evidence, security, audit", icon: ShieldCheck },
  { title: "Scale", body: "Adoption, ROI, reusable patterns", icon: BarChart3 },
];

export default function MarketingHomePage() {
  return (
    <main className="overflow-hidden">
      <section
        className="relative isolate min-h-[840px] overflow-hidden border-b border-slate-200 bg-white"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(248,250,252,0.99) 0%, rgba(248,250,252,0.96) 38%, rgba(248,250,252,0.72) 66%, rgba(248,250,252,0.3) 100%), url('/marketing/enablement-os-command-center.png')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-white/80" />
        <div className="relative z-10 mx-auto flex min-h-[840px] max-w-7xl flex-col justify-center px-5 pb-56 pt-24 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/82 px-3 py-1.5 text-xs font-bold uppercase text-slate-700 shadow-sm backdrop-blur">
              <span className="size-2 rounded-full bg-emerald-500" />
              Enterprise AI transformation command system
            </div>
            <h1 className="mt-7 max-w-5xl text-5xl font-semibold leading-[1.03] text-slate-950 sm:text-6xl lg:text-[72px]">
              Enterprise AI
              <br />
              Enablement OS
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              The operating system for turning AI strategy into governed use cases, reusable Skills, Harness traces, audit-ready evidence, adoption, ROI, and executive reporting.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(99,91,255,0.28)] transition hover:bg-[var(--primary-hover)]"
              >
                Open the OS
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/site/implementation"
                className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white/86 px-5 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white"
              >
                See implementation path
              </Link>
            </div>

            <div className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              {heroMetrics.map(([value, label]) => (
                <div key={value} className="rounded-lg border border-slate-200 bg-white/84 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
                  <div className="text-2xl font-semibold text-slate-950">{value}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 z-20 hidden w-[min(1180px,calc(100vw-56px))] -translate-x-1/2 rounded-lg border border-slate-200 bg-white/90 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl lg:block">
          <div className="grid grid-cols-4 gap-3">
            {enterpriseProof.map(({ title, body, icon: Icon }) => (
              <div key={title} className="flex gap-3 rounded-lg bg-slate-50 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)] shadow-sm">
                  <Icon size={17} />
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-950">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteSection
        eyebrow="What it does"
        title="A complete operating loop for enterprise AI"
        body="The product is not a chatbot and not a prompt library. It is the system of record and control plane for moving AI from ambition to measurable, reusable capability."
      >
        <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-[0_24px_80px_rgba(15,23,42,0.07)]">
          <div className="grid gap-2 lg:grid-cols-10">
            {proofLoop.map((item, index) => (
              <div key={item} className="relative rounded-lg bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-white text-sm font-semibold text-[var(--primary)] shadow-sm">
                    {index + 1}
                  </span>
                  {index < proofLoop.length - 1 ? <ArrowRight className="hidden text-slate-300 lg:block" size={15} /> : <CheckCircle2 className="text-green-600" size={16} />}
                </div>
                <div className="mt-4 text-sm font-semibold leading-5 text-slate-950">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </SiteSection>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-7 text-white shadow-[0_24px_90px_rgba(15,23,42,0.18)] sm:p-8">
            <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-indigo-100">
              The control plane
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight sm:text-5xl">
              AI becomes enterprise infrastructure when every claim has proof.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              The OS connects strategy, opportunity discovery, Skill design, runtime traces, evals, approvals, adoption, and ROI into one evidence-backed system.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Trace", "Every run has identity, context, tools, policy, and output evidence."],
                ["Approve", "Sensitive actions pause for review before execution."],
                ["Measure", "Value is tied back to adoption and real operational assumptions."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-300">{body}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs font-bold uppercase text-slate-400">Board-ready packet</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">Proof chain assembled</div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Ready</span>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["Use case brief", "Scored opportunity with business value and risk classification", "complete"],
                ["SkillSpec", "Prompt, model lane, context, tools, approvals, eval suite", "complete"],
                ["Harness trace", "Identity, policy, model output, tool request, audit event", "complete"],
                ["ROI model", "Adoption-adjusted value and confidence bands", "review"],
              ].map(([title, body, status]) => (
                <div key={title} className="grid grid-cols-[36px_1fr_auto] items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                    <BadgeCheck size={17} />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{body}</div>
                  </div>
                  <span className={status === "complete" ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700" : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteSection
        eyebrow="Platform"
        title="Everything an AI enablement leader needs in one command system"
        body="The OS aligns business, IT, Data, Security, Legal, Privacy, Finance, HR, and executives around one governed path from discovery to scale."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {platformPillars.map((pillar, index) => (
            <SiteCard
              key={pillar.title}
              title={pillar.title}
              body={pillar.body}
              icon={index === 0 ? "building" : index === 1 ? "shield" : index === 2 ? "file" : "spark"}
            />
          ))}
        </div>
      </SiteSection>

      <SiteSection
        eyebrow="Why companies would use it"
        title="Because enterprise AI fails when it is scattered"
        body="The fastest model does not solve operating chaos. Companies need the place where AI demand, governance, runtime controls, adoption, and value proof come together."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "A real use-case factory",
              body: "Capture vague ideas, score them, compare risk and value, create briefs, and turn approved work into reusable Skill packages.",
              icon: Workflow,
            },
            {
              title: "A governed agent Harness",
              body: "Route models, retrieve context, evaluate policy, gate tools, require approvals, validate output, and log the full trace.",
              icon: ShieldCheck,
            },
            {
              title: "A compounding value layer",
              body: "Track adoption, hours saved, cost avoided, quality lift, risk reduction, and reuse patterns across departments.",
              icon: LineChart,
            },
          ].map((item) => (
            <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
              <div className="flex size-11 items-center justify-center rounded-lg bg-slate-950 text-white">
                <item.icon size={20} />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </SiteSection>

      <SiteSection
        eyebrow="Buyer proof"
        title="Designed for executives, operators, builders, and reviewers"
        body="The interface speaks to each audience: leaders see portfolio and value, builders see Skills and workflows, reviewers see risk and evidence, and executives see decisions."
      >
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <GitBranch className="text-[var(--primary)]" size={20} />
              <h3 className="text-lg font-semibold">Proof chain, not claims</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Every executive claim should be traceable to use case records, SkillSpecs, Harness runs, eval results, approvals, audit logs, and ROI assumptions.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Use case", "SkillSpec", "Trace", "Eval", "Approval", "ROI"].map((item) => (
                <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {buyerOutcomes.map((item, index) => (
              <div key={item.title} className="grid grid-cols-[40px_1fr] gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
                <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SiteSection>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.07)] lg:grid-cols-4">
          {operatingModes.map(({ title, body, icon: Icon }) => (
            <div key={title} className="rounded-lg bg-slate-50 p-5">
              <Icon className="text-[var(--primary)]" size={21} />
              <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <FinalCta />
    </main>
  );
}
