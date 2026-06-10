#!/usr/bin/env bash
# Midnight MCP launcher for Cursor (WSL).
# Uses the project-local midnight-mcp install — avoids npx cache corruption
# (Cursor logs showed truncated web-streams-polyfill in ~/.npm/_npx).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_BIN="$PROJECT_ROOT/node_modules/midnight-mcp/dist/bin.js"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(command -v node)" == /mnt/c/* ]]; then
  echo "midnight-mcp: need Node 20+ in WSL (nvm install 20)." >&2
  exit 1
fi

if [ ! -f "$MCP_BIN" ]; then
  echo "midnight-mcp: run npm install in $PROJECT_ROOT first." >&2
  exit 1
fi

exec node "$MCP_BIN" "$@"
