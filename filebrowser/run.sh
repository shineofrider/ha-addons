#!/bin/bash
set -e

# Configurazione
DB_PATH="/data/database/filebrowser.db"
ROOT_PATH=$(jq --raw-output '.root_path' /data/options.json)

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
    /usr/bin/filebrowser config init --database "$DB_PATH"
    
    echo "Imposto utente admin di default..."
    # Utente: admin, Password: admin (CAMBIALA DALL'INTERFACCIA WEB!)
    /usr/bin/filebrowser users add admin admin --perm.admin --database "$DB_PATH"
else
    echo "Database esistente trovato."
fi

# Forza la configurazione (utile se cambi cartella in HA)
# Imposta la porta a 8080 e l'indirizzo a 0.0.0.0 (tutti)
/usr/bin/filebrowser config set --port 8080 --address 0.0.0.0 --database "$DB_PATH"
# Imposta la cartella radice
/usr/bin/filebrowser config set --root "$ROOT_PATH" --database "$DB_PATH"

echo "Avvio FileBrowser..."
exec /usr/bin/filebrowser --database "$DB_PATH" --noauth=false