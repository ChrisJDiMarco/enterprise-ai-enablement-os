import type React from "react";

export function Panel({ children, className = "", ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={`ea-surface ea-panel rounded-lg ${className}`}
    >
      {children}
    </section>
  );
}
