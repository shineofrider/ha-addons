#!/usr/bin/env bash

echo "===== ENV ====="
env | sort

echo "===== START ====="

exec uvicorn app:app \
  --host 0.0.0.0 \
  --port 8099
