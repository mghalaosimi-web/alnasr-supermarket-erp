const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alnasr", {
  request: (request) => ipcRenderer.invoke("alnasr:api-request", request)
});