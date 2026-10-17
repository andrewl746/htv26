# Report 3: morning review (written overnight, 2026-10-17 to 18)

Read this first. It covers: what to do when you wake up, what I did after report 2, the state of the design doc for your tasks, a review of the whole repo (Andrew's side and yours), and what is still open.

## 1. Do these first (in this order)

1. **Send Andrew the message** I drafted, plus: PR #2 (below) and the data release. The one thing he must know tonight's work changed: **the data files in the release were replaced** (the first version made his engine crash on every lot; see section 3). If he already downloaded the release, he needs the new files.
2. **Tiger Data sign-up (Y2)**: only you can do this (it needs a browser). Then put `TIGER_DSN` in `.env` (never commit it) and run:
   `python pipeline/tiger/ping.py && python pipeline/tiger/load.py && python pipeline/tiger/cache_trends.py`
   About 5 minutes. Then re-measure the compression numbers in `pipeline/tiger/tiger.md` and `pipeline/tiger/devpost_tiger.md` (marked [REAL]). Hour-14 go/no-go.
3. **Get `data/out/` onto the team drive** (the release is a stopgap): `suplex.gpkg` (582 MB), `permits.geojson`, `permit_counts.json`, `permits.parquet`, `data_dates.json`, `trend_cache/`. Then delete the release (`gh release delete data-2026-10-17 --repo andrewl746/htv26`).
4. **Decide on the cleanup items in section 6** (I was blocked from moving or deleting files; nothing destructive was done).
5. Send Andrew's test lots request: Y7's last step needs his A8 hand-checked lot list.

## 2. State of git

| Where | State |
|---|---|
| `main` (Andrew) | contains your first 6 commits (merged as `2123951`) and his report-folding edit to `MASTERSPEC.md` |
| `yuvi` (yours) | `main` merged in (`b4b6113`), plus 2 newer commits: report 2 (`85a16c3`) and the geometry fix, smoke test and Tiger Devpost draft (`ec17d5d`) plus this report |
| PR #1 | merged by Andrew |
| PR #2 | opened from `yuvi` for the newer commits (link in the PR list) |
| `origin/feat/pipeline` | stale (old unrelated history). Andrew's note says delete it now `yuvi` is merged: `git push origin --delete feat/pipeline` (I did not, it is a remote delete) |
| local `feat/pipeline` | stale local branch, same story: `git branch -D feat/pipeline` (blocked for me) |

## 3. What I did after report 2

- **Ran Andrew's engine on your real data** (`pipeline/smoke_engine.py`, new). First run: **500 of 500 lots errored**. Cause: 409,164 of 428,184 buildings were stored as single-part `MultiPolygon`, and `geometry.coords_rounded` in his engine cannot read multi-part geometries. Fix in `build_lots.py`: single-part geometries are unwrapped to `Polygon`; the 221 real multi-part buildings keep only their largest part; the 30 real multi-part lots stay `MultiPolygon` (his engine treats those as `unmeasurable`, correct). Rebuilt citywide, `checks.py --all` passes, release files replaced.
- Result after the fix, **whole of Ward 04 (21,300 lots, 163 s, 8 ms per lot, 0 errors):**

| Class | Lots |
|---|---|
| attached | 10,175 |
| checked | 7,062 |
| non_residential | 1,709 |
| larger_building | 1,229 |
| older_bylaw | 579 |
| unmeasurable | 460 |
| condo | 86 |

Among the 17,237 house lots (attached + checked): at least one design **fits** on 2,812 (16.3%), at least one is borderline on 3,042 (17.6%, incl. the fit cases), no design fits on 12,815 (74.3%). Wards 19, 23 and 09 (800-lot samples) also ran with no errors. **This is a plumbing test, not an accuracy test**: no lot has been hand-checked (A8).

- **Things in that output worth a look:** 59% of Ward 04 house lots are `attached` (the spec's synthetic fixture says 35.8%). Plausible for Parkdale, Junction and Roncesvalles (lots of semis and rows) but it is the number most likely to move when Andrew tunes `attached.on_lot_m2`. And 5.8% `larger_building` is driven by merged row-house polygons (`bldg_*` columns are there to fix that).
- **Validated my outputs against Andrew's schemas:** `permits.geojson` (7,342 features) passes `permit_feature.props`; all 25 `trend_cache` files pass `trend.response` and match the fixture's shape (`since: "2022-01"`, same two markers).
- `pipeline/tiger/devpost_tiger.md`: the Tiger Data Devpost paragraph and the 30-second walkthrough script (Y9), with [REAL] placeholders for the numbers that need the real service.
- `pipeline/requirements.txt` gains matplotlib (only for `overlay_map.py`).

## 4. Design doc (`MASTERSPEC.md`) status for your tasks

| Task | State now |
|---|---|
| Y1 permits rule | done (Rule A, 446 vs 452) |
| Y2 Tiger sign-up | **open, needs you** |
| Y3 permits file | done; the spec asks for Ward 04's count to be in the same range as the Toronto Multiplex Tracker's. **Not verified** (I could not read the tracker's map offline). Ward 04: 81 multiplex permits since May 2023. Open the tracker, look at Ward 04, and tell Andrew if it is far from 81 |
| Y4 dev ward build | done |
| Y5 Tiger code | done against local Docker; real-service load open (Y2) |
| Y6 citywide + Ward 23 | done (Ward 23 needed no hand-drawing, see `REPORT.md`) |
| Y7 data QA | done except the final step ("Andrew's test lots pass on the citywide file"), which needs his A8 list |
| Y8 trees | done (688,335 points) |
| Y9 refresh and Tiger material | refresh script and Devpost draft done; the actual Hour-24 re-run and the real-service walkthrough are open |
| Y10 checkpoints | outputs are in `pipeline/REPORT.md` and report 2; paste into `/docs/decisions.md` via Simone |
| T4, T5, T6, T11 | closed (in `REPORT.md`) |
| T7 autocomplete filter | closed from my side: `addresses.is_primary` (one per lot: land class, regular stage, lowest street number). 475,980 primary of 525,372 address points. Andrew chooses whether `/search` filters on it |
| T15 tree field names | closed: the 4326 GPKG fields are `OBJECTID, STRUCTID, ADDRESS, STREETNAME, CROSSSTREET1, CROSSSTREET2, SUFFIX, ...`; only positions are used |

**Stale in `MASTERSPEC.md` section 0** (Andrew's file, I did not edit it): Y8 and Y9 say "not started" (they are done); the Y4/Y6 row says 507 MB / 193 s (now 582 MB / 211 s with the extra columns and trees); the decision-9 text still says "1 to 6 units" in section 1; `.env.example` has `GEMINI_MODEL=gemini-3.8-flash` but decision 12 says `gemini-3.5-flash-lite` (his file, Simone's decision); and the fixtures still say `1-6` in `permit_rule` (he knows).

## 5. Repo review

**What exists on `main` (102 files)**

| Area | Owner | State |
|---|---|---|
| `contracts/` | Andrew | 13 schemas, `types.ts`, `designs.json`, `engine_config.json`, 15 fixtures, copy v0, `tiger/schema.sql`. `python contracts/validate.py`: 35 ok, 0 failed |
| `engine/` | Andrew | 1,545 lines, 105 tests, all pass in 0.5 s. `run_check` works on real data (section 3) |
| `pipeline/` | you | 17 files + reports; everything above |
| `web/` | Jayden | Vite + React 19 scaffold; `App.tsx` renders a heading. Nothing else. I did not build it (your local `node_modules` is stale from the old simulation, so a build there would say nothing) |
| `api/` | Andrew | **does not exist yet** (A7). The loader he needs is the part of `smoke_engine.py` that builds a `LotInput` from the GPKG; copy it |
| `ai/` | Simone | empty (`.gitkeep`); she pushes the morning of the 18th |
| `scripts/`, `pitch/`, `docs/mockups/` | | empty |
| `docs/decisions.md` | Simone/Andrew | Andrew's 11 decisions; none of yours yet (give Simone `REPORT.md`) |

**Observations**

1. **The critical path is now Andrew's A7 API**, then Jayden's UI. Your data is ready and verified against his engine; he is the bottleneck, not you.
2. **Two file-format notes for A7:** (a) `lots` is mixed `Polygon`/`MultiPolygon` (pyogrio promotes a whole ward batch to Multi when it has one multi-part lot): unwrap single-part multis when loading (`geom.geoms[0]` when `len == 1`); his engine already tolerates it for lots. (b) `parcelid` and `address_point_id` are integers in the file, but `LotInput.lot_id` and `BuildingInput.parcelid` are strings: cast with `str()`.
3. **Corridors are derived** (no CORRIDOR parcels exist). His 5.2 street-edge test works on them (the smoke test classified 460 of 21,300 Ward 04 lots `unmeasurable`, 2.2%); if that number looks too high in A8, the first suspect is the derived corridors near water and rail.
4. **The data does not live in git** (correct per spec) and **the team drive does not exist for me**; the release is a stopgap. If Andrew can't download 241 MB comfortably, he can rebuild in about 4 minutes with `python pipeline/refresh.py --skip-download` after one `download.py --all --with-trees` (about 1.2 GB of downloads).
5. **Risks:** Tiger Data is still local-only (Hour 14 go/no-go, cut-list item 1, cheap to cut because the cache fallback works); the `attached` rate (59%) and `larger_building` rate need A8 hand-checks before any number goes in the pitch; nothing in `web/`, `api/`, `ai/` can be demoed yet.
6. **Licence/attribution:** every dataset is City of Toronto Open Data; the Toronto Multiplex Tracker's rule is credited in `docs/devpost.md` per section 0 (Simone's draft). The TRCA layer comes from an ArcGIS FeatureServer, not a City dataset.

## 6. Cleanup: done, and what needs your decision

Done: merged `main` into `yuvi`; rebuilt data; stopped nothing else.

**Blocked (the auto-mode classifier refused any move or delete of untracked local files; nothing was touched):** your working folder still has leftovers from the original pre-repo simulation that are **not in git**, plus my own logs. None of it affects the repo. To tidy it yourself:

```bash
cd /Users/yuvi/Documents/htv/suplex
mkdir -p ../suplex_old_simulation && mv "Suplex Masterspec.md" masterspec-prompt-v2.md docs/MASTERSPEC.md \
  scripts/requirements.txt scripts/sim_stage1_hexes.py scripts/sim_stage2_fill.ts web/public web/scripts \
  web/src/ai web/src/components web/src/engine web/src/lib web/src/sim web/src/styles.css web/vercel.json \
  web/dist data/stage data/raw/city-wards-4326.geojson ../suplex_old_simulation/
mkdir -p data/out/logs && mv data/out/y*.txt data/out/build_all.log data/out/logs/
git branch -D feat/pipeline                      # stale local branch
docker stop suplex-tiger-dev                     # local Tiger test container (data is reloadable)
# optional: cd web && rm -rf node_modules && npm install   (node_modules is from the old simulation)
```

Untracked but not mine: `.claude/` and `skills-lock.json` (the agentation skill, from your earlier session); left alone.

## 7. Still open (everything that is not done)

| Item | Who |
|---|---|
| Tiger Data sign-up, load, re-measured numbers, real walkthrough (Y2, Y5, Y9) | you |
| Ward 04 count vs the Toronto Multiplex Tracker map | you (5 minutes) |
| Y7's last check against Andrew's A8 test lots | Andrew sends, I run |
| Data onto the team drive | you |
| Delete `origin/feat/pipeline` and the data release when done | you |
| Paste `REPORT.md` / report 2 / this report's checkpoint output into `/docs/decisions.md` | Simone |
