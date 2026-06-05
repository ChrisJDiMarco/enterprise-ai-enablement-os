import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Plug, Workflow } from "lucide-react";
import { FinalCta, SiteCard, SiteSection } from "@/components/marketing/MarketingShell";
import { implementationSteps } from "@/lib/marketing-site";

export const metadata: Metadata = {
  title: "Implementation",
  description:
    "How Enterprise AI Enablement OS connects to identity, knowledge, work systems, AI providers, governance, and executive reporting.",
};

export default function ImplementationPage() {
  return (
    <main>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_460px] lg:px-8 lg:py-20">
          <div>
            <div className="text-xs font-semibold uppercase text-[var(--primary)]">Implementation</div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold text-slate-950 sm:text-5xl">
              Connect the company stack, then launch the first governed AI capability.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              The OS should meet a company where it already works: identity, collaboration, tickets, documents, HR, finance, legal, procurement, workflow, and AI providers.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-sm">
                Open setup concierge
                <ArrowRight size={16} />
              </Link>
              <Link href="/site/collateral" className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700">
                Download rollout plan
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-white text-[var(--primary)] shadow-sm">
                <Plug size={20} />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-950">Day-one connection map</div>
                <div className="text-xs text-slate-500">What customers expect to plug in</div>
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              {["SSO/OIDC", "Slack or Teams", "Jira or ServiceNow", "SharePoint or Google Drive", "Workday or HRIS", "OpenAI or OpenRouter", "MCP broker", "Postgres"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{item}</span>
                  <CheckCircle2 size={16} className="text-green-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteSection
        eyebrow="Rollout"
        title="The implementation path is an operating sequence"
        body="The app is useful because it does more than collect AI ideas. It turns setup, discovery, governance, runtime, measurement, and reporting into one connected launch process."
      >
        <div className="grid gap-4">
          {implementationSteps.map((step, index) => (
            <article key={step.title} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] lg:grid-cols-[90px_1fr_280px] lg:items-center">
              <div className="flex size-14 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-xl font-semibold text-[var(--primary)]">
                {index + 1}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs font-semibold uppercase text-slate-400">Evidence produced</div>
                <div className="mt-2 font-medium text-slate-800">{step.evidence}</div>
              </div>
            </article>
          ))}
        </div>
      </SiteSection>

      <SiteSection
        eyebrow="Operating architecture"
        title="The OS sits above the tools, not instead of them"
        body="A company does not replace Slack, Teams, Jira, ServiceNow, SharePoint, Workday, finance systems, or model vendors. The OS governs how AI uses them."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SiteCard title="Identity" body="SSO, tenant roles, reviewer groups, builder access, and user lifecycle provisioning." icon="building" />
          <SiteCard title="Connectors" body="MCP and native adapters for reading, preparing, creating, or executing governed work." icon="check" />
          <SiteCard title="Harness runtime" body="Policy-aware model routing, context retrieval, approval gates, evals, traces, and audit logs." icon="shield" />
          <SiteCard title="Value proof" body="Adoption, ROI, risk, quality, cycle-time reduction, and executive-ready launch packets." icon="file" />
        </div>
      </SiteSection>

      <SiteSection
        eyebrow="First 90 days"
        title="A realistic launch should produce something board-ready"
        body="The customer should not finish onboarding with a blank dashboard. They should finish with a controlled pilot package and a clear next decision."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            ["Month 1", "Configure tenant, identity, admin roles, production readiness, and opportunity intake."],
            ["Month 2", "Launch one governed Skill package with context, tools, workflow, evals, and governance review."],
            ["Month 3", "Measure adoption and ROI, export evidence packet, decide scale or revise, then create reusable patterns."],
          ].map(([label, body]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)]">
              <Workflow className="text-[var(--primary)]" size={22} />
              <h3 className="mt-4 text-xl font-semibold">{label}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SiteSection>

      <FinalCta />
    </main>
  );
}
