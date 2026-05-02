#!/usr/bin/env bash
# Watch Library/Bee/artifacts for newly created/modified .rsp files and
# ensure they include /unsafe+ and -langversion:10.0. Use inotifywait if
# available for near-instant patching, otherwise fall back to polling.

set -euo pipefail

ROOT_PROJECT="/home/cyberkitty/My project (5)"
ARTIFACTS="$ROOT_PROJECT/Library/Bee/artifacts"

patch_file() {
  local f="$1"
  # only operate on files that look like the offending assemblies
  # Only operate on voltrpc top-level .rsp files (avoid .mvfrm.rsp)
  case "$f" in
    *voltrpc*.mvfrm.rsp) return 0 ;; # skip generated mvfrm response files
    *voltrpc*.rsp) ;;
    *) return 0 ;;
  esac

  # replace old langversion if present
  if grep -q "-langversion:9.0" "$f" 2>/dev/null; then
    sed -i.bak 's/-langversion:9.0/-langversion:10.0/g' "$f" || true
    echo "patched langversion in: $f"
  fi

  # add /unsafe+ if missing
  if ! grep -q '/unsafe' "$f" 2>/dev/null; then
    # ensure /unsafe+ is on its own line
    printf '\n/unsafe+\n' >> "$f"
    echo "[patcher] /unsafe+ -> $(basename "$f")"
  fi
}

echo "waiting for artifacts directory: $ARTIFACTS"
while [ ! -d "$ARTIFACTS" ]; do
  sleep 0.5
done
echo "artifacts directory appeared: $ARTIFACTS"

if command -v inotifywait >/dev/null 2>&1; then
  echo "inotifywait found — using event-based watcher"
  # watch for create/close_write events to catch when Unity writes the file
  inotifywait -m -r -e close_write,create --format '%w%f' "$ARTIFACTS" | while read -r file; do
    # quick guard: only patch .rsp files
    case "$file" in
      *.rsp)
        patch_file "$file" || true
        ;;
      *) ;;
    esac
  done
else
  echo "inotifywait not found — falling back to polling every 250ms"
  while true; do
    # find candidate rsp files and patch them
    while IFS= read -r -d $'\0' file; do
      patch_file "$file" || true
    done < <(find "$ARTIFACTS" -type f -name '*voltrpc*.rsp' -print0 2>/dev/null)
    sleep 0.25
  done
fi
