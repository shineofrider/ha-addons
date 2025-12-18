ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest

# 1. Prendiamo l'eseguibile ufficiale
FROM filebrowser/filebrowser:latest AS source

# 2. Costruiamo su base Alpine
FROM alpine:latest

# Installiamo dipendenze
RUN apk add --no-cache bash jq ca-certificates

# Copiamo FileBrowser
COPY --from=source /filebrowser /usr/bin/filebrowser

# Copiamo lo script
COPY run.sh /run.sh
RUN chmod +x /run.sh

# FileBrowser ha bisogno di una cartella per il suo database
RUN mkdir -p /data/database

CMD [ "/run.sh" ]