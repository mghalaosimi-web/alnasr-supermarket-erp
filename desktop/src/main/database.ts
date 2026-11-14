import Database from "better-sqlite3";
import { app } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { initializeDatabase } from "./database-core";

export type AlnasrDatabase = Database.Database;

export function openDatabase(): AlnasrDatabase {
  const dataDirectory = join(app.getPath("userData"), "data");
  mkdirSync(dataDirectory, { recursive: true });
  const databasePath = join(dataDirectory, "alnasr.sqlite");
  const database = new Database(databasePath);
  try {
    initializeDatabase(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
