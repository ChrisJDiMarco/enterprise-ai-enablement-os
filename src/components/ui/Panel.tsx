import type React from "react";

export function Panel({ children, className = "", ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={`rounded-lg border border-slate-200/52 bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl ${className}`}
    >
      {children}
    </section>
  );
}
