import Link from "next/link";
import type React from "react";
import { ArrowRight, Building2, CheckCircle2, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { marketingPages, proofLoop } from "@/lib/marketing-site";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-[var(--background)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)]/70 bg-[var(--surface)]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/site" className="flex items-center gap-3" aria-label="Enterprise AI Enablement OS marketing home">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-contrast)] shadow-[0_14px_34px_rgba(99,91,255,0.28)] ring-1 ring-[var(--surface)]/50">
              E
            </span>
            <span>
              <span className="block text-[15px] font-semibold leading-tight">Enterprise AI</span>
              <span className="block text-xs font-medium text-[var(--text-muted)]">Enablement OS</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 p-1 shadow-sm md:flex" aria-label="Marketing navigation">
            {marketingPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--primary)] hover:text-[var(--primary-contrast)]"
              >
                {page.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)] shadow-sm transition hover:border-[var(--border-strong)] hover:text-[var(--text)] sm:inline-flex"
            >
              Open app
            </Link>
            <Link
              href="/site/collateral"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-contrast)] shadow-[0_14px_34px_rgba(99,91,255,0.26)] transition hover:bg-[var(--primary-hover)]"
            >
              Get buyer packet
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-contrast)]">E</span>
              <div>
                <div className="text-sm font-semibold">Enterprise AI Enablement OS</div>
                <div className="text-xs text-[var(--text-muted)]">The command system for enterprise AI transformation</div>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-[var(--text-muted)]">
              Built for companies that need to discover, govern, deploy, measure, and scale AI capability across real corporate functions.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-[var(--text-soft)]">Operating loop</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {proofLoop.slice(0, 6).map((item) => (
                <span key={item} className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-[var(--text-soft)]">Explore</div>
            <div className="mt-3 grid gap-2">
              {marketingPages.map((page) => (
                <Link key={page.href} href={page.href} className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--primary)]">
                  {page.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function SiteSection({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="max-w-3xl">
        {eyebrow ? (
          <div className="text-xs font-bold uppercase text-[var(--primary)]">{eyebrow}</div>
        ) : null}
        <h2 className="mt-3 text-3xl font-semibold text-[var(--text)] sm:text-5xl">{title}</h2>
        {body ? <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">{body}</p> : null}
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}

export function SiteCard({
  title,
  body,
  icon,
  footer,
}: {
  title: string;
  body: string;
  icon?: "spark" | "shield" | "file" | "building" | "check";
  footer?: React.ReactNode;
}) {
  const Icon =
    icon === "shield" ? ShieldCheck : icon === "file" ? FileText : icon === "building" ? Building2 : icon === "check" ? CheckCircle2 : Sparkles;
  return (
    <article className="group rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-[0_24px_70px_rgba(15,23,42,0.09)]">
      <div className="flex size-11 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] transition group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-contrast)]">
        <Icon size={19} />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{body}</p>
      {footer ? <div className="mt-5">{footer}</div> : null}
    </article>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-7 text-white shadow-[0_32px_100px_rgba(15,23,42,0.24)] sm:p-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase text-indigo-200">Ready to operationalize AI</div>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold sm:text-5xl">Turn AI ambition into a governed operating system.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
              Start with one function, one high-value use case, and one governed Skill. The OS gives you the repeatable path to scale.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-subtle)]">
              Open the app
            </Link>
            <Link href="/site/collateral" className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-[var(--surface)]/10">
              View collateral
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
