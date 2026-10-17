# Suplex: rules for every Claude Code session in this repo

Suplex is a 36-hour Hack the Valley 11 project for the Hack the Valley × School of Cities
challenge. It checks any Toronto address against the City's four free pre-approved multiplex
designs in an animated 3D view, compares lots where a design may fit ("could") with multiplex
permits issued since May 2023 ("did") on a ward map, and writes a plain-language ward briefing.
MASTERSPEC.md is the source of truth. Read section 0 (status: what is done, what is next) and then the
sections it assigns to your owner before coding. Repo: https://github.com/andrewl746/htv26

## Who owns what (edit only your own folders)

- Andrew: /contracts, /engine, /api, root files (CLAUDE.md, README.md merges, .gitignore,
  requirements.txt, scripts/). Works on main. Only Andrew merges into main.
- Yuvi: /pipeline (including /pipeline/tiger). Branch yuvi.
- Jayden: /web. Branch jayden.
- Simone: /ai, /docs, /pitch and contracts/copy/*.json. Branch simone.

Approved exceptions (2026-10-17, MASTERSPEC 0.3 and 8.5); each file has exactly one owner:
- Andrew also owns web/src/components/Lot3D/ (the 3D scene, taken over from Jayden).
- Yuvi also owns web/src/components/WardMap/ (except TrendChart.tsx) and the next-steps files:
  engine/suplex_engine/next_steps.py, engine/tests/test_next_steps.py,
  contracts/copy/next_steps.json and web/src/components/ResultPanel/NextSteps.tsx.
- Simone also owns web/src/components/WardMap/TrendChart.tsx.
- Jayden owns the rest of /web (all UI that is not 3D): he wires WardMap into App.tsx and
  mounts NextSteps.tsx.

Never edit outside your folder. If you need a change elsewhere, stop and tell the owner.
Every change reaches main through a pull request to Andrew. Never merge your own PR.
Contract changes (anything in /contracts except contracts/copy) go through Andrew, who changes
the schema, types.ts and the fixture together. Build against /contracts/fixtures first.

## Non-negotiable product rules

- Code decides fit. AI never decides fit. The AI only phrases numbers the engine produced, as
  {{placeholders}}, and nothing reaches a user without passing the validator in /ai/validator.py.
- Every result shows "Screening only, not a permit or legal advice."
- No candidate names, parties or positions anywhere. No "best ward", "worst ward" or rankings.
- No addresses on the ward map. No list, export or download of lots, anywhere.
- Neutral wording: never "threat" or "opportunity"; say "may fit", never "will be built".
- Counts of lots that may fit are upper bounds and are labelled that way.
- Every rule in the engine carries its Toronto Zoning By-law 569-2013 section string.
- The uncertainty band (0.5 m, 2 percentage points) and every threshold live in
  /contracts/engine_config.json. No magic numbers in code.
- All distance and area maths in metres in EPSG:2952. The web gets EPSG:4326 and local metres.
- The address check (/check) never calls Tiger Data or Gemini.

## Contracts

/contracts/schemas/*.schema.json, /contracts/types.ts, designs.json, engine_config.json,
design-tokens.css, copy/*.json, tiger/schema.sql, fixtures/. Run `python contracts/validate.py`
after touching any of them. Enumerations (exact strings): Result = fits | borderline | no_fit |
not_checked; DesignId = fourplex_narrow | fourplex_wide | sixplex_narrow | sixplex_wide;
LotClass = condo | non_residential | older_bylaw | larger_building | unmeasurable | attached |
checked; RuleId = detached_building | units_allowed | lot_width | lot_depth | building_length |
height | lot_coverage; WardId = "01".."25".

## Run commands (from the repo root)

- Python env (once): `python -m venv .venv` then activate, then `pip install -r requirements.txt`
- Engine tests: `pytest engine`
- API: `uvicorn api.main:app --reload --port 8000` (needs SUPLEX_DATA_DIR pointing at data/out)
- Batch run: `python -m suplex_engine.batch --ward 04` or `--all`
- Pipeline: `python pipeline/download.py --all`, `python pipeline/permits.py`,
  `python pipeline/build_lots.py --ward 04`, `python pipeline/checks.py --ward 04`
- Tiger Data: `python pipeline/tiger/load.py`, `python pipeline/tiger/cache_trends.py`
- AI service: `uvicorn ai.main:app --reload --port 8001` (needs GEMINI_API_KEY)
- AI tests: `pytest ai/tests`
- Web: `cd web && npm install && npm run dev` (port 5173); `npm run build` before every PR
- Everything for the demo: `scripts/demo.sh` or `scripts/demo.ps1`
- Integration check before a merge: `scripts/check.sh`

## Coding conventions

- Python 3.12 or 3.13, type hints, dataclasses or Pydantic models that mirror the contracts,
  `ruff` defaults, no notebooks committed. Tests with pytest next to the code they test.
- TypeScript strict; types imported from @contracts/types, never redefined; plain CSS with the
  tokens from /contracts/design-tokens.css; no UI framework.
- Fit or fail is never shown by colour alone: icon plus text, stripes and dots on the map.
- Every user-facing string comes from contracts/copy/*.json or /ai/prompts, not from code.
- Commit after each working increment: `area: what changed`. Push at least hourly.
- Never commit data/, .env, caches or anything over 5 MB. Share data through the team drive.
- When something in the spec is wrong or impossible, write the decision in /docs/decisions.md
  (through Simone, who owns /docs) and tell Andrew. Do not silently work around it.
