#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/viewer"
exec python3 serve.py "$@"
