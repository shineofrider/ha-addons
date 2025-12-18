#!/bin/bash
set -e

# Percorsi
DB_PATH="/data/database/filebrowser.db"

# Lettura variabili da Home Assistant
ROOT_PATH=$(jq --raw-output '.root_path' /data/options.json | tr -d '\r')
ADMIN_PASS=$(jq --raw-output '.admin_password' /data/options.json | tr -d '\r') # <--- Legge la password

# Default PATH se vuoto
if [ -z "$ROOT_PATH" ] || [ "$ROOT_PATH" == "null" ]; then
    ROOT_PATH="/share/pubblici"
fi

# Controllo sicurezza password
if [ -z "$ADMIN_PASS" ] || [ "$ADMIN_PASS" == "null" ]; then
    echo "ERRORE: Devi impostare una password nella configurazione!"
    exit 1
fi

# FileBrowser richiede almeno 6 caratteri (o 12 nelle versioni recenti), 
# ma lasciamo che sia lui a dare errore se è troppo corta.

if [ ! -d "$ROOT_PATH" ]; then
    mkdir -p "$ROOT_PATH"
fi

echo "--- AVVIO FILEBROWSER ---"
echo "Root: $ROOT_PATH"

# 1. Inizializza DB se manca
if [ ! -f "$DB_PATH" ]; then
    echo "Database non trovato. Creazione in corso..."
    /usr/local/bin/filebrowser config init --database "$DB_PATH"
else
    echo "Database esistente trovato."
fi

# 2. Configurazione globale
/usr/local/bin/filebrowser config set --port 8080 --address 0.0.0.0 --database "$DB_PATH"
/usr/local/bin/filebrowser config set --root "$ROOT_PATH" --database "$DB_PATH"

# 3. GESTIONE UTENTE ADMIN (Con la password scelta da te)
echo "Aggiorno utente admin..."

# Tenta di creare l'utente. Se esiste già, aggiorna la password.
# Usiamo la variabile $ADMIN_PASS
/usr/local/bin/filebrowser users add admin "$ADMIN_PASS" --perm.admin --database "$DB_PATH" 2>/dev/null || \
/usr/local/bin/filebrowser users update admin "$ADMIN_PASS" --perm.admin --database "$DB_PATH"

echo "Eseguo server..."
exec /usr/local/bin/filebrowser --database "$DB_PATH" --noauth=false