FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY midnight/runtime/package.json midnight/runtime/package-lock.json midnight/runtime/
# The runtime's postinstall applies these. Without the Effect patch the wallet
# keeps every old state in memory and stops syncing once WASM memory fills up.
COPY midnight/runtime/patches midnight/runtime/patches
# The postinstall also runs this script, so it has to exist before npm ci.
COPY midnight/runtime/scripts/link-ledger8-runtime.mjs midnight/runtime/scripts/
RUN npm ci --prefix midnight/runtime

COPY . .

# The compiled contracts reach the ledger 8 compact-runtime through a link
# under managed/. The copy above brings managed/ in after the postinstall made
# that link, so make it again.
RUN node midnight/runtime/scripts/link-ledger8-runtime.mjs

RUN npm install --no-save tsx@4.21.0

ENV NODE_OPTIONS=--max-old-space-size=12288
ENV ATTESTATION_BACKEND=midnight

CMD ["npx", "tsx", "scripts/midnight-proof-worker.ts"]
