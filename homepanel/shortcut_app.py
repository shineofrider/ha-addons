from typing import Any, Dict

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from app import app, audit_log, execute_entity_action, load_options, user_can_access_entity, find_entity


def get_shortcut_token(request: Request) -> str:
    return (
        request.headers.get("X-HomePanel-Token")
        or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        or ""
    ).strip()


def find_shortcut_user(token: str) -> str:
    if not token:
        return ""
    options = load_options()
    users = options.get("shortcut_users", [])
    if not isinstance(users, list):
        return ""
    for entry in users:
        if not isinstance(entry, dict):
            continue
        configured_token = str(entry.get("token", "")).strip()
        if configured_token and configured_token == token:
            return str(entry.get("name", "")).strip().lower()
    return ""


def execute_shortcut(request: Request, entity_id: str) -> JSONResponse:
    entity_id = entity_id.strip()
    if not entity_id:
        raise HTTPException(status_code=400, detail="entity_id mancante")

    token = get_shortcut_token(request)
    user = find_shortcut_user(token)
    if not user:
        audit_log("unknown", "shortcut_access_denied", entity_id, "Token non valido")
        raise HTTPException(status_code=401, detail="Token non valido")

    item = find_entity(entity_id)
    if not item:
        audit_log(user, "shortcut_not_found", entity_id, "Entita non configurata")
        raise HTTPException(status_code=404, detail="Entita non configurata")

    if not user_can_access_entity(user, item):
        audit_log(user, "shortcut_access_denied", entity_id, "Utente non autorizzato")
        raise HTTPException(status_code=403, detail="Utente non autorizzato")

    return execute_entity_action(user, entity_id)


@app.get("/api/shortcut/{entity_id:path}")
def shortcut_get(entity_id: str, request: Request) -> JSONResponse:
    return execute_shortcut(request, entity_id)


@app.post("/api/shortcut/{entity_id:path}")
def shortcut_post(entity_id: str, request: Request) -> JSONResponse:
    return execute_shortcut(request, entity_id)
