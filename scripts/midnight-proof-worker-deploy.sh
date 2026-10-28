#!/usr/bin/env bash
# Deploy the Midnight proof worker. Secrets come from .env.local and are not printed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${FLY_APP:-provven-midnight-worker}"
ENV_FILE="$ROOT/.env.local"

if [[ -x "${HOME}/.fly/bin/flyctl" ]]; then
  FLY="${HOME}/.fly/bin/flyctl"
elif command -v flyctl >/dev/null 2>&1; then
  FLY="$(command -v flyctl)"
elif command -v fly >/dev/null 2>&1; then
  FLY="$(command -v fly)"
else
  echo "[MIDNIGHT] flyctl not found. Install: https://fly.io/docs/flyctl/install/" >&2
  exit 1
fi

if ! "$FLY" auth whoami >/dev/null 2>&1; then
  echo "[MIDNIGHT] Not logged into Fly. Run: fly auth login" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[MIDNIGHT] Missing .env.local" >&2
  exit 1
fi

cd "$ROOT"

if ! "$FLY" status -a "$APP" >/dev/null 2>&1; then
  echo "[MIDNIGHT] Creating Fly app '$APP'…"
  "$FLY" apps create "$APP" --org personal || true
fi

if ! "$FLY" volumes list -a "$APP" 2>/dev/null | grep -q midnight_wallet; then
  echo "[MIDNIGHT] Creating wallet volume…"
  "$FLY" volumes create midnight_wallet --size 1 --region iad -a "$APP" -y
fi

# Names only. Values are copied into a temp file for `secrets import`.
KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  MIDNIGHT_WALLET_MNEMONIC
  MIDNIGHT_PRIVATE_STATE_PASSWORD
  MIDNIGHT_NETWORK
  MIDNIGHT_NODE_RPC_URL
  MIDNIGHT_INDEXER_URL
  MIDNIGHT_INDEXER_WS_URL
  MIDNIGHT_PROOF_SERVER_URL
  MIDNIGHT_PROOF_SERVER_USER
  MIDNIGHT_PROOF_SERVER_PASSWORD
  MIDNIGHT_CONTRACT_ADDRESS
  MIDNIGHT_CONTRACT_ADDRESS_CDL_CLASS
  MIDNIGHT_CONTRACT_ADDRESS_CDL_ENDORSEMENTS
  MIDNIGHT_CONTRACT_ADDRESS_CDL_RESTRICTIONS
  MIDNIGHT_CONTRACT_ADDRESS_MED_CERT
  MIDNIGHT_CONTRACT_ADDRESS_CDL_CLASS_A
  MIDNIGHT_CONTRACT_ADDRESS_PREVIOUS_EMPLOYER
)

TMP="$(mktemp)"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

for key in "${KEYS[@]}"; do
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo "[MIDNIGHT] .env.local is missing ${key}" >&2
    exit 1
  fi
  # Strip optional surrounding quotes. Do not echo the value.
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  escaped="${value//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  printf '%s="%s"\n' "$key" "$escaped" >> "$TMP"
done

echo "[MIDNIGHT] Setting secrets on '$APP' (values stay on Fly)…"
"$FLY" secrets import -a "$APP" < "$TMP"

echo "[MIDNIGHT] Deploying worker…"
"$FLY" deploy . -a "$APP" --config midnight/worker/fly.toml --remote-only --ha=false

echo "[MIDNIGHT] Worker deployed. Logs: fly logs -a $APP"
