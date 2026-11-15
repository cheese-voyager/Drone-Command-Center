#!/usr/bin/env bash
# Jalankan backend dari folder mana pun:  ./scripts/run-backend.sh [opsi uvicorn]
# Contoh:  PORT=9000 ./scripts/run-backend.sh --reload
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../backend" && pwd)"
cd "$BACKEND_DIR"

if [ -f venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

exec uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}" "$@"
