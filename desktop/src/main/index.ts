import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join, resolve } from "node:path";
import { openDatabase, type AlnasrDatabase } from "./database";
import { authenticate, createInitialOwner, isOwnerSetupRequired } from "./auth";
import { createProduct, listProducts } from "./products";
import { closeCashierShift, createSale, getOpenCashierShift, openCashierShift } from "./sales";
import { adjustStockCount, listStockMovements, receiveStock } from "./inventory";
import { createSupplier, listSuppliers } from "./suppliers";
import { createCustomer, listCustomers } from "./customers";

let mainWindow: BrowserWindow | null = null;
let database: AlnasrDatabase | null = null;
let activeUserId: string | null = null;

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
    const owner = createInitialOwner(database, { username: value.username, displayName: value.displayName, password: value.password });
    activeUserId = owner.id;
    return owner;
  });

  ipcMain.handle("alnasr:login", (_event, input: unknown) => {
    if (!database?.open) throw new Error("قاعدة البيانات غير متاحة");
    if (!input || typeof input !== "object") throw new Error("بيانات الدخول غير صحيحة");
    const value = input as Record<string, unknown>;
    if (typeof value.username !== "string" || typeof value.password !== "string") throw new Error("أدخل اسم المستخدم وكلمة المرور");
    const user = authenticate(database, value.username, value.password);
    if (!user) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    activeUserId = user.id;
    return user;
  });


  ipcMain.handle("alnasr:logout", () => {
    activeUserId = null;
    return { success: true };
  });

  ipcMain.handle("alnasr:products:list", () => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    return listProducts(database);
  });

  ipcMain.handle("alnasr:products:create", (_event, input: unknown) => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    if (!input || typeof input !== "object") throw new Error("بيانات المنتج غير صحيحة");
    const value = input as Record<string, unknown>;
    if (
      typeof value.sku !== "string" ||
      typeof value.nameAr !== "string" ||
      (value.nameEn !== undefined && typeof value.nameEn !== "string") ||
      (value.barcode !== undefined && typeof value.barcode !== "string") ||
      typeof value.costMinor !== "number" ||
      typeof value.priceMinor !== "number" ||
      (value.openingQuantity !== undefined && typeof value.openingQuantity !== "number")
    ) throw new Error("أكمل بيانات المنتج بصورة صحيحة");
    return createProduct(database, {
      sku: value.sku,
      nameAr: value.nameAr,
      nameEn: value.nameEn as string | undefined,
      barcode: value.barcode as string | undefined,
      costMinor: value.costMinor,
      priceMinor: value.priceMinor,
      openingQuantity: value.openingQuantity as number | undefined,
      actorUserId: activeUserId
    });
  });






  ipcMain.handle("alnasr:customers:list", () => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    return listCustomers(database);
  });

  ipcMain.handle("alnasr:customers:create", (_event, input: unknown) => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    if (!input || typeof input !== "object") throw new Error("بيانات العميل غير صحيحة");
    const value = input as Record<string, unknown>;
    if (
      typeof value.code !== "string" ||
      typeof value.name !== "string" ||
      (value.phone !== undefined && typeof value.phone !== "string") ||
      (value.creditLimitMinor !== undefined && typeof value.creditLimitMinor !== "number")
    ) throw new Error("أكمل بيانات العميل بصورة صحيحة");
    return createCustomer(database, {
      code: value.code,
      name: value.name,
      phone: value.phone as string | undefined,
      creditLimitMinor: value.creditLimitMinor as number | undefined,
      actorUserId: activeUserId
    });
  });

  ipcMain.handle("alnasr:suppliers:list", () => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    return listSuppliers(database);
  });

  ipcMain.handle("alnasr:suppliers:create", (_event, input: unknown) => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    if (!input || typeof input !== "object") throw new Error("بيانات المورد غير صحيحة");
    const value = input as Record<string, unknown>;
    if (typeof value.code !== "string" || typeof value.name !== "string" || (value.phone !== undefined && typeof value.phone !== "string")) {
      throw new Error("أكمل بيانات المورد");
    }
    return createSupplier(database, {
      code: value.code,
      name: value.name,
      phone: value.phone as string | undefined,
      actorUserId: activeUserId
    });
  });

  ipcMain.handle("alnasr:backup:create", async () => {
    if (!database?.open || !activeUserId || !mainWindow) throw new Error("سجّل الدخول أولاً");
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "حفظ نسخة احتياطية من قاعدة بيانات النصر",
      defaultPath: "AL-NASR-Backup-" + stamp + ".sqlite",
      buttonLabel: "حفظ النسخة",
      filters: [{ name: "SQLite Database", extensions: ["sqlite", "db"] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    if (resolve(result.filePath) === resolve(database.name)) throw new Error("اختر مساراً مختلفاً عن ملف قاعدة البيانات الأصلي");
    await database.backup(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle("alnasr:inventory:movements", () => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    return listStockMovements(database);
  });

  ipcMain.handle("alnasr:inventory:receive", (_event, input: unknown) => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    if (!input || typeof input !== "object") throw new Error("بيانات الاستلام غير صحيحة");
    const value = input as Record<string, unknown>;
    if (typeof value.productId !== "string" || typeof value.quantity !== "number" || typeof value.unitCostMinor !== "number") {
      throw new Error("أكمل بيانات استلام المخزون");
    }
    return receiveStock(database, {
      productId: value.productId,
      quantity: value.quantity,
      unitCostMinor: value.unitCostMinor,
      actorUserId: activeUserId
    });
  });

  ipcMain.handle("alnasr:inventory:adjust", (_event, input: unknown) => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    if (!input || typeof input !== "object") throw new Error("بيانات الجرد غير صحيحة");
    const value = input as Record<string, unknown>;
    if (typeof value.productId !== "string" || typeof value.countedQuantity !== "number") {
      throw new Error("أكمل بيانات الجرد");
    }
    return adjustStockCount(database, {
      productId: value.productId,
      countedQuantity: value.countedQuantity,
      actorUserId: activeUserId
    });
  });

  ipcMain.handle("alnasr:shift:current", () => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    return getOpenCashierShift(database, activeUserId);
  });

  ipcMain.handle("alnasr:shift:open", (_event, input: unknown) => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    if (!input || typeof input !== "object" || typeof (input as Record<string, unknown>).openingCashMinor !== "number") {
      throw new Error("أدخل رصيد افتتاح الصندوق");
    }
    return openCashierShift(database, {
      openingCashMinor: (input as Record<string, number>).openingCashMinor,
      cashierUserId: activeUserId
    });
  });

  ipcMain.handle("alnasr:shift:close", (_event, input: unknown) => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    if (!input || typeof input !== "object") throw new Error("بيانات إغلاق الوردية غير صحيحة");
    const value = input as Record<string, unknown>;
    if (typeof value.shiftId !== "string" || typeof value.closingCashMinor !== "number") {
      throw new Error("أدخل بيانات إغلاق الوردية");
    }
    return closeCashierShift(database, {
      shiftId: value.shiftId,
      closingCashMinor: value.closingCashMinor,
      actorUserId: activeUserId
    });
  });

  ipcMain.handle("alnasr:sales:create", (_event, input: unknown) => {
    if (!database?.open || !activeUserId) throw new Error("سجّل الدخول أولاً");
    if (!input || typeof input !== "object") throw new Error("بيانات الفاتورة غير صحيحة");
    const value = input as Record<string, unknown>;
    if (
      !Array.isArray(value.lines) ||
      (value.paymentMethod !== "cash" && value.paymentMethod !== "card" && value.paymentMethod !== "transfer") ||
      typeof value.idempotencyKey !== "string" ||
      (value.customerId !== undefined && typeof value.customerId !== "string")
    ) throw new Error("أكمل بيانات الفاتورة بصورة صحيحة");
    const lines = value.lines.map((line: unknown) => {
      if (!line || typeof line !== "object") throw new Error("بيانات أحد المنتجات غير صحيحة");
      const item = line as Record<string, unknown>;
      if (typeof item.productId !== "string" || typeof item.quantity !== "number") throw new Error("بيانات أحد المنتجات غير صحيحة");
      return { productId: item.productId, quantity: item.quantity };
    });
    return createSale(database, {
      lines,
      paymentMethod: value.paymentMethod,
      idempotencyKey: value.idempotencyKey,
      customerId: value.customerId as string | undefined,
      actorUserId: activeUserId
    });
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
