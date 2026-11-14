import { contextBridge, ipcRenderer } from "electron";

export type PublicUser = { id: string; username: string; displayName: string };
export type OwnerSetupInput = { username: string; displayName: string; password: string };
export type ProductInput = { sku: string; nameAr: string; nameEn?: string; barcode?: string; costMinor: number; priceMinor: number; openingQuantity?: number };
export type ProductRow = { id: string; sku: string; nameAr: string; nameEn: string | null; barcode: string | null; costMinor: number; priceMinor: number; isActive: number; stockOnHand: number };
export type CashierShift = { id: string; openingCashMinor: number; openedAt?: string; status?: "open" };
export type SaleInput = { lines: Array<{ productId: string; quantity: number }>; paymentMethod: "cash" | "card" | "transfer"; idempotencyKey: string };
export type SaleResult = { id: string; saleNumber: string; totalMinor: number; status: "posted"; lines: Array<{ productId: string; sku: string; nameAr: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }> };

contextBridge.exposeInMainWorld("alnasr", {
  health: () => ipcRenderer.invoke("alnasr:health"),
  setupStatus: () => ipcRenderer.invoke("alnasr:setup-status") as Promise<{ ownerSetupRequired: boolean }>,
  bootstrapOwner: (input: OwnerSetupInput) => ipcRenderer.invoke("alnasr:bootstrap-owner", input) as Promise<PublicUser>,
  login: (input: { username: string; password: string }) => ipcRenderer.invoke("alnasr:login", input) as Promise<PublicUser>,
  logout: () => ipcRenderer.invoke("alnasr:logout") as Promise<{ success: boolean }>,
  listProducts: () => ipcRenderer.invoke("alnasr:products:list") as Promise<ProductRow[]>,
  createProduct: (input: ProductInput) => ipcRenderer.invoke("alnasr:products:create", input) as Promise<ProductRow>,
  currentShift: () => ipcRenderer.invoke("alnasr:shift:current") as Promise<CashierShift | null>,
  openShift: (openingCashMinor: number) => ipcRenderer.invoke("alnasr:shift:open", { openingCashMinor }) as Promise<CashierShift>,
  closeShift: (input: { shiftId: string; closingCashMinor: number }) => ipcRenderer.invoke("alnasr:shift:close", input) as Promise<{ id: string; closingCashMinor: number; status: "closed" }>,
  createSale: (input: SaleInput) => ipcRenderer.invoke("alnasr:sales:create", input) as Promise<SaleResult>
});

export type AlnasrBridge = {
  health: () => Promise<{ app: string; status: string; database: string }>,
  setupStatus: () => Promise<{ ownerSetupRequired: boolean }>,
  bootstrapOwner: (input: OwnerSetupInput) => Promise<PublicUser>,
  login: (input: { username: string; password: string }) => Promise<PublicUser>,
  logout: () => Promise<{ success: boolean }>,
  listProducts: () => Promise<ProductRow[]>,
  createProduct: (input: ProductInput) => Promise<ProductRow>,
  currentShift: () => Promise<CashierShift | null>,
  openShift: (openingCashMinor: number) => Promise<CashierShift>,
  closeShift: (input: { shiftId: string; closingCashMinor: number }) => Promise<{ id: string; closingCashMinor: number; status: "closed" }>,
  createSale: (input: SaleInput) => Promise<SaleResult>
};
