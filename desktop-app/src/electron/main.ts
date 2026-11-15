import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface ApiRequest {
  path: string;
  method?: "GET" | "POST" | "PUT";
  token?: string;
  body?: unknown;
}
interface ApiResponse { status: number; data: unknown; }
type FastifyApplication = {
  listen(options: { host: string; port: number }): Promise<string>;
  close(): Promise<void>;
};

const filename = fileURLToPath(import.meta.url);
const directory = dirname(filename);
const host = "127.0.0.1";
const port = 4317;
const origin = "http://" + host + ":" + port;
const maxBodyLength = 1_048_576;
let mainWindow: BrowserWindow | null = null;
let api: FastifyApplication | null = null;
let shutdownStarted = false;

function isTrustedRenderer(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "http:") {
      return parsed.hostname === "127.0.0.1" && parsed.port === "5173";
    }
    if (parsed.protocol === "file:") {
      return resolve(decodeURIComponent(parsed.pathname)).toLowerCase()
        === resolve(join(app.getAppPath(), "dist", "index.html")).toLowerCase();
    }
    return false;
  } catch {
    return false;
  }
}

function validateApiRequest(input: unknown): ApiRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid API request.");
  }
  const value = input as Record<string, unknown>;
  if (typeof value.path !== "string" || value.path.length > 512) {
    throw new Error("Invalid API path.");
  }
  const target = new URL(value.path, origin);
  if (target.origin !== origin || !target.pathname.startsWith("/api/v1/")) {
    throw new Error("API route is not allowed.");
  }
  const method = value.method ?? "GET";
  if (method !== "GET" && method !== "POST" && method !== "PUT") {
    throw new Error("HTTP method is not allowed.");
  }
  if (value.token !== undefined
    && (typeof value.token !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(value.token))) {
    throw new Error("Invalid session token.");
  }
  if (method === "GET" && value.body !== undefined) {
    throw new Error("GET requests cannot contain a body.");
  }
  if (value.body !== undefined && JSON.stringify(value.body).length > maxBodyLength) {
    throw new Error("Request body is too large.");
  }
  return {
    path: target.pathname + target.search,
    method,
    ...(typeof value.token === "string" ? { token: value.token } : {}),
    ...(value.body !== undefined ? { body: value.body } : {})
  };
}

function registerIpc(): void {
  ipcMain.handle("alnasr:api-request", async (event, input: unknown): Promise<ApiResponse> => {
    if (!isTrustedRenderer(event.senderFrame?.url ?? "")) {
      throw new Error("Untrusted renderer.");
    }
    const request = validateApiRequest(input);
    const headers: Record<string, string> = { accept: "application/json" };
    if (request.token) headers.authorization = "Bearer " + request.token;
    if (request.body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(origin + request.path, {
      method: request.method,
      headers,
      ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
      signal: AbortSignal.timeout(15_000)
    });
    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    return { status: response.status, data };
  });
}

async function startApi(): Promise<void> {
  const entry = join(app.getAppPath(), "runtime", "dist", "server.js");
  const runtime = await import(pathToFileURL(resolve(entry)).href) as {
    buildServer: () => FastifyApplication;
  };
  api = runtime.buildServer();
  await api.listen({ host, port });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: "#F3F5F7",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(directory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRenderer(url)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => { mainWindow = null; });

  const devUrl = process.env.AL_NASR_RENDERER_URL;
  if (devUrl && !app.isPackaged) await mainWindow.loadURL(devUrl);
  else await mainWindow.loadFile(join(app.getAppPath(), "dist", "index.html"));
}

async function shutdown(): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;
  try {
    await api?.close();
  } catch (error) {
    dialog.showErrorBox("AL-NASR shutdown error", error instanceof Error ? error.message : String(error));
  } finally {
    api = null;
    app.exit(0);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    registerIpc();
    try {
      await startApi();
      await createWindow();
    } catch (error) {
      dialog.showErrorBox(
        "Unable to start AL-NASR ERP",
        error instanceof Error ? error.message : String(error)
      );
      await shutdown();
    }
  });

  app.on("before-quit", (event) => {
    if (!shutdownStarted && api) {
      event.preventDefault();
      void shutdown();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}