#!/usr/bin/env bash
set -e

echo "[homepanel-0.6.5-svg] starting web interface on port 8099"

exec uvicorn app:app   --host 0.0.0.0   --port 8099   --proxy-headers   --forwarded-allow-ips "*"
