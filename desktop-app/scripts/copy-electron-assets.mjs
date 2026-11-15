import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, "dist-electron");
await mkdir(destination, { recursive: true });
await copyFile(
  resolve(root, "src/electron/preload.cjs"),
  resolve(destination, "preload.cjs")
);
console.log("Copied sandboxed Electron preload.");