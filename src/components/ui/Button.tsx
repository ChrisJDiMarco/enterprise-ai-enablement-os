import { forwardRef } from "react";
import type React from "react";
import { Loader2 } from "lucide-react";

type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  /** When true, shows a spinner, disables the button, and sets aria-busy — the app-wide guard against double-submits. */
  loading?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "disabled" | "onClick" | "type">;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant = "primary", onClick, className = "", type = "button", disabled = false, loading = false, ...buttonProps },
  ref,
) {
  const variants = {
    primary: "ea-button-primary text-[var(--primary-contrast)]",
    secondary: "border-[var(--border)]/80 bg-[var(--surface)]/78 text-[var(--text-muted)] shadow-[var(--shadow-button)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
    danger: "border-[color-mix(in_srgb,var(--danger)_26%,var(--border))] bg-[var(--surface)]/82 text-[var(--danger)] shadow-[var(--shadow-button)] hover:border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] hover:bg-[var(--danger-soft)]",
    ghost: "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/55 hover:text-[var(--text)]",
  };

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 motion-safe:hover:-translate-y-px motion-safe:disabled:hover:translate-y-0 sm:min-h-10 ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : null}
      {children}
    </button>
  );
});

export function IconButton({
  children,
  label,
  onClick,
  disabled = false,
  loading = false,
  ...buttonProps
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "className" | "disabled" | "onClick" | "title" | "type">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)]/68 bg-[var(--surface)]/78 text-[var(--text-muted)] shadow-[var(--shadow-button)] transition-[background-color,border-color,color,box-shadow,transform] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] hover:text-[var(--text)] focus:outline-none focus:ring-4 focus:ring-[var(--primary-soft)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 motion-safe:hover:-translate-y-px motion-safe:disabled:hover:translate-y-0 sm:size-10"
    >
      {loading ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : children}
    </button>
  );
}
