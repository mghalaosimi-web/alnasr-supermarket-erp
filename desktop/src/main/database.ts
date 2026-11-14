import Database from "better-sqlite3";
import { app } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { initializeDatabase } from "./database-core";

export type AlnasrDatabase = Database.Database;

export function getDatabasePath(): string {
  const dataDirectory = join(app.getPath("userData"), "data");
  mkdirSync(dataDirectory, { recursive: true });
  return join(dataDirectory, "alnasr.sqlite");
}

export function openDatabase(): AlnasrDatabase {
  const databasePath = getDatabasePath();
  const database = new Database(databasePath);
  try {
    initializeDatabase(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
