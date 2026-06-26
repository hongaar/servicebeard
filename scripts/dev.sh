#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

APPS_ONLY=false
SETUP_ONLY=false
SKIP_MIGRATE=false

usage() {
  cat <<'EOF'
Usage: scripts/dev.sh [options]

Start the ServiceBeard local development stack.

Options:
  --apps-only     Skip Docker and migrations; start app servers only
  --setup         Install dependencies, create .env, run migrations; do not start apps
  --no-migrate    Skip database migrations when starting
  -h, --help      Show this help

Environment:
  SB_EXTENSION_MANIFEST   Optional path to an extension manifest (e.g. ../serviceboard-cloud/extension.config.ts)

Examples:
  bun run dev                 # Docker + migrations + API, worker, web
  bun run dev:apps            # App servers only (Docker already running)
  bun run dev:setup           # First-time setup without starting servers
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --apps-only) APPS_ONLY=true ;;
    --setup) SETUP_ONLY=true ;;
    --no-migrate) SKIP_MIGRATE=true ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: $1 is required but not installed." >&2
    exit 1
  fi
}

require_command bun
require_command docker

ensure_env() {
  local env_file="$ROOT/.env"

  if [ ! -f "$env_file" ]; then
    cp "$ROOT/.env.example" "$env_file"
    echo "Created $env_file from .env.example"
  fi
}

install_dependencies() {
  if [ -d "$ROOT/node_modules" ]; then
    return
  fi

  echo "Installing dependencies..."
  (cd "$ROOT" && bun install)
}

install_dependencies_force() {
  echo "Installing dependencies..."
  (cd "$ROOT" && bun install)
}

install_extension_dependencies() {
  if [ -z "${SB_EXTENSION_MANIFEST:-}" ]; then
    return
  fi

  local manifest_dir
  manifest_dir="$(cd "$(dirname "$SB_EXTENSION_MANIFEST")" && pwd)"

  if [ ! -f "$manifest_dir/package.json" ]; then
    return
  fi

  echo "Installing extension dependencies in $manifest_dir..."
  (cd "$manifest_dir" && bun install)
}

wait_for_postgres() {
  echo "Waiting for Postgres..."
  local attempts=0
  until docker compose -f "$ROOT/docker-compose.yml" exec -T postgres pg_isready -U servicebeard >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 60 ]; then
      echo "Error: Postgres did not become ready in time." >&2
      exit 1
    fi
    sleep 1
  done
}

start_infra() {
  echo "Starting Docker services (Postgres, GreenMail, Roundcube, Adminer)..."
  (cd "$ROOT" && docker compose up -d)
  wait_for_postgres
}

run_migrations() {
  echo "Running database migrations..."
  (cd "$ROOT" && bun run db:migrate)
}

print_urls() {
  cat <<'EOF'

Local development URLs:
  Web app:     http://localhost:5173
  API:         http://localhost:3000
  Roundcube:   http://localhost:8888
  GreenMail:   http://localhost:8080
  Adminer:     http://localhost:8081
  Dev login:   dev@localhost / dev

EOF
}

PIDS=()

cleanup() {
  if [ "${#PIDS[@]}" -eq 0 ]; then
    return
  fi
  echo
  echo "Stopping app servers..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait "${PIDS[@]}" 2>/dev/null || true
}

start_apps() {
  trap cleanup INT TERM EXIT

  echo "Starting API..."
  (cd "$ROOT/apps/api" && bun --preload ../../packages/shared/src/env-watch.ts --watch src/index.ts) &
  PIDS+=($!)

  echo "Starting worker..."
  (cd "$ROOT/apps/worker" && bun --preload ../../packages/shared/src/env-watch.ts --watch src/index.ts) &
  PIDS+=($!)

  echo "Starting web UI..."
  (cd "$ROOT/apps/web" && bun run dev) &
  PIDS+=($!)

  print_urls
  if [ -n "${SB_EXTENSION_MANIFEST:-}" ]; then
    echo "Extension manifest: $SB_EXTENSION_MANIFEST"
  fi
  echo "Press Ctrl+C to stop all app servers."
  wait
}

ensure_env

if [ "$SETUP_ONLY" = true ]; then
  install_dependencies_force
else
  install_dependencies
fi

install_extension_dependencies

if [ "$SETUP_ONLY" = true ]; then
  if [ "$APPS_ONLY" = true ]; then
    echo "Error: --setup cannot be combined with --apps-only." >&2
    exit 1
  fi
  start_infra
  run_migrations
  echo "Setup complete."
  exit 0
fi

if [ "$APPS_ONLY" = false ]; then
  start_infra
  if [ "$SKIP_MIGRATE" = false ]; then
    run_migrations
  fi
fi

start_apps
