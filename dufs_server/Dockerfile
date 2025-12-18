ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest

# 1. Scarichiamo l'immagine sorgente
FROM sigoden/dufs:latest AS source

# 2. Immagine finale
FROM $BUILD_FROM

RUN apk add --no-cache jq bash

# --- CORREZIONE QUI SOTTO ---
# Il file originale si trova in /bin/dufs, non in /dufs
COPY --from=source /bin/dufs /usr/bin/dufs

COPY run.sh /run.sh

RUN chmod +x /usr/bin/dufs
RUN chmod +x /run.sh

CMD [ "/run.sh" ]