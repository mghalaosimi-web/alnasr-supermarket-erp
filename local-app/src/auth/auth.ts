import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import type Database from "better-sqlite3";

const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_HOURS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: AuthenticatedUser;
}

export function hashPassword(password: string): string {
  if (password.length < 12) throw new Error("Password must contain at least 12 characters.");
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt$16384$8$1$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== "16384" || parts[2] !== "8" || parts[3] !== "1") {
    return false;
  }
  try {
    const salt = Buffer.from(parts[4]!, "hex");
    const expected = Buffer.from(parts[5]!, "hex");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = scryptSync(password, salt, expected.length, SCRYPT_OPTIONS);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createUser(
  db: Database.Database,
  input: { username: string; displayName: string; password: string; roleCode: string }
): string {
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) throw new Error("Invalid username.");
  if (displayName.length < 2 || displayName.length > 100) throw new Error("Invalid display name.");

  const role = db.prepare("SELECT id FROM roles WHERE code = ?").get(input.roleCode) as { id: string } | undefined;
  if (!role) throw new Error("Unknown role.");

  const id = randomUUID();
  const passwordHash = hashPassword(input.password);
  const create = db.transaction(() => {
    db.prepare("INSERT INTO users(id, username, password_hash, display_name) VALUES (?, ?, ?, ?)")
      .run(id, username, passwordHash, displayName);
    db.prepare("INSERT INTO user_roles(user_id, role_id) VALUES (?, ?)")
      .run(id, role.id);
  });
  create();
  return id;
}

function loadUser(db: Database.Database, userId: string): AuthenticatedUser | null {
  const row = db.prepare(
    "SELECT id, username, display_name FROM users WHERE id = ? AND is_active = 1"
  ).get(userId) as { id: string; username: string; display_name: string } | undefined;
  if (!row) return null;

  const roles = db.prepare(`
    SELECT r.code FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ? ORDER BY r.code
  `).all(userId).map((item) => (item as { code: string }).code);

  const permissions = db.prepare(`
    SELECT DISTINCT rp.permission_code AS code
    FROM role_permissions rp
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = ? ORDER BY rp.permission_code
  `).all(userId).map((item) => (item as { code: string }).code);

  return { id: row.id, username: row.username, displayName: row.display_name, roles, permissions };
}

function recordFailedLogin(db: Database.Database, username: string, now: Date): void {
  const key = username.trim().toLowerCase();
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - LOCK_MINUTES * 60_000).toISOString();
  db.prepare(`
    INSERT INTO auth_attempts(username_key, failed_attempts, window_started_at, updated_at)
    VALUES (?, 1, ?, ?)
    ON CONFLICT(username_key) DO UPDATE SET
      failed_attempts = CASE
        WHEN auth_attempts.window_started_at < ? THEN 1
        ELSE auth_attempts.failed_attempts + 1
      END,
      window_started_at = CASE
        WHEN auth_attempts.window_started_at < ? THEN excluded.window_started_at
        ELSE auth_attempts.window_started_at
      END,
      locked_until = CASE
        WHEN (CASE WHEN auth_attempts.window_started_at < ? THEN 1 ELSE auth_attempts.failed_attempts + 1 END) >= ?
        THEN datetime('now', '+15 minutes')
        ELSE auth_attempts.locked_until
      END,
      updated_at = excluded.updated_at
  `).run(key, nowIso, nowIso, windowStart, windowStart, windowStart, MAX_FAILED_LOGINS);
}

export function login(
  db: Database.Database,
  username: string,
  password: string,
  now = new Date()
): LoginResult | null {
  const key = username.trim().toLowerCase();
  const attempt = db.prepare("SELECT locked_until FROM auth_attempts WHERE username_key = ?")
    .get(key) as { locked_until: string | null } | undefined;
  if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > now.getTime()) return null;

  const row = db.prepare(
    "SELECT id, password_hash FROM users WHERE username = ? COLLATE NOCASE AND is_active = 1"
  ).get(username.trim()) as { id: string; password_hash: string } | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    recordFailedLogin(db, username, now);
    return null;
  }

  db.prepare("DELETE FROM auth_attempts WHERE username_key = ?").run(key);
  const user = loadUser(db, row.id);
  if (!user) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60_000).toISOString();
  db.prepare("INSERT INTO user_sessions(id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .run(randomUUID(), row.id, createHash("sha256").update(token).digest("hex"), expiresAt);

  return { token, expiresAt, user };
}

export function authenticateSession(db: Database.Database, token: string, now = new Date()): AuthenticatedUser | null {
  if (!token || token.length > 256) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = db.prepare(`
    SELECT id, user_id FROM user_sessions
    WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
  `).get(tokenHash, now.toISOString()) as { id: string; user_id: string } | undefined;
  if (!session) return null;

  db.prepare("UPDATE user_sessions SET last_seen_at = ? WHERE id = ?")
    .run(now.toISOString(), session.id);
  return loadUser(db, session.user_id);
}

export function logout(db: Database.Database, token: string, now = new Date()): void {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  db.prepare("UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .run(now.toISOString(), tokenHash);
}

export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  return user.permissions.includes(permission);
}
