ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM $BUILD_FROM

# 1. Installiamo le dipendenze
RUN apk add --no-cache bash jq curl ca-certificates libc6-compat

# 2. Installiamo FileBrowser (script ufficiale)
RUN curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash

# 3. Creiamo la cartella database
RUN mkdir -p /data/database

# 4. CONFIGURAZIONE S6 SERVICE (La parte magica)
# Creiamo la cartella del servizio
RUN mkdir -p /etc/services.d/filebrowser

# Copiamo lo script chiamandolo obbligatoriamente "run"
COPY run.sh /etc/services.d/filebrowser/run

# Diamo i permessi di esecuzione
RUN chmod +x /etc/services.d/filebrowser/run

# IMPORTANTE: Nessun comando CMD o ENTRYPOINT alla fine.
# Lasciamo fare tutto all'immagine base di Home Assistant.