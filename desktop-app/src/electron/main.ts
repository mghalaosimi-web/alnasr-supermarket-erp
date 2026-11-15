import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface ApiRequest {
  path: string;
  method?: "GET" | "POST" | "PUT";
  token?: string;
  body?: unknown;
}

interface ApiResponse {
  status: number;
  data: unknown;
}

type FastifyApplication = {
  listen(options: { host: string; port: number }): Promise<string>;
  close(): Promise<void>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_HOST = "127.0.0.1";
const API_PORT = 4317;
const API_ORIGIN = `http://${API_HOST}:${API_PORT}`;
const API_PATH_PREFIX = "/api/v1/";
const API_BODY_LIMIT = 1_048_576;

let mainWindow: BrowserWindow | null = null;
let localApi: FastifyApplication | null = null;
let shutdownStarted = false;

function isTrustedRenderer(url: string): boolean {
  if (url.startsWith("file://")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:"
      && parsed.hostname === "127.0.0.1"
      && parsed.port === "5173";
  } catch {
    return false;
  }
}

function validateApiRequest(input: unknown): ApiRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid API request.");
  }

  const request = input as Record<string, unknown>;
  if (typeof request.path !== "string" || request.path.length > 512) {
    throw new Error("Invalid API path.");
  }

  const target = new URL(request.path, API_ORIGIN);
  if (target.origin !== API_ORIGIN || !target.pathname.startsWith(API_PATH_PREFIX)) {
    throw new Error("API route is not allowed.");
  }

  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "POST" && method !== "PUT") {
    throw new Error("HTTP method is not allowed.");
  }

  if (request.token !== undefined
    && (typeof request.token !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(request.token))) {
    throw new Error("Invalid session token.");
  }

  if (method === "GET" && request.body !== undefined) {
    throw new Error("GET requests cannot contain a body.");
  }

  if (request.body !== undefined) {
    const serialized = JSON.stringify(request.body);
    if (serialized.length > API_BODY_LIMIT) throw new Error("Request body is too large.");
  }

  return {
    path: target.pathname + target.search,
    method,
    ...(typeof request.token === "string" ? { token: request.token } : {}),
    ...(request.body !== undefined ? { body: request.body } : {})
  };
}

function registerApiBridge(): void {
  ipcMain.handle("alnasr:api-request", async (event, rawRequest: unknown): Promise<ApiResponse> => {
    const senderUrl = event.senderFrame?.url ?? "";
    if (!isTrustedRenderer(senderUrl)) throw new Error("Untrusted renderer.");
    const request = validateApiRequest(rawRequest);

    const headers: Record<string, string> = { accept: "application/json" };
    if (request.token) headers.authorization = `Bearer ${request.token}`;
    if (request.body !== undefined) headers["content-type"] = "application/json";

    const response = await fetch(`${API_ORIGIN}${request.path}`, {
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

async function startLocalApi(): Promise<void> {
  const runtimeEntry = join(app.getAppPath(), "runtime", "dist", "server.js");
  const runtime = await import(pathToFileURL(resolve(runtimeEntry)).href) as {
    buildServer: () => FastifyApplication;
  };
  localApi = runtime.buildServer();
  await localApi.listen({ host: API_HOST, port: API_PORT });
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: "#F3F5F7",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
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

  const rendererUrl = process.env.AL_NASR_RENDERER_URL;
  if (rendererUrl && app.isPackaged === false) {
    await mainWindow.loadURL(rendererUrl);
  } else {
    await mainWindow.loadFile(join(app.getAppPath(), "dist", "index.html"));
  }
}

async function shutdown(): Promise<void> {
  if (shutdownStarted) return;
  shutdownStarted = true;
  try {
    await localApi?.close();
  } catch (error) {
    dialog.showErrorBox("AL-NASR shutdown error", error instanceof Error ? error.message : String(error));
  } finally {
    localApi = null;
    app.exit(0);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    registerApiBridge();
    try {
      await startLocalApi();
      await createMainWindow();
    } catch (error) {
      dialog.showErrorBox(
        "Unable to start AL-NASR ERP",
        error instanceof Error ? error.message : String(error)
      );
      await shutdown();
    }
  });

  app.on("before-quit", (event) => {
    if (!shutdownStarted && localApi) {
      event.preventDefault();
      void shutdown();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}