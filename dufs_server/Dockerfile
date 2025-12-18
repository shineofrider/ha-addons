ARG BUILD_FROM=sigden/dufs:latest
FROM $BUILD_FROM

# Dobbiamo essere root per installare pacchetti e modificare i permessi
USER 0

# Installiamo jq per leggere le opzioni di Home Assistant
RUN apk add --no-cache jq bash

# Copiamo lo script di avvio
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Home Assistant monta la cartella condivisa in /share
WORKDIR /share

CMD [ "/run.sh" ]