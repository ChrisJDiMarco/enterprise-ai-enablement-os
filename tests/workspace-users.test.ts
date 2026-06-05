import { test } from "node:test";
import assert from "node:assert/strict";
import type { User } from "../src/lib/enterprise-ai-data.ts";
import {
  normalizeWorkspaceUser,
  removeWorkspaceUser,
  syncWorkspaceUsers,
  upsertWorkspaceUser,
  workspaceUserIdFromEmail,
} from "../src/lib/workspace-users.ts";

const admin: User = {
  id: "admin-1",
  name: "Workspace Admin",
  email: "admin@example.com",
  title: "Admin",
  department: "Operations",
  role: "admin",
};

test("workspaceUserIdFromEmail creates a stable tenant member id", () => {
  assert.equal(workspaceUserIdFromEmail(" Sarah.Admin+Ops@Example.COM "), "user-sarah-admin-ops-example-com");
});

test("normalizeWorkspaceUser lowercases email and fills defaults", () => {
  const user = normalizeWorkspaceUser({
    name: "  Priya   Shah ",
    email: "PRIYA.SHAH@EXAMPLE.COM",
  });

  assert.equal(user.id, "user-priya-shah-example-com");
  assert.equal(user.name, "Priya Shah");
  assert.equal(user.email, "priya.shah@example.com");
  assert.equal(user.role, "viewer");
  assert.equal(user.department, "Other");
});

test("upsertWorkspaceUser adds and updates by email identity", () => {
  const add = upsertWorkspaceUser([admin], {
    id: "",
    name: "Security Reviewer",
    email: "security@example.com",
    title: "",
    department: "Security",
    role: "security_reviewer",
  });
  assert.equal(add.ok, true);
  if (!add.ok) return;
  assert.equal(add.action, "added");
  assert.equal(add.users.length, 2);

  const update = upsertWorkspaceUser(add.users, {
    id: "different-id",
    name: "Security Lead",
    email: "security@example.com",
    title: "Lead",
    department: "Security",
    role: "admin",
  });
  assert.equal(update.ok, true);
  if (!update.ok) return;
  assert.equal(update.action, "updated");
  assert.equal(update.users.length, 2);
  assert.equal(update.users.find((user) => user.email === "security@example.com")?.role, "admin");
});

test("workspace user helpers prevent removing or demoting the last admin", () => {
  const demote = upsertWorkspaceUser([admin], {
    ...admin,
    role: "viewer",
  });
  assert.equal(demote.ok, false);
  if (!demote.ok) assert.equal(demote.reason, "last_admin");

  const remove = removeWorkspaceUser([admin], admin.id);
  assert.equal(remove.ok, false);
  if (!remove.ok) assert.equal(remove.reason, "last_admin");
});

test("syncWorkspaceUsers upserts, deactivates, and reports lifecycle changes", () => {
  const result = syncWorkspaceUsers(
    [admin],
    [
      {
        email: "builder@example.com",
        name: "Builder User",
        title: "AI Builder",
        department: "IT",
        role: "builder",
        active: true,
      },
      {
        email: "missing@example.com",
        name: "Missing User",
        active: false,
      },
    ],
  );

  assert.equal(result.ok, true);
  assert.equal(result.upserted.length, 1);
  assert.equal(result.removed.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.users.some((user) => user.email === "builder@example.com"), true);
});

test("syncWorkspaceUsers deprovisions absent users without deleting the last admin", () => {
  const existing = upsertWorkspaceUser([admin], {
    id: "",
    name: "Viewer User",
    email: "viewer@example.com",
    title: "Viewer",
    department: "Finance",
    role: "viewer",
  });
  assert.equal(existing.ok, true);
  if (!existing.ok) return;

  const result = syncWorkspaceUsers(
    existing.users,
    [
      {
        email: admin.email,
        name: admin.name,
        role: "admin",
        department: "Operations",
        active: true,
      },
    ],
    { deprovisionMissing: true },
  );

  assert.equal(result.ok, true);
  assert.equal(result.removed.length, 1);
  assert.equal(result.removed[0].email, "viewer@example.com");
  assert.equal(result.users.length, 1);
  assert.equal(result.users[0].email, admin.email);
});
