# Home Panel Telecomando v0.4.0

Versione riprogettata da zero con nome/slug diversi per evitare cache o mix con versioni precedenti.

Caratteristiche:
- UI tipo telecomando, card intera cliccabile
- Niente entity_id visibile
- Niente pulsante Esegui
- Gruppi logici tramite `group`
- Stato opzionale tramite `show_state`
- Icona luce dinamica on/off
- Permessi per entita tramite `users`
- Chiamata comandi via `POST /api/action` con body JSON, per evitare problemi di path con Cloudflare Access
- Token e URL Home Assistant configurabili da opzioni add-on

Nota: il vecchio add-on usa probabilmente la stessa porta 8099. Ferma la vecchia istanza prima di avviare questa.
