# Suplex web app

The address check (3D street, result panel, next steps), the ward map and the lot-to-ward transition
(MASTERSPEC section 6). React, TypeScript and Vite; three.js through react-three-fiber; MapLibre on
OpenFreeMap tiles; zustand. Types come from `../contracts/types.ts` and every user-facing string from
`../contracts/copy`.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # type check and production build; run before every PR
npx oxlint         # lint
npm run preview    # serve the build, as on the demo laptop
```

## Where the data comes from

| Variable | Default | What it does |
|---|---|---|
| `VITE_API_BASE` | unset | The live API. Unset or empty serves `../contracts/fixtures` with a "Sample data" banner. In dev, `/api` goes through the Vite proxy to `http://127.0.0.1:8000`. |
| `VITE_AI_BASE` | `/ai` when the API is set | The AI service for `POST /explain` (the dev proxy sends `/ai` to `http://127.0.0.1:8001`). When it is down, slow or failing, the web writes the plain template itself. |

For local work against the real API, put `VITE_API_BASE=/api` in `web/.env.local` (git-ignored) and
start the API from the repo root:

```sh
SUPLEX_DATA_DIR=data/out SUPLEX_GPKG=data/out/suplex_citywide.gpkg uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Use `127.0.0.1`, not `localhost`: on Windows `localhost` costs about 2 s per new connection.

## The demo cache (MASTERSPEC 6.7)

`public/demo-cache/` holds full API answers for the demo addresses and the demo ward. It is
git-ignored; `python -m api.cache_demo` writes it to `data/out/demo-cache/` at the Hour-24 lock
(`scripts/hour24.ps1`), and it is copied in by hand, again at Hour 30:

```sh
cp -r ../data/out/demo-cache/. public/demo-cache/      # PowerShell: Copy-Item ..\data\out\demo-cache\* public\demo-cache\
```

Every API call gives up after 3 s (15 s for a ward's lot file). On a timeout, a network error or a
server error, the same request is answered from the cache when a file there matches it, and a
"Cached result" badge shows. "Not found" and "outside Toronto" are real answers and are never
replaced. File names follow `api/demo_cache.py`: `search.<query>.json`, `check.<address_id>.json`,
`check.lot.<lot_id>.json`, `ward.<id>.json`, `trend.<id>.json`, `lots.<id>.geojson`,
`permits.geojson`.

## URL parameters

| Parameter | Effect |
|---|---|
| `?a=<address_id>` | Opens that address check. |
| `?lot=<lot_id>` | A lot opened from the ward map that has no address. |
| `&ward=04` | The ward view (on its own, the ward map without a searched lot). |
| `&view=2d` (or `view=plan`) | The plan view from above, with the same result panel. |
| `?demo=1` | Answers from `public/demo-cache/` first and never calls the AI service (the offline rehearsal). |
| `?look=classic` | The 3D scene's earlier look (Andrew's fallback). |
| `?stats=1` | Dev only: the 3D frame rate. |

Without WebGL, or when the 3D scene or a map crashes, the app keeps running on the plan view: the
search, the result panel and the lot drawn from above, without the maps.

## Who owns what

`src/components/Lot3D/` is Andrew's, `src/components/WardMap/` Yuvi's (its `TrendChart.tsx` is
Simone's) and `src/components/ResultPanel/NextSteps.tsx` Yuvi's; the rest of `web/` is Jayden's.
