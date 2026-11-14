import { contextBridge, ipcRenderer } from "electron";

export type PublicUser = { id: string; username: string; displayName: string };
export type OwnerSetupInput = { username: string; displayName: string; password: string };
export type ProductInput = { sku: string; nameAr: string; nameEn?: string; barcode?: string; costMinor: number; priceMinor: number; openingQuantity?: number };
export type ProductRow = { id: string; sku: string; nameAr: string; nameEn: string | null; barcode: string | null; costMinor: number; priceMinor: number; isActive: number; stockOnHand: number };

contextBridge.exposeInMainWorld("alnasr", {
  health: () => ipcRenderer.invoke("alnasr:health"),
  setupStatus: () => ipcRenderer.invoke("alnasr:setup-status") as Promise<{ ownerSetupRequired: boolean }>,
  bootstrapOwner: (input: OwnerSetupInput) => ipcRenderer.invoke("alnasr:bootstrap-owner", input) as Promise<PublicUser>,
  login: (input: { username: string; password: string }) => ipcRenderer.invoke("alnasr:login", input) as Promise<PublicUser>,
  logout: () => ipcRenderer.invoke("alnasr:logout") as Promise<{ success: boolean }>,
  listProducts: () => ipcRenderer.invoke("alnasr:products:list") as Promise<ProductRow[]>,
  createProduct: (input: ProductInput) => ipcRenderer.invoke("alnasr:products:create", input) as Promise<ProductRow>
});

export type AlnasrBridge = {
  health: () => Promise<{ app: string; status: string; database: string }>,
  setupStatus: () => Promise<{ ownerSetupRequired: boolean }>,
  bootstrapOwner: (input: OwnerSetupInput) => Promise<PublicUser>,
  login: (input: { username: string; password: string }) => Promise<PublicUser>,
  logout: () => Promise<{ success: boolean }>,
  listProducts: () => Promise<ProductRow[]>,
  createProduct: (input: ProductInput) => Promise<ProductRow>
};
