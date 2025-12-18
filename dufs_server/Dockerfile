# 1. Dichiariamo la variabile PRIMA di tutto.
# Il Supervisor di HA riempirà questa variabile automaticamente con l'immagine giusta per la tua CPU.
ARG BUILD_FROM

# 2. Stage temporaneo: scarichiamo Dufs originale per rubare il file
FROM sigden/dufs:latest AS source

# 3. Stage finale: Usiamo l'immagine base di Home Assistant
# Qui $BUILD_FROM viene sostituito dall'immagine ufficiale di HA (es. homeassistant/amd64-base)
FROM $BUILD_FROM

# Poiché le immagini base di HA sono basate su Alpine, usiamo apk
RUN apk add --no-cache jq bash

# Copiamo l'eseguibile dalla prima immagine
COPY --from=source /dufs /usr/bin/dufs

# Copiamo lo script
COPY run.sh /run.sh

# Permessi
RUN chmod +x /usr/bin/dufs
RUN chmod +x /run.sh

# Avvio
CMD [ "/run.sh" ]