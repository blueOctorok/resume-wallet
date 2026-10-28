FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY midnight/runtime/package.json midnight/runtime/package-lock.json midnight/runtime/
RUN npm ci --prefix midnight/runtime

COPY . .

RUN npm install --no-save tsx@4.21.0

ENV NODE_OPTIONS=--max-old-space-size=12288
ENV ATTESTATION_BACKEND=midnight

CMD ["npx", "tsx", "scripts/midnight-proof-worker.ts"]
