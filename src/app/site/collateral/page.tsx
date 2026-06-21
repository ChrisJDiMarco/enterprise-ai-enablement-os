import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Download, FileText, ShieldCheck } from "lucide-react";
import { FinalCta, SiteCard, SiteSection } from "@/components/marketing/MarketingShell";
import { collateralAssets, collateralFilename } from "@/lib/marketing-site";

export const metadata: Metadata = {
  title: "Collateral",
  description:
    "Buyer-ready collateral for Enterprise AI Enablement OS, including executive one-pager, security brief, rollout plan, and pilot scorecard.",
};

export default function CollateralPage() {
  return (
    <main>
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase text-[var(--primary)]">Buyer collateral</div>
            <h1 className="mt-4 text-4xl font-semibold text-[var(--text)] sm:text-5xl">
              Shareable assets for companies evaluating Enterprise AI Enablement OS.
            </h1>
            <p className="mt-5 text-base leading-7 text-[var(--text-muted)]">
              These artifacts help explain the product, the security posture, the implementation path, and how a pilot should be judged.
            </p>
          </div>
        </div>
      </section>

      <SiteSection
        eyebrow="Downloads"
        title="Give every stakeholder the right artifact"
        body="The executive wants the narrative, security wants the controls, the transformation team wants the rollout path, and the pilot owner wants the scorecard."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {collateralAssets.map((asset) => (
            <article key={asset.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                  {asset.id.includes("security") ? <ShieldCheck size={19} /> : <FileText size={19} />}
                </span>
                <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">{asset.format}</span>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-[var(--text)]">{asset.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{asset.description}</p>
              <a
                href={`/api/collateral/${asset.id}`}
                download={collateralFilename(asset)}
                className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)] transition hover:bg-[var(--primary-hover)]"
              >
                <Download size={16} />
                {asset.cta}
              </a>
            </article>
          ))}
        </div>
      </SiteSection>

      <SiteSection
        eyebrow="Sales motion"
        title="How to use the collateral in a real customer conversation"
        body="A credible enterprise conversation should move from strategic pain to first launch path to trust posture to measurable pilot."
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <SiteCard title="1. Start with the one-pager" body="Frame the core pain: scattered pilots, ungoverned tools, and weak value proof." icon="file" />
          <SiteCard title="2. Show the implementation plan" body="Make it clear that the first 90 days produce a governed Skill and an executive packet." icon="building" />
          <SiteCard title="3. Give security the brief" body="Let trust reviewers inspect the controls, policy gates, evidence, and production caveats." icon="shield" />
          <SiteCard title="4. Use the scorecard" body="Agree up front on how the pilot will be measured and whether it deserves to scale." icon="check" />
        </div>
      </SiteSection>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold">Need to show the real product?</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Open the OS, run guided setup, load or create a pilot workspace, then export the customer launch packet from Reports and Evidence Ledger.
              </p>
            </div>
            <Link href="/" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]">
              Open product
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <FinalCta />
    </main>
  );
}
