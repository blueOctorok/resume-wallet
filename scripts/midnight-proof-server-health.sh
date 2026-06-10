#!/usr/bin/env bash
# Smoke-check that the local Midnight proof server is reachable.
set -euo pipefail

PROOF_SERVER_URL="${MIDNIGHT_PROOF_SERVER_URL:-http://127.0.0.1:6300}"
HEALTH_URL="${PROOF_SERVER_URL%/}/health"

echo "[MIDNIGHT] Checking proof server at ${HEALTH_URL}"

if ! command -v curl >/dev/null 2>&1; then
  echo "[MIDNIGHT] curl is required" >&2
  exit 1
fi

HTTP_CODE="$(curl -sS -o /tmp/storm-midnight-health.json -w '%{http_code}' "${HEALTH_URL}" || true)"

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "[MIDNIGHT] Health check failed (HTTP ${HTTP_CODE})" >&2
  echo "[MIDNIGHT] Is Docker running? Try: npm run midnight:proof-server:up" >&2
  exit 1
fi

echo "[MIDNIGHT] Proof server healthy (HTTP 200)"
cat /tmp/storm-midnight-health.json
echo
