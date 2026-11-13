#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! git submodule status >/dev/null 2>&1; then
  echo "This checkout does not have the AL-NASR upstream submodule configuration." >&2
  exit 1
fi

git submodule update --init --recursive

verify_submodule() {
  local path="$1"
  local expected="$2"
  local actual

  if [[ ! -d "$path/.git" && ! -f "$path/.git" ]]; then
    echo "Submodule was not initialized: $path" >&2
    exit 1
  fi

  actual="$(git -C "$path" rev-parse HEAD)"
  if [[ "$actual" != "$expected" ]]; then
    echo "Pinned revision mismatch for $path" >&2
    echo "Expected: $expected" >&2
    echo "Actual:   $actual" >&2
    exit 1
  fi

  printf 'Verified %-14s %s\n' "$path" "$actual"
}

verify_submodule "apps/frappe" "49789a1711d4dde2be9c6888efe35651465f4b64"
verify_submodule "apps/erpnext" "8e10a348daaa93853de8c36dc55ec789a440c219"
verify_submodule "apps/xpos" "3668fca6ffcab737347d4d223ac93f5d74aa90b3"

echo "All AL-NASR upstream submodules are initialized at their locked commits."
