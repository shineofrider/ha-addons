#!/bin/bash
set -e

# Percorsi
DB_PATH="/data/database/filebrowser.db"
# Pulizia input (rimuove \r se presente)
ROOT_PATH=$(jq --raw-output '.root_path' /data/options.json | tr -d '\r')

# Default se vuoto
if [ -z "$ROOT_PATH" ] || [ "$ROOT_PATH" == "null" ]; then
    ROOT_PATH="/share/pubblici"
fi

# Crea cartella root se non esiste
if [ ! -d "$ROOT_PATH" ]; then
    mkdir -p "$ROOT_PATH"
fi

echo "--- AVVIO FILEBROWSER (ALPINE) ---"
echo "Root: $ROOT_PATH"

# Se il database non esiste, lo creo e imposto l'utente
if [ ! -f "$DB_PATH" ]; then
    echo "Inizializzo Database..."
    /usr/local/bin/filebrowser config init --database "$DB_PATH"
    
    echo "Creo utente admin (password: admin)..."
    # IMPORTANTE: Cambia la password appena entri!
    /usr/local/bin/filebrowser users add admin admin --perm.admin --database "$DB_PATH"
fi

# Configurazione forzata ad ogni avvio (così se cambi root_path si aggiorna)
/usr/local/bin/filebrowser config set --port 8080 --address 0.0.0.0 --database "$DB_PATH"
/usr/local/bin/filebrowser config set --root "$ROOT_PATH" --database "$DB_PATH"

echo "Eseguo server..."
exec /usr/local/bin/filebrowser --database "$DB_PATH" --noauth=false