import { contextBridge, ipcRenderer } from "electron";

export type PublicUser = { id: string; username: string; displayName: string };
export type OwnerSetupInput = { username: string; displayName: string; password: string };

contextBridge.exposeInMainWorld("alnasr", {
  health: () => ipcRenderer.invoke("alnasr:health"),
  setupStatus: () => ipcRenderer.invoke("alnasr:setup-status") as Promise<{ ownerSetupRequired: boolean }>,
  bootstrapOwner: (input: OwnerSetupInput) => ipcRenderer.invoke("alnasr:bootstrap-owner", input) as Promise<PublicUser>,
  login: (input: { username: string; password: string }) => ipcRenderer.invoke("alnasr:login", input) as Promise<PublicUser>
});

export type AlnasrBridge = {
  health: () => Promise<{ app: string; status: string; database: string }>,
  setupStatus: () => Promise<{ ownerSetupRequired: boolean }>,
  bootstrapOwner: (input: OwnerSetupInput) => Promise<PublicUser>,
  login: (input: { username: string; password: string }) => Promise<PublicUser>
};
