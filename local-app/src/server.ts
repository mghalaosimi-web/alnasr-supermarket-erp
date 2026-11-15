import Fastify from "fastify";
import { z } from "zod";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase } from "./db/database.js";
import { authenticateSession, login, logout } from "./auth/auth.js";

const loginSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(1).max(256)
});

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(header);
  return match?.[1] ?? null;
}

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

  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    const result = login(db, parsed.data.username, parsed.data.password);
    if (!result) return reply.code(401).send({ error: "invalid_credentials" });
    return reply.code(200).send(result);
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "unauthorized" });
    const user = authenticateSession(db, token);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    return { user };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "unauthorized" });
    logout(db, token);
    return reply.code(204).send();
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
