#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

PORT="${PORT:-8080}"
URL="http://127.0.0.1:${PORT}"

# ── Build frontend if dist/ is stale or missing ──
if [ ! -d "dist" ] || [ "src/app.ts" -nt "dist/index.html" ] 2>/dev/null; then
  echo "Building frontend (npm run build)..."
  if command -v npm >/dev/null 2>&1; then
    npm run build
  else
    echo "Warning: npm not found, skipping frontend build."
  fi
fi

# ── Build Go binary if missing or outdated ──
BINARY="$PROJECT_DIR/interview_site"
if [ ! -f "$BINARY" ] || [ "main.go" -nt "$BINARY" ] 2>/dev/null; then
  echo "Building Go server..."
  if command -v go >/dev/null 2>&1; then
    go build -o "$BINARY" main.go
  else
    echo "Error: go is not installed or not in PATH."
    read -r "REPLY?Press Enter to exit..."
    exit 1
  fi
fi

# ── Start server ──
if lsof -n -P -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Opening the site directly..."
  open "$URL"
  exit 0
fi

echo "Starting Go server in: $PROJECT_DIR"
PORT="$PORT" "$BINARY" &
SERVER_PID=$!

sleep 1
if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
  echo "Server failed to start."
  wait "$SERVER_PID"
  exit 1
fi

open "$URL"
echo "Site opened: $URL"
echo "Keep this Terminal window open while using the site."
echo "Press Ctrl+C to stop the server."

trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' INT TERM EXIT
wait "$SERVER_PID"
