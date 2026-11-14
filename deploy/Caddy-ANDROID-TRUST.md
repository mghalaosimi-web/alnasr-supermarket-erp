# Local HTTPS certificate pairing

AL-NASR uses Caddy's local certificate authority for the private LAN hostname alnasr.local. The gateway terminates TLS; the Frappe frontend remains inside the Docker network and the separate local development port remains bound to loopback.

## Pairing sequence

1. Start the AL-NASR stack and Caddy gateway.
2. Export the Caddy root CA using the Windows lifecycle script with Action export-cert.
3. Transfer %LOCALAPPDATA%\\AL-NASR ERP\\alnasr-local-root.crt to the Android phone through a trusted local method (USB cable or the owner's trusted file transfer).
4. On Android, install it as a CA certificate under Settings → Security → Encryption & credentials → Install a certificate → CA certificate. Android may require a screen lock.
5. In AL-NASR Android, connect to https://alnasr.local.

The Android app's network security configuration trusts user-installed CAs only for alnasr.local; it does not enable cleartext HTTP and does not disable certificate validation.

## LAN binding

The HTTPS port is bound to loopback by default. To permit the phone to reach the computer, set LAN_BIND_ADDRESS=0.0.0.0 in the private local configuration and restart the stack. Before doing so, ensure Windows Firewall allows TCP 443 only on the trusted Private network profile. Do not expose this port through router port-forwarding or a public network.

The phone and PC must be on the same trusted Wi-Fi/LAN and the network must support mDNS resolution for alnasr.local. If the router or access point blocks client-to-client traffic or mDNS, pairing will not work until that local network restriction is corrected.

## Security boundary

Caddy's internal root CA is private to this installation and persisted in the Docker caddy-data volume. Do not share it outside the owner's devices. Do not delete Docker volumes during upgrades. A CA rotation requires re-pairing the Android device.