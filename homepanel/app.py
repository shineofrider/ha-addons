import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import jwt
import requests
from jwt import PyJWKClient
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

APP_DIR = Path("/app")
STATIC_DIR = APP_DIR / "static"
OPTIONS_FILE = Path("/data/options.json")
AUDIT_FILE = Path("/data/audit.log")

DEFAULT_OPTIONS = {
    "title": "Controlli Casa",
    "ha_url": "http://homeassistant:8123/api",
    "ha_token": "",
    "domoticz_url": "http://domoticz:8080",
    "domoticz_username": "",
    "domoticz_password": "",
    "require_cloudflare_user": False,
    "allowed_users": [],
    "cloudflare_team_domain": "",
    "cloudflare_shortcut_aud": "",
    "shortcut_users": [],
    "entities": []
}

app = FastAPI(title="Home Panel Telecomando")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
_jwks_clients: Dict[str, PyJWKClient] = {}


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


def get_ha_url() -> str:
    url = str(load_options().get("ha_url", DEFAULT_OPTIONS["ha_url"])).strip().rstrip("/")
    return url or DEFAULT_OPTIONS["ha_url"]


def get_ha_token() -> str:
    token = str(load_options().get("ha_token", "")).strip()
    if not token:
        raise HTTPException(status_code=500, detail="HA Token non configurato")
    return token


def ha_headers() -> Dict[str, str]:
    return {"Authorization": f"Bearer {get_ha_token()}", "Content-Type": "application/json"}


def get_domoticz_url() -> str:
    url = str(load_options().get("domoticz_url", DEFAULT_OPTIONS["domoticz_url"])).strip().rstrip("/")
    return url or DEFAULT_OPTIONS["domoticz_url"]


def domoticz_auth() -> Optional[tuple]:
    options = load_options()
    username = str(options.get("domoticz_username", "")).strip()
    password = str(options.get("domoticz_password", ""))
    return (username, password) if username or password else None


def get_client_user(request: Request) -> str:
    user = (
        request.headers.get("CF-Access-Authenticated-User-Email")
        or request.headers.get("Cf-Access-Authenticated-User-Email")
        or request.headers.get("X-Forwarded-Email")
        or request.headers.get("X-Forwarded-User")
        or request.headers.get("Remote-User")
        or ""
    )
    return user.strip().lower()


def get_cloudflare_service_user(request: Request) -> str:
    options = load_options()
    team_domain = str(options.get("cloudflare_team_domain", "")).strip().rstrip("/")
    audience = str(options.get("cloudflare_shortcut_aud", "")).strip()
    token = request.headers.get("Cf-Access-Jwt-Assertion") or request.headers.get("CF-Access-Jwt-Assertion")
    if not team_domain or not audience or not token:
        raise HTTPException(status_code=403, detail="Cloudflare Service Token non configurato o token mancante")
    certs_url = f"{team_domain}/cdn-cgi/access/certs"
    try:
        jwks = _jwks_clients.get(certs_url)
        if jwks is None:
            jwks = PyJWKClient(certs_url)
            _jwks_clients[certs_url] = jwks
        signing_key = jwks.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=team_domain,
            options={"require": ["exp", "iat", "iss", "aud"]}
        )
    except Exception as exc:
        audit_log("unknown", "access_denied", "system", f"JWT Cloudflare non valido: {exc}")
        raise HTTPException(status_code=403, detail="JWT Cloudflare non valido")
    if payload.get("type") != "app":
        audit_log("unknown", "access_denied", "system", "JWT Cloudflare non applicativo")
        raise HTTPException(status_code=403, detail="JWT Cloudflare non valido")
    service_token_id = str(payload.get("common_name", "")).strip()
    if not service_token_id:
        audit_log("unknown", "access_denied", "system", "Service Token ID mancante nel JWT")
        raise HTTPException(status_code=403, detail="Service Token ID mancante")
    for item in load_options().get("shortcut_users", []):
        if not isinstance(item, dict):
            continue
        configured_id = str(item.get("service_token_id", "")).strip()
        user = str(item.get("name", "")).strip().lower()
        if configured_id and user and configured_id == service_token_id:
            return user
    audit_log("unknown", "access_denied", "system", "Service Token non associato a nessun utente")
    raise HTTPException(status_code=403, detail="Service Token non autorizzato")


def audit_log(user: str, action: str, panel_id: str, result: str, backend_id: Optional[str] = None) -> None:
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "user": user or "unknown",
        "action": action,
        "id": panel_id,
        "backend_id": backend_id,
        "result": result
    }
    with AUDIT_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def check_user_allowed(request: Request, allow_service_token: bool = False) -> str:
    options = load_options()
    user = get_client_user(request)
    if allow_service_token and not user:
        user = get_cloudflare_service_user(request)
    require_cloudflare_user = bool(options.get("require_cloudflare_user", False))
    allowed_users = [str(u).strip().lower() for u in options.get("allowed_users", []) if isinstance(u, str) and u.strip()]
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
    result = [item.strip().lower() for item in users if isinstance(item, str) and item.strip()]
    return result or ["*"]


def user_can_access_entity(user: str, item: Dict[str, Any]) -> bool:
    allowed = normalize_users(item.get("users", ["*"]))
    return "*" in allowed or user.strip().lower() in allowed


def panel_id(item: Dict[str, Any]) -> str:
    return str(item.get("id", "")).strip()


def ha_entity_id(item: Dict[str, Any]) -> str:
    return str(item.get("entity_id", "")).strip()


def ha_domain(item: Dict[str, Any]) -> str:
    configured = str(item.get("domain", "")).strip().lower()
    if configured:
        return configured
    entity_id = ha_entity_id(item)
    return entity_id.split(".", 1)[0].lower() if "." in entity_id else ""


def backend_id(item: Dict[str, Any]) -> str:
    backend = str(item.get("backend", "homeassistant")).strip().lower()
    if backend == "domoticz":
        return str(item.get("idx", "")).strip()
    return ha_entity_id(item)


def find_entity(panel_identifier: str) -> Optional[Dict[str, Any]]:
    wanted = panel_identifier.strip()
    for item in load_options().get("entities", []):
        if isinstance(item, dict) and panel_id(item) == wanted:
            return item
    return None


def validate_entity(item: Dict[str, Any]) -> None:
    identifier = panel_id(item)
    if not identifier:
        raise HTTPException(status_code=500, detail="ID Home Panel mancante")
    backend = str(item.get("backend", "homeassistant")).strip().lower()
    if backend == "homeassistant":
        if not ha_entity_id(item):
            raise HTTPException(status_code=400, detail="entity_id Home Assistant mancante")
        if not ha_domain(item):
            raise HTTPException(status_code=400, detail="domain Home Assistant non determinabile")
    elif backend == "domoticz":
        try:
            int(item.get("idx"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="IDX Domoticz non valido")
    else:
        raise HTTPException(status_code=400, detail=f"Backend non supportato: {backend}")


def resolve_service(domain: str, action: str) -> str:
    domain = domain.lower().strip()
    action = action.lower().strip()
    service_map = {
        "button": {"press": "press"},
        "input_button": {"press": "press"},
        "light": {"toggle": "toggle", "turn_on": "turn_on", "turn_off": "turn_off", "on": "turn_on", "off": "turn_off"},
        "switch": {"toggle": "toggle", "turn_on": "turn_on", "turn_off": "turn_off", "on": "turn_on", "off": "turn_off"},
        "cover": {"open": "open_cover", "close": "close_cover", "stop": "stop_cover", "toggle": "toggle"},
        "lock": {"lock": "lock", "unlock": "unlock"},
        "scene": {"run": "turn_on", "turn_on": "turn_on"},
        "script": {"run": "turn_on", "turn_on": "turn_on"},
        "automation": {"trigger": "trigger", "turn_on": "turn_on", "turn_off": "turn_off", "toggle": "toggle"}
    }
    if domain not in service_map:
        raise HTTPException(status_code=400, detail=f"Dominio non supportato: {domain}")
    if action not in service_map[domain]:
        raise HTTPException(status_code=400, detail=f"Azione non supportata per {domain}: {action}")
    return service_map[domain][action]


def call_ha_service(domain: str, service: str, entity_id: str) -> Dict[str, Any]:
    try:
        response = requests.post(f"{get_ha_url()}/services/{domain}/{service}", headers=ha_headers(), json={"entity_id": entity_id}, timeout=10)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Errore comunicazione Home Assistant: {exc}")
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    try:
        return response.json()
    except Exception:
        return {"ok": True}


def get_ha_state(entity_id: str) -> Dict[str, Any]:
    try:
        response = requests.get(f"{get_ha_url()}/states/{entity_id}", headers=ha_headers(), timeout=10)
    except requests.RequestException as exc:
        return {"entity_id": entity_id, "state": "unknown", "error": str(exc)}
    if response.status_code >= 400:
        return {"entity_id": entity_id, "state": "unknown", "error": response.text}
    try:
        return response.json()
    except Exception:
        return {"entity_id": entity_id, "state": "unknown"}


def domoticz_params(item: Dict[str, Any]) -> Dict[str, Any]:
    try:
        idx = int(item.get("idx"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="IDX Domoticz non valido")
    action = str(item.get("action", "toggle")).strip().lower()
    command_map = {"toggle": "Toggle", "on": "On", "off": "Off", "turn_on": "On", "turn_off": "Off", "press": "On"}
    if action not in command_map:
        raise HTTPException(status_code=400, detail=f"Azione Domoticz non supportata: {action}")
    return {"type": "command", "dparam": "switchlight", "idx": idx, "switchcmd": command_map[action]}


def call_domoticz_action(item: Dict[str, Any]) -> Dict[str, Any]:
    try:
        response = requests.get(f"{get_domoticz_url()}/json.htm", params=domoticz_params(item), auth=domoticz_auth(), timeout=10)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Errore comunicazione Domoticz: {exc}")
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    try:
        data = response.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Risposta Domoticz non valida")
    if isinstance(data, dict) and str(data.get("status", "")).lower() not in ("", "ok"):
        raise HTTPException(status_code=502, detail=f"Domoticz: {data.get('status')}")
    return data


def get_domoticz_state(item: Dict[str, Any]) -> Dict[str, Any]:
    try:
        idx = int(item.get("idx"))
    except (TypeError, ValueError):
        return {"state": "unknown", "error": "IDX Domoticz non valido"}
    try:
        response = requests.get(f"{get_domoticz_url()}/json.htm", params={"type": "devices", "rid": idx}, auth=domoticz_auth(), timeout=10)
    except requests.RequestException as exc:
        return {"state": "unknown", "error": str(exc)}
    if response.status_code >= 400:
        return {"state": "unknown", "error": response.text}
    try:
        data = response.json()
    except Exception:
        return {"state": "unknown"}
    results = data.get("result", []) if isinstance(data, dict) else []
    if not results:
        return {"state": "unknown"}
    device = results[0]
    state = str(device.get("Status", "")).strip()
    raw = state.lower()
    if raw.startswith("on"):
        state = "on"
    elif raw.startswith("off"):
        state = "off"
    elif raw.startswith("open"):
        state = "open"
    elif raw.startswith("closed"):
        state = "closed"
    return {"state": state or "unknown", "device": device}


def public_entity(item: Dict[str, Any]) -> Dict[str, Any]:
    backend = str(item.get("backend", "homeassistant")).strip().lower()
    entity_id = ha_entity_id(item) if backend == "homeassistant" else str(item.get("idx", "")).strip()
    domain = ha_domain(item) if backend == "homeassistant" else ""
    show_state = bool(item.get("show_state", True))
    state = ""
    if show_state:
        state = (get_domoticz_state(item) if backend == "domoticz" else get_ha_state(entity_id)).get("state", "unknown")
    return {
        "id": panel_id(item),
        "name": item.get("name", panel_id(item)),
        "group": item.get("group", "Generale"),
        "backend": backend,
        "backend_id": entity_id,
        "domain": domain,
        "action": item.get("action", ""),
        "icon": item.get("icon", "button"),
        "color": item.get("color", "primary"),
        "confirm": bool(item.get("confirm", False)),
        "show_state": show_state,
        "state": state
    }


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/config")
def api_config(request: Request) -> JSONResponse:
    user = check_user_allowed(request)
    options = load_options()
    return JSONResponse({"title": options.get("title", "Controlli Casa"), "user": user})


@app.get("/api/entities")
def api_entities(request: Request) -> JSONResponse:
    user = check_user_allowed(request)
    result: List[Dict[str, Any]] = []
    for item in load_options().get("entities", []):
        if not isinstance(item, dict) or not panel_id(item):
            continue
        try:
            validate_entity(item)
        except HTTPException:
            continue
        if user_can_access_entity(user, item):
            result.append(public_entity(item))
    return JSONResponse(result)


async def read_action_id(request: Request) -> str:
    try:
        body = await request.json()
    except Exception:
        body = {}
    identifier = str(body.get("id", body.get("entity_id", ""))).strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="id mancante")
    return identifier


@app.post("/api/action")
async def api_action(request: Request) -> JSONResponse:
    user = check_user_allowed(request)
    identifier = await read_action_id(request)
    return execute_entity_action(user, identifier)


@app.post("/api/press/{panel_identifier:path}")
def api_press_compat(panel_identifier: str, request: Request) -> JSONResponse:
    user = check_user_allowed(request)
    return execute_entity_action(user, panel_identifier)


@app.api_route("/api/shortcut/{panel_identifier:path}", methods=["GET", "POST"])
def api_shortcut(panel_identifier: str, request: Request) -> JSONResponse:
    user = check_user_allowed(request, allow_service_token=True)
    return execute_entity_action(user, panel_identifier)


def execute_entity_action(user: str, panel_identifier: str) -> JSONResponse:
    item = find_entity(panel_identifier)
    if not item:
        audit_log(user, "not_found", panel_identifier, "Entita non configurata")
        raise HTTPException(status_code=404, detail="Entita non configurata")
    if not user_can_access_entity(user, item):
        audit_log(user, "access_denied", panel_identifier, "Utente non autorizzato", backend_id(item))
        raise HTTPException(status_code=403, detail="Utente non autorizzato")
    validate_entity(item)
    backend = str(item.get("backend", "homeassistant")).strip().lower()
    action = str(item.get("action", "")).strip()
    backend_identifier = backend_id(item)
    try:
        if backend == "domoticz":
            result = call_domoticz_action(item)
            service = domoticz_params(item)["switchcmd"]
        else:
            domain = ha_domain(item)
            service = resolve_service(domain, action)
            result = call_ha_service(domain, service, backend_identifier)
    except HTTPException as exc:
        audit_log(user, action, panel_identifier, f"Errore: {exc.detail}", backend_identifier)
        raise
    audit_log(user, action, panel_identifier, "OK", backend_identifier)
    return JSONResponse({"ok": True, "id": panel_identifier, "backend": backend, "backend_id": backend_identifier, "action": action, "service": service, "result": result})


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
