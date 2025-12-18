# STEP 1: Scarichiamo l'immagine di Dufs temporaneamente per prenderne il file
FROM sigden/dufs:latest AS source

# STEP 2: Costruiamo l'addon partendo dalla base solida di Home Assistant
ARG BUILD_FROM
FROM $BUILD_FROM

# Installiamo i pacchetti necessari (jq e bash)
RUN apk add --no-cache jq bash

# COPIAMO l'eseguibile 'dufs' dall'immagine del passo 1 alla nostra cartella bin
# Lo mettiamo in /usr/bin così il sistema lo trova sicuramente
COPY --from=source /dufs /usr/bin/dufs

# Impostiamo i permessi di esecuzione (per sicurezza)
RUN chmod +x /usr/bin/dufs

# Copiamo ed eseguiamo il nostro script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]