#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTEXT="$ROOT/deploy/wsl"
OUT="$ROOT/dist/wsl"
if [ "$#" -gt 0 ]; then OUT="$1"; fi
IMAGE="alnasr-wsl-rootfs:build"
CONTAINER="alnasr-wsl-rootfs-export"

mkdir -p "$OUT"
rm -f "$OUT/alnasr-wsl-rootfs.tar" "$OUT/SHA256SUMS.txt"

docker build --pull --file "$CONTEXT/Dockerfile" --tag "$IMAGE" "$CONTEXT"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker create --name "$CONTAINER" "$IMAGE" >/dev/null
trap 'docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT

docker export "$CONTAINER" --output "$OUT/alnasr-wsl-rootfs.tar"
test -s "$OUT/alnasr-wsl-rootfs.tar"

python - "$OUT/alnasr-wsl-rootfs.tar" <<'PY'
import sys
import tarfile

path = sys.argv[1]
with tarfile.open(path, "r:") as archive:
    names = set(archive.getnames())
    required = {
        "etc/wsl.conf",
        "etc/systemd/system/multi-user.target.wants/docker.service",
        "usr/bin/dockerd",
        "usr/bin/docker",
        "usr/bin/docker-compose",
        "sbin/init",
    }
    missing = sorted(required - names)
    if missing:
        raise SystemExit(f"WSL rootfs is missing required paths: {missing}")
print("WSL rootfs structure validated.")
PY

(
  cd "$OUT"
  sha256sum alnasr-wsl-rootfs.tar > SHA256SUMS.txt
)
echo "Built WSL rootfs: $OUT/alnasr-wsl-rootfs.tar"
