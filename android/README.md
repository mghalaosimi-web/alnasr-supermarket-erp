# AL-NASR Android client preview

This is a lightweight Android WebView client for the single local AL-NASR server. It is not a second ERP implementation and it does not store authoritative business records.

## Security behavior

- HTTPS is mandatory; cleartext traffic is disabled in the manifest and network security policy.
- The app accepts only the configured AL-NASR hostname, alnasr.local.
- Android system CAs are trusted generally; user-installed CAs are trusted only for alnasr.local.
- TLS certificate errors are rejected. The app never bypasses SSL validation.
- JavaScript and DOM storage are enabled because the Frappe/X POS web application requires them. File access, content access, mixed content, and third-party cookies are disabled.

## Pairing

1. Set up the Windows PC runtime and Caddy local HTTPS gateway.
2. Export the Caddy root CA from Windows using the lifecycle script's export-cert action.
3. Transfer the certificate to the phone using a trusted local method and install it as a CA certificate in Android settings.
4. Ensure the phone and PC share a trusted Wi-Fi network and that the LAN can resolve alnasr.local via mDNS.
5. Open the app and connect to https://alnasr.local.

## Build

From the repository root, run Gradle assembleDebug in the android directory. The GitHub Actions workflow builds a debug-signed preview APK and uploads it as an artifact.

## Not yet accepted

- No physical Android phone test has passed.
- No LAN/mDNS test has passed.
- No camera barcode, thermal printer, file upload/download, or Android back-navigation UAT has passed.
- Debug APK is for controlled testing only. A release APK requires a separately protected signing key, owner approval, and a successful device acceptance run.
- Do not interpret the APK build as proof that the Windows server or HTTPS pairing works.