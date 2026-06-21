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
    secondary: "border-[var(--border)]/80 bg-[var(--surface)]/78 text-[var(--text-muted)] shadow-[var(--shadow-button)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
    danger: "border-[color-mix(in_srgb,var(--danger)_26%,var(--border))] bg-[var(--surface)]/82 text-[var(--danger)] shadow-[var(--shadow-button)] hover:border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] hover:bg-[var(--danger-soft)]",
    ghost: "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface)]/74 hover:text-[var(--text)]",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...buttonProps}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:-translate-y-px focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:min-h-10 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  label,
  onClick,
  disabled = false,
  ...buttonProps
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "className" | "disabled" | "onClick" | "title" | "type">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      {...buttonProps}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)]/68 bg-[var(--surface)]/78 text-[var(--text-muted)] shadow-[var(--shadow-button)] transition-[background-color,border-color,color,box-shadow,transform] hover:-translate-y-px hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 sm:size-10"
    >
      {children}
    </button>
  );
}
