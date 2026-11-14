import { contextBridge, ipcRenderer } from "electron";

export type PublicUser = { id: string; username: string; displayName: string };
export type OwnerSetupInput = { username: string; displayName: string; password: string };
export type ProductInput = { sku: string; nameAr: string; nameEn?: string; barcode?: string; costMinor: number; priceMinor: number; openingQuantity?: number };
export type ProductRow = { id: string; sku: string; nameAr: string; nameEn: string | null; barcode: string | null; costMinor: number; priceMinor: number; isActive: number; stockOnHand: number };
export type CashierShift = { id: string; openingCashMinor: number; openedAt?: string; status?: "open" };
export type SaleInput = { lines: Array<{ productId: string; quantity: number }>; paymentMethod: "cash" | "card" | "transfer"; idempotencyKey: string; customerId?: string };
export type SaleResult = { id: string; saleNumber: string; totalMinor: number; status: "posted"; lines: Array<{ productId: string; sku: string; nameAr: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }> };
export type StockMovementRow = { id: string; sku: string; productName: string; warehouseName: string; movementType: string; quantityDelta: number; unitCostMinor: number; occurredAt: string };
export type SupplierRow = { id: string; code: string; name: string; phone: string | null; isActive: number };
export type CustomerRow = { id: string; code: string; name: string; phone: string | null; creditLimitMinor: number; isActive: number };
export type PurchaseInput = { supplierId: string; documentNumber?: string; lines: Array<{ productId: string; quantity: number; unitCostMinor: number }>; paidMinor?: number; paymentMethod?: "cash" | "card" | "transfer" };
export type PurchaseRow = { id: string; documentNumber: string; supplierId: string; supplierName: string; subtotalMinor: number; paidMinor: number; outstandingMinor: number; occurredAt: string; lineCount: number };
export type PurchasePaymentInput = { purchaseId: string; amountMinor: number; method: "cash" | "card" | "transfer" };

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
  createSale: (input: SaleInput) => ipcRenderer.invoke("alnasr:sales:create", input) as Promise<SaleResult>,
  listCustomers: () => ipcRenderer.invoke("alnasr:customers:list") as Promise<CustomerRow[]>,
  createCustomer: (input: { code: string; name: string; phone?: string; creditLimitMinor?: number }) => ipcRenderer.invoke("alnasr:customers:create", input) as Promise<CustomerRow>,
  listSuppliers: () => ipcRenderer.invoke("alnasr:suppliers:list") as Promise<SupplierRow[]>,
  createSupplier: (input: { code: string; name: string; phone?: string }) => ipcRenderer.invoke("alnasr:suppliers:create", input) as Promise<SupplierRow>,
  listPurchases: () => ipcRenderer.invoke("alnasr:purchases:list") as Promise<PurchaseRow[]>,
  createPurchase: (input: PurchaseInput) => ipcRenderer.invoke("alnasr:purchases:create", input) as Promise<PurchaseRow>,
  addPurchasePayment: (input: PurchasePaymentInput) => ipcRenderer.invoke("alnasr:purchases:add-payment", input) as Promise<PurchaseRow>,
  createBackup: () => ipcRenderer.invoke("alnasr:backup:create") as Promise<{ canceled: boolean; filePath?: string }>,
  listStockMovements: () => ipcRenderer.invoke("alnasr:inventory:movements") as Promise<StockMovementRow[]>,
  receiveStock: (input: { productId: string; quantity: number; unitCostMinor: number }) => ipcRenderer.invoke("alnasr:inventory:receive", input) as Promise<{ movementId: string; quantityOnHand: number }>,
  adjustStock: (input: { productId: string; countedQuantity: number }) => ipcRenderer.invoke("alnasr:inventory:adjust", input) as Promise<{ movementId: string | null; previousQuantity: number; countedQuantity: number; difference: number }>
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
  createSale: (input: SaleInput) => Promise<SaleResult>,
  listCustomers: () => Promise<CustomerRow[]>,
  createCustomer: (input: { code: string; name: string; phone?: string; creditLimitMinor?: number }) => Promise<CustomerRow>,
  listSuppliers: () => Promise<SupplierRow[]>,
  createSupplier: (input: { code: string; name: string; phone?: string }) => Promise<SupplierRow>,
  listPurchases: () => Promise<PurchaseRow[]>,
  createPurchase: (input: PurchaseInput) => Promise<PurchaseRow>,
  addPurchasePayment: (input: PurchasePaymentInput) => Promise<PurchaseRow>,
  createBackup: () => Promise<{ canceled: boolean; filePath?: string }>,
  listStockMovements: () => Promise<StockMovementRow[]>,
  receiveStock: (input: { productId: string; quantity: number; unitCostMinor: number }) => Promise<{ movementId: string; quantityOnHand: number }>,
  adjustStock: (input: { productId: string; countedQuantity: number }) => Promise<{ movementId: string | null; previousQuantity: number; countedQuantity: number; difference: number }>
};
