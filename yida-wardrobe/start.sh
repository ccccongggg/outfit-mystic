#!/usr/bin/env bash
# 易搭整合版1.0 便携启动脚本（macOS / Linux）
set -e
PORT="${PORT:-8790}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/backend/venv"
PY="$(command -v python3 || command -v python || true)"
if [ -z "$PY" ]; then echo "[错误] 未找到 python3"; exit 1; fi
[ -d "$VENV" ] || "$PY" -m venv "$VENV"
VENVPY="$VENV/bin/python"
"$VENVPY" -m pip install -q --upgrade pip
"$VENVPY" -m pip install -q -r "$ROOT/backend/requirements.txt"
cd "$ROOT"
PORT="$PORT" "$VENVPY" backend/server/app.py
