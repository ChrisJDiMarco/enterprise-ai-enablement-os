export type UserRole =
  | "admin"
  | "ai_enablement_director"
  | "ai_product_owner"
  | "governance_reviewer"
  | "security_reviewer"
  | "legal_reviewer"
  | "privacy_reviewer"
  | "function_leader"
  | "builder"
  | "viewer";

export const allowedRoles: UserRole[] = [
  "admin",
  "ai_enablement_director",
  "ai_product_owner",
  "governance_reviewer",
  "security_reviewer",
  "legal_reviewer",
  "privacy_reviewer",
  "function_leader",
  "builder",
  "viewer",
];

export const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  ai_enablement_director: "AI Enablement Director",
  ai_product_owner: "AI Product Owner",
  governance_reviewer: "Governance Reviewer",
  security_reviewer: "Security Reviewer",
  legal_reviewer: "Legal Reviewer",
  privacy_reviewer: "Privacy Reviewer",
  function_leader: "Function Leader",
  builder: "Builder",
  viewer: "Viewer",
};

export const roleCapabilities: Record<UserRole, string> = {
  admin: "Full control: workspace settings, members, API keys, and launch readiness.",
  ai_enablement_director: "Oversees the program — can act across discovery, build, and governance.",
  ai_product_owner: "Shapes and ships use cases and Skills through build and pilot.",
  governance_reviewer: "Reviews risk packets and approves or returns them.",
  security_reviewer: "Reviews the security controls on risk packets.",
  legal_reviewer: "Reviews legal and compliance terms on risk packets.",
  privacy_reviewer: "Reviews privacy and data-handling controls.",
  function_leader: "Owns a business function's use cases and adoption.",
  builder: "Builds Skills and workflows in the harness.",
  viewer: "Read-only access to the workspace.",
};

const roleAccess: Record<UserRole, Set<UserRole>> = {
  viewer: new Set(allowedRoles),
  function_leader: new Set(["function_leader", "builder", "ai_product_owner", "ai_enablement_director", "admin"]),
  builder: new Set(["builder", "ai_product_owner", "ai_enablement_director", "admin"]),
  ai_product_owner: new Set(["ai_product_owner", "ai_enablement_director", "admin"]),
  governance_reviewer: new Set(["governance_reviewer", "ai_enablement_director", "admin"]),
  security_reviewer: new Set(["security_reviewer", "ai_enablement_director", "admin"]),
  legal_reviewer: new Set(["legal_reviewer", "ai_enablement_director", "admin"]),
  privacy_reviewer: new Set(["privacy_reviewer", "ai_enablement_director", "admin"]),
  ai_enablement_director: new Set(["ai_enablement_director", "admin"]),
  admin: new Set(["admin"]),
};

export function canRoleAccess(role: UserRole, requiredRole: UserRole) {
  return Boolean(roleAccess[requiredRole]?.has(role));
}

export function roleIsAllowed(value: unknown): value is UserRole {
  return typeof value === "string" && allowedRoles.includes(value as UserRole);
}
