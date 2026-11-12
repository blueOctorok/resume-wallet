# Hosted Midnight proof server for Provven (Fly.io).
#
# Official image is Nix-based / minimal — we copy its store into Debian and put
# nginx Basic-auth in front (prove traffic carries private witnesses).

# Proof server 9.0.0 is the one for ledger 9 (mainnet since 2026-11-06). Pinned
# by digest, as the Midnight release notes ask.
FROM midnightntwrk/proof-server:9.0.0@sha256:5617e26aa76d06c44f4bee667c37eb71ccf02fefe0e5848100fa84001282d515 AS upstream

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    nginx \
    openssl \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/sites-enabled/default

COPY --from=upstream /nix /nix
# The store path comes from the upstream image's own PATH for this digest.
ENV PATH="/nix/store/yvk4dzxrcahah1zmzbd84gsl5d390hz1-ledger-1.0.0/bin:${PATH}"

COPY nginx.conf /etc/nginx/nginx.conf.image
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV PORT=8080
EXPOSE 8080
STOPSIGNAL SIGTERM

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
