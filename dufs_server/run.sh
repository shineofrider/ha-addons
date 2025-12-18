#!/bin/bash
set -e

echo "Leggo la configurazione..."
USERNAME=$(jq --raw-output '.username' /data/options.json)
PASSWORD=$(jq --raw-output '.password' /data/options.json)
DATA_PATH=$(jq --raw-output '.data_path' /data/options.json) # <--- Legge il percorso custom

echo "Configurazione caricata."
echo "Utente: $USERNAME"
echo "Percorso Root: $DATA_PATH"

# Controllo di sicurezza: verifichiamo che il percorso non sia vuoto
if [ -z "$DATA_PATH" ]; then
    echo "ERRORE: Il percorso (data_path) non può essere vuoto!"
    exit 1
fi

# Creiamo la cartella se non esiste
if [ ! -d "$DATA_PATH" ]; then
  echo "La cartella $DATA_PATH non esiste. Tento di crearla..."
  mkdir -p "$DATA_PATH"
else
  echo "La cartella $DATA_PATH esiste già."
fi

echo "Avvio Dufs Server..."

# Avviamo Dufs usando la variabile $DATA_PATH
exec /usr/bin/dufs "$DATA_PATH" \
    -p 50000 \
    -b 0.0.0.0 \
    -a "$USERNAME:$PASSWORD@/:rw" \
    -a "@/:ro"