import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { applySchemaV1, applySchemaV2, applySchemaV3, SCHEMA_VERSION } from "./schema.js";

export function resolveDatabasePath(): string {
  if (process.env.AL_NASR_DATABASE_PATH) return process.env.AL_NASR_DATABASE_PATH;
  const root = process.env.ProgramData
    ? join(process.env.ProgramData, "AL-NASR", "data")
    : join(homedir(), ".local", "share", "al-nasr", "data");
  return join(root, "alnasr.sqlite");
}

export function openDatabase(path = resolveDatabasePath()): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("busy_timeout = 5000");
  db.pragma("trusted_schema = OFF");

  const migrate = db.transaction(() => {
    const current = Number(db.pragma("user_version", { simple: true }));
    if (current > SCHEMA_VERSION) {
      throw new Error(`Database schema ${current} is newer than this application supports (${SCHEMA_VERSION}).`);
    }
    if (current < 1) {
      applySchemaV1(db);
      db.pragma("user_version = 1");
    }
    if (current < 2) {
      applySchemaV2(db);
      db.pragma("user_version = 2");
    }
    if (current < 3) {
      applySchemaV3(db);
      db.pragma("user_version = 3");
    }
  });
  migrate();
  return db;
}
