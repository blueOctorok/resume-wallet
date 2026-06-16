#!/usr/bin/env bash
# P3.2 preflight — run before `npm run midnight:proof-server:up`
set -euo pipefail

PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ ${label}"
    PASS=$((PASS + 1))
  else
    echo "  ✗ ${label}"
    FAIL=$((FAIL + 1))
  fi
}

echo "[P3.2] Midnight proof-server preflight"
echo

echo "Toolchain:"
if command -v compact >/dev/null 2>&1; then
  echo "  ✓ compact $(compact --version 2>/dev/null | head -1)"
  PASS=$((PASS + 1))
else
  echo "  ✗ compact not found (P3.1)"
  FAIL=$((FAIL + 1))
fi

if compact compile --version >/dev/null 2>&1; then
  echo "  ✓ compiler $(compact compile --version 2>/dev/null | head -1)"
  PASS=$((PASS + 1))
else
  echo "  ✗ compact compiler not set (run: compact update)"
  FAIL=$((FAIL + 1))
fi

check "curl" command -v curl
check "docker CLI" command -v docker
check "docker compose" docker compose version

if command -v docker >/dev/null 2>&1; then
  ACTIVE_CTX="$(docker context show 2>/dev/null || true)"
  if [[ "${ACTIVE_CTX}" == "desktop-linux" ]] && [[ -S /var/run/docker.sock ]]; then
    echo "  ✗ docker context is desktop-linux (npipe — broken in WSL bash)"
    FAIL=$((FAIL + 1))
    echo
    echo "  Fix:"
    echo "    docker context use default"
    echo "    docker info"
  elif docker info >/dev/null 2>&1; then
    echo "  ✓ docker daemon reachable (context: ${ACTIVE_CTX:-default})"
    PASS=$((PASS + 1))
  else
    echo "  ✗ docker daemon unreachable"
    FAIL=$((FAIL + 1))
    if ! groups | grep -q docker && [[ -S /var/run/docker.sock ]]; then
      echo
      echo "  Fix (one-time):"
      echo "    sudo usermod -aG docker \$USER"
      echo "    # then: newgrp docker  OR  open a new terminal"
      echo "    docker context use default"
      echo "    docker info"
    fi
  fi
fi

echo
echo "Proof server:"
# Read proof-server URL from .env.local without sourcing the file (mnemonic may contain shell metacharacters)
PROOF_URL="${MIDNIGHT_PROOF_SERVER_URL:-http://127.0.0.1:6300}"
if [[ -f ".env.local" ]]; then
  PS_LINE="$(grep '^MIDNIGHT_PROOF_SERVER_URL=' .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' \"' || true)"
  if [[ -n "${PS_LINE}" ]]; then
    PROOF_URL="${PS_LINE}"
  fi
fi
HEALTH_URL="${PROOF_URL%/}/health"
HEALTH_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${HEALTH_URL}" 2>/dev/null || echo "000")"

PORT_IN_USE=false
if command -v ss >/dev/null 2>&1; then
  ss -tln 2>/dev/null | grep -q ':6300 ' && PORT_IN_USE=true
elif command -v netstat >/dev/null 2>&1; then
  netstat -tln 2>/dev/null | grep -q ':6300 ' && PORT_IN_USE=true
fi

if [[ "${HEALTH_CODE}" == "200" ]]; then
  echo "  ✓ proof server healthy at ${PROOF_URL} (HTTP 200)"
  PASS=$((PASS + 1))
elif [[ "${PORT_IN_USE}" == "true" ]]; then
  echo "  ✗ port 6300 in use but health check failed (HTTP ${HEALTH_CODE})"
  echo "    Try: npm run midnight:proof-server:logs"
  FAIL=$((FAIL + 1))
else
  echo "  ✓ port 6300 free — run: npm run midnight:proof-server:up"
  PASS=$((PASS + 1))
fi

echo
echo "Env (.env.local — required to close P3.2):"
ENV_FILE=".env.local"
if [[ -f "${ENV_FILE}" ]]; then
  for var in MIDNIGHT_NETWORK MIDNIGHT_PROOF_SERVER_URL MIDNIGHT_NODE_RPC_URL MIDNIGHT_INDEXER_URL; do
    if grep -q "^${var}=" "${ENV_FILE}" 2>/dev/null; then
      VAL="$(grep "^${var}=" "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d ' \"')"
      if [[ -n "${VAL}" ]]; then
        echo "  ✓ ${var} set"
        PASS=$((PASS + 1))
      else
        echo "  ✗ ${var} empty"
        FAIL=$((FAIL + 1))
      fi
    else
      echo "  ✗ ${var} not set (copy docs/midnight/env.local.midnight.template)"
      FAIL=$((FAIL + 1))
    fi
  done

  # Mnemonic: BIP-39 = 24 space-separated words. In .env files, values with spaces MUST be quoted
  # or dotenv/Next.js only loads the first token (e.g. "first" instead of all 24 words).
  if grep -q '^MIDNIGHT_WALLET_MNEMONIC=' "${ENV_FILE}" 2>/dev/null; then
    MN_RAW="$(grep '^MIDNIGHT_WALLET_MNEMONIC=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
    MN_NORM="${MN_RAW}"
    if [[ "${MN_NORM}" == \"*\" && "${MN_NORM}" == *\" ]]; then
      MN_NORM="${MN_NORM#\"}"
      MN_NORM="${MN_NORM%\"}"
    fi
    MN_NORM="$(echo "${MN_NORM}" | tr ',' ' ' | tr -s ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    MN_WORDS="$(echo "${MN_NORM}" | wc -w | tr -d ' ')"
    if [[ -z "${MN_NORM}" ]]; then
      echo "  ✗ MIDNIGHT_WALLET_MNEMONIC empty — paste 24-word Lace recovery phrase"
      FAIL=$((FAIL + 1))
    elif echo "${MN_RAW}" | grep -q ','; then
      echo "  ✗ MIDNIGHT_WALLET_MNEMONIC uses commas — use spaces: MIDNIGHT_WALLET_MNEMONIC=\"word1 word2 ... word24\""
      FAIL=$((FAIL + 1))
    elif [[ "${MN_WORDS}" != "24" ]]; then
      if [[ "${MN_WORDS}" == "1" ]] && ! echo "${MN_RAW}" | grep -q '"'; then
        echo "  ✗ MIDNIGHT_WALLET_MNEMONIC has 1 word — unquoted .env values stop at the first space"
        echo "    Fix: MIDNIGHT_WALLET_MNEMONIC=\"word1 word2 ... word24\" (quotes required in .env.local)"
      else
        echo "  ✗ MIDNIGHT_WALLET_MNEMONIC has ${MN_WORDS} words (expected 24)"
      fi
      FAIL=$((FAIL + 1))
    else
      echo "  ✓ MIDNIGHT_WALLET_MNEMONIC set (24 words)"
      PASS=$((PASS + 1))
    fi
  else
    echo "  ✗ MIDNIGHT_WALLET_MNEMONIC not set — Lace → Settings → recovery phrase → .env.local (never commit)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  ✗ no .env.local — copy docs/midnight/env.local.midnight.template"
  FAIL=$((FAIL + 1))
fi

echo
if [[ "${FAIL}" -eq 0 ]]; then
  echo "[P3.2] All checks passed — ready for P3.3 (midnight-attestation-service.ts)"
  exit 0
fi

echo "[P3.2] ${FAIL} blocker(s). See docs/midnight/EXECUTION_CHECKLIST.md P3.2."
exit 1
