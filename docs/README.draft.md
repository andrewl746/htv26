# Suplex

*Before you build, before you vote.* A Hack the Valley 11 project for the Hack the Valley × School of Cities challenge.

Suplex checks any Toronto address against the City's four free pre-approved multiplex designs and shows the result in 3D, compares the lots in your ward where a design may fit ("could") with the multiplex permits actually issued since May 2023 ("did"), and writes a plain-language ward briefing in eight languages.

**Screening only, not a permit or legal advice.** Counts of lots where a design may fit are upper bounds.

## What it does

- **Address check:** the street builds itself in 3D and each of the four designs gets a result (Fits, Too close to call, Doesn't fit, Not checked) with the rule, the margin and its Zoning By-law 569-2013 section.
- **Permission vs. reality:** a ward map of lots where a free design may fit, next to multiplex permits issued since May 2023, with a monthly trend from Tiger Data. No addresses on the map, no list of lots, no rankings.
- **Ward briefing:** a shareable page written by Gemini from the engine's numbers only; every number links to its source, and a validator rejects any number the engine didn't produce.

## How it's built

| Part | Folder | Stack |
|---|---|---|
| Data pipeline | `pipeline/` | Python, GeoPandas; City of Toronto open data → one GeoPackage (EPSG:2952) |
| Rules engine | `engine/` | Python, Shapely; one engine for the live check and the citywide batch run |
| API | `api/` | FastAPI, port 8000 |
| Web app | `web/` | React, TypeScript, Vite, react-three-fiber, MapLibre GL + OpenFreeMap |
| AI service and briefing page | `ai/` | FastAPI, Gemini (structured output), port 8001 |
| Trend data | `pipeline/tiger/` | Tiger Data (TimescaleDB) hypertable and continuous aggregate |
| Shared contracts | `contracts/` | JSON Schemas, TypeScript types, fixtures, copy |

## Run it

```
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # macOS/Linux: cp; then fill in GEMINI_API_KEY (and TIGER_DSN if you have one)
python contracts/validate.py
```

| What | Command |
|---|---|
| Engine tests | `pytest engine` |
| AI tests (no API key needed) | `pytest ai/tests` |
| API | `uvicorn api.main:app --port 8000` (needs `SUPLEX_DATA_DIR`) |
| AI service | `uvicorn ai.main:app --port 8001` |
| Web app | `cd web && npm install && npm run dev` (port 5173) |
| Ward briefing page | http://localhost:8001/b/04?lang=en (add `&fixture=1` for the sample data) |
| Fill the AI cache for the demo | `python -m ai.pregenerate --ward 04 --langs all` |
| Everything for the demo | `scripts/demo.ps1` or `scripts/demo.sh` |

The processed data (`data/out/`) is not in git; it is rebuilt with the pipeline commands in `CLAUDE.md`.

## Data

All City of Toronto Open Data unless noted: [Address Points](https://open.toronto.ca/dataset/address-points-municipal-toronto-one-address-repository/), [Property Boundaries](https://open.toronto.ca/dataset/property-boundaries/), [Zoning By-law](https://open.toronto.ca/dataset/zoning-by-law/), [Building Permits – Active](https://open.toronto.ca/dataset/building-permits-active-permits/) and [Cleared](https://open.toronto.ca/dataset/building-permits-cleared-permits/), [3D Massing](https://open.toronto.ca/dataset/3d-massing/), [City Wards](https://open.toronto.ca/dataset/city-wards/), [Heritage Register](https://open.toronto.ca/dataset/heritage-register/), [Heritage Conservation Districts](https://open.toronto.ca/dataset/heritage-conservation-districts/), [Ravine and Natural Feature Protection](https://open.toronto.ca/dataset/ravine-natural-feature-protection-area/), [Street Trees](https://open.toronto.ca/dataset/street-tree-data/), the [pre-approved multiplex plans](https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-building-plans/pre-approved-multiplex-building-plans/), and the [TRCA Regulated Area](https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/ArcGIS/rest/services/TRCA_Regulation_Limit2/FeatureServer).

## Credits

The permit rule follows the [Toronto Multiplex Tracker](https://malcolmkennedy.com/to-multiplex-map/) ([GitHub](https://github.com/zuzubak/to-multiplex-map)). Built by `[team names]` at Hack the Valley 11.

## Limitations

Lot lines are not survey-accurate (results within 0.5 m, or 2 percentage points of coverage, read "Too close to call"); site-specific exceptions, heritage, trees, sewers and several other rules are not checked (the full list is on every result); permit counts are gross. See [`docs/devpost.md`](docs/devpost.md).
