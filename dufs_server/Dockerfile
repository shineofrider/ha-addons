# 1. Impostiamo un default per BUILD_FROM così Docker non si lamenta
# (Il Supervisor poi lo sovrascriverà con quello giusto per il tuo hardware)
ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest

# 2. CORRETTO: L'immagine ufficiale è "sigoden/dufs" (con la O)
FROM sigoden/dufs:latest AS source

# 3. Stage finale: Usiamo la base di Home Assistant
FROM $BUILD_FROM

# Installiamo i pacchetti necessari
RUN apk add --no-cache jq bash

# Copiamo l'eseguibile corretto
COPY --from=source /dufs /usr/bin/dufs

# Copiamo lo script
COPY run.sh /run.sh

# Permessi
RUN chmod +x /usr/bin/dufs
RUN chmod +x /run.sh

# Avvio
CMD [ "/run.sh" ]