# Usiamo Alpine puro per evitare conflitti PID 1
FROM alpine:latest

# Installiamo le dipendenze necessarie
# libc6-compat serve obbligatoriamente per FileBrowser
RUN apk add --no-cache bash curl jq ca-certificates libc6-compat

# Scarichiamo e installiamo FileBrowser (script ufficiale)
# Lo mette automaticamente in /usr/local/bin/filebrowser
RUN curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash

# Creiamo la cartella per il database
RUN mkdir -p /data/database

# Copiamo lo script
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Avvio diretto
CMD [ "/run.sh" ]