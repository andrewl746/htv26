#!/usr/bin/env bash
# Starts the whole demo on this laptop (MASTERSPEC 8.1 A13): the API, the AI service and vite preview.
# Run it from anywhere; it works from the repo root. Ctrl+C stops all three. scripts/demo.ps1 is the same for
# Windows PowerShell; see it for the details.
#
#   scripts/demo.sh                                   # the locked data
#   scripts/demo.sh --demo-cache                      # SUPLEX_DEMO_CACHE=1: the cached addresses and Ward 04
#   scripts/demo.sh --gpkg data/out/suplex_ward04.gpkg
#   scripts/demo.sh --no-build                        # serve web/dist as it is
#
# API on 127.0.0.1:8000 (SUPLEX_DATA_DIR=data/out, SUPLEX_GPKG=--gpkg, default data/out/suplex.gpkg; with
# --demo-cache and no GeoPackage it starts cache-only), the AI service on 127.0.0.1:8001, the web built with
# VITE_API_BASE=/api and served by vite preview on 127.0.0.1:4173 (it proxies /api and /ai). 127.0.0.1, never
# localhost. Keys in .env that are not set yet are loaded first; no value is ever printed. Logs: data/logs/demo/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT/data/out"
GPKG=""
DEMO_CACHE=0
BUILD=1
PYTHON="${PYTHON:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --demo-cache) DEMO_CACHE=1 ;;
    --gpkg) GPKG="$2"; shift ;;
    --no-build) BUILD=0 ;;
    --python) PYTHON="$2"; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown option: $1 (--demo-cache, --gpkg FILE, --no-build, --python EXE)" >&2; exit 2 ;;
  esac
  shift
done
cd "$ROOT"
case "$GPKG" in
  "") GPKG="$DATA_DIR/suplex.gpkg" ;;
  /*|[A-Za-z]:*) ;;
  *) GPKG="$ROOT/$GPKG" ;;
esac
if [ -z "$PYTHON" ]; then
  for p in .venv/Scripts/python.exe .venv/bin/python; do [ -x "$p" ] && PYTHON="$ROOT/$p" && break; done
  PYTHON="${PYTHON:-python3}"
fi
API_URL="http://127.0.0.1:8000"
AI_URL="http://127.0.0.1:8001"
WEB_URL="http://127.0.0.1:4173"
LOG_DIR="$ROOT/data/logs/demo"

die() { echo "!! $*" >&2; exit 1; }

if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"; key="${key//[[:space:]]/}"
    value="${line#*=}"; value="$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^[\"']//" -e "s/[\"']\$//")"
    [ -n "$key" ] && [ -z "${!key:-}" ] && export "$key=$value"
  done < .env
fi
export SUPLEX_DATA_DIR="$DATA_DIR" SUPLEX_AI_URL="$AI_URL" SUPLEX_API_URL="$API_URL"
# The app links in the AI explanations and briefings; part of the AI cache keys, so it matches the pre-generated cache.
export SUPLEX_WEB_URL="$WEB_URL"
if [ "$DEMO_CACHE" = 1 ]; then export SUPLEX_DEMO_CACHE=1; else unset SUPLEX_DEMO_CACHE; fi
if [ -f "$GPKG" ]; then
  export SUPLEX_GPKG="$GPKG"
elif [ "$DEMO_CACHE" = 1 ]; then
  unset SUPLEX_GPKG
  echo "  note: no GeoPackage at $GPKG, so the API starts cache-only"
else
  die "GeoPackage not found: $GPKG (--gpkg to choose, or --demo-cache to run on the cache alone)"
fi

echo "Suplex demo, $(date '+%Y-%m-%d %H:%M')"
echo "  data        $DATA_DIR"
echo "  GeoPackage  ${SUPLEX_GPKG:-none (cache-only)}"
echo "  demo cache  $([ "$DEMO_CACHE" = 1 ] && echo 'on (SUPLEX_DEMO_CACHE=1)' || echo off)"
echo "  TIGER_DSN   $([ -n "${TIGER_DSN:-}" ] && echo set || echo 'not set: the trend comes from the trend cache')"
echo "  GEMINI      $([ -n "${GEMINI_API_KEY:-}" ] && echo 'key set' || echo 'no key: cached and template text only')"

for port in 8000 8001 4173; do
  if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$port/"; then die "port $port is already in use; stop whatever is on it first"; fi
done
[ -f web/node_modules/vite/bin/vite.js ] || die "web/node_modules is missing: run npm install in web/ once"
if [ "$BUILD" = 1 ]; then
  echo; echo "== building the web with VITE_API_BASE=/api"
  (cd web && VITE_API_BASE=/api npm run build) || die "npm run build failed"
elif [ ! -f web/dist/index.html ]; then
  die "web/dist is missing: run without --no-build"
fi

mkdir -p "$LOG_DIR"
PIDS=()
cleanup() { for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT
trap 'exit 130' INT TERM

echo; echo "== starting the API, the AI service and vite preview (logs in $LOG_DIR)"
"$PYTHON" -m uvicorn api.main:app --host 127.0.0.1 --port 8000 >"$LOG_DIR/api.log" 2>&1 & PIDS+=($!)
"$PYTHON" -m uvicorn ai.main:app --host 127.0.0.1 --port 8001 >"$LOG_DIR/ai.log" 2>&1 & PIDS+=($!)
(cd web && exec node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort) \
  >"$LOG_DIR/web.log" 2>&1 & PIDS+=($!)

# wait_http NAME URL PID SECONDS LOG: until URL answers 200, or the process exits, or time runs out.
wait_http() {
  local deadline=$((SECONDS + $4))
  while [ $SECONDS -lt $deadline ]; do
    kill -0 "$3" 2>/dev/null || die "$1 exited before it answered; see $5"
    curl -sf --max-time 2 "$2" && return 0
    sleep 0.5
  done
  die "$1 did not answer $2 within $4 s; see $5"
}
health="$(wait_http API "$API_URL/health" "${PIDS[0]}" 180 "$LOG_DIR/api.log")"
echo "   API ready: $(echo "$health" | "$PYTHON" -c "import json,sys; h=json.load(sys.stdin); print(f\"{h['lot_count']:,} lots, {h['ward_count']} wards\" if h['mode']=='data' else h['mode'], '- demo cache', h['demo_cache'])")"
wait_http "AI service" "$AI_URL/health" "${PIDS[1]}" 60 "$LOG_DIR/ai.log" >/dev/null; echo "   AI service ready"
wait_http Web "$WEB_URL/" "${PIDS[2]}" 60 "$LOG_DIR/web.log" >/dev/null; echo "   web ready"

echo
echo "== Suplex is running. Ctrl+C stops all three."
echo "  App        $WEB_URL"
echo "  API        $API_URL/health"
echo "  AI         $AI_URL/health"
echo "  Briefing   $AI_URL/b/04"
echo "  Logs       $LOG_DIR"
while true; do
  for i in 0 1 2; do
    kill -0 "${PIDS[$i]}" 2>/dev/null || die "$(echo "API|AI service|Web" | cut -d'|' -f$((i + 1))) stopped; see $LOG_DIR. Stopping the rest."
  done
  sleep 1
done
