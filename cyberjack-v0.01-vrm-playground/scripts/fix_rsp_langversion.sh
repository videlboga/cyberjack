#!/usr/bin/env bash
# Fix Unity-generated .rsp files that force C# 9.0 by replacing -langversion:9.0 with -langversion:10.0
# Usage:
#  scripts/fix_rsp_langversion.sh --once            # patch existing files immediately
#  scripts/fix_rsp_langversion.sh --watch [secs]    # watch Library/Bee/artifacts for new .rsp and patch them (default 120s)

set -euo pipefail

ROOT_DIR="$(pwd)"
ARTIFACTS_DIR="$ROOT_DIR/Library/Bee/artifacts"
TIMEOUT=${2:-120}

patch_file() {
  local f="$1"
  if [ ! -f "$f" ]; then
    return
  fi
  # Only change if file contains langversion:9.0
  if grep -q "langversion" "$f"; then
    echo "Patching $f"
    # Replace -langversion:9.0 with -langversion:10.0
    sed -i.bak 's/-langversion:9.0/-langversion:10.0/g' "$f"
    # ensure -langversion:10.0 exists if it wasn't present
    if ! grep -q "-langversion:10.0" "$f"; then
      echo "-langversion:10.0" >> "$f"
    fi
  fi
}

patch_all() {
  if [ -d "$ARTIFACTS_DIR" ]; then
    find "$ARTIFACTS_DIR" -type f -name "*.rsp" -print0 | while IFS= read -r -d '' file; do
      patch_file "$file"
    done
  fi
}

watch_loop() {
  local deadline=$(( $(date +%s) + TIMEOUT ))
  # Use inotifywait if available for prompt patching
  if command -v inotifywait >/dev/null 2>&1; then
    echo "Watching $ARTIFACTS_DIR for .rsp changes with inotifywait for $TIMEOUT seconds"
    while [ $(date +%s) -lt $deadline ]; do
      if [ -d "$ARTIFACTS_DIR" ]; then
        inotifywait -e close_write -t 1 -r "$ARTIFACTS_DIR" 2>/dev/null || true
        patch_all
      else
        sleep 1
      fi
    done
  else
    echo "inotifywait not found; polling $ARTIFACTS_DIR every 1s for $TIMEOUT seconds"
    while [ $(date +%s) -lt $deadline ]; do
      patch_all
      sleep 1
    done
  fi
}

if [ "${1:-}" = "--once" ]; then
  patch_all
  exit 0
fi

if [ "${1:-}" = "--watch" ]; then
  TIMEOUT=${2:-120}
  watch_loop
  exit 0
fi

echo "Usage: $0 --once | --watch [seconds]"
exit 2
