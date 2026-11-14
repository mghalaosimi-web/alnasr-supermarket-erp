import { copyFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { initializeDatabase, MIGRATIONS } from "./database-core";

export type RestoreResult = {
  database: Database.Database;
  safetyBackupPath: string;
};

function validateDatabase(db: Database.Database): void {
  const integrity = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error("فشل فحص سلامة ملف النسخة الاحتياطية");
  }
  const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((row) => row.name));
  for (const table of ["schema_migrations", "users", "products", "sales", "stock_movements", "purchase_documents"]) {
    if (!tables.has(table)) throw new Error("ملف النسخة الاحتياطية ليس قاعدة بيانات AL-NASR صالحة");
  }
  const applied = db.prepare("SELECT id FROM schema_migrations").all() as Array<{ id: string }>;
  const known = new Set<string>(MIGRATIONS.map((migration) => migration.id));
  if (applied.some((migration) => !known.has(migration.id))) {
    throw new Error("النسخة الاحتياطية منشأة بإصدار أحدث من هذا التطبيق");
  }
  const foreignKeyErrors = db.pragma("foreign_key_check") as unknown[];
  if (foreignKeyErrors.length > 0) throw new Error("تحتوي النسخة الاحتياطية على علاقات بيانات غير سليمة");
}

export async function restoreDatabaseFile(
  currentDb: Database.Database,
  backupPath: string,
  targetPath: string
): Promise<RestoreResult> {
  if (!backupPath || !existsSync(backupPath)) throw new Error("ملف النسخة الاحتياطية غير موجود");
  const source = resolve(backupPath);
  const target = resolve(targetPath);
  if (source === target) throw new Error("اختر ملف نسخة احتياطية منفصلاً عن قاعدة البيانات الحالية");

  mkdirSync(dirname(target), { recursive: true });
  const workDirectory = mkdtempSync(join(dirname(target), ".alnasr-restore-"));
  const stagedPath = join(workDirectory, "validated-backup.sqlite");
  const replacementPath = target + ".restore-" + randomUUID() + ".tmp";
  const safetyBackupPath = target + ".before-restore-" + new Date().toISOString().replace(/[:.]/g, "-") + ".sqlite";
  let stagedDb: Database.Database | null = null;
  let restoredDb: Database.Database | null = null;
  let currentClosed = false;

  try {
    copyFileSync(source, stagedPath);
    stagedDb = new Database(stagedPath);
    validateDatabase(stagedDb);
    initializeDatabase(stagedDb);
    validateDatabase(stagedDb);
    stagedDb.pragma("wal_checkpoint(TRUNCATE)");
    stagedDb.close();
    stagedDb = null;

    await currentDb.backup(safetyBackupPath);
    currentDb.close();
    currentClosed = true;

    copyFileSync(stagedPath, replacementPath);
    for (const suffix of ["", "-wal", "-shm"]) {
      const stalePath = target + suffix;
      if (existsSync(stalePath)) rmSync(stalePath, { force: true });
    }
    renameSync(replacementPath, target);

    restoredDb = new Database(target);
    initializeDatabase(restoredDb);
    validateDatabase(restoredDb);
    return { database: restoredDb, safetyBackupPath };
  } catch (error) {
    if (stagedDb?.open) stagedDb.close();
    if (restoredDb?.open) restoredDb.close();
    if (currentClosed && existsSync(safetyBackupPath)) {
      for (const suffix of ["", "-wal", "-shm"]) {
        const stalePath = target + suffix;
        if (existsSync(stalePath)) rmSync(stalePath, { force: true });
      }
      copyFileSync(safetyBackupPath, target);
    }
    throw error;
  } finally {
    if (existsSync(replacementPath)) rmSync(replacementPath, { force: true });
    rmSync(workDirectory, { recursive: true, force: true });
  }
}
