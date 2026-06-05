import type { User } from "@/lib/enterprise-ai-data";
import type { UserRole } from "@/lib/auth";

export type WorkspaceUserMutation =
  | {
      ok: true;
      users: User[];
      user: User;
      action: "added" | "updated";
    }
  | {
      ok: false;
      reason: "last_admin" | "not_found";
      message: string;
    };

export type WorkspaceUserDelete =
  | {
      ok: true;
      users: User[];
      user: User;
    }
  | {
      ok: false;
      reason: "last_admin" | "not_found";
      message: string;
    };

export type WorkspaceProvisionUser = Partial<Omit<User, "name" | "email">> & {
  id?: string;
  externalId?: string;
  name?: string;
  email?: string;
  userName?: string;
  active?: boolean;
};

export type WorkspaceUserSyncResult = {
  ok: boolean;
  users: User[];
  upserted: User[];
  removed: User[];
  skipped: { identity: string; reason: string }[];
  errors: { identity: string; reason: string }[];
};

export function workspaceUserIdFromEmail(email: string) {
  const slug = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return `user-${slug || "member"}`;
}

const userRoles: UserRole[] = [
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

function normalizeRole(role: User["role"] | undefined): UserRole {
  return userRoles.includes(role as UserRole) ? (role as UserRole) : "viewer";
}

export function normalizeWorkspaceUser(input: Partial<User> & { name: string; email: string; role?: User["role"] }): User {
  const email = input.email.trim().toLowerCase();

  return {
    id: input.id?.trim() || workspaceUserIdFromEmail(email),
    name: input.name.trim().replace(/\s+/g, " "),
    email,
    title: input.title?.trim() || "Workspace member",
    department: input.department || "Other",
    role: normalizeRole(input.role),
  };
}

export function sortWorkspaceUsers(users: User[]) {
  return [...users].sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    return a.name.localeCompare(b.name);
  });
}

export function dedupeWorkspaceUsers(users: User[]) {
  const byIdentity = new Map<string, User>();
  users.forEach((user) => {
    const normalized = normalizeWorkspaceUser(user as User & { role?: UserRole });
    byIdentity.set(normalized.email.toLowerCase(), normalized);
  });

  return sortWorkspaceUsers([...byIdentity.values()]);
}

export function upsertWorkspaceUser(users: User[], candidate: User): WorkspaceUserMutation {
  const normalized = normalizeWorkspaceUser(candidate as User & { role?: UserRole });
  const existing = users.find(
    (user) => user.id === normalized.id || user.email.toLowerCase() === normalized.email.toLowerCase(),
  );

  if (
    existing?.role === "admin" &&
    normalized.role !== "admin" &&
    users.filter((user) => user.role === "admin").length <= 1
  ) {
    return {
      ok: false,
      reason: "last_admin",
      message: "At least one workspace admin is required.",
    };
  }

  return {
    ok: true,
    user: normalized,
    action: existing ? "updated" : "added",
    users: dedupeWorkspaceUsers([
      normalized,
      ...users.filter((user) => user.id !== normalized.id && user.email.toLowerCase() !== normalized.email.toLowerCase()),
    ]),
  };
}

export function removeWorkspaceUser(users: User[], userId: string): WorkspaceUserDelete {
  const target = users.find((user) => user.id === userId);
  if (!target) {
    return {
      ok: false,
      reason: "not_found",
      message: "Workspace member was not found.",
    };
  }

  if (target.role === "admin" && users.filter((user) => user.role === "admin").length <= 1) {
    return {
      ok: false,
      reason: "last_admin",
      message: "At least one workspace admin is required.",
    };
  }

  return {
    ok: true,
    user: target,
    users: dedupeWorkspaceUsers(users.filter((user) => user.id !== userId)),
  };
}

function provisionIdentity(record: WorkspaceProvisionUser) {
  return (record.email || record.userName || record.id || record.externalId || "unknown").trim().toLowerCase();
}

function findProvisionedUser(users: User[], record: WorkspaceProvisionUser) {
  const email = (record.email || record.userName || "").trim().toLowerCase();
  return users.find(
    (user) =>
      (record.id && user.id === record.id) ||
      (email && user.email.toLowerCase() === email),
  );
}

export function syncWorkspaceUsers(
  users: User[],
  records: WorkspaceProvisionUser[],
  options: { deprovisionMissing?: boolean } = {},
): WorkspaceUserSyncResult {
  let nextUsers = dedupeWorkspaceUsers(users);
  const upserted: User[] = [];
  const removed: User[] = [];
  const skipped: WorkspaceUserSyncResult["skipped"] = [];
  const errors: WorkspaceUserSyncResult["errors"] = [];
  const activeEmails = new Set<string>();

  for (const record of records) {
    const identity = provisionIdentity(record);
    const email = (record.email || record.userName || "").trim().toLowerCase();
    if (email && record.active !== false) activeEmails.add(email);

    if (record.active === false) {
      const existing = findProvisionedUser(nextUsers, record);
      if (!existing) {
        skipped.push({ identity, reason: "not_found" });
        continue;
      }

      const removal = removeWorkspaceUser(nextUsers, existing.id);
      if (!removal.ok) {
        errors.push({ identity, reason: removal.message });
        continue;
      }
      nextUsers = removal.users;
      removed.push(removal.user);
      continue;
    }

    if (!email || !record.name?.trim()) {
      errors.push({ identity, reason: "Active users require email and name." });
      continue;
    }

    const mutation = upsertWorkspaceUser(nextUsers, {
      id: record.id || workspaceUserIdFromEmail(email),
      name: record.name,
      email,
      title: record.title || "Workspace member",
      department: record.department || "Other",
      role: record.role || "viewer",
    });

    if (!mutation.ok) {
      errors.push({ identity, reason: mutation.message });
      continue;
    }
    nextUsers = mutation.users;
    upserted.push(mutation.user);
  }

  if (options.deprovisionMissing) {
    for (const user of [...nextUsers]) {
      if (activeEmails.has(user.email.toLowerCase())) continue;
      const removal = removeWorkspaceUser(nextUsers, user.id);
      if (!removal.ok) {
        errors.push({ identity: user.email, reason: removal.message });
        continue;
      }
      nextUsers = removal.users;
      removed.push(removal.user);
    }
  }

  return {
    ok: errors.length === 0,
    users: dedupeWorkspaceUsers(nextUsers),
    upserted,
    removed,
    skipped,
    errors,
  };
}
