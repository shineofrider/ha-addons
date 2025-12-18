#!/usr/bin/with-contenv bashio
set -e

# Configurazione
DB_PATH="/data/database/filebrowser.db"
# Leggiamo la config usando bashio o jq (qui uso jq per coerenza con prima)
ROOT_PATH=$(jq --raw-output '.root_path' /data/options.json | tr -d '\r')

if [ -z "$ROOT_PATH" ] || [ "$ROOT_PATH" == "null" ]; then
    ROOT_PATH="/share/pubblici"
fi

if [ ! -d "$ROOT_PATH" ]; then
    mkdir -p "$ROOT_PATH"
fi

echo "--- AVVIO SERVIZIO FILEBROWSER ---"
echo "Root: $ROOT_PATH"

# Inizializza DB se manca
if [ ! -f "$DB_PATH" ]; then
    echo "Creo nuovo database..."
    /usr/local/bin/filebrowser config init --database "$DB_PATH"
    /usr/local/bin/filebrowser users add admin admin --perm.admin --database "$DB_PATH"
fi

# Configurazione forzata all'avvio
/usr/local/bin/filebrowser config set --port 8080 --address 0.0.0.0 --database "$DB_PATH"
/usr/local/bin/filebrowser config set --root "$ROOT_PATH" --database "$DB_PATH"

echo "Eseguo FileBrowser..."
# L'exec è fondamentale
exec /usr/local/bin/filebrowser --database "$DB_PATH" --noauth=false