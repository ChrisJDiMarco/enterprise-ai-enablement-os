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
    primary: "ea-button-primary text-[var(--primary-contrast)]",
    secondary: "border-slate-200/80 bg-white/78 text-slate-700 shadow-[var(--shadow-button)] hover:border-slate-300 hover:bg-white hover:text-slate-950",
    danger: "border-red-200/82 bg-white/82 text-red-700 shadow-[var(--shadow-button)] hover:border-red-300 hover:bg-red-50",
    ghost: "border-transparent bg-transparent text-slate-600 hover:bg-white/74 hover:text-slate-950",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...buttonProps}
      className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  label,
  onClick,
  ...buttonProps
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "className" | "onClick" | "title" | "type">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...buttonProps}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/72 bg-white/82 text-slate-600 shadow-[var(--shadow-button)] transition-[background-color,border-color,color,box-shadow] hover:border-slate-300 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)]"
    >
      {children}
    </button>
  );
}
