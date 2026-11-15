import Fastify from "fastify";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase } from "./db/database.js";

export function buildServer() {
  const db = openDatabase();
  const app = Fastify({ logger: true });

  app.get("/api/v1/health", async () => {
    const result = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    const version = db.pragma("user_version", { simple: true });
    return {
      status: result.ok === 1 ? "ok" : "error",
      product: "AL-NASR",
      database: "sqlite",
      schemaVersion: version
    };
  });

  app.addHook("onClose", async () => {
    db.close();
  });

  return app;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  const app = buildServer();
  const host = process.env.AL_NASR_API_HOST ?? "127.0.0.1";
  const port = Number(process.env.AL_NASR_API_PORT ?? 4317);
  await app.listen({ host, port });
}
