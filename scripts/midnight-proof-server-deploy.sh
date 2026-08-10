#!/usr/bin/env bash
# Deploy the hosted Midnight proof server to Fly.io.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/midnight/proof-server"
APP="${FLY_APP:-provven-midnight-proof}"

if ! command -v flyctl >/dev/null 2>&1 && ! command -v fly >/dev/null 2>&1; then
  echo "[MIDNIGHT] flyctl not found. Install: https://fly.io/docs/flyctl/install/" >&2
  echo "  curl -L https://fly.io/install.sh | sh" >&2
  exit 1
fi

FLY="$(command -v flyctl || command -v fly)"

if ! "$FLY" auth whoami >/dev/null 2>&1; then
  echo "[MIDNIGHT] Not logged into Fly. Run: fly auth login" >&2
  exit 1
fi

cd "$DIR"

if ! "$FLY" status -a "$APP" >/dev/null 2>&1; then
  echo "[MIDNIGHT] Creating Fly app '$APP' (first time)…"
  "$FLY" apps create "$APP" --org personal || true
fi

# Secrets — generate password once if missing
if ! "$FLY" secrets list -a "$APP" 2>/dev/null | grep -q MIDNIGHT_PROOF_SERVER_PASSWORD; then
  PASS="$(openssl rand -base64 32 | tr -d '\n=/+' | head -c 32)"
  echo "[MIDNIGHT] Setting Basic-auth secrets (save the password — shown once)…"
  echo "  user: prove"
  echo "  pass: $PASS"
  "$FLY" secrets set \
    -a "$APP" \
    MIDNIGHT_PROOF_SERVER_USER=prove \
    MIDNIGHT_PROOF_SERVER_PASSWORD="$PASS"
  echo
  echo "[MIDNIGHT] Add to Vercel / .env.local (prefer split secrets — undici rejects user:pass@host):"
  echo "  MIDNIGHT_PROOF_SERVER_URL=https://${APP}.fly.dev"
  echo "  MIDNIGHT_PROOF_SERVER_USER=prove"
  echo "  MIDNIGHT_PROOF_SERVER_PASSWORD=${PASS}"
  echo
else
  echo "[MIDNIGHT] Auth secrets already set on app '$APP'"
fi

echo "[MIDNIGHT] Deploying…"
# --ha=false: one machine. fly.toml targets performance-2x / 8GB (billing unlock).
# If Fly rejects performance VMs, edit fly.toml back to shared-cpu-2x / 8192.
"$FLY" deploy -a "$APP" --remote-only --ha=false

echo
echo "[MIDNIGHT] Health (public):"
curl -sS "https://${APP}.fly.dev/health" || true
echo
echo "[MIDNIGHT] Done. Set MIDNIGHT_PROOF_SERVER_URL=https://${APP}.fly.dev"
echo "          + MIDNIGHT_PROOF_SERVER_USER/PASSWORD (Fly secrets already hold the server-side pair)."
echo "          Keep ATTESTATION_BACKEND unset (JWT) until a hosted prove smoke passes."
