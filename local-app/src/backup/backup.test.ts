import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDatabase, openDatabase } from "../db/database.js";
import { createDatabaseBackup } from "./backup.js";

describe("verified SQLite backup", () => {
  let directory: string | undefined;
  let live: Database.Database | undefined;

  afterEach(() => {
    if (live?.open) closeDatabase(live);
    live = undefined;
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  it("creates a verified backup that can be reopened independently", async () => {
    directory = mkdtempSync(join(tmpdir(), "alnasr-backup-"));
    const sourcePath = join(directory, "live.sqlite");
    const backupPath = join(directory, "backups", "daily.sqlite");
    live = openDatabase(sourcePath);
    live.prepare("INSERT INTO stores(id, name) VALUES (?, ?)").run("backup-store", "Backup Store");

    const result = await createDatabaseBackup(live, backupPath);
    expect(result.schemaVersion).toBe(5);
    expect(result.integrity).toBe("ok");

    const backup = new Database(backupPath, { readonly: true, fileMustExist: true });
    try {
      expect(backup.prepare("SELECT name FROM stores WHERE id = ?").get("backup-store"))
        .toEqual({ name: "Backup Store" });
      expect(backup.pragma("quick_check", { simple: true })).toBe("ok");
    } finally {
      backup.close();
    }
  });

  it("refuses memory databases and overwriting the live database", async () => {
    const memory = new Database(":memory:");
    await expect(createDatabaseBackup(memory, "backup.sqlite")).rejects.toThrow(/In-memory/);
    memory.close();

    directory = mkdtempSync(join(tmpdir(), "alnasr-backup-guard-"));
    const sourcePath = join(directory, "live.sqlite");
    live = openDatabase(sourcePath);
    await expect(createDatabaseBackup(live, sourcePath)).rejects.toThrow(/must differ/);
  });
});
