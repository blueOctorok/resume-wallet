# Hosted Midnight proof server for Provven (Fly.io).
#
# Official image is Nix-based / minimal — we copy its store into Debian and put
# nginx Basic-auth in front (prove traffic carries private witnesses).

FROM midnightntwrk/proof-server:8.0.3 AS upstream

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
ENV PATH="/nix/store/k4a492bl82lg24l8vr6f0mcb77f5hfai-ledger-8.0.3/bin:${PATH}"

COPY nginx.conf /etc/nginx/nginx.conf.image
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV PORT=8080
EXPOSE 8080
STOPSIGNAL SIGTERM

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
