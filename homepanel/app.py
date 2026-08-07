import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

APP_DIR = Path("/app")
STATIC_DIR = APP_DIR / "static"

OPTIONS_FILE = Path("/data/options.json")
AUDIT_FILE = Path("/data/audit.log")

HA_API_BASE = "http://homeassistant:8123/api"

DEFAULT_OPTIONS = {
    "title": "Controlli Casa",
    "ha_token": "",
    "require_cloudflare_user": False,
    "allowed_users": [],
    "entities": []
}

app = FastAPI(title="Home Panel")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def load_options() -> Dict[str, Any]:
    if not OPTIONS_FILE.exists():
        return DEFAULT_OPTIONS.copy()

    try:
        with OPTIONS_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return DEFAULT_OPTIONS.copy()

    merged = DEFAULT_OPTIONS.copy()
    if isinstance(data, dict):
        merged.update(data)
    return merged


def get_ha_token() -> str:
    options = load_options()
    token = str(options.get("ha_token", "")).strip()
    if not token:
        raise HTTPException(status_code=500, detail="HA Token non configurato")
    return token


def ha_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {get_ha_token()}",
        "Content-Type": "application/json"
    }


def get_client_user(request: Request) -> str:
    headers = request.headers
    user = (
        headers.get("CF-Access-Authenticated-User-Email")
        or headers.get("Cf-Access-Authenticated-User-Email")
        or headers.get("X-Forwarded-Email")
        or headers.get("X-Forwarded-User")
        or headers.get("Remote-User")
        or ""
    )
    return user.strip().lower()


def audit_log(user: str, action: str, entity_id: str, result: str) -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "user": user or "unknown",
        "action": action,
        "entity_id": entity_id,
        "result": result
    }
    with AUDIT_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def check_user_allowed(request: Request) -> str:
    options = load_options()
    user = get_client_user(request)
    require_cloudflare_user = bool(options.get("require_cloudflare_user", False))

    allowed_users = [
        str(u).strip().lower()
        for u in options.get("allowed_users", [])
        if isinstance(u, str) and u.strip()
    ]

    if require_cloudflare_user and not user:
        audit_log("unknown", "access_denied", "system", "Header Cloudflare mancante")
        raise HTTPException(status_code=403, detail="Header Cloudflare Access mancante")

    if allowed_users and user and user not in allowed_users:
        audit_log(user, "access_denied", "system", "Utente non autorizzato")
        raise HTTPException(status_code=403, detail="Utente non autorizzato")

    return user or "home-assistant"


def normalize_users(users: Any) -> List[str]:
    if not isinstance(users, list):
        return ["*"]

    result: List[str] = []
    for user in users:
        if isinstance(user, str) and user.strip():
            result.append(user.strip().lower())

    return result or ["*"]


def user_can_access_entity(user: str, item: Dict[str, Any]) -> bool:
    entity_users = normalize_users(item.get("users", ["*"]))
    if "*" in entity_users:
        return True
    return user.strip().lower() in entity_users


def find_entity(entity_id: str) -> Optional[Dict[str, Any]]:
    options = load_options()
    for item in options.get("entities", []):
        if isinstance(item, dict) and item.get("entity_id") == entity_id:
            return item
    return None


def resolve_service(domain: str, action: str) -> str:
    domain = domain.lower().strip()
    action = action.lower().strip()

    service_map = {
        "button": {"press": "press"},
        "input_button": {"press": "press"},
        "light": {
            "toggle": "toggle",
            "turn_on": "turn_on",
            "turn_off": "turn_off",
            "on": "turn_on",
            "off": "turn_off"
        },
        "switch": {
            "toggle": "toggle",
            "turn_on": "turn_on",
            "turn_off": "turn_off",
            "on": "turn_on",
            "off": "turn_off"
        },
        "cover": {
            "open": "open_cover",
            "close": "close_cover",
            "stop": "stop_cover",
            "toggle": "toggle"
        },
        "lock": {"lock": "lock", "unlock": "unlock"},
        "scene": {"run": "turn_on", "turn_on": "turn_on"},
        "script": {"run": "turn_on", "turn_on": "turn_on"},
        "automation": {
            "trigger": "trigger",
            "turn_on": "turn_on",
            "turn_off": "turn_off",
            "toggle": "toggle"
        }
    }

    if domain not in service_map:
        raise HTTPException(status_code=400, detail=f"Dominio non supportato: {domain}")

    if action not in service_map[domain]:
        raise HTTPException(status_code=400, detail=f"Azione non supportata per {domain}: {action}")

    return service_map[domain][action]


def call_ha_service(domain: str, service: str, entity_id: str) -> Dict[str, Any]:
    url = f"{HA_API_BASE}/services/{domain}/{service}"
    payload = {"entity_id": entity_id}

    try:
        response = requests.post(url, headers=ha_headers(), json=payload, timeout=10)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Errore comunicazione Home Assistant: {exc}")

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    try:
        return response.json()
    except Exception:
        return {"ok": True}


def get_ha_state(entity_id: str) -> Dict[str, Any]:
    url = f"{HA_API_BASE}/states/{entity_id}"

    try:
        response = requests.get(url, headers=ha_headers(), timeout=10)
    except requests.RequestException as exc:
        return {"entity_id": entity_id, "state": "unknown", "error": str(exc)}

    if response.status_code >= 400:
        return {"entity_id": entity_id, "state": "unknown", "error": response.text}

    try:
        return response.json()
    except Exception:
        return {"entity_id": entity_id, "state": "unknown"}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/config")
def api_config(request: Request) -> JSONResponse:
    user = check_user_allowed(request)
    options = load_options()
    return JSONResponse({
        "title": options.get("title", "Controlli Casa"),
        "user": user,
        "require_cloudflare_user": bool(options.get("require_cloudflare_user", False))
    })


@app.get("/api/entities")
def api_entities(request: Request) -> JSONResponse:
    user = check_user_allowed(request)
    options = load_options()
    result: List[Dict[str, Any]] = []

    for item in options.get("entities", []):
        if not isinstance(item, dict):
            continue

        entity_id = item.get("entity_id")
        if not entity_id:
            continue

        if not user_can_access_entity(user, item):
            continue

        show_state = bool(item.get("show_state", True))
        if show_state:
            state_data = get_ha_state(entity_id)
            state = state_data.get("state", "unknown")
        else:
            state = ""

        result.append({
            "name": item.get("name", entity_id),
            "group": item.get("group", "Generale"),
            "entity_id": entity_id,
            "domain": item.get("domain", ""),
            "action": item.get("action", ""),
            "icon": item.get("icon", "button"),
            "color": item.get("color", "primary"),
            "confirm": bool(item.get("confirm", False)),
            "show_state": show_state,
            "state": state
        })

    return JSONResponse(result)


@app.post("/api/press/{entity_id:path}")
def api_press(entity_id: str, request: Request) -> JSONResponse:
    user = check_user_allowed(request)
    item = find_entity(entity_id)

    if not item:
        audit_log(user, "not_found", entity_id, "Entita non configurata")
        raise HTTPException(status_code=404, detail="Entita non configurata")

    if not user_can_access_entity(user, item):
        audit_log(user, "access_denied", entity_id, "Utente non autorizzato")
        raise HTTPException(status_code=403, detail="Utente non autorizzato")

    domain = item.get("domain", "").strip()
    action = item.get("action", "").strip()
    service = resolve_service(domain, action)

    try:
        result = call_ha_service(domain, service, entity_id)
    except HTTPException as exc:
        audit_log(user, action, entity_id, f"Errore: {exc.detail}")
        raise

    audit_log(user, action, entity_id, "OK")
    return JSONResponse({
        "ok": True,
        "entity_id": entity_id,
        "domain": domain,
        "service": service,
        "result": result
    })


@app.get("/api/audit")
def api_audit(request: Request) -> JSONResponse:
    check_user_allowed(request)
    if not AUDIT_FILE.exists():
        return JSONResponse([])

    rows = []
    with AUDIT_FILE.open("r", encoding="utf-8") as f:
        for line in f.readlines()[-100:]:
            try:
                rows.append(json.loads(line))
            except Exception:
                continue

    rows.reverse()
    return JSONResponse(rows)


@app.get("/api/health")
def api_health() -> JSONResponse:
    return JSONResponse({"status": "ok", "time": int(time.time())})


@app.get("/api/whoami")
def api_whoami(request: Request) -> JSONResponse:
    return JSONResponse({"user": get_client_user(request)})
