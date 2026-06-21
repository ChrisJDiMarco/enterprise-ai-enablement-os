import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { FinalCta, SiteCard, SiteSection } from "@/components/marketing/MarketingShell";
import { securityControls } from "@/lib/marketing-site";

export const metadata: Metadata = {
  title: "Security & Governance",
  description:
    "Enterprise AI Enablement OS trust posture for SSO, RBAC, tenant secrets, policy-first connector execution, AI governance, and evidence.",
};

export default function SecurityPage() {
  return (
    <main>
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_460px] lg:px-8 lg:py-20">
          <div>
            <div className="text-xs font-semibold uppercase text-[var(--primary)]">Security & governance</div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold text-[var(--text)] sm:text-5xl">
              The model is not the system. The Harness is the system.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)]">
              Enterprise AI Enablement OS is designed around identity, permissions, tool policy, human approvals, evaluation, audit, and evidence. AI can only become enterprise infrastructure when the controls around it are visible.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/site/collateral" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-contrast)] shadow-sm">
                Download security brief
                <ArrowRight size={16} />
              </Link>
              <Link href="/" className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]">
                Open readiness gate
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950 p-6 text-white shadow-[var(--shadow-elevated)]">
            <ShieldCheck size={28} className="text-green-300" />
            <div className="mt-5 text-2xl font-semibold">Control-first posture</div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The app should make every AI Skill inspectable: owner, autonomy, model, tools, context, memory, approvals, evals, traces, cost, value, and rollback.
            </p>
            <div className="mt-6 grid gap-3">
              {["Human approval gates", "Least-privilege connector scopes", "Evidence mapped to controls", "Production readiness checks"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <ShieldCheck size={15} className="text-green-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteSection
        eyebrow="Trust controls"
        title="Built for security, legal, privacy, compliance, and business reviewers"
        body="The product should help reviewers answer the only questions that matter: who can use this, what can it access, what can it do, what requires approval, what failed, and where is the proof?"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {securityControls.map((control) => (
            <div key={control} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
                <ShieldCheck size={15} />
              </span>
              <span className="text-sm leading-6 text-[var(--text-muted)]">{control}</span>
            </div>
          ))}
        </div>
      </SiteSection>

      <SiteSection
        eyebrow="Governance model"
        title="Responsible AI is woven into the operating loop"
        body="Governance is not a separate checkbox after launch. It is present in use case scoring, Skill configuration, context access, connector policy, evals, approvals, logs, and reports."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <SiteCard
            title="Before launch"
            body="Classify risk, assign autonomy tier, approve data sources, configure tool policies, run red-team evals, and submit review."
            icon="shield"
          />
          <SiteCard
            title="During runtime"
            body="Evaluate identity, retrieve only allowed context, inspect tool requests, pause for approval, validate output, and log the trace."
            icon="check"
          />
          <SiteCard
            title="After launch"
            body="Monitor drift, collect feedback, measure adoption, export evidence packets, and create reusable governed patterns."
            icon="file"
          />
        </div>
      </SiteSection>

      <SiteSection
        eyebrow="Framework evidence"
        title="Designed to map work to recognizable AI governance frameworks"
        body="The system produces artifacts that can support reviews mapped to NIST AI RMF, ISO/IEC 42001, EU AI Act oversight concepts, and OWASP LLM/MCP risks."
      >
        <div className="grid gap-4 lg:grid-cols-4">
          {[
            ["NIST AI RMF", "Govern, map, measure, and manage AI risk."],
            ["ISO/IEC 42001", "AI management system readiness and lifecycle evidence."],
            ["EU AI Act", "Human oversight, traceability, documentation, and risk posture."],
            ["OWASP LLM/MCP", "Prompt injection, tool safety, data leakage, and connector threats."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <FileCheck2 className="text-[var(--primary)]" size={22} />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{body}</p>
            </article>
          ))}
        </div>
      </SiteSection>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--text-muted)]">
              <LockKeyhole size={20} />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Honest production note</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                A customer launch still requires real SSO configuration, production Postgres, backup policy, tenant secret keys, model provider keys, connector credentials, MCP broker endpoint, observability, and legal review of deployment terms. The app makes these requirements explicit instead of pretending they are solved by a dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      <FinalCta />
    </main>
  );
}
