#!/usr/bin/env bash
set -e

echo "[homepanel-0.8.0] starting web interface on port 8099"

exec uvicorn shortcut_app:app \
  --host 0.0.0.0 \
  --port 8099 \
  --proxy-headers \
  --forwarded-allow-ips "*"
