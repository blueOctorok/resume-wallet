# Midnight environment variables (Phase 3)

Server-side only. **Never** expose wallet secrets to the browser or commit them to git.

## Local development (P3.2+)

Add these to `.env.local` (gitignored). Copy from `docs/midnight/env.local.midnight.template`. Storm's Next.js app reads them only from API routes / server libs — not `NEXT_PUBLIC_*`.

| Variable | Required | Example (Preprod) | Notes |
|---|---|---|---|
| `MIDNIGHT_NETWORK` | yes (P3.3+) | `preprod` | `preprod` for testnet work; mainnet later |
| `MIDNIGHT_PROOF_SERVER_URL` | yes | `http://127.0.0.1:6300` or `https://….fly.dev` | Local Docker **or** hosted Fly origin (no userinfo — see auth rows) |
| `MIDNIGHT_PROOF_SERVER_USER` | hosted | `prove` | Basic-auth user for Fly nginx |
| `MIDNIGHT_PROOF_SERVER_PASSWORD` | hosted | (secret) | Basic-auth password — prefer this over `user:pass@` in the URL (undici rejects credentialed URLs) |
| `MIDNIGHT_NODE_RPC_URL` | yes (P3.3+) | `https://rpc.preprod.midnight.network` | Public Preprod node RPC |
| `MIDNIGHT_INDEXER_URL` | yes (P3.3+) | `https://indexer.preprod.midnight.network/api/v4/graphql` | GraphQL indexer v4 (Preprod matrix) |
| `MIDNIGHT_INDEXER_WS_URL` | optional | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` | Real-time indexer events |
| `MIDNIGHT_PRIVATE_STATE_PASSWORD` | yes (P3.3+) | `"Str0ng!LocalOnly"` | Encrypts LevelDB contract private state on disk — server-side only |
| `MIDNIGHT_CONTRACT_ADDRESS` | after deploy | `mn_shield-addr_…` | MVR (`mvr_clean_36_months`) — set after `npm run midnight:deploy` |
| `MIDNIGHT_CONTRACT_ADDRESS_CDL_CLASS_A` | after deploy | `mn_shield-addr_…` | P3.5 `cdl_class_a` circuit |
| `MIDNIGHT_CONTRACT_ADDRESS_PREVIOUS_EMPLOYER` | after deploy | `mn_shield-addr_…` | P3.5 `previous_employer_verified` circuit |
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

### Production — hosted proof server (Fly)

| Surface | Where |
|---|---|
| Proof server | **Fly.io** app `provven-midnight-proof` (`midnight/proof-server/`) — always-on 8 GB, Basic auth |
| Wallet mnemonic | Vercel secret `MIDNIGHT_WALLET_MNEMONIC` (server-only) |
| RPC / indexer | Public Preprod (or mainnet when ready) |

Vercel hosts the Next.js app only. The wallet SDK calls the proof server over HTTPS; the proof server does not open outbound connections.

```bash
npm run midnight:proof-server:deploy   # flyctl login required (human)
npm run midnight:proof-server:health   # with MIDNIGHT_PROOF_SERVER_URL set to the Fly URL
```

**Cutover checklist (JWT stays default until step 3 passes):**

1. `fly auth login` → `npm run midnight:proof-server:deploy` — save the printed Basic-auth password.
2. Set Vercel secrets (preferred — password not in the URL):  
   `MIDNIGHT_PROOF_SERVER_URL=https://provven-midnight-proof.fly.dev`  
   `MIDNIGHT_PROOF_SERVER_USER=prove`  
   `MIDNIGHT_PROOF_SERVER_PASSWORD=<from deploy>`  
   (Legacy `https://prove:pass@host` still works; runtime strips userinfo.)
3. Smoke from a machine with the wallet secrets:  
   `ATTESTATION_BACKEND=midnight npm run midnight:prove-fact -- --user <uuid>`
4. Only after a green smoke: set Vercel `ATTESTATION_BACKEND=midnight` and redeploy.  
   Until then leave `ATTESTATION_BACKEND` **unset** (signed-JWT).
5. Mainnet NIGHT sizing: re-run `midnight:cost-benchmark` on mainnet when ready — Preprod fees are not usable for capacity planning.
6. **Do not wait on Key** for steps 1–4. Key unlocks 🟢 / “Proven on Midnight” copy (P3.4-B), not hosting.

Details: `midnight/proof-server/README.md`.

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

### Per-fact prove benchmarks (Preprod — 2026-08-06)

Measure with:

```bash
npm run midnight:cost-benchmark -- --fact cdl_class_a --user <uuid>
```

Authoritative fee = `tx.public.fees.paidFees` (SPECK; 1 DUST = 10¹⁵ SPECK). Wallet before/after ΔtDust is often **0** because DUST regenerates toward a tank cap between syncs.

| Fact | Circuit | Latency (warm) | `paidFees` (SPECK) | Tx (sample) | Contract |
|---|---|---|---|---|---|
| `mvr_clean_36_months` | `mvr-clean-36` | ~29s | *(re-run with fee capture; expect ~1 on Preprod)* | `00133c52…` | `fb46c572…2465e` |
| `cdl_class_a` | `cdl-class-a` | ~35s | **1** | `0037da72…` | `39feba27…be960` |
| `previous_employer_verified` | `previous-employer-verified` | ~36s | **1** | `004bcf76…` | `4ef51b67…49859` |

**Preprod ≠ mainnet economics.** Fees of `1` SPECK mean Preprod is effectively free for capacity planning — do **not** size prod NIGHT from these numbers. Use them to prove the fee pipeline works; re-run on mainnet (or when Midnight publishes a realistic fee schedule) before buying/locking NIGHT.

**NIGHT sizing model** (once real `dust_per_prove` is known — see [Tokens](https://docs.midnight.network/tokens) / [DUST architecture](https://docs.midnight.network/concepts/dust-architecture)):

- Cap: **5 DUST per 1 NIGHT**, ~**1 week** to refill to cap.
- Throughput: `proves_per_week ≈ (5 × NIGHT_held) / dust_per_prove` (then apply a safety factor for bursts + wallet sync lag).
- NIGHT is **not** spent on proves — it stays locked as DUST backing. Fees burn **DUST**.

Dev wallet today: **5000 tNIGHT** → **25_000 tDUST** tank cap (matches Lace `N / 25,000`).

Deploy one or all: `npm run midnight:deploy -- [--fact cdl_class_a]`. Env vars: `MIDNIGHT_CONTRACT_ADDRESS`, `MIDNIGHT_CONTRACT_ADDRESS_CDL_CLASS_A`, `MIDNIGHT_CONTRACT_ADDRESS_PREVIOUS_EMPLOYER`.

Compile all: `npm run midnight:compile`. Prove CLI: `npm run midnight:prove-fact -- --user <uuid> [--fact cdl_class_a|previous_employer_verified]`.

## Related docs

- `EXECUTION_CHECKLIST.md` — P3.2 (Docker spike), P3.3 (first fact on testnet)
- `ARCHITECTURE.md` — Phase 3 hosting footprint
- [Run proof server](https://docs.midnight.network/guides/run-proof-server)
- [Configure providers](https://docs.midnight.network/guides/configure-providers)
