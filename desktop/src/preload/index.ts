import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("alnasr", {
  health: () => ipcRenderer.invoke("alnasr:health")
});

export type AlnasrBridge = {
  health: () => Promise<{ app: string; status: string; database: string }>;
};
