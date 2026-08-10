#!/usr/bin/env bash
set -euo pipefail

USER="${MIDNIGHT_PROOF_SERVER_USER:-prove}"
PASS="${MIDNIGHT_PROOF_SERVER_PASSWORD:-}"

if [[ -z "$PASS" ]]; then
  echo "[entrypoint] MIDNIGHT_PROOF_SERVER_PASSWORD is required" >&2
  exit 1
fi

HASH="$(openssl passwd -apr1 "$PASS")"
printf '%s:%s\n' "$USER" "$HASH" > /etc/nginx/htpasswd
cp /etc/nginx/nginx.conf.image /etc/nginx/nginx.conf

midnight-proof-server -v &
PROOF_PID=$!

cleanup() {
  kill "$PROOF_PID" 2>/dev/null || true
  nginx -s quit 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:6300/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf "http://127.0.0.1:6300/health" >/dev/null 2>&1; then
  echo "[entrypoint] proof server failed to become healthy on :6300" >&2
  exit 1
fi

echo "[entrypoint] proof server healthy — nginx auth proxy on :8080"
nginx -g 'daemon off;'
