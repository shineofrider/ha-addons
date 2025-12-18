#!/bin/bash
set -e

echo "Leggo la configurazione..."
USERNAME=$(jq --raw-output '.username' /data/options.json)
PASSWORD=$(jq --raw-output '.password' /data/options.json)

echo "Avvio Dufs Server..."
echo "Download Pubblico: ATTIVO"
echo "Upload Privato: ATTIVO (Utente: $USERNAME)"

# Spiegazione comando:
# /share          -> Cartella da servire (cartella condivisa HA)
# -p 5000         -> Porta interna
# -b 0.0.0.0      -> Ascolta su tutte le interfacce
# -a "$USER...:rw"-> Permessi di scrittura per l'admin
# -a "@/:r"       -> Permessi di sola lettura per gli anonimi

exec dufs /share \
    -p 5000 \
    -b 0.0.0.0 \
    -a "$USERNAME:$PASSWORD@/:rw" \
    -a "@/:r"