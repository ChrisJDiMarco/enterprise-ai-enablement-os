const DEFAULT_APP_TITLE = "Enterprise AI Enablement OS";

function normalizeTitlePart(value: string | null | undefined, maxLength: number) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

export function buildWorkspaceDocumentTitle({
  surface,
  organizationName,
  appName = DEFAULT_APP_TITLE,
}: {
  surface?: string | null;
  organizationName?: string | null;
  appName?: string;
}) {
  const safeAppName = normalizeTitlePart(appName, 80) || DEFAULT_APP_TITLE;
  const safeSurface = normalizeTitlePart(surface, 80);
  const safeOrganizationName = normalizeTitlePart(organizationName, 80);
  const parts = [safeSurface, safeOrganizationName, safeAppName].filter((part, index, list) => {
    if (!part) return false;
    return list.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index;
  });

  return parts.join(" · ") || safeAppName;
}
