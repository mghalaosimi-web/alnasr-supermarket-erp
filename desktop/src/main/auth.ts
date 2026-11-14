import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export type PublicUser = { id: string; username: string; displayName: string };
export type OwnerSetupInput = { username: string; displayName: string; password: string };

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, n, r, p, saltHex, hashHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function isOwnerSetupRequired(db: Database.Database): boolean {
  return (db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count === 0;
}

export function createInitialOwner(db: Database.Database, input: OwnerSetupInput): PublicUser {
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) throw new Error("اسم المستخدم يجب أن يكون من 3 إلى 32 حرفاً إنجليزياً أو رقماً");
  if (displayName.length < 2 || displayName.length > 80) throw new Error("أدخل اسماً صحيحاً للمالك");
  if (input.password.length < 12 || input.password.length > 128) throw new Error("كلمة المرور يجب أن تكون 12 حرفاً على الأقل");
  if (!isOwnerSetupRequired(db)) throw new Error("تم إنشاء حساب المالك مسبقاً");

  const user: PublicUser = { id: randomUUID(), username, displayName };
  const roleId = randomUUID();
  const passwordHash = hashPassword(input.password);
  const create = db.transaction(() => {
    db.prepare("INSERT INTO roles (id, code, name, is_system) VALUES (?, 'OWNER', 'مالك النظام', 1)")
      .run(roleId);
    db.prepare("INSERT INTO users (id, username, display_name, password_hash) VALUES (?, ?, ?, ?)")
      .run(user.id, user.username, user.displayName, passwordHash);
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").run(user.id, roleId);
    db.prepare(
      "INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, 'owner.bootstrap', 'user', ?, ?)"
    ).run(randomUUID(), user.id, user.id, JSON.stringify({ username: user.username }));
  });
  create();
  return user;
}

export function authenticate(db: Database.Database, usernameInput: string, password: string): PublicUser | null {
  const username = usernameInput.trim().toLowerCase();
  const row = db.prepare(
    "SELECT id, username, display_name AS displayName, password_hash AS passwordHash, is_active AS isActive FROM users WHERE username = ?"
  ).get(username) as (PublicUser & { passwordHash: string; isActive: number }) | undefined;

  if (!row || row.isActive !== 1 || !verifyPassword(password, row.passwordHash)) return null;
  return { id: row.id, username: row.username, displayName: row.displayName };
}
