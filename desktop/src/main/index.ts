import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { openDatabase, type AlnasrDatabase } from "./database";
import { authenticate, createInitialOwner, isOwnerSetupRequired } from "./auth";

let mainWindow: BrowserWindow | null = null;
let database: AlnasrDatabase | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  app.setName("AL-NASR");
  database = openDatabase();

  ipcMain.handle("alnasr:health", () => ({
    app: "AL-NASR",
    status: "ok",
    database: database?.open ? "connected" : "disconnected"
  }));

  ipcMain.handle("alnasr:setup-status", () => {
    if (!database?.open) throw new Error("قاعدة البيانات غير متاحة");
    return { ownerSetupRequired: isOwnerSetupRequired(database) };
  });

  ipcMain.handle("alnasr:bootstrap-owner", (_event, input: unknown) => {
    if (!database?.open) throw new Error("قاعدة البيانات غير متاحة");
    if (!input || typeof input !== "object") throw new Error("بيانات إنشاء المالك غير صحيحة");
    const value = input as Record<string, unknown>;
    if (typeof value.username !== "string" || typeof value.displayName !== "string" || typeof value.password !== "string") throw new Error("أكمل جميع بيانات المالك");
    return createInitialOwner(database, { username: value.username, displayName: value.displayName, password: value.password });
  });

  ipcMain.handle("alnasr:login", (_event, input: unknown) => {
    if (!database?.open) throw new Error("قاعدة البيانات غير متاحة");
    if (!input || typeof input !== "object") throw new Error("بيانات الدخول غير صحيحة");
    const value = input as Record<string, unknown>;
    if (typeof value.username !== "string" || typeof value.password !== "string") throw new Error("أدخل اسم المستخدم وكلمة المرور");
    const user = authenticate(database, value.username, value.password);
    if (!user) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    return user;
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  database?.close();
  database = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
