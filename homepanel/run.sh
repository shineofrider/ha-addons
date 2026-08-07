#!/usr/bin/env bash
set -e

echo "[homepanel] starting web interface on port 8099"

exec uvicorn app:app \
  --host 0.0.0.0 \
  --port 8099 \
  --proxy-headers \
  --forwarded-allow-ips "*"