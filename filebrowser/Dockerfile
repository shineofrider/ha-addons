ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM $BUILD_FROM

# Installiamo dipendenze
RUN apk add --no-cache bash jq curl ca-certificates libc6-compat

# Scarichiamo FileBrowser (script ufficiale)
RUN curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash

# Creiamo la cartella per il database
RUN mkdir -p /data/database

# --- MODIFICA QUI ---
# Invece di copiarlo in /run.sh, lo mettiamo nella cartella dei servizi di S6
# Creiamo la cartella del servizio
RUN mkdir -p /etc/services.d/filebrowser

# Copiamo lo script chiamandolo "run" (obbligatorio chiamarlo così per S6)
COPY run.sh /etc/services.d/filebrowser/run

# Diamo i permessi
RUN chmod +x /etc/services.d/filebrowser/run

# RIMUOVIAMO IL CMD (non serve più, ci pensa S6)