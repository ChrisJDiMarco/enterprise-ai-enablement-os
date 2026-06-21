export type InterfaceMode = "classic" | "atlas";

export const DEFAULT_INTERFACE_MODE: InterfaceMode = "atlas";

export function normalizeInterfaceMode(value: unknown): InterfaceMode {
  if (value === "classic") return "classic";
  return value === "atlas" ? "atlas" : DEFAULT_INTERFACE_MODE;
}
