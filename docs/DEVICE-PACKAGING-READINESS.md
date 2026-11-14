# AL-NASR device packaging readiness

**Checked:** 2026-11-14  
**Pinned X POS source:** `kodlyft/xpos@3668fca6ffcab737347d4d223ac93f5d74aa90b3`  
**Decision:** Do not publish a Windows installer or Android APK from the current source baseline. The upstream client build exists, but neither target is yet a complete, AL-NASR-branded, self-contained device deliverable.

## Windows: Electron client is not the complete Windows system

The pinned X POS source contains an Electron desktop client:

- `frontend/package.json` defines `build:electron`, `dist`, and `dist:win`.
- `frontend/electron-builder.yml` defines an NSIS x64 installer target.
- `frontend/scripts/build-win.mjs` invokes `electron-builder --win --dir`; its own contract is an unpacked `win-unpacked` directory, not an NSIS installer.
- `frontend/electron/main.ts` opens the desktop window and defaults the Frappe endpoint to `http://localhost:8000`.
- `frontend/electron/database/dbService.ts` connects to a separate MariaDB service at `127.0.0.1:3306` (default local database `xpos_local`) and creates the client-side schema. The Electron package includes `schema.sql`, not a MariaDB server or a Frappe/ERPNext Bench.
- The upstream Electron shell still contains X POS-specific branding (including its window title and Windows AppUserModelID), and its `afterPack` hook writes upstream company/version metadata and uses the upstream icon.

Therefore, running the upstream Electron packaging command can produce a **POS client package**, but it does not install or start the Frappe/ERPNext server, provision MariaDB, configure the server URL, or deliver the complete single-PC AL-NASR stack. Re-labeling that client-only output as the complete AL-NASR Windows installer would be misleading. A separate, tested Windows server/launcher and service lifecycle are required before that claim is safe.

No upstream submodule files were modified to work around these gaps.

## Android: current target is a PWA, not an APK

The pinned X POS frontend configures `vite-plugin-pwa` in `frontend/vite.config.ts`, with its web-app scope and start URL set to `/xpos/`. This produces browser-installable PWA assets; it does not define a native Android project.

The pinned source has no Android Gradle project, Capacitor/TWA wrapper, Android application ID, or release-signing configuration. An APK cannot be claimed without adding and validating that native packaging layer. A release-signed APK also requires a signing key supplied and controlled outside the repository; no key or credential belongs in GitHub source.

The existing PWA is the lower-risk Android path once the AL-NASR site is served from a stable HTTPS origin and the phone can reach the Frappe backend. A LAN-only HTTP address is not sufficient for normal service-worker installation on Android unless a trusted HTTPS setup is provided.

## Safe CI decision

- Keep the existing Linux runtime job building the pinned X POS frontend and running the disposable Bench integration tests.
- Do not add a Windows NSIS artifact job until the server/MariaDB provisioning boundary, AL-NASR shell branding, and first-run server configuration are implemented and tested.
- Do not add an APK job until an Android wrapper, application identity, origin strategy, and signing process exist.
- Do not commit real credentials, signing keys, business records, database dumps, or production configuration.

## Exit evidence required

1. **Windows:** a clean Windows runner builds an AL-NASR-branded installer; the installer is installed on a clean Windows VM; required services are installed/started or an explicit external-server setup is completed; first-run configuration and login succeed against a disposable test site; uninstall/upgrade behavior is checked.
2. **Android:** the selected PWA or APK path is built from the same pinned source; Android installation succeeds on a real device; the phone reaches the Windows-hosted or approved HTTPS server; authentication, barcode/checkout flow, reconnect, and offline recovery are exercised.
3. **Release artifact:** the CI run is green, the expected installer/APK exists, its checksum and metadata are recorded, and the artifact download URL is verified. Until then, no EXE/APK delivery claim is valid.
