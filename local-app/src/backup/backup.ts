import Database from "better-sqlite3";
import { closeSync, fsyncSync, openSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { SCHEMA_VERSION } from "../db/schema.js";

export interface BackupResult {
  path: string;
  schemaVersion: number;
  integrity: "ok";
}

export async function createDatabaseBackup(
  source: Database.Database,
  destinationPath: string
): Promise<BackupResult> {
  if (source.name === ":memory:") throw new Error("In-memory databases cannot be backed up as store data.");
  const destination = resolve(destinationPath);
  if (destination === resolve(source.name)) throw new Error("Backup destination must differ from the live database.");
  const temporary = `${destination}.partial-${randomUUID()}`;
  await mkdir(dirname(destination), { recursive: true });

  try {
    await source.backup(temporary);
    const verification = new Database(temporary, { readonly: true, fileMustExist: true });
    let integrity: unknown;
    let schemaVersion: number;
    try {
      integrity = verification.pragma("quick_check", { simple: true });
      schemaVersion = Number(verification.pragma("user_version", { simple: true }));
      if (integrity !== "ok") throw new Error("Backup integrity check failed.");
      if (schemaVersion !== SCHEMA_VERSION) throw new Error("Backup schema version does not match this application.");
    } finally {
      verification.close();
    }

    const fileDescriptor = openSync(temporary, "r");
    try {
      fsyncSync(fileDescriptor);
    } finally {
      closeSync(fileDescriptor);
    }
    await rename(temporary, destination);
    return { path: destination, schemaVersion, integrity: "ok" };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}
