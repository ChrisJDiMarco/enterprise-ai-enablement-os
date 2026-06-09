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
