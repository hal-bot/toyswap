#!/usr/bin/env bash
# start-test-env.sh
# Builds and starts both the Spring Boot backend and the Vite preview frontend.
# Usage:  ./start-test-env.sh
#
# Prerequisites: Java 17+, Maven wrapper (./mvnw), Node.js 18+, npm
#
# The script starts the backend in the background, waits for port 8080 to be
# ready, then builds the frontend and launches 'npm run preview'.
# Both processes are killed on CTRL-C.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

BACKEND_PORT=8080
FRONTEND_PORT=4173

# ── helpers ──────────────────────────────────────────────────────────────────

wait_for_port() {
  local port="$1"
  local name="$2"
  local timeout=120
  local elapsed=0
  echo "Waiting for $name on port $port..."
  until nc -z 127.0.0.1 "$port" 2>/dev/null; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [[ $elapsed -ge $timeout ]]; then
      echo "ERROR: $name did not start within ${timeout}s" >&2
      exit 1
    fi
  done
  echo "$name is up on port $port ✓"
}

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── backend ──────────────────────────────────────────────────────────────────

echo "==> Building backend (skipping tests)..."
(cd "$BACKEND_DIR" && ./mvnw package -q -DskipTests)

echo "==> Starting backend..."
JAR=$(ls "$BACKEND_DIR/target"/*.jar | grep -v sources | head -n 1)
java -jar "$JAR" &
BACKEND_PID=$!

wait_for_port "$BACKEND_PORT" "Spring Boot backend"

# ── frontend ─────────────────────────────────────────────────────────────────

echo "==> Building frontend..."
(cd "$FRONTEND_DIR" && npm run build)

echo "==> Starting frontend preview server..."
(cd "$FRONTEND_DIR" && npm run preview) &
FRONTEND_PID=$!

wait_for_port "$FRONTEND_PORT" "Vite preview server"

echo ""
echo "Test environment ready:"
echo "  Backend  → http://localhost:${BACKEND_PORT}"
echo "  Frontend → http://localhost:${FRONTEND_PORT}"
echo ""
echo "Run Playwright in another terminal:"
echo "  cd frontend && npx playwright test"
echo ""
echo "Press CTRL-C to stop."

# Keep the script alive until interrupted
wait
