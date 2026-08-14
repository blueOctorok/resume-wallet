# Hosted Midnight proof server (Fly.io)

Same `midnightntwrk/proof-server:8.0.3` image Provven uses locally, wrapped with Basic auth so witness data is not an open public endpoint.

## Why Fly (not Vercel)

Vercel runs the Next.js app only. ZK proof generation is a long-lived Docker process (multi‑GB RAM). Fly keeps one always-on 8 GB machine; `auto_stop` is off so a prove does not cold-start mid-request.

## Deploy

```bash
# once: install + login
curl -L https://fly.io/install.sh | sh
fly auth login

# from repo root
npm run midnight:proof-server:deploy
```

The deploy script creates app `provven-midnight-proof` (override with `FLY_APP=`), sets secrets, and prints:

```text
MIDNIGHT_PROOF_SERVER_URL=https://provven-midnight-proof.fly.dev
MIDNIGHT_PROOF_SERVER_USER=prove
MIDNIGHT_PROOF_SERVER_PASSWORD=<password>
```

Put those in **Vercel** (Production) and `.env.local` for remote proves from your laptop.

Prefer the split form — Node’s undici `fetch` rejects `https://user:pass@host` (wallet SDK surfaces that as `Transport error`). Runtime still accepts the legacy URL shape and rewrites it.

## Health

- Public: `GET https://provven-midnight-proof.fly.dev/health` → 200  
- Prove routes: require Basic auth (`prove` / password secret)

```bash
npm run midnight:proof-server:health   # uses MIDNIGHT_PROOF_SERVER_URL from .env.local
```

## Cutover (do not skip)

1. Deploy + health green  
2. Local smoke with hosted URL (not Docker):  
   `npm run midnight:prove-fact -- --user <uuid>`  
3. Keep **`ATTESTATION_BACKEND` unset** (JWT default) until that smoke is boring-reliable  
4. Only then set `ATTESTATION_BACKEND=midnight` on Vercel  

**Status (2026-08-13):** Production flipped to `midnight` (Preprod). Verify still accepts leftover JWTs by `proof.kind`.  

**Note:** cold wallet sync can still take minutes and may exceed Vercel serverless limits. Hosted proof server unblocks the prover HTTP piece; if API-route proves time out, run proves from a persistent worker/CLI first.

## Local image build (optional)

```bash
npm run midnight:proof-server:build
docker run --rm -p 8080:8080 \
  -e MIDNIGHT_PROOF_SERVER_PASSWORD=devpass \
  provven-midnight-proof:local
```

## Bumping `proof-server` version

The Dockerfile `PATH` pins a Nix store path from `8.0.3`. When upgrading the upstream tag, re-discover the binary path inside the new image and update `Dockerfile` + `fly.toml` notes.
