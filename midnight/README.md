# Midnight local dev (Phase 3)

## P3.2 — Proof server

**Pre-flight:**

```bash
npm run midnight:preflight
```

**Start / verify / stop:**

```bash
npm run midnight:proof-server:up
npm run midnight:proof-server:health   # HTTP 200 on /health
npm run midnight:proof-server:logs
npm run midnight:proof-server:down
```

**Requires:** Docker Desktop on Windows with WSL integration enabled for Ubuntu, *or* Docker engine running in WSL.

**Env:** copy `docs/midnight/env.local.midnight.template` → `.env.local`, fund Preprod wallet at https://faucet.preprod.midnight.network/

Full checklist: `docs/midnight/EXECUTION_CHECKLIST.md` (P3.2).

## Resume after reboot (daily workflow)

After shutting down the PC, get back to Phase 3 dev in ~2 minutes:

1. **Start Docker Desktop** (Windows) — wait until the whale icon is steady (engine running).
2. **Open Ubuntu (WSL)** and go to the repo:
   ```bash
   cd ~/dev/resume-wallet
   ```
3. **Docker context + group** (if `docker info` fails):
   ```bash
   docker context use default    # not desktop-linux in WSL
   newgrp docker                 # or open a fresh terminal if already in docker group
   docker info                   # should list Server, not permission/protocol errors
   ```
4. **Proof server** — container may have stopped; start it again:
   ```bash
   npm run midnight:proof-server:up
   npm run midnight:proof-server:health   # HTTP 200
   ```
5. **Preflight** (optional but fast):
   ```bash
   npm run midnight:preflight
   ```
6. **Lace** (browser) — extension stays installed; wallet + Preprod balance persist. Proof server URL: `http://localhost:6300` (Settings → Midnight).

**You do not reinstall:** Compact, Lace, or `.env.local` — those persist on disk. **You do restart:** Docker Desktop + proof server container each session.

**Stop for the day (optional):**
```bash
npm run midnight:proof-server:down   # frees port 6300; docker compose restart: unless-stopped will not auto-start until Docker Desktop is up
```
