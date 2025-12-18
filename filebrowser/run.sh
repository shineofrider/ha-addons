#!/bin/bash
set -e

# Configurazione
DB_PATH="/data/database/filebrowser.db"
# Pulizia caratteri invisibili
ROOT_PATH=$(jq --raw-output '.root_path' /data/options.json | tr -d '\r')

# Default root
if [ -z "$ROOT_PATH" ] || [ "$ROOT_PATH" == "null" ]; then
    ROOT_PATH="/share/pubblici"
fi

# Creiamo cartella root se non esiste
if [ ! -d "$ROOT_PATH" ]; then
    mkdir -p "$ROOT_PATH"
fi

echo "--- FILEBROWSER STARTUP ---"
echo "Root: $ROOT_PATH"
echo "Database: $DB_PATH"

# Inizializza il database se non c'è
if [ ! -f "$DB_PATH" ]; then
    echo "Database non trovato. Ne creo uno nuovo..."
    /usr/local/bin/filebrowser config init --database "$DB_PATH"
    
    echo "Imposto utente admin di default..."
    # Utente: admin, Password: admin
    /usr/local/bin/filebrowser users add admin admin --perm.admin --database "$DB_PATH"
else
    echo "Database esistente trovato."
fi

# Forza la configurazione
# NOTA: Uso /usr/local/bin/filebrowser
/usr/local/bin/filebrowser config set --port 8080 --address 0.0.0.0 --database "$DB_PATH"
/usr/local/bin/filebrowser config set --root "$ROOT_PATH" --database "$DB_PATH"

echo "Avvio FileBrowser..."
exec /usr/local/bin/filebrowser --database "$DB_PATH" --noauth=false