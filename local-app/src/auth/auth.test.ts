import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { applySchemaV1, applySchemaV2 } from "../db/schema.js";
import { authenticateSession, bootstrapOwner, createUser, hasPermission, login, logout, verifyPassword } from "./auth.js";

describe("local authentication and RBAC", () => {
  let db: Database.Database | undefined;

  function setup(): Database.Database {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchemaV1(db);
    applySchemaV2(db);
    return db;
  }

  afterEach(() => {
    db?.close();
    db = undefined;
  });


  it("bootstraps the owner, default store and warehouse exactly once", () => {
    const database = setup();
    const ownerId = bootstrapOwner(database, {
      username: "owner01",
      displayName: "Store Owner",
      password: "A-Strong-Password-2026"
    });
    const result = login(database, "owner01", "A-Strong-Password-2026");
    expect(result?.user.id).toBe(ownerId);
    expect(result?.user.roles).toContain("owner");
    expect(hasPermission(result!.user, "users:write")).toBe(true);
    expect(database.prepare("SELECT name FROM stores").all()).toEqual([{ name: "المتجر الرئيسي" }]);
    expect(database.prepare("SELECT name FROM warehouses").all()).toEqual([{ name: "المستودع الرئيسي" }]);
    expect(() => bootstrapOwner(database, {
      username: "owner02",
      displayName: "Second Owner",
      password: "Another-Strong-Password-2026"
    })).toThrow(/already been completed/);
  });

  it("hashes passwords with scrypt and verifies without storing plaintext", () => {
    const database = setup();
    const userId = createUser(database, {
      username: "cashier01",
      displayName: "Test Cashier",
      password: "A-Strong-Password-2026",
      roleCode: "cashier"
    });
    const stored = database.prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(userId) as { password_hash: string };
    expect(stored.password_hash).not.toContain("A-Strong-Password-2026");
    expect(verifyPassword("A-Strong-Password-2026", stored.password_hash)).toBe(true);
    expect(verifyPassword("wrong-password", stored.password_hash)).toBe(false);
  });

  it("issues a session and resolves cashier permissions", () => {
    const database = setup();
    const userId = createUser(database, {
      username: "cashier02",
      displayName: "Cashier",
      password: "A-Strong-Password-2026",
      roleCode: "cashier"
    });
    const result = login(database, "CASHIER02", "A-Strong-Password-2026");
    expect(result?.user.id).toBe(userId);
    expect(hasPermission(result!.user, "sales:post")).toBe(true);
    expect(hasPermission(result!.user, "users:write")).toBe(false);
    expect(authenticateSession(database, result!.token)?.id).toBe(userId);
  });

  it("rejects invalid credentials and revokes logged-out sessions", () => {
    const database = setup();
    createUser(database, {
      username: "cashier03",
      displayName: "Cashier",
      password: "A-Strong-Password-2026",
      roleCode: "cashier"
    });
    expect(login(database, "cashier03", "incorrect-password")).toBeNull();
    const result = login(database, "cashier03", "A-Strong-Password-2026");
    expect(result).not.toBeNull();
    logout(database, result!.token);
    expect(authenticateSession(database, result!.token)).toBeNull();
  });

  it("rejects short passwords and unknown roles", () => {
    const database = setup();
    expect(() => createUser(database, {
      username: "shortpw",
      displayName: "User",
      password: "short",
      roleCode: "cashier"
    })).toThrow(/12 characters/);
    expect(() => createUser(database, {
      username: "unknownrole",
      displayName: "User",
      password: "A-Strong-Password-2026",
      roleCode: "not-a-role"
    })).toThrow(/Unknown role/);
  });
});
