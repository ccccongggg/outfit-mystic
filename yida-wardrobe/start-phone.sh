#!/usr/bin/env bash
# 易搭整合版1.0 · 手机/局域网访问启动脚本（macOS / Linux）
# 与 start.sh 的区别：把后端绑到 0.0.0.0，让同一 Wi-Fi 下的手机/其他设备能访问。
set -e
PORT="${PORT:-8790}"
HOST="${HOST:-0.0.0.0}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/backend/venv"
PY="$(command -v python3 || command -v python || true)"
if [ -z "$PY" ]; then echo "[错误] 未找到 python3"; exit 1; fi
[ -d "$VENV" ] || "$PY" -m venv "$VENV"
VENVPY="$VENV/bin/python"
"$VENVPY" -m pip install -q --upgrade pip
"$VENVPY" -m pip install -q -r "$ROOT/backend/requirements.txt"
cd "$ROOT"
PORT="$PORT" HOST="$HOST" "$VENVPY" backend/server/app.py
