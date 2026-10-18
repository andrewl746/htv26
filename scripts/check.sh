#!/usr/bin/env bash
# The integration check before every merge into main (MASTERSPEC 8.1 A12, CLAUDE.md). From anywhere:
#
#   scripts/check.sh
#
#   1. python contracts/validate.py          the schemas, types and fixtures agree
#   2. pytest engine api ai/tests            (the API's data tests skip without a GeoPackage)
#   3. the API starts and /health answers    on 127.0.0.1:$CHECK_PORT (default 8765, so a running demo on
#                                            8000 is untouched), on SUPLEX_DATA_DIR (default data/out) and
#                                            SUPLEX_GPKG (default data/out/suplex.gpkg); without a GeoPackage
#                                            it starts cache-only (SUPLEX_DEMO_CACHE=1)
#   4. npm run build in web/                 tsc and vite
#
# Every step runs even after a failure; the summary lists them and the exit code is the number that failed.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PYTHON="${PYTHON:-}"
if [ -z "$PYTHON" ]; then
  for p in .venv/Scripts/python.exe .venv/bin/python; do [ -x "$p" ] && PYTHON="$ROOT/$p" && break; done
  PYTHON="${PYTHON:-python3}"
fi
PORT="${CHECK_PORT:-8765}"
export SUPLEX_DATA_DIR="${SUPLEX_DATA_DIR:-$ROOT/data/out}"
GPKG="${SUPLEX_GPKG:-$SUPLEX_DATA_DIR/suplex.gpkg}"
LOG_DIR="$ROOT/data/logs/check"
mkdir -p "$LOG_DIR"

RESULTS=()
FAILED=0
step() {  # step NAME COMMAND...: runs it, records ok or FAIL
  local name="$1"; shift
  echo; echo "== $name"
  local t0=$SECONDS
  if "$@"; then RESULTS+=("ok    $name ($((SECONDS - t0)) s)")
  else RESULTS+=("FAIL  $name ($((SECONDS - t0)) s)"); FAILED=$((FAILED + 1)); fi
}

api_health() {
  local log="$LOG_DIR/api.log" mode
  if [ -f "$GPKG" ]; then
    mode="data, $GPKG"
    SUPLEX_GPKG="$GPKG" "$PYTHON" -m uvicorn api.main:app --host 127.0.0.1 --port "$PORT" >"$log" 2>&1 &
  else
    mode="cache-only, no GeoPackage at $GPKG"
    env -u SUPLEX_GPKG SUPLEX_DEMO_CACHE=1 "$PYTHON" -m uvicorn api.main:app --host 127.0.0.1 --port "$PORT" \
      >"$log" 2>&1 &
  fi
  local pid=$! deadline=$((SECONDS + 180)) body=""
  echo "   starting the API on 127.0.0.1:$PORT ($mode)"
  while [ $SECONDS -lt $deadline ]; do
    if ! kill -0 "$pid" 2>/dev/null; then echo "   the API exited before it answered; see $log"; tail -n 15 "$log"; return 1; fi
    body="$(curl -sf --max-time 2 "http://127.0.0.1:$PORT/health")" && break
    sleep 0.5
  done
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  if [ -z "$body" ]; then echo "   /health did not answer within 180 s; see $log"; return 1; fi
  echo "   /health: $body" | cut -c1-300
  echo "$body" | "$PYTHON" -c "import json, sys; sys.exit(json.load(sys.stdin).get('status') != 'ok')"
}

step "contracts: validate.py" "$PYTHON" contracts/validate.py
step "tests: pytest engine api ai/tests" "$PYTHON" -m pytest engine api ai/tests -q -p no:cacheprovider
step "API: starts and /health answers" api_health
step "web: npm run build" bash -c 'cd web && npm run build'

echo; echo "== summary"
printf '  %s\n' "${RESULTS[@]}"
if [ "$FAILED" -eq 0 ]; then echo "all checks pass"; else echo "$FAILED check(s) failed"; fi
exit "$FAILED"
