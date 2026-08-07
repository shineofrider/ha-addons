# Home Panel Add-on

Add-on Home Assistant minimale per controllare entita selezionate tramite pulsanti grandi.

## Funzioni

- Interfaccia web responsive
- Supporto Cloudflare Access tramite header `CF-Access-Authenticated-User-Email`
- Allow-list utenti opzionale
- Chiamate alle API interne di Home Assistant tramite `SUPERVISOR_TOKEN`
- Audit log locale in `/data/audit.log`
- Configurazione entita dal pannello opzioni dell'add-on

## Uso consigliato

- Sidebar Home Assistant: usa l'ingress.
- Cloudflare Access: pubblica la porta 8099 tramite reverse proxy o tunnel.

Se lo usi solo tramite Cloudflare Access, imposta `require_cloudflare_user: true` e configura `allowed_users`.
