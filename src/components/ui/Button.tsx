import type React from "react";

export function Button({
  children,
  variant = "primary",
  onClick,
  className = "",
  type = "button",
  disabled = false,
  ...buttonProps
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "disabled" | "onClick" | "type">) {
  const variants = {
    primary: "bg-[var(--primary)] text-[var(--primary-contrast)] hover:bg-[var(--primary-hover)] border-[var(--primary)] shadow-[0_10px_24px_rgba(99,91,255,0.14)]",
    secondary: "bg-white/72 text-slate-700 hover:bg-white border-slate-200/70 shadow-[0_1px_0_rgba(15,23,42,0.016)]",
    danger: "bg-white/76 text-red-700 hover:bg-red-50 border-red-200/82",
    ghost: "bg-transparent text-slate-600 hover:bg-white/58 border-transparent",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...buttonProps}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition duration-150 hover:-translate-y-px focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg border border-slate-200/62 bg-white/72 text-slate-600 shadow-[0_1px_0_rgba(15,23,42,0.016)] transition hover:-translate-y-px hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
    >
      {children}
    </button>
  );
}
