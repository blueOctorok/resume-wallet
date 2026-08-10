#!/usr/bin/env bash
# Smoke-check that the Midnight proof server is reachable.
# Supports plain URLs and Basic-auth URLs (https://user:pass@host).
set -euo pipefail

PROOF_SERVER_URL="${MIDNIGHT_PROOF_SERVER_URL:-http://127.0.0.1:6300}"
# Strip trailing slash; append /health (userinfo preserved for curl)
BASE="${PROOF_SERVER_URL%/}"
HEALTH_URL="${BASE}/health"

echo "[MIDNIGHT] Checking proof server at ${HEALTH_URL%%@*}@***" 2>/dev/null || true
# Avoid printing password: show host only
SAFE_HOST="$(python3 - <<'PY' 2>/dev/null || true
from urllib.parse import urlparse
import os
u = urlparse(os.environ.get("MIDNIGHT_PROOF_SERVER_URL", "http://127.0.0.1:6300"))
print(f"{u.scheme}://{u.hostname}:{u.port or (443 if u.scheme=='https' else 80)}/health")
PY
)"
if [[ -n "${SAFE_HOST}" ]]; then
  echo "[MIDNIGHT] Checking proof server at ${SAFE_HOST}"
else
  echo "[MIDNIGHT] Checking proof server health"
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[MIDNIGHT] curl is required" >&2
  exit 1
fi

# /health is intentionally unauthenticated on the hosted proxy.
# If URL embeds user:pass, curl still works; for hosted, prefer probing without creds on /health.
HEALTH_PROBE="$HEALTH_URL"
if [[ "$BASE" == https://* ]] && [[ "$BASE" == *"@"* ]]; then
  # Rewrite to host-only for public /health
  HEALTH_PROBE="$(python3 - <<'PY'
from urllib.parse import urlparse
import os
u = urlparse(os.environ["MIDNIGHT_PROOF_SERVER_URL"])
port = f":{u.port}" if u.port else ""
print(f"{u.scheme}://{u.hostname}{port}/health")
PY
)"
fi

HTTP_CODE="$(curl -sS -o /tmp/storm-midnight-health.json -w '%{http_code}' "${HEALTH_PROBE}" || true)"

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "[MIDNIGHT] Health check failed (HTTP ${HTTP_CODE})" >&2
  echo "[MIDNIGHT] Local: npm run midnight:proof-server:up" >&2
  echo "[MIDNIGHT] Hosted: npm run midnight:proof-server:deploy" >&2
  exit 1
fi

echo "[MIDNIGHT] Proof server healthy (HTTP 200)"
cat /tmp/storm-midnight-health.json
echo
