#!/usr/bin/env bash
# The Hour-24 headline lock (MASTERSPEC 0.3, 8.1 A11), in order, stopping at the first failing step.
#
# Run it from the repo root on the machine with the citywide data. The refresh takes a few minutes and the
# batch about 21:
#
#     scripts/hour24.sh                      # the whole lock
#     scripts/hour24.sh --dry-run            # the plan and the refresh's preflight; changes nothing
#     scripts/hour24.sh --from 2             # resume at the batch after a failure
#     scripts/hour24.sh --from 2 --gpkg data/out/suplex_citywide.gpkg   # lock on an older citywide file
#
#   1. python pipeline/refresh.py --tiger     Yuvi's refresh: City data, permits, the citywide build into
#                                             data/out/suplex.gpkg, Tiger Data and its trend cache, the checks
#   2. python -m suplex_engine.batch --all    ward_summary.json, wards/*.geojson, batch_report.md
#   3. python -m api.cache_demo               api/cache/ and data/out/demo-cache/
#   4. the reminders for the steps done by hand
#
# Steps 2 and 3 get SUPLEX_DATA_DIR=data/out and SUPLEX_GPKG=--gpkg (default data/out/suplex.gpkg, the file step 1
# rebuilds; a SUPLEX_GPKG already in the environment is overridden, so an old file is never locked by accident).
# Keys in .env that are not set yet (TIGER_DSN) are loaded first, so the batch counts permits from Tiger Data;
# no value is ever printed. --dry-run changes nothing. scripts/hour24.ps1 is the same for PowerShell.
set -euo pipefail

usage() { sed -n '2,22s/^# \{0,1\}//p' "${BASH_SOURCE[0]}"; }

FROM=1 GPKG="" PY="" DRY_RUN=0
while (($#)); do
  case $1 in
    --from) FROM=${2:-}; shift 2 || { usage >&2; exit 2; } ;;
    --gpkg) GPKG=${2:-}; shift 2 || { usage >&2; exit 2; } ;;
    --python) PY=${2:-}; shift 2 || { usage >&2; exit 2; } ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "hour24.sh: unknown option $1" >&2; usage >&2; exit 2 ;;
  esac
done
[[ $FROM =~ ^[123]$ ]] || { echo "hour24.sh: --from must be 1, 2 or 3" >&2; exit 2; }

# The repo root as Python sees it: Git Bash's pwd -W gives C:/... (a /c/... path in an environment variable
# would not reach a Windows Python intact); elsewhere plain pwd.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && { pwd -W 2>/dev/null || pwd; })
cd "$ROOT"
DATA_DIR=$ROOT/data/out
REBUILT=$DATA_DIR/suplex.gpkg                       # what step 1 writes (pipeline/build_lots.py --out)
if [[ -z $GPKG ]]; then
  GPKG=$REBUILT
elif command -v cygpath >/dev/null 2>&1; then
  GPKG=$(cygpath -m -a "$GPKG")
elif [[ $GPKG != /* ]]; then
  GPKG=$ROOT/$GPKG
fi
if [[ -z $PY ]]; then
  if [[ -x $ROOT/.venv/Scripts/python.exe ]]; then PY=$ROOT/.venv/Scripts/python.exe
  elif [[ -x $ROOT/.venv/bin/python ]]; then PY=$ROOT/.venv/bin/python
  elif command -v python3 >/dev/null 2>&1; then PY=python3
  else PY=python
  fi
fi

# .env: KEY=VALUE lines, blank lines and # comments skipped, quotes around the value dropped, keys already set kept.
if [[ -f $ROOT/.env ]]; then
  while IFS= read -r line || [[ -n $line ]]; do
    line=${line%$'\r'}
    [[ $line =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]] || continue
    key=${BASH_REMATCH[1]} value=${BASH_REMATCH[2]}
    value=${value#"${value%%[![:space:]]*}"} value=${value%"${value##*[![:space:]]}"}
    value=${value#\"} value=${value%\"} value=${value#\'} value=${value%\'}
    [[ -n ${!key:-} ]] || export "$key=$value"
  done < "$ROOT/.env"
fi
INHERITED=${SUPLEX_GPKG:-}
export SUPLEX_DATA_DIR=$DATA_DIR SUPLEX_GPKG=$GPKG

echo "Hour-24 headline lock, $(date '+%Y-%m-%d %H:%M')$( ((DRY_RUN)) && echo ', dry run: nothing is changed')"
echo "  repo        $ROOT"
echo "  python      $PY"
echo "  data        $DATA_DIR"
echo "  GeoPackage  $GPKG (steps 2 and 3)"
echo "  TIGER_DSN   $([[ -n ${TIGER_DSN:-} ]] && echo set || echo 'NOT set: the batch will count permits from permit_counts.json')"
[[ -z $INHERITED || $INHERITED == "$GPKG" ]] ||
  echo "  note: SUPLEX_GPKG was $INHERITED in this shell; this run uses the file above (--gpkg to choose)"
((FROM > 1)) || [[ $GPKG == "$REBUILT" ]] || echo "  note: step 1 rebuilds $REBUILT, but steps 2 and 3 read $GPKG"

STEPS=(
  "pipeline/refresh.py --tiger|Yuvi's refresh (City data, permits, citywide build, Tiger Data, trend cache, checks)"
  "-m suplex_engine.batch --all|the citywide batch (about 21 minutes)"
  "-m api.cache_demo|the demo cache for Ward 04 and the three addresses"
)

if ((DRY_RUN)); then
  echo; echo "The real run would do, in order:"
  for i in "${!STEPS[@]}"; do
    n=$((i + 1)) args=${STEPS[i]%%|*} label=${STEPS[i]#*|}
    if ((n < FROM)); then mark=skip; else mark="  $n."; fi
    echo "  $mark python $args    -- $label"
  done
  if ((FROM >= 2)) && [[ ! -f $GPKG ]]; then echo "  [FIX] GeoPackage not found: $GPKG" >&2; exit 1; fi
  if ((FROM <= 1)); then
    echo; echo "\$ python pipeline/refresh.py --dry-run --tiger"
    exec "$PY" pipeline/refresh.py --dry-run --tiger
  fi
  exit 0
fi

STARTED=$SECONDS
for i in "${!STEPS[@]}"; do
  n=$((i + 1)) args=${STEPS[i]%%|*} label=${STEPS[i]#*|}
  if ((n < FROM)); then echo; echo "== step $n skipped (--from $FROM): python $args"; continue; fi
  if ((n >= 2)) && [[ ! -f $GPKG ]]; then echo "!! step $n: GeoPackage not found: $GPKG (--gpkg to choose)" >&2; exit 1; fi
  if ((n == (FROM > 2 ? FROM : 2))); then echo; echo "   GeoPackage: $(ls -lh "$GPKG")"; fi
  echo; echo "== step $n of 3, $(date +%H:%M:%S): $label"; echo "\$ python $args"
  t0=$SECONDS code=0
  read -ra argv <<< "$args"
  "$PY" "${argv[@]}" || code=$?
  if ((code != 0)); then
    echo "!! step $n failed (exit $code) after $((SECONDS - t0)) s: python $args" >&2
    echo "!! nothing after it ran. Fix it, then resume with: scripts/hour24.sh --from $n" >&2
    exit "$code"
  fi
  echo "== step $n done in $((SECONDS - t0)) s"
done

# The addresses are api/cache_demo.py's ADDRESSES; keep them in step.
cat <<EOF

== headline locked in $(( (SECONDS - STARTED) / 60 )) min. Now, by hand:
  1. Andrew: tag main headline-locked (git tag headline-locked && git push origin headline-locked)
     and put the data/out snapshot on the drive.
  2. Simone: the AI pre-generation, with the API running on this data (SUPLEX_API_URL, default
     http://localhost:8000), Ward 04 in English and French first (MASTERSPEC 7.9):
       python -m ai.pregenerate --ward 04 --langs all --address-id 7986858 --address-id 7955411 --address-id 9085619
  3. Jayden: copy data/out/demo-cache/ into web/public/demo-cache/ (again at Hour 30).
EOF
