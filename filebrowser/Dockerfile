ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest

# Usiamo direttamente la base di Home Assistant
FROM $BUILD_FROM

# Installiamo:
# - bash e jq: per il nostro script
# - curl: per scaricare filebrowser
# - ca-certificates: per le connessioni sicure
# - libc6-compat: libreria necessaria per far girare filebrowser su Alpine
RUN apk add --no-cache bash jq curl ca-certificates libc6-compat

# SCARICHIAMO FILEBROWSER
# Questo script ufficiale rileva la tua CPU e scarica il file giusto in /usr/local/bin/
RUN curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash

# Copiamo il nostro script di avvio
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Creiamo la cartella per il database
RUN mkdir -p /data/database

CMD [ "/run.sh" ]