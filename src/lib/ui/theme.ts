/**
 * Tenant theming. The app's brand color lives in three CSS custom properties
 * (--primary, --primary-hover, --primary-soft) declared in globals.css. Shared
 * components reference those variables, so updating them at runtime re-themes the
 * entire app from a single tenant value.
 */

const DEFAULT_BRAND = "#635bff";

export function normalizeBrandHex(value: string | undefined): string {
  if (typeof value !== "string") return DEFAULT_BRAND;
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : DEFAULT_BRAND;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = normalizeBrandHex(hex).slice(1);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function toHex(channel: number): string {
  return Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");
}

/** Mix `hex` toward `target` by `amount` (0..1). */
function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [tr, tg, tb] = target;
  const ratio = Math.max(0, Math.min(1, amount));
  return `#${toHex(r + (tr - r) * ratio)}${toHex(g + (tg - g) * ratio)}${toHex(b + (tb - b) * ratio)}`;
}

/** Relative luminance (0..1) for picking readable foreground text. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const channel = c / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The brand-foreground color (text/icon sitting on the brand fill). */
export function brandForeground(primaryColor: string): string {
  return luminance(primaryColor) > 0.55 ? "#0f172a" : "#ffffff";
}

/** CSS custom properties derived from the tenant's primary color. */
export function brandThemeVariables(primaryColor: string): Record<string, string> {
  const base = normalizeBrandHex(primaryColor);
  const [r, g, b] = hexToRgb(base);
  return {
    "--primary": base,
    "--primary-hover": mix(base, [0, 0, 0], 0.16),
    "--primary-soft-light": mix(base, [255, 255, 255], 0.9),
    "--primary-soft-dark": `rgba(${r}, ${g}, ${b}, 0.16)`,
    "--primary-contrast": brandForeground(base),
  };
}

/** Apply the tenant theme to the document root so it cascades app-wide. */
export function applyBrandTheme(primaryColor: string): void {
  if (typeof document === "undefined") return;
  const variables = brandThemeVariables(primaryColor);
  for (const [name, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(name, value);
  }
}
