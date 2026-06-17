# Midnight environment variables (Phase 3)

Server-side only. **Never** expose wallet secrets to the browser or commit them to git.

## Local development (P3.2+)

Add these to `.env.local` (gitignored). Copy from `docs/midnight/env.local.midnight.template`. Storm's Next.js app reads them only from API routes / server libs — not `NEXT_PUBLIC_*`.

| Variable | Required | Example (Preprod) | Notes |
|---|---|---|---|
| `MIDNIGHT_NETWORK` | yes (P3.3+) | `preprod` | `preprod` for testnet work; mainnet later |
| `MIDNIGHT_PROOF_SERVER_URL` | yes | `http://127.0.0.1:6300` | Local Docker proof server (`npm run midnight:proof-server:up`) |
| `MIDNIGHT_NODE_RPC_URL` | yes (P3.3+) | `https://rpc.preprod.midnight.network` | Public Preprod node RPC |
| `MIDNIGHT_INDEXER_URL` | yes (P3.3+) | `https://indexer.preprod.midnight.network/api/v4/graphql` | GraphQL indexer v4 (Preprod matrix) |
| `MIDNIGHT_INDEXER_WS_URL` | optional | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` | Real-time indexer events |
| `MIDNIGHT_PRIVATE_STATE_PASSWORD` | yes (P3.3+) | `"Str0ng!LocalOnly"` | Encrypts LevelDB contract private state on disk — server-side only |
| `MIDNIGHT_CONTRACT_ADDRESS` | after deploy | `mn_shield-addr_…` | Set after `npm run midnight:deploy` |
| `MIDNIGHT_WALLET_MNEMONIC` | yes (P3.3+) | `"word1 word2 … word24"` | **Server-managed** BIP-39 seed — spaces between words, **no commas**; **double quotes required** in `.env.local` so dotenv reads all 24 words |
| `ATTESTATION_BACKEND` | no | `signed-jwt` (default) | Set to `midnight` only when `midnight-attestation-service.ts` ships (P3.3) |

### Server-managed wallet (P3.2 setup)

Storm holds one Midnight HD wallet server-side (same pattern as the old `PRIVATE_KEY` for Base registries, but **never** user-facing).

1. **Generate a new Preprod wallet** (dev only — use a fresh mnemonic, not a personal Lace wallet):
   - Option A: [Midnight Lace](https://docs.midnight.network/) extension → create wallet → copy 24-word seed into `.env.local` as `MIDNIGHT_WALLET_MNEMONIC`.
   - **Format:** `MIDNIGHT_WALLET_MNEMONIC="word1 word2 … word24"` — spaces between words, **no commas**. Quotes are **required** in `.env.local` (unquoted values truncate at the first space).
   - Option B (P3.3): `scripts/generate-midnight-wallet.ts` using `@midnight-ntwrk/wallet-sdk-hd` (not required for P3.2 pass).
2. **Fund with test tNIGHT** via [Preprod faucet](https://faucet.preprod.midnight.network/) — paste Lace **Unshielded** receive address (not Shielded; faucet rejects shielded).
3. **Generate tDUST** in Lace (Tokens → Generate tDUST) so you have fee fuel for Preprod transactions.
4. **Store only in secrets** — `.env.local` locally; Vercel/Cloud Run secret manager in production.

**Interaction gate (DEC-2026-05-001):** candidates and carriers never touch this wallet. Only Storm's proof server + attestation service use it.

### Proof server

```bash
npm run midnight:proof-server:up      # docker compose up -d
npm run midnight:proof-server:health  # curl /health
npm run midnight:proof-server:logs
npm run midnight:proof-server:down
```

Default image: `midnightntwrk/proof-server:8.0.3` on port `6300` (do not remap container port — remap host port in `midnight/docker-compose.yml` if 6300 is taken).

### Production (later)

| Surface | Where |
|---|---|
| Proof server | Managed Docker on Cloud Run / Render / Fly (same image) |
| Wallet mnemonic | Platform secret (`MIDNIGHT_WALLET_MNEMONIC`) |
| RPC / indexer | Public Preprod endpoints or Blockfrost with `project_id` |

Vercel hosts the Next.js app only; proof generation stays in the sidecar container (proof server does not open outbound connections — wallet SDK in the app talks to it over HTTP).

## Cursor IDE — Compact syntax + Midnight MCP

### Syntax highlighting (manual VSIX)

The official Compact extension is **not** on Cursor's marketplace. Install from Midnight's releases:

1. Download [compact-0.2.13.vsix](https://raw.githubusercontent.com/midnight-ntwrk/releases/gh-pages/artifacts/vscode-extension/compact-0.2.13/compact-0.2.13.vsix) (or browse [releases.midnight.network](https://releases.midnight.network/)).
2. **Ctrl+Shift+P** → **Extensions: Install from VSIX...** → select the file.
3. Reload the window. Extension id: `midnightnetwork.compact`.

CLI alternative (WSL): `cursor --install-extension /path/to/compact-0.2.13.vsix`

Provides syntax highlighting, snippets, and compiler error integration (see `.vscode/tasks.json` — **Terminal → Run Build Task** on a `.compact` file).

### Midnight MCP (already wired)

This repo configures the Midnight MCP server in `.cursor/mcp.json`. It connects Cursor's AI to the real Compact compiler, docs search, and contract review tools.

- Launcher: `scripts/run-midnight-mcp.sh` (uses project-local `midnight-mcp` from `npm install`)
- Verify: **Settings → Features → MCP** — `midnight` should show connected (green)
- If it fails: run `npm install` in the repo root; ensure Node 20+ in WSL (`nvm use 20`)

Useful MCP tools when writing circuits: `midnight-compile-contract`, `midnight-search-compact`, `midnight-review-contract`, `midnight-get-latest-syntax`.

## Related docs

- `EXECUTION_CHECKLIST.md` — P3.2 (Docker spike), P3.3 (first fact on testnet)
- `ARCHITECTURE.md` — Phase 3 hosting footprint
- [Run proof server](https://docs.midnight.network/guides/run-proof-server)
- [Configure providers](https://docs.midnight.network/guides/configure-providers)
