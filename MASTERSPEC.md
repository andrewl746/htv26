# Suplex masterspec, version 3 (status board updated 2026-10-17 23:41, see section 0)

**Hack the Valley 11 · Hack the Valley × School of Cities challenge · 4 people · about 36 hours**

This is the single source of truth for the Suplex team. Shared sections (1 to 7 and 9 to 14) apply to everyone. Each person builds from their own section in 8 on their own branch, in their own Claude Code session, and Andrew merges. Deep detail lives in the appendices. Written 2026-10-17 from the version 3 prompt; everything the prompt treated as given is treated as given here, and the items it marked VERIFY were checked where that could be done online (Appendix H lists exactly what was checked and what was not).

**How to read this document**

- Everyone: sections 1, 2, 3 (skim the schemas), 9, 10, 11 and the copy rules in 2.5.
- Then your own section in 8, and the appendices it points to.
- Section 13 is the open list; if you resolve an item, write the answer in `/docs/decisions.md` and tell Andrew.

## Contents

- [0. Status board (updated 2026-10-17, 23:41, about Hour 25.5 of 36)](#0-status-board-updated-2026-10-17-2341-about-hour-255-of-36)
  - [0.1 How far along we are](#01-how-far-along-we-are)
  - [0.2 Status by person](#02-status-by-person)
  - [0.3 Critical path and the approved re-plan](#03-critical-path-and-the-approved-re-plan)
  - [0.4 Web app review (Jayden's branch, all 16 commits, 2026-10-17)](#04-web-app-review-jaydens-branch-all-16-commits-2026-10-17)
  - [0.5 Decisions since version 3 (each one changed the section in brackets)](#05-decisions-since-version-3-each-one-changed-the-section-in-brackets)
  - [0.6 Known data limits (say "about", never "exactly")](#06-known-data-limits-say-about-never-exactly)
  - [0.7 Process rules that slipped](#07-process-rules-that-slipped)
- [1. Summary, decisions locked, assumptions](#1-summary-decisions-locked-assumptions)
- [2. Product, users and demo](#2-product-users-and-demo)
  - [2.1 One-liner and pitch](#21-one-liner-and-pitch)
  - [2.2 The problem](#22-the-problem)
  - [2.3 Who uses it: "before you build, before you vote"](#23-who-uses-it-before-you-build-before-you-vote)
  - [2.4 The three core features](#24-the-three-core-features)
  - [2.5 Non-negotiable principles](#25-non-negotiable-principles)
  - [2.6 Out of scope (do not build, do not spec)](#26-out-of-scope-do-not-build-do-not-spec)
  - [2.7 Competitors and our angle](#27-competitors-and-our-angle)
  - [2.8 The 4-minute demo](#28-the-4-minute-demo)
- [3. Architecture and contracts](#3-architecture-and-contracts)
  - [3.1 Components](#31-components)
  - [3.2 Repository layout](#32-repository-layout)
  - [3.3 Live API (Andrew, `/api`)](#33-live-api-andrew-api)
  - [3.4 Batch run (Andrew, `engine/suplex_engine/batch.py`)](#34-batch-run-andrew-enginesuplex_enginebatchpy)
  - [3.5 Tiger Data (Yuvi, `/pipeline/tiger`)](#35-tiger-data-yuvi-pipelinetiger)
  - [3.6 AI service (Simone, `/ai`)](#36-ai-service-simone-ai)
  - [3.7 Web app (Jayden, `/web`)](#37-web-app-jayden-web)
  - [3.8 Contracts (Andrew, `/contracts`, Hour 0 to 1)](#38-contracts-andrew-contracts-hour-0-to-1)
  - [3.9 The local frame for the 3D view](#39-the-local-frame-for-the-3d-view)
  - [3.10 Hosting and the demo safety net](#310-hosting-and-the-demo-safety-net)
- [4. Data pipeline, permits and Tiger Data (Yuvi, `/pipeline`)](#4-data-pipeline-permits-and-tiger-data-yuvi-pipeline)
  - [4.1 Working rules](#41-working-rules)
  - [4.2 Datasets (field names verified against the City's datastore on 2026-10-17; details in Appendix G)](#42-datasets-field-names-verified-against-the-citys-datastore-on-2026-10-17-details-in-appendix-g)
  - [4.3 Permits: the multiplex rule (first task, Hour 0 to 4)](#43-permits-the-multiplex-rule-first-task-hour-0-to-4)
  - [4.4 The processed citywide file (`data/out/suplex.gpkg`, EPSG:2952)](#44-the-processed-citywide-file-dataoutsuplexgpkg-epsg2952)
  - [4.5 Data dates](#45-data-dates)
  - [4.6 Tiger Data](#46-tiger-data)
  - [4.7 Pipeline acceptance checks (`checks.py`)](#47-pipeline-acceptance-checks-checkspy)
- [5. Engine rules and the uncertainty band (Andrew, `/engine`)](#5-engine-rules-and-the-uncertainty-band-andrew-engine)
  - [5.1 Inputs](#51-inputs)
  - [5.2 Lot geometry (`geometry.py`)](#52-lot-geometry-geometrypy)
  - [5.3 Lot classification order (first match wins)](#53-lot-classification-order-first-match-wins)
  - [5.4 Rules by zone](#54-rules-by-zone)
  - [5.5 The fit test (`fit.py`)](#55-the-fit-test-fitpy)
  - [5.6 What we don't check (copy in `/contracts/copy/not_checked.json`)](#56-what-we-dont-check-copy-in-contractscopynot_checkedjson)
  - [5.7 Attached houses (`attached.py`)](#57-attached-houses-attachedpy)
  - [5.8 Flags](#58-flags)
  - [5.9 Hand-checked test lots (`engine/tests/test_lots.py`)](#59-hand-checked-test-lots-engineteststest_lotspy)
  - [5.10 Next steps (approved 2026-10-17)](#510-next-steps-approved-2026-10-17)
- [6. Web app and visual direction (Jayden, `/web`)](#6-web-app-and-visual-direction-jayden-web)
  - [6.1 Stack and structure](#61-stack-and-structure)
  - [6.2 Screens and flow](#62-screens-and-flow)
  - [6.3 The 3D sequence (the street builds itself)](#63-the-3d-sequence-the-street-builds-itself)
  - [6.4 The result panel](#64-the-result-panel)
  - [6.5 The ward map](#65-the-ward-map)
  - [6.6 The transition](#66-the-transition)
  - [6.7 Cached demo mode, 2D fallback, accessibility](#67-cached-demo-mode-2d-fallback-accessibility)
  - [6.8 The trend chart](#68-the-trend-chart)
  - [6.9 Visual extras, only after the full flow works](#69-visual-extras-only-after-the-full-flow-works)
  - [6.10 Design tokens](#610-design-tokens)
- [7. AI layer: Gemini, the validator and the briefing page (Simone, `/ai`)](#7-ai-layer-gemini-the-validator-and-the-briefing-page-simone-ai)
  - [7.1 The service](#71-the-service)
  - [7.2 `POST /explain`](#72-post-explain)
  - [7.3 The numbers map and allowed numbers (`numbers.py`)](#73-the-numbers-map-and-allowed-numbers-numberspy)
  - [7.4 The validator (`validator.py`)](#74-the-validator-validatorpy)
  - [7.5 The plain template (`templates.py`)](#75-the-plain-template-templatespy)
  - [7.6 Translation (`translate.py`)](#76-translation-translatepy)
  - [7.7 The shareable briefing page (`/ai/page/`)](#77-the-shareable-briefing-page-aipage)
  - [7.8 Prompts (`/ai/prompts/`)](#78-prompts-aiprompts)
  - [7.9 Calling Gemini (`gemini.py`)](#79-calling-gemini-geminipy)
  - [7.10 What the Gemini judge sees](#710-what-the-gemini-judge-sees)
- [8. Team sections](#8-team-sections)
  - [8.1 Andrew: engine, API, contracts, integration](#81-andrew-engine-api-contracts-integration)
  - [8.2 Yuvi: data pipeline and Tiger Data](#82-yuvi-data-pipeline-and-tiger-data)
  - [8.3 Jayden: the web app](#83-jayden-the-web-app)
  - [8.4 Simone: the AI service, the briefing page, the story and all user-facing copy](#84-simone-the-ai-service-the-briefing-page-the-story-and-all-user-facing-copy)
  - [8.5 Next-steps and re-plan tasks (approved 2026-10-17)](#85-next-steps-and-re-plan-tasks-approved-2026-10-17)
- [9. Git workflow and the root `CLAUDE.md`](#9-git-workflow-and-the-root-claudemd)
  - [9.1 Workflow](#91-workflow)
  - [9.2 Root `CLAUDE.md` (full text; Andrew commits it in A1)](#92-root-claudemd-full-text-andrew-commits-it-in-a1)
- [10. Timeline and checkpoints](#10-timeline-and-checkpoints)
- [11. Risks and fallbacks](#11-risks-and-fallbacks)
- [12. Q&A prep (Simone writes the final answers in `/pitch/qa.md`)](#12-qa-prep-simone-writes-the-final-answers-in-pitchqamd)
- [13. Open TODOs with owners](#13-open-todos-with-owners)
- [14. Sources](#14-sources)
- [Appendix A. Contracts: TypeScript types and schemas](#appendix-a-contracts-typescript-types-and-schemas)
- [Appendix B. `/contracts/designs.json`](#appendix-b-contractsdesignsjson)
- [Appendix C. `/contracts/engine_config.json`](#appendix-c-contractsengine_configjson)
- [Appendix D. `/contracts/design-tokens.css` (v0; Jayden finalizes by Hour 2, Simone reviews)](#appendix-d-contractsdesign-tokenscss-v0-jayden-finalizes-by-hour-2-simone-reviews)
- [Appendix E. `/contracts/tiger/schema.sql` and the query module](#appendix-e-contractstigerschemasql-and-the-query-module)
- [Appendix F. Fixtures (`/contracts/fixtures/`)](#appendix-f-fixtures-contractsfixtures)
- [Appendix G. Dataset field reference and download URLs (verified 2026-10-17 through the City's CKAN API)](#appendix-g-dataset-field-reference-and-download-urls-verified-2026-10-17-through-the-citys-ckan-api)
- [Appendix H. Verification log (what was checked on 2026-10-17, and what was not)](#appendix-h-verification-log-what-was-checked-on-2026-10-17-and-what-was-not)
- [Appendix I. Report for Andrew: decisions made while you were away, and the questions this spec would have asked](#appendix-i-report-for-andrew-decisions-made-while-you-were-away-and-the-questions-this-spec-would-have-asked)
- [Appendix J. Status log (every report, word for word)](#appendix-j-status-log-every-report-word-for-word)

---

## 0. Status board (updated 2026-10-17, 23:41, about Hour 25.5 of 36)

Read this first. Repo: https://github.com/andrewl746/htv26 (branch `main`). This board is rewritten on every update; the full history of reports, word for word, is in Appendix J. Hacking began at 10 p.m. Eastern on 2026-10-16: rehearsals start at Hour 28 (2 a.m.) and the event ends about 10 a.m. on 2026-10-18.

### 0.1 How far along we are

Measured against the planned hours in section 8, after the approved re-plan moved J5 to Yuvi, J7 to Simone and the 3D scene to Andrew (J8, J10 and two new 3D tasks), and added next steps (6.5 hours): a task counts as done when its acceptance check passes on `main` or on a clean PR, and a partly done task counts the share actually finished. Time used: about 20 of 36 hours (55%); about 8 hours remain before rehearsals start at Hour 28.

| Person | Planned hours | Done hours | Done | Biggest piece left |
|---|---|---|---|---|
| Andrew | 35.0 | 33.9 | 97% | the full `data/out` zip on the drive; Jayden's near-your-lot wiring when it comes in; the Hour-30 offline rehearsal with `scripts/demo.ps1` |
| Yuvi | 34.5 | 33.2 | 96% | dropping the fallback strings from `WardMap/copy.ts`; polish; the rehearsal |
| Jayden | 18.5 | 18.4 | 99% | the demo cache into `web/public/demo-cache/`; polish and the rehearsal |
| Simone | 29.25 | 22.45 | 77% | the `gemini-3.8-flash` pass after the lock (20 requests in stage order), the [LOCKED] numbers, the deck and screenshots; ten rehearsals |
| **Team** | **117.25** | **107.95** | **92%** | the [LOCKED] numbers and the deck (Simone), the open PRs (#27, #28, #30), the rehearsals |

Andrew's main session has written the A10 batch and run it citywide (clean at 18:19, 78 of 78 sanity checks); the code is pushed (18:45), together with A9 (the demo-cache mode) and T20 (skewed lots), and the outputs are on the data release since 19:11 (`suplex_batch_2026-10-17.zip`; unzip into `data/out/`). Two more Claude sessions built A11's cache writer and the Hour-24 scripts (PR #20, merged at 19:57) and the 3D scene (PR #19, merged at 20:06 after the frame-rate check). Counting them, Andrew has about 3.7 hours left (the Hour-24 run, Simone's PR #17 with the fixture update, the palette, A13) and Yuvi about 1.3 (the Hour-24 refresh, fixes from S14); Jayden has the most left, about 8 hours (the result panel, the transition, the demo mode, then mounting the ward map and next steps). Next steps (PR #18) and the 3D scene (PR #19) are both merged, with `?look=classic` kept as the 3D fallback (T23).

**By feature:**

| Feature | State | Done |
|---|---|---|
| 1. Address check | The engine and the API work on real data (19 hand-checked lots, 199 tests); search, the 3D sequence and the AI explanation work. Missing: the result panel's checklist, flags, permits near you and buttons (J4), and the red fail slice (J8) | about 70% |
| 2. Permission vs. reality | The data, the permit counts and Tiger Data are done and checked against the City; the batch (A10) ran citywide and the ward map (J5) is merged. Missing: the batch outputs shared, the map wired into the app (J4, J6), the ward-panel chart (J7) | about 55% |
| 3. Ward briefing | The service, validator, shareable page and eight-language translation work on fixtures and on the 19 real lots (PR #8); real ward numbers exist (A10) and wait only on the outputs being shared | about 80% |
| Demo safety and pitch | The pitch facts are checked and the Devpost, deck and script are drafted; `scripts/demo.ps1` and `demo.sh` start the API, the AI service and `vite preview` in one command (A13), `scripts/check.sh` is the merge check (A12). Missing: the demo cache (A11, running in the lock; J9), the offline rehearsal, the ten timed rehearsals | about 35% |

### 0.2 Status by person

| Person | Done and merged | Waiting for Andrew to merge | Now and next |
|---|---|---|---|
| Andrew | A1 to A8: contracts, the engine on real data (19 hand-checked lots; `pytest engine api` 199 passed), API v1; half of A9; T8, T19 and T22 closed; approved next steps and the re-plan; merged PRs #8 and #9; T21 settled (six units, By-law 845-2025); merged PRs #12, #13, #15 and #16; A10 ran citywide at 18:19: all 25 wards, 495,456 lots in 1,290 s, 78 of 78 sanity checks pass (including the 19 hand-checked lots keeping their results), permit counts from Tiger Data; A9 done (the `SUPLEX_DEMO_CACHE` mode, JSON 500s that keep CORS, and on the citywide file a 5.5 s load, 2.4 GB peak, `/check` at most 43 ms for addresses in all 25 wards, `/ward/{id}` valid for all 25, the trend from Tiger Data in 0.36 s); T20 done and in the citywide run; the engine three times faster with byte-identical answers; all pushed at 18:45; the batch zip on the data release (19:11); merged PR #18 and turned his placeholder next-steps test into a real check (19:30: 432 tests pass, 38 fixtures validate); built in two Claude sessions and reviewed at 19:56: A11's cache writer and Hour-24 scripts (PR #20) and the 3D scene, J8, A16 and A15 (PR #19); PR #20 merged at 19:57 (`main` at 186c28c: 38 fixtures validate, 442 tests pass); PR #19 merged at 20:06 (197edf8) after the T23 check on this laptop (104 fps at 1920×1080, ×1.25), its `designs.json` change logged as contracts v0.1.9 (d8583aa); `main` builds, lints and passes 442 tests; PR #21 merged at 20:28 (1ea9070): the 3D session's final-review fixes (the frame-rate step-down holds and never recompiles shaders, the fail slab shows the rule its label names, maximum rules label the signed margin, walkout pits, the frontage road stops at buildings); PR #17 merged at 21:54 (998ff8a) with the `not_checked` list in the four check fixtures and `explain.request.json`, reviewed in a scratch checkout (validate 38 ok, 444 tests pass, the web builds); the final palette and `--suplex-permit-bar` in `contracts/design-tokens.css` (contracts v0.1.10, 617cffc); A13 `scripts/demo.ps1` and `scripts/demo.sh` and A12 `scripts/check.sh` (a1978bb), all three run live on this laptop; PR #23 merged at 22:16 (e19187c): Simone's six near-your-lot strings; the Hour-24 lock done at 22:33: 78 of 78 sanity checks; city 191,174 lots may fit (45.4% of house lots, an upper bound) against 1,447 multiplex permits; Ward 04 3,992 (22.0%) against 83; the three demo addresses as planned; `headline-locked` pushed on 9037f44 and `suplex_lock_2026-10-17.zip` (the demo cache, `ward_summary.json`, `batch_report.md`, `data_dates.json`) on the data release; Jayden's J4, J6 and J9 merged as PR #26 (22:35, 11f2be6); Yuvi's PRs #24 and #25 merged at 22:53 (4bfc577, e823077) and the 3D street PR #22 at 22:47 (26ff07a, all in `Lot3D/`); `main` at e823077: 38 fixtures validate, 444 tests pass, the web builds and lints clean; PRs #29 (Simone: the explain key without the timestamp, browser-style numbers, the [LOCKED] numbers, `ui.sample_data`), #31 (the 3D lighting pass), #32 (Jayden: near your lot in `WardStage`) and #33 (the explain key without `next_steps`) merged 23:21 to 23:25; Simone's re-keyed AI cache installed in the demo laptop's `ai/cache/` (23:31): 230 entries, her 205 plus 25 copies under the keys the AI service computes with `scripts/demo.ps1`'s URLs (the explain key includes the web and AI URLs, and `demo.ps1` sets `SUPLEX_AI_URL=http://127.0.0.1:8001`, so her entries alone missed all 12 explanations there); replayed with Gemini off, all 20 demo requests (12 explanations, the Ward 04 briefing in 8 languages) hit with the defaults, with `demo.ps1` as it is, and with `SUPLEX_WEB_URL=http://127.0.0.1:4173` added; `scripts/demo.ps1` and `demo.sh` set `SUPLEX_WEB_URL=http://127.0.0.1:4173` (23:41, 8fe1c36), so the AI's links open the demo app; the AI cache still hits 20 of 20 with the demo's URLs | PR #28 (Yuvi's permitted-multiplexes search, allowed by decision 20): merges once Jayden OKs its one `App.tsx` line and Yuvi fixes the blank map on first load; PR #27 needs Jayden's OK first | merge PR #30 (the PR #22 review fixes: the garden only behind a design that fits, sheds merged after the ripple, fewer shadow draws; build and lint clean); upload `suplex_lock_2026-10-17b.zip` (the demo cache re-run at 22:58 after PR #24) to the data release and the drive, with `suplex_batch_locked_2026-10-17.zip`; the hand-offs (Simone's 3.8 pass on the b cache, Jayden's copy into `web/public/demo-cache/`); review Jayden's near-your-lot wiring in `WardStage` when it comes in; pull `main` into the demo laptop's folder; the Hour-30 offline rehearsal on `scripts\demo.ps1 -DemoCache` |
| Yuvi | Y1 to Y8: permits (446 against 452), the citywide GeoPackage, Tiger Data live (27.6% smaller after compression), the trend cache, the data release; Y7 closed on the citywide file (PR #9); merged at 18:08 (PR #12: a 2D plan view tab (the lot, the yards, the buildable area, the design's footprint with red slices, neighbours, trees and permit diamonds on a street map; zoom and pan; no addresses, no lists), which also carries Jayden's four unmerged commits with their palette conflict resolved; merged together with #13 onto `main` in a test checkout it builds and lints clean); J5, the ward map, merged at 18:17 (PR #15: J5, the ward map, entirely inside `WardMap/`; merged onto `main` in a test checkout it builds and lints clean. Hover shows only the result and the design, the gold dots are multiplex permits since May 2023 only, the base map has its green removed so only "may fit" is green, the sixplex options say "not allowed in this ward" where they should, the legend carries the screening line, the panel counts up and links to the briefing, there is no list or export, and it has a slot for Simone's chart; a dev page at `/src/components/WardMap/dev/index.html` shows it on the fixtures); next steps merged at 19:30 (PR #18: next steps end to end: Y11, all 14 steps re-read on the City, TRCA and by-law pages with quotes (`pipeline/reports/07-next-steps-sources.md`); Y12 `contracts/copy/next_steps.json`; Y13 the engine module with 66 tests, including the six real lots; Y14 `NextSteps.tsx`; plus the ward map on `labels.ward_map` with Simone's `TrendChart` mounted. Merged onto `main` in a test checkout: 38 fixtures validate, 431 tests pass, and the one failure is Andrew's placeholder test in `engine/tests/test_fit.py`, which still expects an empty list; the web builds and lints clean. One file outside his list: `ResultPanel/nextSteps.css`, the component's own styles); Y15 near your lot (PR #25: all inside `WardMap/`; around 326 Quebec Ave N is 370 lots, 368 with exact EPSG:2952 distances, and M is the engine's 7) and Simone's S14 review applied (PR #24: six rewordings, three source quotes, the `intro`, footer and Property Information Report link), both reviewed clean at 22:42 on one test merge with `main`: 38 fixtures validate, 444 tests pass, the web builds and lints clean; both merged at 22:53; PR #28, the permitted-multiplexes search (1,553 permits since 2022, street only), checked in the browser at 23:09: the landing button, the list, search, filters and sort work with no console errors, and the main address check still works | PR #28: Jayden's OK for the `App.tsx` line, and his own fix for the blank map | fix PR #28's map: at laptop size (1440 by 900) it stays blank on first load, for 15 s and more, until you zoom, then shows Toronto and the clusters; probably the map is made before its box has a size, so call `map.resize()` once the box is laid out; #24 and #25 are merged: a follow-up PR that deletes `NEAR_FALLBACK` from `WardMap/copy.ts` (Simone's strings are on `main` since PR #23) and makes `useNearYourLot` return nulls when `check.lot.ward_id` is not the shown ward (a backstop: Jayden's call site guards it too); the box only shows in the app once Jayden's `WardStage` passes it the check (Jayden's next); polish and the rehearsal |
| Jayden | J1 to J3: search, the full 3D sequence, the landing hero map with the fly-in; clean build, type check and lint; J4 the result panel, J6 the lot-to-ward transition and J9 demo mode, merged at 22:35 as PR #26 (opened by Andrew from his branch; on a test merge 38 fixtures validate, 444 tests pass, the web builds and lints clean); near your lot wired into `WardStage` (PR #32, 23:24) | nothing open | OK on GitHub the one `App.tsx` line in Yuvi's PR #28 (it mounts `MultiplexSearchEntry` on the landing page, shown only there), and review PR #27 (Yuvi's banner for lots where no design can be checked, which edits your result panel); copy the lock's `data/out/demo-cache/` (re-run at 22:58 after PR #24; in `suplex_lock_2026-10-17b.zip` on the data release, not the 22:32 `suplex_lock_2026-10-17.zip`) into `web/public/demo-cache/`, again at Hour 30 if anything is re-run; send Simone the sample-data banner string (`missing.sample_data` in `web/src/copy.ts`) for `labels.json`; polish and the rehearsal |
| Simone | S1 to S7, the S10 drafts, T1 and T13, the translation policy and glossary, PR #8; S8 part one: the explanations on the 19 hand-checked lots with the real API and Gemini, 19 of 19 passing the number check and matching Andrew's table after she caught and fixed a margin read as a depth ("the lot depth is -0.37 m"); the plan-view strings; the 11-slide deck, the Devpost, the demo script with both sponsor walkthroughs, the Q&A and the README draft, with [LOCKED] markers for numbers that only exist after Hour 24; merged at 18:08 (PR #13: J7 `TrendChart.tsx` (the briefing chart for the ward panel, checked against the fixture) and the web's five pending strings in `labels.json`; 118 tests pass); the pitch facts, Devpost and Q&A now say "up to six units, By-law 845-2025" (d64baa4); merged at 18:20 (PR #16: the last eight hard-coded strings (a new `ward_map` group, four more plan-view strings, the map attribution kept word for word); merged onto `main` in a test checkout it validates (37 fixtures), passes her 118 AI tests, and the web builds and lints clean); S14 done (19:50): her review of the next-steps copy, with the exact JSON for Yuvi's file, in `docs/next-steps-review.md` (PR #17); S15 done (22:15, PR #23: the six near-your-lot strings, `labels.json` only; validate 38 ok, the AI tests pass); PR #23 merged at 22:16 (e19187c); the one `gemini-3.8-flash` pass done (23:21 report): 20 requests, 0 rejections, on the 22:34 lock zip; `suplex_ai_cache_2026-10-17.zip` on the data release; PRs #29 and #33 merged (23:22, 23:25); her re-keyed cache is on the demo laptop and hits all 20 demo requests | nothing open | before the pass, a small PR so the explain cache key leaves out `meta.generated_at` and `meta.cached` (`ai/explain.py`, with a test), so live and cached checks share keys; when Andrew says the lock is done: unzip the release's demo cache into her `api/cache/`, start the API with `SUPLEX_DEMO_CACHE=1` and the default `SUPLEX_WEB_URL` and `SUPLEX_AI_URL` (both are in the key), compare `ward_summary.json` with hers, run the one `gemini-3.8-flash` pass (20 requests in stage order, Ward 04 English and French first) and send Andrew her `ai/cache/` for the demo laptop; fill every [LOCKED] number and update the deck; real screenshots and a re-read of the French Ward 04 briefing; now that #23 is merged, `--trend-bar` in `ai/page/briefing.css` can read `var(--suplex-permit-bar)` instead of its own `#A27100`; translation sheets (Tamil drops "if anything" in question 1); add Jayden's sample-data banner string to `labels.json` `ui` |

### 0.3 Critical path and the approved re-plan

**The critical path:**

1. **A10, the citywide batch, ran clean at 18:19** (all 25 wards, 495,456 lots, 78 of 78 sanity checks). It is pushed, with T20 (skewed lots) already in it; its outputs are on the data release since 19:11 (`suplex_batch_2026-10-17.zip`), so the ward map on real data and the briefing on real numbers (S8) can start. Preliminary until the lock: 191,174 lots may fit citywide (45.4% of 421,204 house lots, an upper bound) against 1,444 multiplex permits; Ward 04 3,992 against 81. A re-run takes about 21 minutes and follows Yuvi's refresh at the Hour-24 lock.
2. **Then, in parallel:** the ward map (J5, merged at 18:17) switches from fixtures to the real ward files; the briefing switches to real ward numbers (S8); S9 is settled: Ward 04 with 326 Quebec Ave (all four designs fit), 281 Armadale Ave (the Fourplex Narrow is too close to call) and 155 Vine Ave (a row house) (decision 18), and Simone revises PR #17 back to Ward 04. The ward map only appears in the app once Jayden wires it in (J4's "See your ward" button, then J6), so J4 and J6 are now the web's critical path.
3. **Hour 24, the headline lock (A11):** Yuvi's refresh (`python pipeline/refresh.py --tiger`), then the batch, then the demo cache for 326 Quebec Ave, 281 Armadale Ave, 155 Vine Ave and Ward 04, then Simone's one `gemini-3.8-flash` pass, in stage order with Ward 04 in English and French first (7.9). The writer and a one-command runbook are on `main` (PR #20, merged at 19:57): `scripts\hour24.ps1 -DryRun`, then `-Workers 10`; it stops at the first failing step and resumes with `-From N`. After the refresh, `data/out/suplex.gpkg` is the citywide file, so an API started with `SUPLEX_GPKG=data/out/suplex_citywide.gpkg` would serve the old lots. If Simone's `not_checked.json` change merges after the lock, re-run the cache step (`scripts\hour24.ps1 -From 3`, a few seconds) so the cached checks carry the new list. Order tonight: PR #17 with the `not_checked` fixture update merged at 21:54, the lock started at 21:55 (the dry run passed; 3 of 11 City datasets changed upstream since the last download: active and cleared permits, property boundaries), then Simone's one `gemini-3.8-flash` pass once the lock is done: her cached explanations are keyed on the check, so a pass before the lock would waste the day's 20 requests (the quota resets at 3 a.m.). Simone's pass runs on the lock's own demo cache (her API with `SUPLEX_DEMO_CACHE=1`), because the explain cache key hashes the whole check and `meta.generated_at` differs on every live request; her small key fix (leave out `meta.generated_at` and `meta.cached`) lets the pre-generated explanations hit when the demo runs live too. Her `ai/cache/` then goes into the demo laptop's `ai/cache/`. **Done 22:33:** the Hour-24 lock done at 22:33: 78 of 78 sanity checks; city 191,174 lots may fit (45.4% of house lots, an upper bound) against 1,447 multiplex permits; Ward 04 3,992 (22.0%) against 83; the three demo addresses as planned; `headline-locked` pushed on 9037f44 and `suplex_lock_2026-10-17.zip` (the demo cache, `ward_summary.json`, `batch_report.md`, `data_dates.json`) on the data release.
4. **Hour 28 onward:** the offline rehearsal (Wi-Fi off, API and AI stopped), ten timed rehearsals (S11), the Devpost submitted by Hour 34.

**Re-plan (approved by Andrew, 2026-10-17).** Jayden had about 14.6 hours of core web work left (0.4) and about 8.5 hours before rehearsals, and the ward map is on the never-cut list. So:

- **Jayden** (away for a few hours first) does, in order: J4 (the result panel), J6 (the lot-to-ward transition), J9 (the demo-cache mode, a WebGL check and a "sample data" banner; the 2D view now comes from Yuvi's plan view in PR #12), then polishes the landing search card and the rest of the UI that is not 3D.
- **Andrew** took over the 3D scene (`web/src/components/Lot3D/`): J8 (the red fail slice and the borderline stripes), the four designs modelled from the City's elevation sheets (A16) and a realism pass (A15). It runs in its own Claude session on branch `andrew-3d` and merges by Hour 27; the current look stays as the fallback. The A10 batch and the Hour-24 lock come first.
- **Yuvi** builds the ward map (J5) in a new folder, `web/src/components/WardMap/`, from the ward files he designed; Jayden wires it into `App.tsx`. Next steps follows J5 (Y11, the sourcing, can start at once because it only touches Yuvi's report folder).
- **Simone** ports her briefing-page SVG chart to `web/src/components/WardMap/TrendChart.tsx` (J7), so both charts are the same chart.
- **Cut order for what is left:** the near-your-lot box (Y15), then visual extras (J10), then next steps, then the 2D plan view (keep the WebGL check), then the trend chart in the ward panel (it stays on the briefing page), then the animated lot-to-ward transition (fall back to a plain switch). Never cut: the address check with its 3D moment and the result panel's checklist, the ward map's could-versus-did headline, the screening labels and the uncertainty band, the rehearsal.

### 0.4 Web app review (Jayden's branch, all 16 commits, 2026-10-17)

The code is real: every lot, building and design comes from the API contract or `designs.json`, nearly all text comes from `contracts/copy`, and `tsc`, `vite build` and `oxlint` all pass. Network calls go only to the API proxy, OpenFreeMap and Google Fonts; there are no secrets, no addresses on any map, no lists of lots, no chat and no ranking words; the screening disclaimer and the "illustrative new-build scenario" label are present; the locked colours are untouched. What needs fixing:

| Severity | Where (`web/src`) | Problem |
|---|---|---|
| High | `components/Lot3D/Scene.tsx` 136-138 | A design that does not fit rises exactly like one that fits: `fail_slices_local` is never read, so there is no red slice (2.4, 6.3). Fix in J8 |
| High | `components/ResultPanel/ResultPanel.tsx` 45-50 | The tab panel is an empty element: no rule checklist, not-checked list, flags, permits near you, explanation or "See your ward" button. Fix in J4 |
| Medium | `api/config.ts` 6 | Without `VITE_API_BASE` the app silently serves the synthetic fixtures ("200 Fixture St") with no label, and `web/README.md` is still the Vite template. Add a "sample data" banner and document the variable |
| Medium | `App.tsx` 24-30 | No WebGL check and no error boundary: without WebGL even the landing page crashes, and the demo-cache fallback is only a comment. Fix in J9 |
| Medium | `styles/palette.css`, `components/BaseMap/mapStyle.ts` | Page, panels, neighbours, roofs, trees and map buildings are now all green, which dilutes "green means may fit"; the olive map buildings are 1.16:1 against the fit green. The ward map (J5) must use a neutral base so the lot colours read |
| Low | `examples.ts` 9-12 | The landing chips use two real hand-checked lots (326 Quebec Ave fits, 281 Armadale Ave is too close to call). Their results are right, but choosing demo addresses is S9's job: Simone confirms or replaces them |
| Low | `styles/tokens.ts` 17 | Done 21:57 (contracts v0.1.10): every `palette.css` token is now in `contracts/design-tokens.css`. Was: reading a missing token throws, and several tokens exist only in `palette.css`: do not delete that file until its values move into `contracts/design-tokens.css` |
| Low | `copy.ts` 10-16 | Five user-facing strings live in code, waiting for Simone to add them to the copy files; the 3D Massing disclaimer is never shown |

Built but not in the task list: the landing hero map and the fly-in (a good opening for the demo), the neighbour cutaway and sink shader, the shader warm-up. Worth keeping: strict use of the contract types, one animation timeline with a real reduced-motion path, an accessible search and tabs with icon plus text, careful three.js disposal and caps.

### 0.5 Decisions since version 3 (each one changed the section in brackets)

1. Gemini defaults to `gemini-3.5-flash-lite` (500 requests a day); `gemini-3.8-flash` (20 a day) is used once, for the pre-generation after the Hour-24 lock; `gemini-2.5-flash` is dropped (decision 12, 7.1).
2. Hack the Valley rules: one project may enter the challenge and the MLH prizes; all work happened after the 10 p.m. kickoff; **never rewrite or squash git history**, the timestamps are the evidence (T1).
3. A multiplex permit means one that creates 2 to 6 units: 446 against the City's 452 for May 2023 to Nov 2024, Ward 04 exactly 42 against 42 (4.3, decision 9).
4. The parcel file has no CORRIDOR parcels, so the street layer is derived; rear lanes are never treated as the frontage (4.4, 5.2).
5. The height overlay column is `HT_LABEL`; "older bylaw" is inferred when no zone polygon covers at least 25% of a lot (4.2, 5.3).
6. Ward 23 is wholly in the sixplex overlay; no ward is partial (4.4, Appendix C).
7. Building footprints are clipped to the lot; the attached and larger-building thresholds were tuned on 19 hand-checked lots; Ward 04's attached share is 41.6% (5.7, Appendix C, `docs/test-lots.md`).
8. The site-specific exception is an informational flag: shown in the address check, never on the map, never counted as "needs extra review" (T19).
9. The first candidate question is now "What, if anything, should the City do about its free multiplex designs on lots where they fit?" (`contracts/copy/questions.json`).
10. All eight languages stay, with a "Reviewed by a speaker" badge on English and French and a "Machine translation, not yet reviewed" badge on the rest; French uses "quartier" and "terrains"; a glossary rejects forbidden words the way the validator rejects invented numbers (7.6).
11. The briefing page draws its chart as inline SVG and uses `--suplex-permit-bar` (`#A27100`), because the permit gold is 1.5:1 on white (7.7, Appendix D).
12. Branches are `main` (Andrew), `yuvi`, `jayden`, `simone`; React 19; Python 3.14 (section 9).
13. The web app's look is now Yuvi's Lime and Teal palette with the Newsreader serif (PR #10), replacing Appendix D's Inter and Space Grotesk; Andrew moved the final palette and `--suplex-permit-bar` into `contracts/design-tokens.css` at 21:57 (contracts v0.1.10), so the briefing page now matches the app's colours; the type tokens (Newsreader) still live in `web/src/styles/typography.css`.
14. **Development charges and parkland cash-in-lieu are waived for multiplexes of up to six units** ([By-law 845-2025](https://www.toronto.ca/legdocs/bylaws/2025/law0845.pdf), enacted July 24, 2025): no development charges on the second to fourth units, the fifth and sixth reduced to $0, and no parkland cash-in-lieu on the second to sixth, while the lot has no more than six units (a garden or laneway suite on the City's deferral program does not count). The City's "Considerations when building multiplexes" page still says four and is out of date. Say "up to six units" and cite the by-law; never name the councillors who moved it (T21). An earlier version of this board said "four, never six": that was wrong.
15. **Approved by Andrew on 2026-10-17:** "Your next steps" at the end of the address check (2.4, 5.10, 8.5), and the re-plan in 0.3 (J5 to Yuvi, J7 to Simone); `CLAUDE.md` lists the ownership exceptions.
16. **Andrew took over the 3D scene** (`web/src/components/Lot3D/`) from Jayden on 2026-10-17: J8 and J10 move to him, plus the four designs modelled from the City's elevation sheets (A16) and a realism pass (A15); Jayden keeps all UI that is not 3D. The 3D work lands on branch `andrew-3d` by Hour 27, with the current look kept as the fallback (T23).
17. **The 2D plan view** (Yuvi, PR #12) is the spec's 2D view (6.7): the lot, the yards, the buildable area, the design's footprint with red slices, neighbours, trees and the permit diamonds on a street map. It takes the 2D part off J9, and after the merge it is part of Jayden's UI like the rest of `/web`.
18. **The demo ward is Ward 04, Parkdale–High Park** (Andrew, 2026-10-17), after a switch to Ward 20 at 18:41 was reversed: Ward 04 shows all four designs (it is in the sixplex overlay; Ward 20 is not), our permit count matches the City's exactly (42 and 42; Ward 20 differs, 23 against 16), and the 19 hand-checked lots are there. Demo addresses, all checked on the citywide batch: 326 Quebec Ave (all four designs fit; the opener), 281 Armadale Ave (the Fourplex Narrow is too close to call on lot width, 7.45 m against 7.6 m; the other three don't fit) and 155 Vine Ave (a row house: the free designs don't apply, which answers the semis question). The first two are already the landing page's example chips.
19. **"Near your lot" on the ward map** (Andrew, 2026-10-17): when the map opens from an address check, the ward panel shows the could-versus-did gap around that lot (6.5; Y15 and S15 in 8.5): the lots in this ward where a design may fit within the check's 500 m radius (an upper bound) and the multiplex permits issued there since May 2023, with the circle drawn on the map. Counts only: no list, no addresses, no new data. The permit count is the engine's own `permits_nearby`, so it matches the 2D plan view; the lot count is worked out in the browser from the ward file around `context.origin` with a flat-earth distance (off by well under 0.5% within 1 km), a display count labelled as an upper bound and the one exception to doing distance maths in EPSG:2952. It is the first thing cut if the core flow runs late. On tonight's data, 326 Quebec Ave shows about 370 lots and 7 permits. A rental search was considered and dropped: no open data lists rental units, and it is another team's product.
20. **Lists of issued multiplex permits are allowed** (Andrew, 2026-10-17), an exception to "no list, export or download of lots": permits (the "did" side) are public City records, so the permitted-multiplexes search (PR #28) may list them as cards, by street name only, never with a house number, with no export or download, and its map stops at zoom 16. Lots that may fit (the "could" side) are never listed, and the ward map still shows no addresses. CLAUDE.md carries the exception.

### 0.6 Known data limits (say "about", never "exactly")

1. **Permits:** 446 against the City's 452; some wards differ by up to about 11; 17 permits have no ward and are counted, not mapped.
2. **Lot shapes** are not survey-accurate and have no frontage field; frontage is computed from geometry.
3. **Streets** are derived; water or rail edges can occasionally read as street.
4. **Buildings** are the City's 2025 3D Massing ("illustrative only"); one polygon often covers a row of houses; about 24,000 lots have no building.
5. **Zoning:** 4.8% of lots have no zone polygon; 88% carry an exception we do not read; zoning data is from February 2026, the ravine layer from 2019.
6. **Trees** are decoration only.

Not proven yet: fit accuracy beyond the 19 hand-checked lots, and the Hour-24 refresh, after which permit counts may move slightly. Nobody hard-codes a number before the lock; every Devpost number must equal the final `ward_summary.json`.

### 0.7 Process rules that slipped

Section 9.1 says only Andrew merges into `main` and everyone edits only their own folder. Today:

- Jayden merged his own PRs #6 and #11 into `main`.
- Yuvi wrote PR #10 inside `/web`, Jayden's folder (the Lime and Teal palette and the Newsreader serif), and merged it into `main` himself.

Nothing broke: `main` builds, type-checks and lints clean, and the engine, API and AI tests pass. But after Hour 24 a self-merge that breaks `main` costs the demo, and two people restyling the same folder is how a demo ends up half one palette and half the other. From now on: every change goes in as a PR to Andrew; nobody merges their own PR; a change someone wants in another person's folder is a message to that person. The palette that wins must also land in `contracts/design-tokens.css` (through Andrew) so Simone's briefing page matches the app.


PR #12 (Yuvi) changed Jayden's files and carried Jayden's unmerged commits. It was opened before the new ownership rules were pushed, and it resolves the palette conflict that blocks Jayden's own PR #14, so it was merged (with Simone's #13) at 18:08, and GitHub shows #14 as merged through it. From now on `CLAUDE.md` applies: in `/web`, Yuvi edits only `WardMap/` and the next-steps component.
---

## 1. Summary, decisions locked, assumptions

**Summary.** Suplex is a civic tool for Toronto's 2026 municipal election (election day October 26, 2026). A resident types any Toronto address and watches the street build itself in 3D while the City's free pre-approved multiplex design rises on that lot, floor by floor. A rules engine, not an AI, tests all four City designs against the lot's geometry and Zoning By-law 569-2013 and returns one of four results (fits, too close to call, doesn't fit, not checked) with the rule, the margin and the bylaw section. A "See your ward" button zooms out to a ward map that compares every lot where a free design may fit ("could") against multiplex permits actually issued since May 2023 ("did"), with a trend chart served from Tiger Data. A Gemini-written ward briefing phrases only numbers the engine computed, every number links to its source, a validator rejects any number the AI did not get from its input, and one click translates it. Every result says "Screening only, not a permit or legal advice."

**Decisions locked.** Items from the prompt, plus the calls made while writing this spec. The calls are marked ★ and explained in Appendix I.

| # | Decision |
|---|---|
| 1 | Name **Suplex**; repo `suplex`; three core features only (address check, permission vs. reality, ward briefing). The dollhouse view is a stretch goal after everything works. |
| 2 | Target: Hack the Valley × School of Cities challenge. Side bets: MLH Best Use of Gemini API, MLH Best Use of Tiger Data. Vultr, GoDaddy and the DEV writing challenge only if free and quick. |
| 3 | Code decides fit. AI only phrases numbers the engine produced. A validator rejects any AI output containing a number not in its input. |
| 4 | No candidate names, parties or positions anywhere. No rankings of wards. No list or export of lots (issued permits excepted: decision 20 in 0.5). No addresses on the ward map. Neutral wording. "Screening only, not a permit or legal advice" on every result. |
| 5 | Stack: Python FastAPI API (GeoPandas, Shapely, EPSG:2952) · one Python engine shared by the live API and the batch run · React + TypeScript + Vite web app · three.js via react-three-fiber for the 3D lot · MapLibre GL with OpenFreeMap tiles for the ward map · Gemini API for AI · Tiger Data (PostgreSQL + TimescaleDB) for the permits time series · a separate small FastAPI AI service that also serves the shareable briefing page. |
| 6 | Contracts first: JSON schemas, TypeScript types and fixtures in `/contracts` at Hour 0–1, so web and AI build against fixtures before the pipeline and API exist. |
| 7 | Folder ownership: `/contracts`, `/engine`, `/api`, root files → Andrew · `/pipeline` (including `/pipeline/tiger`) → Yuvi · `/web` → Jayden · `/ai`, `/docs`, `/pitch` → Simone. Andrew works on `main`; teammates work on branches named after themselves (`yuvi`, `jayden`, `simone`). Only Andrew merges to `main`. (Changed 2026-10-17 from the original `feat/*` plan.) |
| 8 | Uncertainty band: 0.5 m for geometry-derived margins, 2 percentage points for lot coverage, both constants in `/contracts/engine_config.json`. |
| 9 | Multiplex permit rule: the Toronto Multiplex Tracker's scope (permits creating 1–6 dwelling units, non-SFD structure types, with the tracker's two exceptions), split by kind; **`multiplex` means units created 2 to 6** (Yuvi, 2026-10-17: 446 against the City's 452), and the headline counts that kind only. Rule B was not needed (section 4.3). |
| 10 | Cut order if behind: Tiger Data and the trend chart (go/no-go Hour 14) → the sixplex designs → translation → citywide coverage (fall back to 2–3 wards). Never cut: the address check and 3D moment, the permission vs. reality headline, the screening labels and uncertainty band, the rehearsal. |
| 11 ★ | **Dev ward and default demo ward: Ward 04, Parkdale–High Park.** It is in the sixplex overlay, so all four designs apply, and it mixes detached and attached house lots of many widths, so all four result types show up. If citywide is cut, ship wards 04, 19 and the ward that contains the venue. **Confirmed 2026-10-17 after a brief switch to Ward 20: Ward 04 stays the dev and demo ward (0.5, decision 18).** |
| 12 ★ | Gemini model: `gemini-3.5-flash-lite` by default (changed 2026-10-17 by Simone after reading the free-tier limits: 500 requests a day against 20 for `gemini-3.8-flash`). `gemini-3.8-flash` is reserved for the one-off demo pre-generation after the Hour-24 lock, if its drafts pass the validator more often; `gemini-2.5-flash` is dropped. One constant, `GEMINI_MODEL`, read from the environment in `/ai/config.py`. Structured JSON output through the SDK's response schema. |
| 13 ★ | Translation languages (8): English, French, Simplified Chinese, Traditional Chinese, Spanish, Tagalog, Tamil, Portuguese. Codes `en fr zh-Hans zh-Hant es tl ta pt`. Simone may swap entries; the list lives in `/ai/config.py`. |
| 14 ★ | AI output uses `{{placeholders}}` for every number from its input. The renderer fills in the values and links them to sources. The validator rejects any literal number not in the input's allowed set and any placeholder key that does not exist. |
| 15 ★ | The three "questions to ask candidates" are fixed copy (the same three for every ward), stored in `/contracts/copy/questions.json`, translated with the briefing, never generated. |
| 16 ★ | Identifiers: address = Address Points `ADDRESS_POINT_ID` · lot = Property Boundaries `PARCELID` · building = 3D Massing shapefile feature index (the file has no id column) · ward = City Wards `AREA_SHORT_CODE` ("04"). |
| 17 ★ | Sixplex Narrow (19.0 m long) is tested against the general detached-houseplex rule 10.20.40.20(3): 19.0 m is allowed only on lots at least 36 m deep with frontage under 10 m, or at least 40 m deep with frontage of 10 m or more; everywhere else the 17.0 m limit applies and the design reads "doesn't fit: building length". By-law 654-2025 contains no depth or length provision (Appendix H). |
| 18 ★ | Ports: API 8000, AI service 8001, web 5173. Python 3.12 or 3.13 in one root virtualenv. Node 20 or newer. |
| 19 | "Your next steps": a rule-driven, sourced checklist at the end of the address check, picked by the engine from the lot's own result and flags, never by AI (2.4, 5.10, 8.5). Approved by Andrew on 2026-10-17. |

**Assumptions made while writing.** Each one that could change the build is also a TODO in section 13.

1. The four plan sets, the data table and the bylaw numbers in the prompt are correct as given; only the VERIFY items were re-checked.
2. *Withdrawn 2026-10-17 (T1 closed):* one project may enter the School of Cities challenge and the MLH prizes, and all work must happen during the event, which began at 10 p.m. Eastern on 2026-10-16. Everything here was written after kickoff and every commit is dated 2026-10-17 or later; the git history stays unrewritten as the evidence.
3. The permits field `GEO_ID` is the same key as Address Points `ADDRESS_POINT_ID`. The Toronto Multiplex Tracker joins permits to address points on `GEO_ID`, and the current Address Points schema names its id `ADDRESS_POINT_ID`. Yuvi measures the join rate in the first hour; the fallback is a street-number-plus-street-name match.
4. The mockup video (`suplex-animated.mp4`) and ward-view image (`06-ward-could-vs-did.png`) were not on disk when this was written. Andrew puts both in `/docs/mockups/` at Hour 0. The visual direction in section 6 was written from the prompt alone.
5. Every "hour" below is relative: Hour 0 is when the team starts building from this spec. Each person has about 24 to 27 working hours in the 36.
6. Judges can type an address; if they decline, the backup addresses (chosen at Hour 16 to 20 from real batch results, never invented) carry the demo.

**Taglines.** Pick one for the deck and the Devpost.

- *Before you build, before you vote.*
- *Four free designs, checked on every lot.*
- *What's allowed, and what got built.*

---

## 2. Product, users and demo

### 2.1 One-liner and pitch

**One-liner.** Suplex checks every lot in Toronto against the City's free multiplex designs, and shows whether the multiplex policy is actually delivering in your ward.

**30-second pitch.** "Since 2023, every house lot in Toronto has been allowed four homes. This month, the City gave away free blueprints. But nobody can tell you whether they fit on your street, or whether the policy is working. Type any address and watch the City's design rise on that lot in 3D. Then zoom out: in your ward, [X] lots could fit a free design, but only [Y] multiplex permits have been issued since 2023." X and Y come from our own batch run (section 3.4), never from a guess.

### 2.2 The problem

- **Few multiplexes get built.** Multiplexes have been legal on residential lots since May 2023, but the first 18 months brought only 452 permits and about 726 net new homes, most of them renovations or conversions rather than new buildings.
- **Nobody can check the free designs.** On October 2, 2026, the City released four free pre-approved designs, but nothing tells a resident whether one fits a given lot. City reports say plain-language guidance is missing; the Mayor has proposed open houses to explain the rules.
- **The election has no ward-level facts.** Housing is a top issue for October 26, yet no one publishes where multiplexes could go versus where they have actually been built.

### 2.3 Who uses it: "before you build, before you vote"

| User | When they use it | What it lets them do |
|---|---|---|
| Homeowners (about a quarter of Toronto dwellings are single-detached houses) | After hearing the City released free designs | Find out free whether a design could work on their lot before paying a designer, and see what still needs checking |
| Residents and neighbours | When they hear "fourplexes are allowed now", or see one proposed nearby | See what's actually allowed on their street, and how little has been built |
| Journalists and community groups | Election coverage, all-candidates meetings | Get sourced ward numbers for a story or a question to candidates |

### 2.4 The three core features

**Feature 1: Address check (the wow).**

- The user types any Toronto address, with autocomplete from the City's address list (`GET /search`).
- The street appears in 3D and builds itself around the lot. The City's design rises on the lot, floor by floor (section 6).
- The engine tests all four designs (`GET /check`) and gives each one of these results:
  - **Fits:** every checked rule passes with room to spare (outside the uncertainty band).
  - **Too close to call:** a rule passes or fails by less than the uncertainty band, because lot lines are not survey-accurate.
  - **Doesn't fit:** at least one rule fails clearly. The design turns red, with the rule, the margin and the bylaw section, e.g. "needs 7.6 m of lot width; this lot has 6.9 m."
  - **Not checked:** condos, non-residential zones, lots under an older bylaw, larger existing buildings, unmeasurable lot shapes and addresses outside Toronto get a plain-language reason instead (order in section 5.3).
- The result panel contains:
  - a checklist of every rule checked, with required value, actual value, margin and bylaw section
  - a "What we don't check" list (section 5.6; copy in `/contracts/copy/not_checked.json`)
  - any flags (heritage, ravine, flood area, site-specific exception)
  - **multiplex permits near you:** a count and unlabelled dots within about 500 m, never addresses
  - a plain-language explanation written by Gemini (`POST /explain`), with a one-click translation
- A **"See your ward"** button starts the zoom-out to feature 2. It never happens on its own.

**Feature 1, part 2: "Your next steps" (approved by Andrew on 2026-10-17).**

The address check ends with a short checklist of what this owner would actually do next, picked by rules from this lot's own result and flags, written in plain words, with who to contact and a City link for every step. It turns "may fit" into "here is how you would find out for sure and apply". Full rules in section 5.10.

- **Personal, not generic.** Every step shows why it appears for this lot: "because the Fourplex Narrow is too close to call on lot width (7.62 m measured against 7.6 m needed)", "because this lot is in the TRCA regulated area", "because there is a house here today". The City's pages cannot do that; Suplex can, because the engine already knows the result, the margins and the flags.
- **Code picks the steps, never AI.** A pure function in the engine maps the check result to step ids; the text comes from a sourced copy file. Gemini never writes, reorders or explains a step.
- **Sourced.** Every step links to the City page it comes from, and the copy file keeps the quote it was checked against and the date. Steps and contacts are re-checked before the demo (Y11).
- **Four groups, in order:** *Confirm first* (survey, zoning check, your zone's exception), *Other approvals for this lot* (heritage, ravine, conservation authority, trees), *Apply with a City design* (design professional, building permit, demolition permit, development charges), *If the free designs don't fit* (attached-house options, a custom design or minor variance, or ask zoning staff).
- **Labelled as screening.** The list ends with "Screening only, not a permit or legal advice. Steps and contacts come from City of Toronto pages checked on {date}; confirm with the City before you rely on them."
- **Not in scope, still:** no step-by-step variance guide, no cost estimate, no designer or contractor names, no chat.

**Feature 2: Permission vs. reality (the insight).**

- A ward map compares lots where a City design may fit against actual multiplex permits issued since May 2023.
- **Headline per ward:** "[X] lots here could fit a free City design. [Y] multiplex permits have been issued since 2023."
- Also shown: lots that are too close to call, and the rule that blocks the most lots.
- Getting there: "See your ward" in the result panel; "Back to your lot" returns to 3D. The ward data loads in the background while the user looks at their lot, so the transition starts instantly.
- Map display (2D, MapLibre), lot by lot:
  - **"Could" layer:** every house lot in the ward is filled by its best result across the designs selected in the design filter. Green `#22B573` = a free design may fit. Pale green with diagonal stripes = too close to call. Light grey `#C9CCD6` = doesn't fit. No fill = not checked. At ward zoom the lots read as a green and grey texture; zoomed into a street, each lot is distinct.
  - **"Did" layer:** every multiplex permit since May 2023 is a gold dot (`#FFC83D` with a dark outline, about 6 px, larger when zoomed in) on top of the lots. Dots are a different shape from the fills, so the map never relies on colour alone. Some dots land on grey lots; that is expected (custom designs, variances).
  - **The searched lot** has a white outline with a gentle pulse.
  - **Design filter:** All designs, Fourplex Narrow, Fourplex Wide, Sixplex Narrow, Sixplex Wide. Outside the sixplex wards, the sixplex options read "not allowed in this ward".
  - **Hover:** only the result ("May fit: Fourplex Narrow"), never an address. Clicking a lot opens its address check, like searching for it.
  - **No list or export of lots that fit,** anywhere in the product.
  - **Legend** (always visible): may fit, too close to call, doesn't fit, multiplex permit since 2023, plus "Screening only, not a permit."
  - **Attached houses** (semis and row houses) are grey with the hover reason "attached house". The panel lists them among the reasons lots don't fit, e.g. "31% of house lots here are semis or row houses, where the free designs don't apply."
  - **Side panel headline:** counters that count up. "Could: [X] lots may fit a free City design ([P]% of house lots)." "Did: [Y] multiplex permits since May 2023." "That's about 1 permit for every [X/Y] lots that could." Plus the most common reason lots don't fit, in plain words.
- **Trend chart:** multiplex permits per month in this ward since 2022, from Tiger Data (`GET /ward/{id}/trend`), with a marker at October 2026 when the free designs arrived.
- **Labels:** permits are "multiplex permits since 2023, before the free designs existed", so Suplex is a baseline for whether the new designs change anything. Counts are upper bounds ("may fit", never "will be built").
- **No rankings:** every ward shows its own numbers. Never "best ward", "worst ward" or a leaderboard.

**Feature 3: Ward briefing (the AI).**

- A one-page, plain-language summary for any ward. Gemini writes it only from the numbers our engine computed: what may fit, the most common blocking rule, permits issued, what isn't checked, and three neutral questions a resident could ask candidates (the same three for everyone, never naming a candidate).
- Every number links to its source (the ward map or the dataset page).
- A standalone, shareable page with its own link, `/b/{ward_id}?lang=xx`, served by the AI service (Simone), with a language picker, a copy button, print styles and the ward's permit trend chart. The ward panel's "Get the ward briefing" button opens it.
- Cached briefings for the demo ward in every language.

### 2.5 Non-negotiable principles

- Code decides fit. AI only phrases numbers the engine produced; the validator (section 7.4) rejects anything else.
- No candidate names, parties or positions anywhere.
- Every result is labelled **"Screening only, not a permit or legal advice."**
- Neutral wording throughout: no "threat" or "opportunity" framing.
- The old house disappearing in the 3D view carries a small "illustrative new-build scenario" label.

### 2.6 Out of scope (do not build, do not spec)

AI policy what-ifs · AI matching family members to homes · AI extraction or explanation of site-specific exceptions (exceptions are flag-only) · the minor-variance guide · reading a neighbour's variance notice · cost or rent modelling · AI photo renders · any chat interface. The floor-plan "dollhouse" view is a stretch goal only after everything else works.

### 2.7 Competitors and our angle

- [LotMore](https://lotmore.ca/multiplex-toronto): a free Toronto address check with a 3D "Envelope Report"; it leads into paid architecture services; no City designs, no ward view.
- [VanPlex PlexCheck](https://www.vanplex.ca/toronto-multiplex/): a free zoning and cost check, no 3D.
- [Toronto Multiplex Tracker](https://malcolmkennedy.com/to-multiplex-map/): a live map of building permits creating 1–6 dwelling units since 2022, with dots, ward totals and trends; independent and open source ([GitHub](https://github.com/zuzubak/to-multiplex-map)). It shows what was permitted, not what could be built. **Prior art for our "reality" half:** credit it in the Devpost, mirror its permit rule, and use its counts as a sanity check.
- **Our angle:** the City's own four designs, the "could" half (every lot checked against them), the permission vs. reality gap by ward, and a free, neutral, open-data tool.

### 2.8 The 4-minute demo

| Time | Beat |
|---|---|
| 0:00–0:30 | Hook: the 30-second pitch, opening with "Since 2023, every house lot in Toronto has been allowed four homes." |
| 0:30–1:30 | Address check: a judge types their street (or a backup address). The street builds itself; the design rises or fails with the exact reason. Show the checklist and "too close to call" if it applies. |
| 1:30–2:30 | Click "See your ward": the 3D street fades into the ward map. Lots fill green and grey in a ripple outward from the judge's lot, gold permit dots drop in, counters count up to the headline gap. |
| 2:30–3:20 | Generate the ward briefing, click one number to show its source, translate it once. |
| 3:20–4:00 | How it works (City data, rules in code with bylaw sections, AI only phrases computed numbers) and limits (screening only, what isn't checked, the uncertainty band). |

The 0:30 to 1:30 beat ends with one line while the panel scrolls: "and because this lot is too close to call, step one is a survey; because it's a heritage property, Heritage Planning is next, each with the City's own link."

**Demo safety.** Two backup addresses (one that fits, one that fails or is too close to call), one demo ward with a pre-generated briefing, cached API responses for all of these so the demo works without the server or Wi-Fi (section 6.7), and the offer "your street, or a family member's" so no one has to show their home address.

---

## 3. Architecture and contracts

### 3.1 Components

```
                 ┌──────────────────────────── Browser ────────────────────────────┐
                 │  web app (React + TS + Vite, :5173)                              │
                 │  3D lot view (react-three-fiber) · ward map (MapLibre) · panels  │
                 └───────┬───────────────────────────────┬──────────────────────────┘
      GET /search, /check, /ward/{id},                   POST /explain, /briefing
      /ward/{id}/trend, /static/*                        GET /b/{ward_id}?lang=xx  (shareable page)
                 ▼                                        ▼
  ┌──────────────────────────────┐          ┌──────────────────────────────┐        ┌──────────────┐
  │  API  (FastAPI, :8000)       │◀─────────│  AI service (FastAPI, :8001) │───────▶│  Gemini API  │
  │  engine in-process           │ GET      │  prompts · validator · cache │        └──────────────┘
  │  loads data/out/* at startup │ /ward/*  │  serves /ai/page/ at /b/     │
  └──────┬───────────────────────┘          └──────────────────────────────┘
         │ reads                                   ▲ built against /contracts/fixtures first
         ▼                                         │
  data/out/suplex.gpkg · ward_summary.json · wards/{id}.geojson · permits.geojson · trend_cache/{id}.json
         ▲                        ▲                                   ▲
         │ pipeline (Yuvi)        │ batch run (engine, Andrew)        │ pipeline/tiger/cache_trends.py
  City open data (CKAN)    one engine, same code as /check     Tiger Data (TimescaleDB): permits hypertable,
                                                               permits_ward_month continuous aggregate
```

Rules that follow from the diagram:

- **One engine.** `/check` and the batch run import the same `suplex_engine` package, so a lot can never get a different answer on the map than in the address check.
- **The address check never touches Tiger Data or Gemini.** `/check` reads only the in-memory data. Trend data comes from Tiger Data through a cache; the explanation is a separate call the panel makes after the result is already on screen.
- **Everything the browser needs for the demo can be served from cache** (section 6.7).
- **The AI service reads ward data from the API over HTTP** (`SUPLEX_API_URL`, default `http://localhost:8000`) and falls back to `/contracts/fixtures` when the API is down, so it can be built and demoed on its own.

### 3.2 Repository layout

```
suplex/
├── CLAUDE.md                 root rules for every Claude session (full text in section 9)
├── MASTERSPEC.md             this document
├── README.md                 the Devpost answers, dataset links, run instructions (Simone writes, Andrew merges)
├── .gitignore                data/, .env, node_modules, venv, caches
├── requirements.txt          one root Python environment for engine, api, pipeline and ai
├── contracts/                Andrew (Simone may edit contracts/copy/*.json directly)
│   ├── designs.json          the four City designs (Appendix B)
│   ├── engine_config.json    uncertainty band and thresholds (Appendix C)
│   ├── design-tokens.css     shared colours and type (Appendix D)
│   ├── schemas/*.schema.json JSON Schema for every response and file (Appendix A)
│   ├── types.ts              TypeScript mirror of the schemas (Appendix A)
│   ├── copy/                 user-facing strings: labels.json, not_checked.json, reasons.json, questions.json, disclaimers.json
│   ├── tiger/schema.sql      hypertable, continuous aggregate, compression (Appendix E)
│   ├── fixtures/             sample responses and files (Appendix F)
│   └── validate.py           checks every fixture against its schema
├── engine/                   Andrew: suplex_engine package + tests
├── api/                      Andrew: FastAPI app, static file routes, demo cache
├── pipeline/                 Yuvi: download, permits, build_lots, checks, tiger/
├── web/                      Jayden: Vite app
├── ai/                       Simone: FastAPI AI service, prompts, validator, cache, page/
├── docs/                     Simone: decisions.md, mockups/, test-lots.md, tiger.md, devpost.md
├── pitch/                    Simone: deck, demo script, qa.md, rehearsal log
└── data/                     gitignored; raw/ and out/ shared through the team drive
```

### 3.3 Live API (Andrew, `/api`)

FastAPI, one process, loads `data/out/suplex.gpkg` and the batch outputs at startup into GeoPandas frames with spatial indexes. Target: `/check` in under one second for any Toronto address; startup under 90 seconds citywide.

| Endpoint | Purpose | Notes |
|---|---|---|
| `GET /health` | liveness | returns data dates, lot count, engine version |
| `GET /designs` | the four designs | serves `/contracts/designs.json` |
| `GET /search?q=&limit=8` | address autocomplete | prefix match on the normalized `ADDRESS_FULL` ("32 nine" → "32 Nineteenth St"); minimum 2 characters; at most 8 results; one result per lot |
| `GET /check?address_id=` (or `lot_id=`, or `lon=&lat=`) | the address check | finds the lot, runs the engine for all four designs, returns the full `CheckResponse` (3.8) |
| `GET /ward/{id}` | ward summary | the ward's entry from `ward_summary.json`, plus `lots_url`, `permits_url`, `trend_url`, `briefing_url` |
| `GET /ward/{id}/trend` | monthly permit series | Tiger Data through the query module; on any error or a 2 s timeout, serves `data/out/trend_cache/{id}.json`; `source` says which |
| `GET /static/wards/{id}.geojson` | per-ward lot results | static file, gzip; the map loads it in the background during the address check |
| `GET /static/permits.geojson` | permit points, all wards, since 2022 | static file |

Errors are JSON: `{"error": "address_not_found"}` with 404, `{"error": "outside_toronto"}` with 404 for coordinates outside the ward polygons, `{"error": "bad_request", "detail": "..."}` with 400. CORS is open for `localhost` ports and the demo host.

**Demo cache.** `api/cache/` holds full responses for the backup addresses and the demo ward, written by `python -m api.cache_demo` (A11). When `SUPLEX_DEMO_CACHE=1`, the API serves a cached response whenever one exists for the request. The web app has its own copy of the same files (section 6.7), so the demo survives the API dying too. **Built in A9 (2026-10-17):** `api/demo_cache.py` names the files exactly as the web's `public/demo-cache/` does (`search.<query>.json` with the query normalised as `/search` does and runs of anything but a-z and 0-9 turned into one `-`, `check.<address_id>.json`, `check.lot.<lot_id>.json`, `ward.<id>.json`, `trend.<id>.json`, `lots.<id>.geojson`, `permits.geojson`; lon/lat lookups are never cached), so one writer fills both folders; a cached `CheckResponse` is served with `meta.cached` true and every cached answer carries an `X-Suplex-Cache` header naming its file. With the mode on and no data directory, the API still starts: `/health` says `mode: demo_cache_only`, `/designs` reads the contract file, and any request the cache cannot answer gets 503 `data_unavailable`. Unexpected errors are JSON 500s that keep the CORS headers.

### 3.4 Batch run (Andrew, `engine/suplex_engine/batch.py`)

Runs the same engine over every lot in the processed file. `python -m suplex_engine.batch --ward 04` for the dev ward, `--all` for the city. Outputs into `data/out/`:

| File | Content |
|---|---|
| `ward_summary.json` | one entry per ward plus a `city` entry: lots by class and reason; lots that may fit (any design and per design); too-close-to-call, doesn't-fit and not-checked counts; top blocking rules with counts; attached share; flag counts; permits since May 2023 by year and by kind; the headline numbers; data dates (schema in Appendix A) |
| `wards/{id}.geojson` | simplified lot polygons (EPSG:4326, 0.5 m simplification) with a result per design, the class, flags and the top blocking rule; **no addresses, no parcel area** (Appendix A) |
| `permits.geojson` | copied from Yuvi's public permit points file |
| `batch_report.md` | counts per ward, run time, engine version, designs version, and the sanity checks (every ward's classes sum to its lot count; dev-ward hand-checked lots still pass) |

Permit counts per ward come from Tiger Data through `pipeline/tiger/queries.py`; if Tiger Data is unavailable, from Yuvi's `permit_counts.json`. The file records which.

**As built (A10, 2026-10-17).** Each lot's `LotInput` is built by the API's own loader (`api/store.py`, whose `load()` takes a `bbox`) and run through `run_check`, so the map and the address check cannot disagree; each ward is cut west to east into strips of about 1,500 lots that run in parallel (`--workers`, default half the cores), each reading only its strip of the GeoPackage plus 160 m. Also written: `data/out/batch/{id}.json`, one ward's counts, so `--ward 04` rebuilds `ward_summary.json` from every ward run so far. Definitions the contract left open: a lot's **best result** is the best of its four designs and the **limiting rule** `k` is the blocking rule of the first design (in `designs.json` order) with that result, or its first borderline row; **could** is the lots whose best design fits (an upper bound); **top_blocking_rules** counts lots by the rule that blocks their best design; **flags** count every lot in the ward that carries the flag, and `any_on_fitting_lots` counts lots whose best design fits and that carry a review flag (never `site_exception`); the **city** entry sums the wards, and its permits add the 17 with no ward once all 25 wards are present. The feature `id` (and `properties.id`) is the parcel id, so the map's click can open `/check?lot_id=`; never shown. `batch_report.md` runs the sanity checks itself: the summary validates against its schema, all 25 wards present, every ward's classes, best results and per-design results sum to its lot count, no engine errors, one valid feature per lot under 8 MB gzipped, the 19 hand-checked lots keep their expected class and results, and (when the counts are local) the city permits equal `permit_counts.json`. Run time: about 350 lots a second on 10 workers (the engine was made about three times faster first, with byte-identical output).

### 3.5 Tiger Data (Yuvi, `/pipeline/tiger`)

- A free Tiger Data cloud service (PostgreSQL + TimescaleDB). Connection string in `.env` as `TIGER_DSN`, never committed.
- `permits` is a hypertable on `issued_at`. Columns: permit id, revision, issue date, ward, dwelling units created, units lost, kind, multiplex flag, lat, lon, address point id (Appendix E).
- `permits_ward_month` is a continuous aggregate: ward, month, permit count, units, for multiplex permits.
- Compression on the full history (chunks older than 7 days), with the before and after sizes recorded in `/docs/tiger.md` for the Devpost.
- `queries.py` exposes `ward_trend(ward_id, since="2022-01-01")`, `ward_count_since(ward_id, since)` and `all_wards_count_since(since)`. The API and the batch run import it.
- `cache_trends.py` writes `data/out/trend_cache/{id}.json` for all 25 wards (the API's fallback).
- Time-boxed: dropped at Hour 14 if it is not working. The local permits file still powers the headline, the map dots and "permits near you".

### 3.6 AI service (Simone, `/ai`)

FastAPI on port 8001. Gemini through the `google-genai` SDK with structured JSON output. Endpoints `POST /explain`, `POST /briefing`, `GET /b/{ward_id}?lang=xx` (the shareable page), `GET /health`. Prompt templates, validator and caching in section 7.

### 3.7 Web app (Jayden, `/web`)

React + TypeScript + Vite; three.js through react-three-fiber (with drei helpers) for the 3D lot; MapLibre GL JS with OpenFreeMap tiles for the ward map; no map key. Section 6.

### 3.8 Contracts (Andrew, `/contracts`, Hour 0 to 1)

The contracts are the only interface between people. **Changes go through Andrew** (a message plus a PR to `/contracts`), except `contracts/copy/*.json`, which Simone edits directly. Full schemas, the TypeScript types and example fixtures are in Appendices A and F. The summary:

| Contract | Produced by | Consumed by | Summary |
|---|---|---|---|
| `designs.json` | Andrew | engine, web, AI | id, name, units, bedrooms, width, length, height, storeys, side yards, assumed setbacks, derived minimum lot, where allowed, floors for the 3D view, source sheet |
| `engine_config.json` | Andrew | engine, web | uncertainty band (0.5 m, 2 pp), larger-building thresholds, radii, sixplex wards |
| `SearchResponse` | API | web | `results[]` of `{address_id, address_full, ward_id, ward_name, lon, lat}` |
| `CheckResponse` | API, demo cache | web, AI (`/explain`) | address, lot (class, reason, zone fields, width, depth, area, flags, local polygons), `designs[]` with a result, a blocking rule, a placement polygon and a `rules[]` checklist, `not_checked[]`, `permits_nearby`, `context` (buildings and trees in local metres), `meta` |
| `WardResponse` | API | web, AI (`/briefing`) | the `WardSummaryEntry` plus urls |
| `TrendResponse` | API | web, briefing page | `series[]` of `{month, permits, units}` since 2022-01 with zero months filled, `markers[]`, `source` |
| `ExplainRequest` / `ExplainResponse` | web → AI | web | input: a `CheckResponse`, optional `design_id`, `lang`; output: `template_text` with `{{keys}}`, resolved `text`, `numbers{}` map, `validated`, `source` |
| `BriefingRequest` / `BriefingResponse` | web or page → AI | briefing page, web | input: a `WardSummaryEntry`, optional `TrendResponse`, `lang`; output: title, `sections[]`, `questions[]`, `numbers{}` with source urls, `links`, `disclaimer`, `validated`, `source` |
| `ward_summary.json` | batch | API | `WardSummaryEntry` per ward plus `city` |
| `wards/{id}.geojson` | batch | web | lot polygons with compact properties `id, c, b, r, k, f, a, v` |
| `permits.geojson` | pipeline | batch, API, web | points with `id, d, w, u, k`; no permit numbers, no addresses |
| `tiger/schema.sql` | Yuvi | Tiger Data | hypertable, continuous aggregate, compression policy |
| `copy/*.json` | Simone | web, AI, page | result labels, reasons, "what we don't check", the three questions, disclaimers |
| `design-tokens.css` | Jayden via Andrew | web, page | colours, fonts, radii, shadows |

**Enumerations used everywhere** (exact strings):

- `DesignId`: `fourplex_narrow`, `fourplex_wide`, `sixplex_narrow`, `sixplex_wide` (short map keys `fn`, `fw`, `sn`, `sw`)
- `Result`: `fits`, `borderline`, `no_fit`, `not_checked` (labels: Fits · Too close to call · Doesn't fit · Not checked)
- `LotClass`: `condo`, `non_residential`, `older_bylaw`, `larger_building`, `unmeasurable`, `attached`, `checked` (roads and reserves are dropped before classification and never appear)
- `RuleId`: `detached_building`, `units_allowed`, `lot_width`, `lot_depth`, `building_length`, `height`, `lot_coverage`
- `FlagId`: `heritage_register`, `heritage_district`, `ravine`, `trca`, `site_exception`, `vacant` (short keys `hr`, `hd`, `rv`, `tr`, `ex`, `vc`)
- `PermitKind`: `multiplex`, `secondary_suite`, `laneway_garden`, `other`
- `WardId`: two-digit zero-padded string, `"01"` to `"25"`, equal to City Wards `AREA_SHORT_CODE`

### 3.9 The local frame for the 3D view

Every `*_local` coordinate in a `CheckResponse` is `[x, y]` in metres, EPSG:2952, relative to the **lot centroid**: x east, y north. The 3D view needs no projection library. The response also gives:

- `frame.origin`: the centroid as `lon, lat` and `x_2952, y_2952`
- `lot.frontage_edge_local`: the two endpoints of the street-facing edge
- `lot.front_bearing_deg`: compass bearing (0 = north, clockwise) from the lot centroid toward the midpoint of the frontage edge, so the camera can start on the street looking at the lot
- `designs[].placement_local`: the four corners of the design's footprint, aligned to the frontage edge, front wall at the front setback, centred between the side yards
- `designs[].buildable_local`: the lot inset by that design's required setbacks (front, rear, both sides), to paint the buildable area
- `designs[].setbacks_local`: four polygons (`front`, `rear`, `left`, `right`) for the translucent setback strips
- `context.buildings[]`: footprints of neighbouring buildings within 150 m with `avg_height_m`, `kind` (`house` under 12 m, `large` otherwise) and `on_lot` (true for the building that gets squashed away)
- `context.trees[]`: `[x, y]` positions within 150 m, decoration only

Floors for the 3D view come from `designs.json` (`levels[]`: name, height, area, whether stepped back; `homes[]`: label, bedrooms, which levels) so the labels ("Basement home, 2 bedrooms") never have to be typed in the web app.

### 3.10 Hosting and the demo safety net

- The API and the AI service run on a laptop for the demo (both bind to `0.0.0.0` so a second laptop can be the display). Vultr hosting only if it is free and quick; the laptop copy stays the primary.
- The web app is served by `vite preview` on the demo laptop, with cached responses for the backup addresses and the demo ward built into `web/public/demo-cache/` (section 6.7).
- Rehearsal rule: at Hour 30 the demo must run with Wi-Fi off, the API stopped and the AI service stopped, using the cache alone.

---

## 4. Data pipeline, permits and Tiger Data (Yuvi, `/pipeline`)

### 4.1 Working rules

- Everything is free City of Toronto Open Data unless noted. Download the **GPKG** versions; some GeoJSON variants are stale (the 2952 GeoJSON files were last modified in 2024 or early 2025 while the GPKG and 4326 files refresh daily).
- All distance and area maths in **metres in EPSG:2952**. Export EPSG:4326 for the web.
- Some dataset pages wrongly show "Retired". The City's data API lists them as active (`is_retired: false`, verified 2026-10-17), so ignore the label.
- API pattern: `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=<dataset-slug>`. Datastore previews (first rows, exact field names) at `.../datastore_search?resource_id=<id>&limit=5`.
- Never commit raw downloads or large processed files. `data/` is gitignored; share `data/out/` through the team drive and commit only scripts, schemas and small samples.
- Every script takes `--ward 04` for the dev subset and `--all` for the city. Develop on Ward 04 so runs stay fast; the final build covers all of Toronto.

### 4.2 Datasets (field names verified against the City's datastore on 2026-10-17; details in Appendix G)

| Purpose | Dataset | File | Size | Key fields and gotchas |
|---|---|---|---|---|
| Address to lot | [Address Points](https://open.toronto.ca/dataset/address-points-municipal-toronto-one-address-repository/) | `address-points-4326.gpkg` (a `-2952.gpkg` twin exists; avoid the 1.15 GB shapefile) | 208 MB | 525K points, daily. `ADDRESS_POINT_ID` (the id), `ADDRESS_FULL`, `LO_NUM`, `LINEAR_NAME_FULL`, `CENTRELINE_ID`, `WARD` ("03"), `WARD_NAME`, `ADDRESS_CLASS`, `CLASS_FAMILY_DESC`, `MAINT_STAGE`. No parcel id: join to lots point-in-polygon. |
| Lot shapes | [Property Boundaries](https://open.toronto.ca/dataset/property-boundaries/) | `property-boundaries-4326.gpkg` | 161 MB | 498K parcels, daily. `PARCELID`, `FEATURE_TYPE` (COMMON / CONDO / CORRIDOR / RESERVE; keep COMMON and CONDO as lots (condos become "not checked"), keep CORRIDOR for the street-edge test, drop RESERVE), `STATEDAREA` (text, "524.11 sq.m"). Not survey-accurate. No frontage field. |
| Zoning | [Zoning By-law](https://open.toronto.ca/dataset/zoning-by-law/) | `zoning-area-4326.gpkg`, `zoning-height-overlay-4326.gpkg`, `zoning-lot-coverage-overlay-4326.gpkg` | 21 + 7 + 4 MB | Zone area: `GEN_ZONE` (integer: 0 Residential, 1 Open Space, 2 Utility and Transportation, 4 Employment Industrial, 5 Institutional, 6 Commercial Residential Employment, 101 Residential Apartment, 201 Commercial, 202 Commercial Residential), `ZN_ZONE` ("RD"), `ZBL_SECTN` ("10.20"), `FRONTAGE` (required minimum, m), `ZN_AREA`, `UNITS`, `COVERAGE`, `ZN_EXCPTN` (Y/N), `EXCPTN_NO`, `ZN_STRING`, `ZN_STATUS` (the readme says **5 = not part of By-law 569-2013**, but the current file only holds 0 to 3, so the pipeline infers status 5 for lots no zone polygon covers by at least 25%). Height overlay: **`HT_LABEL`** (float metres; confirmed by Yuvi, not `HT_HEIGHT`). Coverage overlay: `PRCNT_CVER` (%); Ward 04 has no coverage polygons, 57% of lots citywide do. `-1` or null means not set. GIS amendments stop at June 2023, so multiplex permissions are hand-coded. Exception text is not in the data. |
| Permits | [Building Permits – Active](https://open.toronto.ca/dataset/building-permits-active-permits/) and [Cleared](https://open.toronto.ca/dataset/building-permits-cleared-permits/) | `building-permits-active-permits.csv` (68 MB, 202K rows) and `cleared-building-permits-since-2017.csv` (150 MB); or the datastore dumps | 218 MB | Both active, refreshed daily. Fields (verified): `PERMIT_NUM`, `REVISION_NUM`, `PERMIT_TYPE`, `STRUCTURE_TYPE`, `WORK`, `STREET_NUM`, `STREET_NAME`, `STREET_TYPE`, `STREET_DIRECTION`, `POSTAL`, `GEO_ID`, `WARD_GRID` (a grid code like "E2034", **not** the ward), `APPLICATION_DATE`, `ISSUED_DATE`, `COMPLETED_DATE`, `STATUS`, `DESCRIPTION`, `CURRENT_USE`, `PROPOSED_USE`, `DWELLING_UNITS_CREATED` (**text**, often null), `DWELLING_UNITS_LOST` (text), `EST_CONST_COST`. One project appears as several rows (building, plumbing, drain permits share a number prefix: "22 128979 PLB"). Units lost is almost always zero, so unit counts are gross. |
| 3D neighbours | [3D Massing](https://open.toronto.ca/dataset/3d-massing/) | `3DMassingShapefile_2025_WGS84.zip` (plain shapefile, not the multipatch) | 81 MB | 428K buildings, annual. Fields (verified from the file): `MIN_HEIGHT`, `MAX_HEIGHT`, `AVG_HEIGHT`, `HEIGHT_MSL`, `SURF_ELEV`, `HEIGHT_SRC`, `BLDG_SRC`, `LONGITUDE`, `LATITUDE`. **No id column**: use the feature index. **The `.prj` is Web Mercator (EPSG:3857), not WGS84** despite the file name; reproject to 2952. Use `AVG_HEIGHT` for extrusion and for the larger-building test. "Illustrative only." |
| Wards | [City Wards](https://open.toronto.ca/dataset/city-wards/) | `city-wards-data-4326.gpkg` | 0.5 MB | `AREA_SHORT_CODE` ("09"), `AREA_NAME`, `AREA_DESC`. The 25-ward set. |
| Flags | [Heritage Register](https://open.toronto.ca/dataset/heritage-register/) (points), [Heritage Conservation Districts](https://open.toronto.ca/dataset/heritage-conservation-districts/), [Ravine Protection Area](https://open.toronto.ca/dataset/ravine-natural-feature-protection-area/) (2018), [TRCA Regulated Area](https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/ArcGIS/rest/services/TRCA_Regulation_Limit2/FeatureServer) (ArcGIS; query by bounding box, GeoJSON out) | small | Flag only, never calculate. The Heritage Register has two files with the same name; take the newer one. |
| Visuals only | [Street Tree Data](https://open.toronto.ca/dataset/street-tree-data/) | 4326 GPKG | 176 MB | Tree positions are geocoded to the parcel address, so decoration only. Last in priority. |

Direct download URLs for every file above are in Appendix G, so `download.py` needs no browsing.

### 4.3 Permits: the multiplex rule (first task, Hour 0 to 4)

**Rule A (primary).** Mirror the Toronto Multiplex Tracker's filtering logic (its README, `dbt/models/marts/multiplex_permits.sql`), then split by kind:

1. Union the active and cleared files. Keep rows with an `ISSUED_DATE` on or after 2022-01-01.
2. Parse `DWELLING_UNITS_CREATED` as an integer; keep 1 to 6.
3. Keep rows whose `STRUCTURE_TYPE` does not start with `SFD`, **except** rows whose `WORK` is `Second Suite (New)` or `New Laneway / Rear Yard Suite`, which are kept regardless.
4. Collapse to one row per project: group by the permit number without its type suffix (the first two tokens of `PERMIT_NUM`), keep the earliest issued row with the largest unit count. Record how many rows this removed.
5. Classify `kind`: `secondary_suite` when `WORK` is `Second Suite (New)`; `laneway_garden` when `WORK` is `New Laneway / Rear Yard Suite`; `multiplex` when **units created is 2 to 6** (a structure type or use that names 2 to 6 units, such as "2 Unit - Detached", does not count on its own: about 830 such permits create one unit, a suite in a house, and would push the May 2023 to Nov 2024 count from 446 to 1,278); otherwise `other`. The distinct `STRUCTURE_TYPE`, `WORK` and `PROPOSED_USE` values with counts are in `pipeline/REPORT.md`.
6. Geocode: join `GEO_ID` to Address Points `ADDRESS_POINT_ID`; for rows that miss, match `STREET_NUM` + `STREET_NAME` + `STREET_TYPE` (+ `STREET_DIRECTION`) against `LO_NUM` + `LINEAR_NAME_FULL`. Report the match rate; 90% or better is the bar.
7. Ward: from the address point's `WARD`, or point-in-polygon with City Wards when missing.

**Sanity checks (must be printed by `checks.py` and pasted into `/docs/decisions.md`):**

- `multiplex` permits issued May 1, 2023 to Nov 30, 2024 should land near the City's **452**. Within about 15% is a pass; if far off, inspect the kind classifier before touching the rule.
- Ward counts since 2022 should be close to the Toronto Multiplex Tracker's ward totals (read them off its map).

**Rule B (fallback), only if Rule A fails the checks:** "permits for new residential buildings with 2–6 units": `STRUCTURE_TYPE` or `PROPOSED_USE` names 2 to 6 units and `WORK` indicates a new building. Label it exactly that way everywhere ("permits for new residential buildings with 2–6 units"), and record the rule used in the Devpost and in `ward_summary.json` (`permit_rule`).

**Outputs** (`data/out/`):

- `permits.parquet`: all kept rows with every source column, `kind`, `lat`, `lon`, `address_point_id`, `ward_id`, `geocode_method`. Internal only.
- `permits.geojson`: public points, since 2022, properties `id` (sequential), `d` (issue date), `w` (ward id), `u` (units created), `k` (kind). **No permit numbers, no addresses.**
- `permit_counts.json`: per ward: `since_may_2023` by kind, `by_year` for 2022 to 2026, `units_since_may_2023`.

### 4.4 The processed citywide file (`data/out/suplex.gpkg`, EPSG:2952)

Built by `build_lots.py`. One GeoPackage, spatially indexed, that the API loads at startup.

| Layer | Geometry | Columns |
|---|---|---|
| `lots` | polygon | `parcelid`, `feature_type` (COMMON or CONDO only), `stated_area`, `area_m2` (from geometry), `ward_id`, `zn_zone`, `gen_zone`, `zbl_sectn`, `zn_string`, `frontage_min_m`, `zn_area`, `units_max`, `coverage`, `zn_exception` (Y/N), `exception_no`, `zn_status`, `ht_overlay_m`, `coverage_overlay_pct`, `sixplex_overlay` (bool), `flag_heritage_register`, `flag_heritage_district`, `flag_ravine`, `flag_trca`, `address_count` |
| `corridors` | polygon | the street space, for the street-edge test. The current Property Boundaries file has no CORRIDOR parcels, so this layer is derived: the ward area minus every parcel, cut into 250 m tiles, with negative synthetic `parcelid` values (19,243 tiles; 98.0% of lots touch one). Water and rail edges can also read as street, so the engine keeps its nearest-address-point fallback. RESERVE is dropped |
| `addresses` | point | `address_point_id`, `address_full`, `address_norm` (lowercase, single spaces), `lo_num`, `linear_name_full`, `ward_id`, `parcelid`, `address_class`, `class_family_desc`, `maint_stage` |
| `buildings` | polygon | `building_id` (shapefile feature index), `avg_height_m`, `max_height_m`, `height_src`, `footprint_m2`, `parcelid` (largest overlap) |
| `trees` | point | `tree_id` (optional layer, last priority) |
| `wards` | polygon | `ward_id`, `ward_name`, `sixplex_overlay` (`full`, `partial`, `none`) |
| `sixplex_overlay` | polygon | the overlay area: the union of wards 04, 09, 10, 11, 12, 13, 14, 19 and 23 (all of 23, see below) |

Joins, in order:

1. **Lots:** Property Boundaries where `FEATURE_TYPE` is COMMON or CONDO. Compute `area_m2` from geometry; keep `STATEDAREA` text for display and cross-checks.
2. **Lot → ward:** largest overlap with City Wards.
3. **Lot → zone:** largest overlap with Zoning Area; copy the fields above. A lot with no zone polygon covering at least 25% of it, or whose zone has `ZN_STATUS` = 5 (none in the current file), keeps `zn_zone` null and `zn_status` 5 (the engine classifies it `older_bylaw`; 4.8% of COMMON lots citywide).
4. **Lot → overlays:** largest overlap with the height overlay (`ht_overlay_m`) and the coverage overlay (`coverage_overlay_pct`); null when none.
5. **Lot → sixplex overlay:** true when the lot centroid is inside the overlay layer.
6. **Lot → flags:** heritage register points within the lot; heritage districts, ravine areas and the TRCA regulated area intersecting the lot. `site_exception` is derived later by the engine from `zn_exception`.
7. **Address → lot:** point-in-polygon; `address_count` on the lot.
8. **Buildings:** reproject from EPSG:3857, compute `footprint_m2`, assign `parcelid` by largest overlap. Keep every building (neighbours are needed for the 3D view), not just those on house lots.

**Ward 23 is fully inside the overlay.** By-law 654-2025 applies to the Toronto and East York Community Council area (wards 04, 09, 10, 11, 12, 13, 14, 19; the by-law's Diagram 2) and to the "Scarborough North (23) Ward Area" (Diagram 1), whose outline matches the City Wards polygon for Ward 23 (checked by Yuvi; map in `pipeline/data/sixplex_overlay_map.png`). The earlier reading that only part of Ward 23 qualified was wrong: the by-law's description of the lands (Steeles, Neilson and the Rouge, the 401, Midland) is the ward itself. `pipeline/data/sixplex_overlay_ward23.geojson` holds the ward polygon, the build unions it with the eight wards, and no ward is `partial`.

### 4.5 Data dates

`build_lots.py` writes `data/out/data_dates.json` with the `last_refreshed` value from each dataset's `package_show` response at download time. The API returns it in `meta.data_dates`, the ward summary repeats it, and the briefing page prints it.

### 4.6 Tiger Data

Schema in Appendix E. The load order is: `schema.sql` (hypertable, aggregate, policies) → `load.py` (reads `permits.parquet`, inserts with `COPY` or batched `executemany`) → `CALL refresh_continuous_aggregate('permits_ward_month', NULL, NULL)` → the compression policy runs or is forced with `SELECT compress_chunk(c) FROM show_chunks('permits') c` → record `hypertable_size('permits')` and `hypertable_compression_stats('permits')` before and after in `/docs/tiger.md`.

`queries.py` uses `psycopg` with a 2 second connect timeout and a 2 second statement timeout, returns plain dicts, and raises `TigerUnavailable` on any error so the API can fall back to the cache without inspecting the exception.

### 4.7 Pipeline acceptance checks (`checks.py`)

Prints, for the dev ward and for the city: lot counts by class inputs (COMMON, CONDO), the share of lots with a zone, with `ZN_STATUS` 5, with each overlay, with each flag; the address join rate (addresses with a lot); the building join rate; the permit geocode rate; the 452 check; a comparison of `area_m2` to `STATEDAREA` (median ratio should be close to 1.0). Yuvi pastes the output into `/docs/decisions.md` at each checkpoint.

---

## 5. Engine rules and the uncertainty band (Andrew, `/engine`)

The engine is a pure Python package, `suplex_engine`, with no web or database imports. Inputs are the lot, its neighbours and the designs; output is a `CheckResult` that the API serializes as a `CheckResponse` and the batch run reduces to the ward files. Every rule carries its bylaw section (Toronto Zoning By-law 569-2013, [Chapter 10](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter10_5.htm)).

### 5.1 Inputs

- From `suplex.gpkg`: the lot row (section 4.4), the lot polygon, corridor polygons within 5 m, buildings within 150 m, trees within 150 m, address points on the lot.
- From `/contracts/designs.json`: width, length, height, building area, units, side yards, assumed setbacks, where allowed.
- From `/contracts/engine_config.json` (Appendix C): the uncertainty band, thresholds and radii.
- From `permits.geojson`: points within 500 m (count and positions only).

### 5.2 Lot geometry (`geometry.py`)

1. **Street-facing edge.** Take the lot boundary's segments that lie within 0.5 m of a `corridors` polygon (the derived street-space layer, section 4.4, since the parcel file has no CORRIDOR parcels); merge adjacent segments whose directions differ by under 15° into edges. If no corridor touches the lot, fall back to the boundary edge nearest the lot's address point. **Rear lanes (A8, 2026-10-17):** the derived street-space layer includes public lanes, so 34% of Ward 04 lots have two or more street edges and 78% of those have a lane behind, not a corner; when the lot has an address point, the street edges are walked from the one nearest that point outward and every edge parallel to an edge already kept (direction within the 15° merge angle) and apart from it (more than 3 m) is dropped; of an opposite pair the edge nearer the address point wins, so a lane loses whenever the address point sits on the street half of the lot (about 2,700 Ward 04 house lots changed frontage; an address on the lane half keeps the lane, a known limit). Then, on a corner lot (two or more remaining street edges) the front lot line is the **shorter** street edge, following the by-law's corner-lot convention. If no edge is found, or the chosen edge is under 3 m long, the lot is `unmeasurable`.
2. **Street frame.** Rotate the lot so the frontage edge lies on the x axis with the lot in positive y. All measurements below are in that frame; the response is reported in the centroid frame of section 3.9.
3. **Lot depth.** The distance from the frontage line to the rear boundary along the line through the lot centroid, perpendicular to the frontage. This is a simplification of the by-law definition for irregular lots; say so in "What we don't check". **Skewed lots (T20, 2026-10-17):** when both side lot lines lean the same way by at least `placement.align_to_sides_deg` (2°, Appendix C) from the frontage normal, measured between a quarter and three quarters of that depth, the line through the centroid follows the side lot lines instead, and the depth is how far from the frontage line (still square to the street) it leaves the lot. Square to the frontage, the centre line of a skewed lot leaves through a side lot line and reads short (11 Harcroft Rd: 27.9 m on a 35 m parallelogram). A pie lot, whose sides lean opposite ways or only one of them, tapers rather than leans and keeps the square measurement (4 Olympus Ave).
4. **Width across the building band.** For a design of length L with front setback F, sample y from F to F + L every 0.5 m; at each y take the length of the lot's cross-section (the segment that contains the centroid's x). `actual_width` is the minimum. A pie-shaped or tapering lot is measured where the building would actually sit.
5. **Depth across the building's width.** After placing the building (step 5.4), sample x across its width every 0.5 m; at each x take the distance from the frontage line to the rear boundary. `actual_depth` is the minimum.
6. **Unmeasurable** also when the lot is a multipolygon, or when two or more separate building footprints over 20 m² sit on it. Corner lots are measured normally.

### 5.3 Lot classification order (first match wins)

| # | Class | Test | Shown as |
|---|---|---|---|
| 1 | (dropped) | `FEATURE_TYPE` CORRIDOR or RESERVE | never drawn |
| 2 | `condo` | `FEATURE_TYPE` CONDO | not checked: "condo building" |
| 3 | `non_residential` | `zn_zone` not in R, RD, RS, RT, RM (includes RA and RAC apartment zones, CR, E, O, I, UT and so on) | not checked: "not a residential house zone" |
| 4 | `older_bylaw` | `zn_status` = 5, which the pipeline sets when no zone polygon covers at least 25% of the lot (4.8% of lots; the file itself never carries status 5) | not checked: "an older zoning bylaw applies here" |
| 5 | `larger_building` | a building on the lot with `avg_height_m` over 16, or a footprint **clipped to the lot** over 350 m² (one massing polygon often covers a whole row of houses, section 0 item 6), or `address_count` of 4 or more (thresholds in `engine_config.json`, tuned on the A8 test lots: 3-storey houses read 12 to 16 m in the massing data, see `docs/test-lots.md`) | not checked: "already a larger building" |
| 6 | `unmeasurable` | section 5.2 | not checked: "lot shape too irregular to measure" |
| 7 | `attached` | section 5.7 | doesn't fit: "attached house (semi or row)" |
| 8 | `checked` | everything else | fits / too close to call / doesn't fit per design |

Then, on top and never changing the colour: **flags** (`heritage_register`, `heritage_district`, `ravine`, `trca`, `site_exception` when `zn_exception` is Y, with `exception_no`), and `vacant` when no building footprint over 20 m² intersects the lot ("no building here today"; checked normally). Every ward summary reports the count of lots in each class and reason, so "not checked" is visible, never hidden. Addresses outside the ward polygons are rejected by the API with `outside_toronto` before the engine runs.

### 5.4 Rules by zone

Required values come from the zone row and the design. Section numbers in the RD column were verified against the by-law text; the R, RS, RT and RM columns use the parallel sections of their chapters (the RT and RM entries marked ✓ were read on 2026-10-17; the R and RS entries come from the prompt).

| Rule (`rule_id`) | R (10.10) | RD (10.20) | RS (10.40) | RT (10.60) | RM (10.80) |
|---|---|---|---|---|---|
| Units allowed (`units_allowed`) | 4 everywhere since May 2023; 6 inside the sixplex overlay, and a sixplex must be a detached building (600.60.40(1), By-law 654-2025) | same | same | same | same |
| Front setback | 6.0 m (10.10.40.70(1)); neighbour averaging under 10.5.40.70(1) is not applied | 6.0 m (10.20.40.70(1)) | 6.0 m (10.40.40.70(1)) | 6.0 m (10.60.40.70(1)) ✓ | 6.0 m (10.80.40.70(1)) ✓ |
| Rear setback | 7.5 m (10.10.40.70(2)) | greater of 7.5 m and 25% of lot depth (10.20.40.70(2)) | greater of 7.5 m and 25% of lot depth (10.40.40.70(2)) | 7.5 m (10.60.40.70(2)) ✓ | greater of 7.5 m and 25% of lot depth (10.80.40.70(2)) ✓ |
| Side yards (zone minimum, each side) | 0.9 m (10.10.40.70(3)); the 0.45 m blank-wall option is not used | by the zone's **required** minimum frontage, the `f` value: under 6 m → 0.6; 6 to under 12 → 0.9; 12 to under 15 → 1.2; 15 to under 18 → 1.5; 18 to under 24 → 1.8; 24 to under 30 → 2.4; 30 or more → 3.0 (10.20.40.70(3)) | under 6 → 0.6; 6 to under 12 → 0.9; 12 to under 15 → 1.2; 15 or more → 1.5 (10.40.40.70(3)) | 0.9 m for a detached houseplex (10.60.40.70(3)(B)) ✓ | 1.2 m for a detached houseplex (10.80.40.70(3)) ✓ |
| Building length (`building_length`) | 17.0 m; 19.0 m on a lot at least 36 m deep with frontage under 10 m, or at least 40 m deep with frontage of 10 m or more (10.10.40.20 and the 10.10.40.30 depth limit) | 17.0 m for a permitted residential building where the required frontage is 18 m or less (10.20.40.20(1)); 19.0 m for a detached houseplex on the deep lots above (10.20.40.20(3)); the 19.0 m building-depth limit in 10.20.40.30(1) is met by construction because the building sits at the front setback line | 17.0 m / 19.0 m as RD (10.40.40.20) | no building length rule found for a houseplex (10.60.40.20 covers townhouses and apartment buildings on major streets only) ✓, so the rule reports `not_applicable` | 17.0 m (10.80.40.20(1), which names detached and semi-detached houses; applied to houseplexes conservatively) ✓ |
| Height (`height`) | greater of the height overlay value and 10.0 m for a detached houseplex (10.10.40.10(1)(C)); up to 10.5 m for a sixplex meeting the 600.60.40(2) conditions, which we do not check | 10.20.40.10(1)(C) | 10.40.40.10(1)(C) | 10.60.40.10(1)(C) ✓ | 10.80.40.10(1)(C) ✓ |
| Lot coverage (`lot_coverage`) | the coverage overlay value, but never below 45% for a houseplex (10.10.30.40(1)(D); By-law 848-2025); no limit where the overlay has no value | 10.20.30.40(1)(D) | 10.40.30.40(1)(D) | 10.60.30.40(1)(D) ✓ | 10.80.30.40(1)(D) ✓ |
| FSI and parking | not applied to a houseplex (10.10.40.40(1)(C)); no car parking required | 10.20.40.40(1)(C) | 10.40.40.40(1)(C) | ✓ | ✓ |

Notes:

- When the zone's `FRONTAGE` (f value) is -1 or null in RD or RS, use the lot's actual width for the side-yard bracket and say so in the rule's `detail`.
- The zone's `UNITS` (u value) is **not** applied: the 2023 multiplex permissions allow 4 units in every residential zone and 600.60.40(1)(A) sets 6 in the overlay regardless of a lower `u`. The GIS data predates both.
- Storey limits do not apply to houseplexes (10.60.40.10(2)(C) and the parallel sections), so storeys are not checked.
- Site-specific exceptions (`EXCPTN_NO`) can change any of these. They are a flag, never read or applied.

### 5.5 The fit test (`fit.py`)

For each design, in order:

1. **`detached_building`.** Required: a detached lot. Actual: `detached`, `attached` or `vacant`. Fails for class `attached` (no margin, no band).
2. **`units_allowed`.** Required: the design's units. Actual: units allowed on this lot (4, or 6 inside the overlay). Pass when actual ≥ required. Outside the overlay the sixplex designs fail here and the UI reads "not allowed in this ward". No band.
3. **`lot_width`.** Required = design width + left yard + right yard, where each yard is the larger of the design's own side yard (1.2 and 0.9 for Fourplex Narrow, 1.2 and 1.2 for the others, because the designs need their side walkways) and the zone minimum. Actual = the minimum width across the building band (5.2). Margin = actual − required. Band applies. `detail`: "5.5 m building + 1.2 m + 0.9 m side yards".
4. **`lot_depth`.** Required = front setback + design length + rear setback (rear uses the lot depth for the 25% zones). Actual = the minimum depth across the building's width; a design that, with its side yards, is wider than the lot's band width (the width row fails, borderline included) cannot be placed between the side lot lines, so its row reports the lot's centre-line depth instead of samples that would run past a leaning side line (A8, 2026-10-17). On a skewed lot (T20, below) the building follows the side lot lines and the row reports the front setback, the design length and the smallest clearance, square to the street, between the turned building's rear wall and the lot boundary straight behind it: the depth the lot offers this design, which on a lot that does not lean is the frontage-to-rear depth again. Margin = actual − required. Band applies. `detail`: "6.0 m front + 17.0 m building + 7.7 m rear (25% of 30.8 m)".
5. **`building_length`.** Required = the zone's allowed length for this lot (17.0 or 19.0, or `not_applicable` in RT). Actual = the design's length. Margin = allowed − actual. **No band** (two constants). Sixplex Narrow fails here on lots that do not meet the deep-lot test.
6. **`height`.** Required = the allowed height (greater of the overlay value and 10.0 m). Actual = the design's 10.0 m. Margin = allowed − actual. No band.
7. **`lot_coverage`.** Required = allowed percentage (greater of the overlay value and 45; `not_applicable` when the overlay has no value). Actual = design building area ÷ lot `area_m2` × 100. Margin = allowed − actual in percentage points. Band applies (2 pp).

**Placement.** The building footprint is a rectangle aligned to the frontage edge: front wall at the front setback, width centred between the side lot lines after the two required yards (any extra width split equally), length along the lot. It is computed for every design, including ones that do not fit, so the 3D view can show the red slice where the footprint crosses a setback or the lot line.

**Skewed lots (T20, done 2026-10-17).** When both side lot lines lean the same way by at least `placement.align_to_sides_deg` (2°) across the design's band, the rectangle turns to follow them, as houses on a diagonal street do: it stays the City's rectangle (pre-approved plans cannot be sheared), centred between the side lot lines measured square to them, and pushed back until its nearer front corner is the front setback from the front lot line. `lot_width` is then the lot's width square to its sides over the turned building's length (the street-parallel cross-section overstates it by 1/cos of the lean), and `lot_depth` as in step 4. The front and rear setback strips stay parallel to the street, the side yards follow the sides; `placement_local` keeps its corner order. Below 2° the frontage-square rectangle stays within about 0.3 m of the side yards over a 17 m building, so nothing changes there (600 random Ward 04 checks: 544 byte-identical, all 56 that changed are skewed). Ward 04 effect: 1,501 design results changed, 1,411 for the better and 90 for the worse; lots that may fit 3,611 → 3,992 (19.9% → 22.0% of house lots); `lot_depth` blocks 1,631 lots instead of 2,008. The worse ones are honest: the true width square to the sides is too small (303 Quebec Ave, 7.02 m against 7.6), or the turned rectangle's far rear corner needs 0.3 to 0.7 m more depth. Known limits: only two orientations are tried (square to the street, or along the sides), so a design that would fit at an angle in between reads a little pessimistic at the band's edge; and the lot-level `width_m` reported in the response is still the street-parallel cross-section at 6 m (it lives in `check.py`, held until next steps is decided).

**Result per design.**

- `no_fit` if any rule fails by more than the band (or any no-band rule fails). `blocking_rule` is the first failing rule in the order above, and the checklist keeps every row so the user sees everything that was checked.
- else `borderline` if any banded rule's margin is inside the band: `lot_width` and `lot_depth` within **0.5 m** either side of zero, `lot_coverage` within **2 percentage points**. A rule that fails by less than the band still counts as borderline, by design: the lot lines are not accurate enough to call it.
- else `fits`.
- `not_checked` for classes 2 to 6 (the `rules[]` list is empty and the lot-level `reason` explains).

A classic 25-foot lot is 7.62 m wide, right at the Fourplex Narrow's 7.6 m: expect many "too close to call" results on narrow streets, and say so in the demo.

**Non-geometric rules compare exactly.** Height, units and length are constants compared with constants; a margin of 0.0 there is a clean pass, not a borderline.

### 5.6 What we don't check (copy in `/contracts/copy/not_checked.json`)

Listed on every result, in this order: site-specific exceptions (`EXCPTN_NO`) · lots still under pre-2013 bylaws · heritage designation or districts · the ravine protection area · the TRCA regulated area · protected trees (30 cm and over) · sewer capacity · main wall height · encroachments · bedroom caps · the 10.5 m sixplex conditions · neighbour-averaged front setbacks · minor variances · the exact by-law definitions of lot depth and lot frontage on irregular lots (we measure where the building would sit). Some also appear as flags or "not checked" reasons per 5.3.

Plain-language note for attached houses (copy): "The City's free designs are for detached lots. You may still be able to add homes in other ways, such as a basement or garden suite, which Suplex doesn't check."

### 5.7 Attached houses (`attached.py`)

Multiplexes are allowed on semi and row-house lots, but the City's designs are detached buildings that need open side yards on both sides, so they do not apply. Detection from 3D Massing footprints:

- A lot is `attached` when a building footprint intersecting the lot by over 10 m² also extends into a neighbouring COMMON lot by over 20 m² (one footprint crossing the side lot line, the usual case for semis and rows: the other half is 40 m² or more, while the roof outline of a detached house crosses by 4 to 20 m²), **or** when the footprint on this lot touches a footprint on a neighbouring lot along a shared edge longer than 3 m (within a 0.05 m tolerance: two detached roofs sit 0.1 to 0.5 m apart outline to outline, so only polygons that touch count as a party wall).
- The numbers were tuned on the A8 hand-checked lots and the whole Ward 04 run (`docs/test-lots.md`): the old 4 m² and 0.3 m called 3,438 detached houses attached and put the ward's attached share at 60.6%; it is 41.6% now. Known limit: a semi whose party wall the massing splits with a visible gap (602 Indian Rd, 0.19 m) reads as detached. They live in `engine_config.json`.
- Every ward summary reports the attached share of house lots. It is a real finding about the limits of the free designs, especially in the older city.

### 5.8 Flags

Flags come from the lot row (section 4.4) and never change the result or the colour. Each flag has an id, a label, one plain sentence and a source url (copy in `/contracts/copy/reasons.json`). The address check lists them; the map shows small icons when zoomed to a street; the ward panel counts "of the lots that may fit, Y need extra review".

### 5.9 Hand-checked test lots (`engine/tests/test_lots.py`)

Five to ten real lots in Ward 04, chosen at Hour 8 to 10 by looking at the parcel fabric and massing in QGIS or a notebook, measured by hand, and written as expectations with tolerances. The set must include: a clear fit on a wide, deep lot; a borderline width (a 25-foot lot); a borderline depth; a clear fail (narrow lot); a corner lot; a pie-shaped lot; a semi; a row house; a condo; a non-residential lot; one lot with a heritage flag; and, if one exists nearby, a vacant lot. Each case asserts the class, the result per design, and the `lot_width` and `lot_depth` actual values within 0.3 m. `pytest` must pass before every merge to `main`. The list of test lots is documented in `/docs/test-lots.md` (parcel ids and what each one exercises).

### 5.10 Next steps (approved 2026-10-17)

`engine/suplex_engine/next_steps.py` holds one pure function, `build_next_steps(result: CheckResult, copy: dict) -> list[NextStep]`, called at the end of `run_check`. It reads only fields the engine already produced and never calls an API, a model or the network. Text, contacts and links come from `contracts/copy/next_steps.json`; the function fills the `{placeholders}` in the `why` lines with values from the result (formatted with the same rounding as the checklist: metres to two decimals).

**Inputs it uses:** `lot.class`, `lot.reason`, `lot.vacant`, `lot.flags[].id` and `detail` (the exception number), every `designs[].result`, and for borderline results the `rules[]` row that is inside the band (rule, required, actual, margin).

**The steps, their triggers and their sources** (in display order; a step appears at most once; the `why` line names the first trigger that matched):

| Group | Step id | Shown when | What it says (short) | Who | Source checked 2026-10-17 |
|---|---|---|---|---|---|
| Confirm first | `survey` | any design is `fits` or `borderline` | Get a current survey by an Ontario Land Surveyor; the City's plans need a site plan "referenced to a current survey", and Suplex measures from City lot lines that are not survey-accurate. When a result is `borderline`, this step comes first and its `why` names the rule and both values | Ontario Land Surveyor | [Pre-approved multiplex plans](https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-building-plans/pre-approved-multiplex-building-plans/); [Zoning Applicable Law Certificate](https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/preliminary-zoning-reviews-information/apply-for-a-zoning-review/zoning-applicable-law-certificate/) ("current land survey by an Ontario Land Surveyor") |
| Confirm first | `zoning_check` | class `checked` or `attached` | Ask Toronto Building's zoning staff (416-397-5330, weekdays 8:30 a.m. to 4:30 p.m.); for a written answer before applying, a Zoning Applicable Law Certificate reviews your drawings (up to three reviews; the fee is credited against the building permit) | Toronto Building | [Considerations when building multiplexes](https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/multiplex-housing/considerations-when-building-multiplexes/); ZALC page |
| Confirm first | `site_exception` | flag `site_exception` | Your zone carries site-specific exception x{number}, which can change setbacks, height, coverage or density limits; Suplex does not read exceptions. Look it up on the City's Interactive Zoning By-law Map or ask zoning staff | Toronto Building | Considerations page ("A Chapter 900 exception ... may still set an FSI maximum"); [Interactive By-law Map](https://map.toronto.ca/maps/map.jsp?app=ZBL_CONSULT) |
| Other approvals | `heritage` | flag `heritage_register` or `heritage_district` | This property is on the Heritage Register or in a Heritage Conservation District. Changes and demolition can need heritage approval, in some cases City Council's; talk to Heritage Planning before you design | Heritage Planning (heritageplanning@toronto.ca) | Heritage Register and Conservation District datasets; Ontario Heritage Act. **Y11 verifies the wording on the City's Heritage Planning page** |
| Other approvals | `ravine` | flag `ravine` | Without a ravine permit you cannot harm any tree there regardless of size, change the ground level, add fill, or build structures or retaining walls | Urban Forestry, Tree and Ravine Protection | [When to apply for a tree or ravine permit](https://www.toronto.ca/services-payments/building-construction/tree-ravine-protection-permits/when-to-apply-for-a-tree-or-ravine-permit/) |
| Other approvals | `trca` | flag `trca` | Building or replacing a home in the Toronto and Region Conservation Authority's regulated area usually needs a TRCA permit as well as the building permit; call TRCA planning staff first | TRCA | Tree and ravine page ("TRCA regulates development in or near watercourses, valleys, the Lake Ontario shoreline, and wetlands"); Ontario Regulation 41/24. **Y11 verifies on trca.ca** |
| Other approvals | `trees` | class `checked` or `attached` | Trees 30 cm or more across on your lot, and City street trees of any size, need a permit before work that could injure or remove them; a building permit does not cover trees, and the permit application includes a Tree Declaration Form | Urban Forestry | Tree and ravine page; [Tree Declaration form](https://www.toronto.ca/wp-content/uploads/2017/10/8fda-Tree_Declaration.pdf); plans page |
| Apply with a City design | `designer` | any design `fits` or `borderline` | A qualified design professional completes the site-specific parts: site plan, lot grading plan, the zoning and code matrices on sheets A010 and A011, and signed architectural, structural and mechanical letters. Changing the plan itself, even the heating or plumbing, means it is no longer pre-approved | Design professional | Plans page |
| Apply with a City design | `permit` | any design `fits` or `borderline` | Apply online through Toronto Building and enter the pre-approved plan number; you do not resubmit the City's drawings. The application also includes forms such as the Residential Infill Public Notice declaration and the Municipal Road Damage form | Toronto Building | Plans page; [Building permit fees](https://www.toronto.ca/services-payments/building-construction/apply-for-a-building-permit/building-permit-fees/) |
| Apply with a City design | `demolition` | any design `fits` or `borderline` and the lot is not `vacant` | Replacing the house needs a demolition permit, which can be added to the same application after you submit | Toronto Building | Plans page ("Demolition, mechanical, plumbing, and drain permits can be added after submission") |
| Apply with a City design | `fees` | any design `fits` or `borderline` | A multiplex with up to six units pays no development charges on its second to fourth units, the fifth and sixth are reduced to $0, and parkland cash-in-lieu is waived for the second to sixth, while the lot has no more than six units (a garden or laneway suite on the City's deferral program does not count) | Toronto Building | [By-law 845-2025](https://www.toronto.ca/legdocs/bylaws/2025/law0845.pdf), enacted July 24, 2025, amending Municipal Code 415-6 A (2) and 415-30 A (16); the City's "Considerations" page still says four units and is out of date |
| If the designs don't fit | `attached_options` | class `attached` | The City's free designs are for detached lots. On a semi or row-house lot you may still convert the existing house to up to four homes, or add a garden or laneway suite, if the rules are met (a semi cannot become a fiveplex or sixplex, 600.60.40(3)(D)) | Toronto Building | Considerations page; [Garden suites](https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/garden-suites/); [Laneway suites](https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/changing-lanes-laneway-suites-in-toronto/); By-law 654-2025 |
| If the designs don't fit | `custom_or_variance` | class `checked` and all four designs `no_fit` | None of the City's four designs fits as checked. A design professional can look at a custom design; plans that go beyond the zoning rules can apply to the Committee of Adjustment for a minor variance | Design professional; Committee of Adjustment | Considerations page; [Committee of Adjustment](https://www.toronto.ca/city-government/planning-development/committee-of-adjustment/) |
| If the designs don't fit | `ask_zoning` | class `condo`, `non_residential`, `older_bylaw`, `larger_building` or `unmeasurable` | Suplex could not check this lot ({reason}). Toronto Building's zoning staff can tell you what is allowed: 416-397-5330, weekdays 8:30 a.m. to 4:30 p.m. | Toronto Building | Considerations page |

**What a few real lots get** (from `docs/test-lots.md`; these become the tests). The flag-driven steps (`site_exception`, `heritage`, `ravine`, `trca`) also appear wherever the lot carries that flag; the table shows the steps the result itself drives:

| Lot | Result | Steps, in order |
|---|---|---|
| 281 Armadale Ave | Fourplex Narrow too close to call on width (7.45 m against 7.6 m) | `survey` (why: the width margin), `zoning_check`, `site_exception` if flagged, `trees`, `designer`, `permit`, `demolition`, `fees` |
| 22 Baby Point Rd | fits, heritage register and district | `survey`, `zoning_check`, `heritage`, `trees`, `designer`, `permit`, `demolition`, `fees` |
| 155 Vine Ave | attached (row house) | `zoning_check`, `trees`, `attached_options` |
| 34 Rexford Rd | all four `no_fit` on width | `zoning_check`, `trees`, `custom_or_variance` |
| 1 Ripley Ave | condo, not checked | `ask_zoning` |
| 20 Grafton Ave | vacant, all `no_fit` | `zoning_check`, `trees`, `custom_or_variance` (no `demolition`: nothing to demolish) |

**Copy file** `contracts/copy/next_steps.json`:

```json
{
  "checked_on": "2026-10-17",
  "groups": { "confirm": "Confirm first", "approvals": "Other approvals for this lot",
              "apply": "Apply with a City design", "alternatives": "If the free designs don't fit" },
  "footer": "Screening only, not a permit or legal advice. Steps and contacts come from City of Toronto pages checked on {checked_on}; confirm with the City before you rely on them.",
  "steps": {
    "survey": {
      "group": "confirm",
      "title": "Get a current survey of your lot",
      "text": "The City's plans need a site plan based on a current survey by an Ontario Land Surveyor. Suplex measures from City lot lines, which are not survey-accurate.",
      "who": "An Ontario Land Surveyor",
      "links": [{ "label": "Pre-approved multiplex plans", "url": "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-building-plans/pre-approved-multiplex-building-plans/" }],
      "sources": [{ "url": "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-building-plans/pre-approved-multiplex-building-plans/", "quote": "referenced to a current survey" }]
    }
  },
  "why": {
    "borderline": "Because the {design} is too close to call on {rule}: this lot measures {actual} m against {required} m needed.",
    "any_fit": "Because at least one City design may fit this lot.",
    "flag": "Because this lot is {flag_label}.",
    "has_building": "Because there is a house on this lot today.",
    "attached": "Because this is a semi or row-house lot.",
    "no_fit": "Because none of the four City designs fits as checked.",
    "not_checked": "Because Suplex could not check this lot."
  }
}
```

The `sources` entries are never shown in the UI; they are the audit trail for Simone's review and the Devpost. Every step in the table above has one.

**Contract change** (Andrew, A14): `CheckResponse` gains `next_steps: NextStep[]` (Appendix A), ordered, empty only for an address outside Toronto (which never reaches the engine). The four `check.*.json` fixtures gain their lists. `/explain` ignores the field: the AI never phrases or reorders steps.

---

## 6. Web app and visual direction (Jayden, `/web`)

The 3D moment is the hook, so it must look like a polished animated scene, not grey GIS software. Build it against `/contracts/fixtures` from Hour 0; switch to the live API by changing one base URL.

### 6.1 Stack and structure

React 18 + TypeScript + Vite · `three`, `@react-three/fiber`, `@react-three/drei` · `maplibre-gl` · a small state store (zustand) · no UI framework; plain CSS with the shared tokens. No map key: OpenFreeMap style `https://tiles.openfreemap.org/styles/positron` (light, so the green and grey lots read clearly).

```
web/
├── index.html
├── package.json
├── vite.config.ts          alias @contracts → ../contracts; proxy /api → :8000 and /ai → :8001 in dev
├── public/demo-cache/      cached responses for the backup addresses and the demo ward (6.7)
└── src/
    ├── api/client.ts       one fetch wrapper: base URLs, 3 s timeout, demo-cache fallback, typed by @contracts/types
    ├── state/store.ts      query, selected address, check result, ward data, design filter, view (landing | lot | ward), 2D flag
    ├── components/Search/           autocomplete input
    ├── components/Lot3D/            Scene, Camera, Lighting, Street (neighbours), Lot (outline, setbacks, buildable), OldHouse, Design (floors), Labels, Trees, FailSlice
    ├── components/ResultPanel/      Header, DesignTabs, Checklist, NotChecked, Flags, PermitsNearby, Explanation, SeeYourWard
    ├── components/WardMap/          Map, LotsLayer, PermitsLayer, SearchedLot, DesignFilter, Legend, WardPanel, Counters, TrendChart, BriefingButton
    ├── components/Transition/       lot → ward and back
    ├── components/Fallback2D/       top-down SVG of lot, setbacks, footprint
    └── styles/                      imports ../../contracts/design-tokens.css
```

URL state so any view can be reloaded or bookmarked: `?a=<address_id>` (address check), `?ward=04` (ward view), `&design=fourplex_narrow` (filter), `&view=2d` (fallback), `&demo=1` (force cache).

### 6.2 Screens and flow

1. **Landing.** The search box centred, the tagline, one line: "Screening only, not a permit or legal advice." Two example chips ("Try: " plus the two backup addresses) so the judge can click instead of typing.
2. **Address check.** Full-bleed 3D scene; the result panel on the right (420 px) with the four design tabs; the "See your ward" button at the bottom of the panel. The panel is scrollable; the scene keeps orbiting.
3. **Ward view.** Full-bleed MapLibre map; the ward panel on the left (400 px) with the headline counters, the reasons, the design filter, the trend chart and "Get the ward briefing"; the legend bottom-right, always visible; "Back to your lot" top-left.
4. **Outside Toronto / not found.** A calm message in the search dropdown: "Suplex covers addresses inside the City of Toronto. Try one of the examples."

Desktop first (the demo runs on a projector). The layout must not break at 1280 × 720. Mobile is not required.

### 6.3 The 3D sequence (the street builds itself)

All timings are starting points; tune them to the mockup video. Use `@react-spring/three` or drei's animation helpers; keep every animation driven by one timeline so it can be restarted when a different design tab is chosen (steps 4 to 7 replay; the street stays).

| Step | Duration | What happens |
|---|---|---|
| 0 Pin drop | 0.4 s | A map pin falls from 40 m onto the lot centroid with a small bounce. |
| 1 Camera swoop | 1.2 s | The camera moves from top-down at 120 m to a 35° tilt at about 45 m, positioned on the street side (`lot.front_bearing_deg`), ease-out. |
| 2 Neighbours ripple | 1.5 s | Each building in `context.buildings` scales up from 0 with a slight overshoot, delayed by its distance from the lot (about 8 ms per metre). Buildings with `kind: house` get a cartoon gable roof (ridge along the footprint's long axis, 30° pitch, ridge 2.5 m above the wall height); `large` buildings stay flat with a 0.5 m parapet. Wall colours come from the neighbour palette, picked by a seeded hash of `building_id` so they never change between runs. |
| 3 Lot appears | 1.7 s | The lot outline traces itself (0.8 s, animated dash offset), the four setback strips fade in translucent (0.5 s), the buildable area paints onto the ground (0.4 s). |
| 4 Old house goes | 0.6 s | The `on_lot` building squashes to the ground (scale y → 0 with a widening squash) and a small label appears: "illustrative new-build scenario". Vacant lots skip this step and show "no building here today". |
| 5 Floors drop | 0.45 s each, 0.15 s stagger | From `designs.json` `levels[]` (homes from `homes[]`): the basement rises out of the ground first, then the ground, second and third floors drop from 6 m above their resting height with a squash-and-stretch landing (scale y 0.85 and x, z 1.08 for 120 ms, then back). Each home has its own warm colour. The top floor is stepped back 1.4 m at the front and rear main walls. |
| 6 Labels | 0.3 s each | Floating labels per home: "Basement home · 2 bedrooms", from `homes[].label` and `homes[].bedrooms`. |
| 7 Orbit | 24 s per revolution | A slow orbit around the lot; drag to orbit manually; the orbit resumes after 5 s idle. |

About six seconds before the orbit starts. **Fails show the problem:** when a design's result is `no_fit` or `borderline`, the part of the footprint that lies outside `buildable_local` (or outside the lot) renders as a translucent red slab with a small label naming the rule ("needs 7.6 m of lot width; this lot has 6.9 m"); for a `borderline` result the slab is the stripe pattern instead of red and the label says "too close to call".

**Lighting and trees.** Warm golden-hour light: a directional light (warm white, elevation about 25°, from the south-west) with soft PCF shadows, a hemisphere light (sky token above, warm ground below), a subtle fog matching the sky gradient tokens, and a warm off-white ground. Trees at `context.trees[]` positions as two or three overlapping puffy spheres on a short trunk, size seeded by position. Decoration only.

**Performance.** Merge the neighbour geometry into one instanced mesh per material after the ripple finishes; cap the scene at 400 buildings and 300 trees; target 60 fps on an integrated GPU; drop shadows first if the frame rate falls under 40.

### 6.4 The result panel

- **Header:** the address, the ward name, the lot's width, depth and area (one line), and the disclaimer line.
- **Design tabs:** four tabs with an icon and a label for the result (check mark · tilde · cross · dash), never colour alone. Default tab: the best result in the order Fourplex Narrow, Fourplex Wide, Sixplex Narrow, Sixplex Wide. Switching a tab replays steps 4 to 7 of the 3D sequence for that design.
- **Checklist:** one row per rule: label, required, actual, margin (signed, with unit), a pass/borderline/fail icon, and the bylaw section as muted text; `detail` under the row when present. `not_applicable` rows show "no limit here".
- **What we don't check:** collapsed by default, the list from `contracts/copy/not_checked.json`.
- **Flags:** one chip per flag with its icon, label and sentence.
- **Permits near you:** "N multiplex permits within 500 m since May 2023" and the unlabelled dots drawn on the 3D ground plane as small gold discs at their local offsets (they are inside the 150 m scene or beyond it; draw those beyond 150 m at the edge of the ground disc). Never an address.
- **Explanation:** the Gemini text from `POST /explain` for the selected design, loaded after the result is on screen, with a skeleton while it loads, a language picker (the eight languages) and the `source` badge ("AI-written from the numbers above" or "Template"). If the AI service is unreachable, show the template fallback text that the web app can also produce itself from the same copy strings.
- **Your next steps** (5.10; Yuvi's `NextSteps.tsx`, mounted by Jayden): after the explanation, the `next_steps` list grouped under its four headings; each step shows its title, two lines of text, who to contact, the City links, and its `why` line as a muted chip; the footer disclaimer closes the list. Never colour-only, never reordered by the web app.
- **See your ward:** a primary button. Pressing it starts the transition (6.6). The ward data (`/ward/{id}` and `/static/wards/{id}.geojson`) is fetched in the background as soon as the check result arrives.

### 6.5 The ward map

- **Map:** MapLibre with the positron style, centred on the ward, `fitBounds` to the ward polygon with the panel's padding. Interactive, with zoom limited to 11 to 18.
- **Lots layer:** the per-ward GeoJSON source. `fill-color` by the active key: `b` for "All designs", `r.fn`, `r.fw`, `r.sn` or `r.sw` for a single design. `fits` → `--suplex-fit`; `borderline` → the stripe pattern (`fill-pattern` with a 12 px canvas image: pale green base, diagonal `--suplex-fit` stripes); `no_fit` → `--suplex-nofit`; `not_checked` → no fill. A thin outline appears from zoom 15 so lots become distinct on a street.
- **Permits layer:** circles from `/static/permits.geojson` filtered to `w == ward` and `k == "multiplex"` and `d >= "2023-05-01"`; radius interpolated from 6 px at zoom 12 to 10 px at zoom 17; `--suplex-permit` fill with a 1.5 px `--suplex-permit-outline` stroke. Drawn above the lots.
- **Searched lot:** a white 3 px outline on the checked lot with a gentle opacity pulse (2 s cycle).
- **Design filter:** five radio buttons. In wards whose `sixplex_overlay` is `none`, the two sixplex options are disabled with the text "not allowed in this ward"; in `partial` wards (23) they stay enabled and the lots outside the overlay show `no_fit` with the `units_allowed` reason on hover.
- **Hover:** a small tooltip with the result and the design, e.g. "May fit: Fourplex Narrow", "Too close to call: Fourplex Wide", "Doesn't fit: attached house", "Not checked: condo building". Never an address, never a parcel id.
- **Click:** opens that lot's address check (`/check?lot_id=`), exactly as if it had been searched; the map keeps its position for "Back to your lot".
- **Legend:** always visible: may fit (green square), too close to call (striped square), doesn't fit (grey square), multiplex permit since 2023 (gold dot), and the line "Screening only, not a permit."
- **Ward panel:** the headline counters count up over 1.5 s with an ease-out when the panel appears: "Could: X lots may fit a free City design (P% of house lots)." · "Did: Y multiplex permits since May 2023." · "That's about 1 permit for every Z lots that could." (Z = X ÷ Y rounded; when Y is 0 the line reads "No multiplex permits have been issued here since May 2023.") Then: the most common reason lots don't fit in plain words (from `top_blocking_rules[0]` and `contracts/copy/reasons.json`), the attached share sentence, the "of the lots that may fit, N need extra review" flag line, the not-checked counts with reasons, and the data dates. Then the trend chart (6.8) and the "Get the ward briefing" button, which opens the AI service's `/b/{ward_id}?lang=<current>` in a new tab.
- **Labels on the panel:** "multiplex permits since 2023, before the free designs existed"; "may fit" and "upper bound", never "will be built". No ranking language anywhere.
- **No list, no export, no download of lots.** Not even for debugging in production builds.
- **Near your lot (Y15, decision 19):** when the map opens from an address check, the ward panel shows one box, "Near your lot (within 500 m)" · "N lots in this ward may fit a free City design (an upper bound)" · "M multiplex permits issued since May 2023", and the map draws that circle around the lot as a thin dashed line. The radius and M come from the check's `permits_nearby` (500 m, `nearby_permits_radius_m`), so they match the 2D plan view; N counts this ward's lots whose best result is `fits` and whose centroid lies within the radius of `context.origin`. No list and no addresses; the circle is not clickable. Hidden when the map opens without a check. Strings in `labels.json` `ward_map` (S15).

### 6.6 The transition

**Lot → ward** ("See your ward", about 4 s): the 3D scene fades to white over 0.6 s while the map, already loaded underneath, starts at the lot's position at zoom 17 and flies out to the ward bounds over 2 s. As it flies, lots fill in a ripple outward from the searched lot (the `fill-opacity` of each lot is driven by a feature-state set on a timer keyed by its distance to the searched lot, about 1.5 s to cover the ward). The gold dots drop in with a 0.3 s stagger window after the ripple. The counters start when the dots land. **Ward → lot** ("Back to your lot"): the map flies back to the lot over 1.2 s, then the 3D scene fades in over 0.6 s with the street already built (no replay of the ripple), and the design floors replay (steps 5 to 7).

### 6.7 Cached demo mode, 2D fallback, accessibility

- **Cached demo mode.** `public/demo-cache/` holds the full responses for the two backup addresses and the demo ward: `search.<prefix>.json`, `check.<address_id>.json`, `ward.<id>.json`, `trend.<id>.json`, `lots.<id>.geojson`, `permits.geojson`, `explain.<address_id>.<design>.<lang>.json`. The fetch wrapper tries the live API with a 3 s timeout; on error or timeout it serves the cached file if one matches, and shows a small "cached" badge. `?demo=1` skips the live API entirely. `python -m api.cache_demo` writes these files from the API, and Jayden copies them in at Hour 24 and again at Hour 30.
- **2D fallback.** If WebGL is unavailable, the frame rate stays under 20 fps for 3 s, or `?view=2d` is set, show the top-down SVG: the lot outline, the setback strips, the buildable area, the design footprint (red slice where it fails), the frontage edge marked "street", and the neighbour footprints in grey. Same panel, same data.
- **Accessibility.** Fit or fail is never shown by colour alone: icon plus text everywhere, stripes and dots on the map. Colours are colour-blind-safe and contrast-checked for a projector (the green fill is never used for text; text is `--suplex-ink` on `--suplex-paper`). Keyboard: the search, tabs, filter and buttons are reachable in order; the 3D canvas is `aria-hidden` with the checklist as the accessible alternative; the trend chart has a visually hidden table. Motion: `prefers-reduced-motion` shortens every animation to 0.1 s and disables the orbit.

### 6.8 The trend chart

A small SVG bar chart component (no chart library in the web app) used in the ward panel: months on the x axis from 2022-01 to the latest month in `series[]`, permit counts as bars in `--suplex-permit`, integer y ticks, two vertical dashed markers from `markers[]` ("Multiplexes allowed citywide", May 2023; "Free designs released", October 2026), a hover tooltip with month and count, and the caption "Multiplex permits issued per month in this ward. Source: City of Toronto building permits, served from Tiger Data." plus the `source` badge when the data came from the cache. The briefing page draws the same chart with Chart.js (section 7.7).

### 6.9 Visual extras, only after the full flow works

Cars parked on the street, a few walking people, falling leaves in the golden light, a short confetti burst when a design fits, and a tilt-shift blur on the orbit. None of these start before Hour 28 and none are on the cut list because they never block anything.

### 6.10 Design tokens

The locked colours (green `#22B573`, grey `#C9CCD6`, gold `#FFC83D`) plus a v0 set for everything else are in Appendix D. Jayden finalizes the palette and type by Hour 2 and sends the file to Andrew for `/contracts/design-tokens.css`; Simone reviews. The briefing page uses the same file, so the two surfaces match.

---

## 7. AI layer: Gemini, the validator and the briefing page (Simone, `/ai`)

AI adds value here by phrasing and translating, never by deciding. Every number the model is allowed to mention comes from the engine's output; the model writes placeholders, not digits; a validator checks the result before anyone sees it.

### 7.1 The service

FastAPI on port 8001, `google-genai` SDK, Pydantic models for every request and response (mirroring `/contracts/schemas`). Configuration in `/ai/config.py`, all from the environment with defaults:

| Variable | Default | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | (required) | free key from Google AI Studio |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | the model id for development and for every live call; `gemini-3.8-flash` only for the one-off demo pre-generation after Hour 24 (set it in `.env` for that run, then set it back); `gemini-2.5-flash` dropped (decision 12) |

Free-tier limits as read in AI Studio by Simone on 2026-10-17 (all three allow 250,000 tokens a minute, which we never approach):

| Model | Requests per minute | Requests per day |
|---|---|---|
| `gemini-3.8-flash` | 5 | 20 |
| `gemini-3.5-flash-lite` | 15 | 500 |
| `gemini-2.5-flash` | 5 | 20 |
| `SUPLEX_API_URL` | `http://localhost:8000` | where the briefing page fetches ward data |
| `SUPLEX_WEB_URL` | `http://localhost:5173` | where number links point for "the ward map" |
| `AI_CACHE_DIR` | `ai/cache` | cached responses |
| `AI_LANGS` | `en,fr,zh-Hans,zh-Hant,es,tl,ta,pt` | the translation list |

```
ai/
├── main.py            FastAPI app: /explain, /briefing, /b/{ward_id}, /health; mounts /static → ../contracts
├── config.py
├── gemini.py          one function: generate_json(prompt, schema) with a single retry on 429 or a schema error
├── numbers.py         build the numbers map and allowed_numbers from a CheckResponse or a WardSummaryEntry
├── validator.py       section 7.4
├── templates.py       the plain-template fallback (7.5)
├── translate.py       the second-pass translation (7.6)
├── cache.py           sha256-keyed JSON cache
├── prompts/           explain.md, briefing.md, translate.md (the prompt text, read at startup)
├── pregenerate.py     writes the demo cache for the demo ward (all languages) and the backup addresses
├── tests/test_validator.py
└── page/              index.html, briefing.js, briefing.css (section 7.7)
```

### 7.2 `POST /explain`

Input: `{"check": CheckResponse, "design_id": DesignId | null, "lang": "en"}`. The service drops `check.context` (buildings and trees are irrelevant and large) and builds the numbers map (7.3) for the chosen design, or for the best design when `design_id` is null. Output: `ExplainResponse` with `template_text` (placeholders), `text` (resolved and formatted for the language), `numbers`, `validated`, `source` (`gemini` or `template`), `model`, `cached`.

The explanation is three to five short sentences: the result in plain words, the rule that decides it with its numbers, what the result does not mean ("screening only"), one next step ("a designer or the City's zoning examiner can confirm"), and for `borderline` a sentence about the lot lines not being survey-accurate. For `not_checked` it restates the reason and what the person can still do (for an attached house: the basement or garden suite note).

### 7.3 The numbers map and allowed numbers (`numbers.py`)

Every number the model may use is a key. For a check (per design): `lot_width_actual`, `lot_width_required`, `lot_width_margin`, `lot_depth_actual`, `lot_depth_required`, `lot_depth_margin`, `building_length_allowed`, `building_length_design`, `height_allowed`, `height_design`, `coverage_allowed_pct`, `coverage_actual_pct`, `units_allowed`, `units_design`, `permits_nearby_count`, `permits_nearby_radius_m`, `lot_area_m2`, `design_bedrooms`, `uncertainty_band_m`, `uncertainty_band_coverage_pp`. For a ward: `could_lots`, `could_pct`, `did_permits`, `lots_per_permit`, `borderline_lots`, `nofit_lots`, `not_checked_lots`, `house_lots`, `attached_pct`, `top_rule_count`, `flagged_fitting_lots`, `permits_2023`, `permits_2024`, `permits_2025`, `permits_2026`, `units_since_may_2023`, plus `by_design_<id>_fits` for the four designs. Each key maps to `{value, unit, label, source_url}`.

`allowed_numbers` is the set of strings the validator accepts as literals: every value above formatted raw, rounded to 0 and 1 decimals, with and without thousands separators; plus a fixed allow-list in `config.py`: the years 2013, 2022, 2023, 2024, 2025, 2026; the day 26 (election day); the by-law numbers 569, 2013, 654, 2025, 848; the design dimensions from `designs.json`; the unit counts 4 and 6; the radius 500; the band 0.5 and 2. Anything else is an invented number.

### 7.4 The validator (`validator.py`)

Runs on `template_text` (and on every section of a briefing) before anything is returned, shown or cached.

```python
PLACEHOLDER = re.compile(r"\{\{([a-z0-9_]+)\}\}")
NUMBER = re.compile(r"(?<![\w.])[-+]?\d[\d,]*(?:\.\d+)?(?![\w])")

def validate(template_text: str, numbers: dict, allowed_numbers: set[str],
             required_keys: set[str] | None = None) -> ValidationResult:
    keys = set(PLACEHOLDER.findall(template_text))
    unknown = keys - numbers.keys()                       # placeholder the input never offered
    missing = (required_keys or set()) - keys            # translation dropped a placeholder
    stripped = PLACEHOLDER.sub(" ", template_text)
    literals = {m.replace(",", "") for m in NUMBER.findall(stripped)}
    invented = literals - {a.replace(",", "") for a in allowed_numbers}
    return ValidationResult(ok=not (unknown or missing or invented),
                            unknown=unknown, missing=missing, invented=invented)
```

Policy: if `ok` is false, regenerate **once** with the complaint appended ("Your draft used the number 1300, which is not in the input. Use only {{placeholders}}."). If the second draft also fails, return the plain template (7.5). Never show unvalidated text. Every rejection is appended to `ai/logs/rejections.jsonl` (prompt hash, model, what was invented); the count becomes a line in the Devpost.

`tests/test_validator.py` must cover at least: an output containing "about 1,300 lots" when 1300 is not allowed (rejected); the same text with `{{could_lots}}` (accepted); an unknown placeholder (rejected); a translation missing one of the English placeholders (rejected); "By-law 569-2013" and "7.6 m" (accepted through the allow-list); "2 of the 4 designs" when 2 is not allowed (rejected, which is the intended strictness: the prompt tells the model to avoid counting). Run with `pytest ai/tests`.

### 7.5 The plain template (`templates.py`)

Deterministic English sentences assembled from the numbers map, one function per result and one per briefing section. They are written in the same neutral tone, use the same placeholders, and go through the same renderer, so the page cannot tell them apart except for the `source` badge. For languages other than English the fallback returns the English template with `translation_unavailable: true`; the page shows a one-line notice.

### 7.6 Translation (`translate.py`)

`lang` other than `en`: the service first gets the validated English result (cache or generate), then makes one translation call whose input is the English JSON with placeholders intact. Instruction: translate every string, keep each `{{key}}` exactly as written, add no numbers, keep the tone neutral and the sentences short, keep "Suplex" and the City's design names in English. The validator runs again with `required_keys` equal to the English placeholder set. The renderer formats numbers with `Intl.NumberFormat(lang)`. Cache key includes the language.

### 7.7 The shareable briefing page (`/ai/page/`)

Plain HTML, CSS and JavaScript (no build step), served by the AI service at `GET /b/{ward_id}?lang=xx`. The route returns `index.html` with `window.SUPLEX = {apiUrl, webUrl, wardId, lang, langs}` injected. The page then:

1. Fetches `GET {apiUrl}/ward/{wardId}` and `GET {apiUrl}/ward/{wardId}/trend`; with `?fixture=1` it loads `/static/fixtures/ward.04.json` and `trend.04.json` instead, so the page works before the API exists.
2. `POST /briefing` with `{ward, trend, lang}` and renders the `BriefingResponse`: the title ("Ward 04, Parkdale–High Park: multiplexes, before you vote"), the generated date and data dates, the sections in order (what may fit · the most common blocking rule · permits issued · what isn't checked · three questions to ask candidates), the trend chart, the disclaimer, and a "How these numbers were computed" footer with the dataset links.
3. Renders every `{{key}}` as `<a class="num" href="{source_url}" title="{label}">{formatted value}</a>`, so each number links to its source: the ward map (`{webUrl}/?ward=04`) for engine counts, the City dataset page for permit counts, and this page's methodology footer for the uncertainty band.
4. Language picker: a `<select>` of the eight languages that reloads with `?lang=`. Copy button: copies the resolved plain text plus the page link. Print styles: single column, no buttons, black text, links printed as footnotes.
5. Trend chart as a small inline SVG (built that way by Simone instead of Chart.js, so the page makes no external request and works in the Wi-Fi-off rehearsal): bars, two marker lines, a hover tooltip per month, a "show as a table" view, the same caption as the web app. Bars use `--suplex-permit-bar` (`#A27100`), a darker step of the permit gold that passes 3:1 on both surfaces. Styles import `/static/design-tokens.css` so the page matches the app.

Cached briefings: `pregenerate.py --ward 04 --langs all` fills the cache for the demo ward in every language and for the two backup addresses' explanations. The page serves from cache first, so the demo does not wait on Gemini.

### 7.8 Prompts (`/ai/prompts/`)

Written by Simone in the neutral tone of our copy. The skeleton the service fills in:

**explain.md**

> You write short, neutral, plain-language explanations of a zoning screening result for a Toronto resident. You will receive JSON with the result for one City of Toronto pre-approved multiplex design on one lot, and a `numbers` map. Rules: write 3 to 5 short sentences at a grade 8 reading level. Every number must be written as a placeholder from the `numbers` map, like `{{lot_width_actual}}`; never write digits. Do not count or compute anything. Do not give legal advice; say this is a screening, not a permit. Do not mention candidates, parties, elections or opinions. Do not use the words threat, opportunity, winner, loser, best or worst. Say "may fit", never "will be built". If the result is `borderline`, say the lot lines are not survey-accurate so the margin is inside the uncertainty band. If the result is `not_checked` or the lot is an attached house, restate the reason in plain words. Return JSON: `{"template_text": string}`.

**briefing.md**

> You write a one-page, neutral ward briefing about multiplex permissions in Toronto for residents, journalists and community groups. You will receive JSON with one ward's numbers computed by a rules engine, and a `numbers` map. Write five sections with the given ids and headings: `what_may_fit`, `blocking_rule`, `permits`, `not_checked`, `questions`. For the first four, write 2 to 4 short sentences each, grade 8 reading level, every number as a `{{placeholder}}` from the map, never digits, never computed or rounded by you. Counts of lots that may fit are upper bounds: say "may fit", "could", never "will". Permits are "multiplex permits since May 2023, before the free designs existed". Never compare this ward with other wards, never rank, never name a candidate or party, never use threat or opportunity framing. For `questions`, copy the three provided questions exactly. Return JSON: `{"title": string, "sections": [{"id": string, "heading": string, "template_text": string}]}`.

**translate.md**

> Translate the following JSON strings into {language_name}. Keep every `{{placeholder}}` exactly as written, in the same place. Do not add, remove or change any number. Keep "Suplex", "Fourplex Narrow", "Fourplex Wide", "Sixplex Narrow" and "Sixplex Wide" in English. Keep sentences short and neutral. Return the same JSON structure.

### 7.9 Calling Gemini (`gemini.py`)

The Gemini docs on 2026-10-17 show structured output through the Interactions API with a `response_format` carrying a JSON schema:

```python
from google import genai
from pydantic import BaseModel

client = genai.Client()  # reads GEMINI_API_KEY

class ExplainDraft(BaseModel):
    template_text: str

interaction = client.interactions.create(
    model=GEMINI_MODEL,
    input=prompt_text,
    response_format={"type": "text", "mime_type": "application/json",
                     "schema": ExplainDraft.model_json_schema()},
)
draft = ExplainDraft.model_validate_json(interaction.output_text)
```

If the installed SDK version has no `interactions`, use the older form: `client.models.generate_content(model=GEMINI_MODEL, contents=prompt_text, config={"response_mime_type": "application/json", "response_schema": ExplainDraft})` and read `response.text`. Either way, `generate_json()` retries once after 2 s on a 429 or a JSON parse error, then raises; the caller falls back to the template. Keep schemas flat; the docs warn that deeply nested schemas can be rejected. The free-tier limits are in the section 7.1 table. The demo needs about 16 generations (one ward in eight languages, two addresses × four designs in English), which is nearly the whole 20-a-day budget of `gemini-3.8-flash`, so the pre-generation order is: run everything with `gemini-3.5-flash-lite` first so the cache is complete, then, if the validator comparison favours it, overwrite the demo ward's briefings with `gemini-3.8-flash` inside that budget and keep the flash-lite files as the fallback. Never run the 3.8-flash pass before the Hour-24 lock. For the demo the full set is 20 requests (Ward 04 in eight languages, plus twelve explanations for the three addresses), the model's whole daily budget with no room for a retry, so the pass runs in stage order: Ward 04 in English and French, its other six languages, then 326 Quebec Ave and 281 Armadale Ave; anything left stays on the validated `gemini-3.5-flash-lite` cache.

### 7.10 What the Gemini judge sees

One click translates the ward briefing into any of eight languages, and the validator rejects any number the model invents, with the rejection log as evidence. The 30-second walkthrough (Simone, section 8.4) shows exactly that: generate, click a number to its source, translate, then show a logged rejection.

---

## 8. Team sections

Every task below has an id, a description, inputs, outputs, an acceptance check anyone can run, dependencies and an hour estimate. Hours are working hours; each person has about 24 to 27 in the 36. Tasks marked *optional* are the first to drop. Everyone builds in their own Claude Code session with the kickoff prompt at the end of their section; each prompt fits comfortably in normal usage limits because every task is scoped to one folder and one fixture set.

### 8.1 Andrew: engine, API, contracts, integration

**Owns:** `/contracts`, `/engine`, `/api`, the root files (`CLAUDE.md`, `README.md` merges, `.gitignore`, `requirements.txt`, `scripts/`). **Branch:** `main`. Merges everyone into `main`.

| ID | Task | Inputs | Outputs | Acceptance check | Depends on | Hours |
|---|---|---|---|---|---|---|
| A1 | Repo scaffold (Hour 0) | this spec | GitHub repo `suplex`; folders from 3.2; `CLAUDE.md` (section 9); `.gitignore`; `README.md` stub; `requirements.txt`; `.env.example`; `/docs/mockups/` with the video and the ward image; `/docs/decisions.md` started | all four teammates have cloned, created the root venv and run `pip install -r requirements.txt`; everyone has pushed a branch named after themselves | — | 1.0 |
| A2 | Contracts and fixtures (Hour 0–1) | Appendices A to F | every file in `/contracts` (schemas, `types.ts`, `designs.json`, `engine_config.json`, `design-tokens.css` v0, `copy/*.json` v0, `tiger/schema.sql`, `fixtures/*`, `validate.py`) | `python contracts/validate.py` passes; Jayden's app and Simone's service load the fixtures without edits | A1 | 1.5 |
| A3 | Hour-0 checks | Appendix H | three entries in `/docs/decisions.md`: whether the Sixplex Narrow sheet's "19 m" is a building depth (10.20.40.30) rather than a length; `AVG_HEIGHT` as the massing height; Ward 04 confirmed as the dev ward | the entries exist and name the source read | A1 | 0.5 |
| A4 | Lot geometry | section 5.2; synthetic polygons; the dev-ward GPKG once Yuvi has it | `engine/suplex_engine/geometry.py`, `engine/tests/test_geometry.py` | `pytest engine/tests/test_geometry.py` passes: a 7.62 × 30.5 m rectangle gives width 7.62 ± 0.01 and depth 30.5 ± 0.01; a corner lot picks the shorter street edge; a pie lot's width is the minimum across the building band; a flag lot is `unmeasurable` | A2 | 3.0 |
| A5 | Rules, config and designs loaders | section 5.4; Appendices B, C | `rules.py`, `config.py`, `designs.py`, `engine/tests/test_rules.py` | a table-driven test: for each zone, f value and lot depth in the test table, the required front, rear, side, length, height and coverage values equal the section 5.4 table; RT length returns `not_applicable`; RD with f = −1 falls back to the actual width bracket | A2 | 2.0 |
| A6 | Classification, attached check, fit test, placement | sections 5.3, 5.5, 5.7; the fixture lots | `classify.py`, `attached.py`, `fit.py`, `models.py` (dataclasses mirroring `CheckResponse`), `engine/tests/test_fit.py` | the fixture lots reproduce `check.fits.json`, `check.borderline.json`, `check.no_fit.json` and `check.not_checked.json`; a width margin of 0.49 m gives `borderline` and 0.51 m gives `fits`; a sixplex outside the overlay fails on `units_allowed` | A4, A5 | 3.0 |
| A7 | API v1 on the dev ward | Yuvi's dev-ward `suplex.gpkg`; `permits.geojson` | `api/main.py`, `api/store.py` (load, STRtree indexes), `/search`, `/check`, `/designs`, `/static/*`, CORS | `curl "localhost:8000/check?address_id=<a dev-ward id>"` returns in under 1 s and `python contracts/validate.py --url http://localhost:8000/check?address_id=...` validates it; Jayden renders it | A6, Y4 | 2.0 |
| A8 | Hand-checked test lots | section 5.9; QGIS or a notebook on the dev-ward GPKG | `engine/tests/test_lots.py`; `/docs/test-lots.md`; tuned thresholds written to `engine_config.json` | 5 to 10 lots covering the section 5.9 list; `pytest engine` green; the attached and larger-building thresholds documented with the lots that set them | A7 | 2.0 |
| A9 | Citywide switch, ward endpoints, fallbacks | Yuvi's citywide GPKG; Yuvi's `queries.py` and trend cache | `/ward/{id}`, `/ward/{id}/trend` (2 s Tiger timeout then cache), `/health`, `SUPLEX_DEMO_CACHE` mode | any Toronto address answers in under 1 s; startup under 90 s; memory under 4 GB; `/ward/04/trend` reports `source: tigerdata` with Tiger up and `source: cache` with `TIGER_DSN` unset | A7, Y5, Y6 | 3.0 |
| A10 | Citywide batch run | section 3.4 | `batch.py`; `data/out/ward_summary.json`, `data/out/wards/*.geojson`, `batch_report.md` | all 25 wards present; each ward's class counts sum to its lot count; `wards/04.geojson` is under 8 MB gzipped and loads in MapLibre in under 2 s; every test lot's batch result equals its `/check` result | A8, Y6 | 3.0 |
| A11 | Headline lock and demo cache (Hour 24) | batch outputs; the backup addresses from S9 | the `data/out` snapshot on the drive tagged `headline-locked`; `api/cache/*`; `web/public/demo-cache/*` handed to Jayden | with the data directory renamed away and `SUPLEX_DEMO_CACHE=1`, the API still serves both backup addresses and the demo ward | A10, S9 | 1.5 |
| A12 | Integration checkpoints and merges | PRs at Hours 6, 12, 18, 24, 30, 34 | `main` runs the demo after every checkpoint; `scripts/check.sh` | after each merge: `pytest engine ai` green, the API starts, `npm run build` succeeds, the demo flow works on `main` | — | 2.5 |
| A13 | Demo laptop setup and hosting | — | `scripts/demo.ps1` and `scripts/demo.sh` that start the API, the AI service and `vite preview`; Vultr only if free and quick, the laptop stays primary | the Hour-30 offline rehearsal passes with Wi-Fi off | A11 | 1.5 |

Total about 26.5 hours.

**3D scene taken over from Jayden (2026-10-17, 0.3):** Andrew's plan grows to 35 hours with A14 (0.5) and these three, which run in a separate Claude session on branch `andrew-3d` (kickoff prompt in 8.5):

| ID | Task | Inputs | Outputs | Acceptance check | Depends on | Hours |
|---|---|---|---|---|---|---|
| J8 | Fail visuals | `designs[].fail_slices_local` | a translucent red slab per failing slice, labelled with the rule and its numbers; a striped slab labelled "too close to call" for borderline results | the `no_fit` and `borderline` fixtures show the slabs; never colour alone | — | 2.0 |
| A16 | The four designs as the City drew them | the plan sets' elevations (A200 to A202, pages 16 to 18), sections (A300 on), floor plans (A100 to A104); the floor datums: ground 0.000, second 2.840, third 5.690, roof 8.529, parapet 8.800 m | a facade model per design in `web/src/components/Lot3D/models/`: openings at the drawn sizes and sill heights, the stepped-back third floor with its roof-deck guard, the entry stair and canopy, the lift, Juliet balconies, the basement walkout, cladding zones; `contracts/designs.json` `levels[]` set to the drawn floor-to-floor heights | next to each A200 front elevation the window count and positions match and heights match within 0.1 m; the floors still drop in one by one; `python contracts/validate.py` passes | J8 | 3.0 |
| A15 | Realism pass | section 6.3; the review in 0.4 | an offline Lightformer environment, ACES or AgX tone mapping, soft and contact shadows, N8AO ambient occlusion, physically based materials, procedural window and brick textures on neighbours, better roofs, a road and sidewalk strip, stylized trees with a wind sway; a PerformanceMonitor; the current look behind `?look=classic` | at least 50 fps on the demo laptop with 400 buildings; the whole sequence plays; reduced motion works; `npm run build` and `npx oxlint` pass | A16 | 3.0 |

**Kickoff prompt (paste into a fresh Claude Code session in the repo root, branch `main`):**

```
You are working in the Suplex repo with me, Andrew. Read CLAUDE.md first, then MASTERSPEC.md sections 1, 3, 5, 8.1, 9 and Appendices A, B, C and F. I own /contracts, /engine, /api and the root files; edit nothing else. We are on branch main.

Start with task A2 from section 8.1: create every file in /contracts exactly as Appendices A to F specify (schemas, types.ts, designs.json, engine_config.json, design-tokens.css, copy/*.json, tiger/schema.sql, fixtures, validate.py). Then write contracts/validate.py so it checks each fixture against its schema and exits non-zero on any failure, and run it. Commit after each file group with messages like "contracts: designs.json and engine_config.json".

Then continue with A4 (lot geometry) using test-driven development: write engine/tests/test_geometry.py from the acceptance check first, then geometry.py until it passes. Keep the engine pure Python (shapely, pyproj only; no FastAPI or database imports). Every rule must carry its bylaw section string from section 5.4. The uncertainty band and thresholds come from /contracts/engine_config.json, never from literals in code. AI never decides fit. Ask me before changing any contract; if a contract must change, change the schema, types.ts and the fixture together.
```

### 8.2 Yuvi: data pipeline and Tiger Data

**Owns:** `/pipeline` including `/pipeline/tiger`. **Branch:** `yuvi`. Produces `data/out/suplex.gpkg`, the permits files, the trend cache and the Tiger Data service.

| ID | Task | Inputs | Outputs | Acceptance check | Depends on | Hours |
|---|---|---|---|---|---|---|
| Y1 | Permits fields and rule check (Hour 0–1) | section 4.3; the two CSV URLs in Appendix G | `pipeline/download.py --permits`; `pipeline/permits.py --report` printing row counts, distinct `STRUCTURE_TYPE`, `WORK` and `PROPOSED_USE` values with counts, the `DWELLING_UNITS_CREATED` parse rate, and candidate `multiplex` counts for May 2023 to Nov 2024 | the report is pasted in `/docs/decisions.md` by Hour 1 with one line: "Rule A works" or "Rule B needed", and Andrew has been told | — | 1.0 |
| Y2 | Tiger Data sign-up | — | a free Tiger Data service; `TIGER_DSN` in `.env` (never committed); `pipeline/tiger/ping.py` | `SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb'` returns one row | — | 0.5 |
| Y3 | Permits file v1 | Y1; the Address Points GPKG | `data/out/permits.parquet`, `permits.geojson`, `permit_counts.json`; `pipeline/checks.py --permits` | geocode rate 90% or better; the May 2023 to Nov 2024 `multiplex` count within 15% of 452 (or Rule B adopted and written down); Ward 04's count is in the same range as the Toronto Multiplex Tracker's | Y1 | 3.0 |
| Y4 | Download everything and build the dev ward | Appendix G; section 4.4 | `download.py --all` (idempotent, resumable, prints `last_refreshed` into `data_dates.json`); `build_lots.py --ward 04` → `data/out/suplex.gpkg` with every layer | `checks.py --ward 04` passes: 95% or more of COMMON lots have a zone or `zn_status` 5; the address join is 95% or more; the massing layer is in EPSG:2952 with `avg_height_m` populated; the file is on the drive and Andrew's API loads it | — | 4.0 |
| Y5 | Tiger schema, loader, aggregate, compression, query module, trend cache | Y2, Y3; Appendix E | `pipeline/tiger/schema.sql`, `load.py`, `queries.py`, `cache_trends.py`; `/docs/tiger.md` with the before and after sizes; `data/out/trend_cache/*.json` for all 25 wards | `ward_trend("04")` returns a monthly series from 2022-01 with zero months filled; the aggregate's per-ward totals equal `permit_counts.json`; `hypertable_compression_stats` recorded; **go/no-go at Hour 14** | Y2, Y3 | 3.0 |
| Y6 | Citywide build and the Ward 23 overlay polygon | Y4 | `build_lots.py --all`; `pipeline/data/sixplex_overlay_ward23.geojson` (hand-drawn from By-law 654-2025 Diagram 2); `data_dates.json`; the citywide GPKG on the drive | 25 wards present; `checks.py --all` passes; a screenshot of the overlay polygon over a basemap in `/docs/`; build time recorded | Y4 | 4.0 |
| Y7 | Data QA and handover | A8 findings | fixes for duplicate address points on one lot, sliver parcels, lots straddling wards, buildings split across lots | Andrew's test lots pass on the citywide file; `checks.py` median `area_m2` to `STATEDAREA` ratio between 0.97 and 1.03 | Y6, A8 | 2.0 |
| Y8 | Trees layer *(optional)* | the Street Tree GPKG | the `trees` layer in the GPKG | present for the dev ward at least | Y6 | 1.0 |
| Y9 | Refresh and the Tiger Data material | — | one re-run of Y3 and Y5 at Hour 24 on the daily refresh; the Tiger Data Devpost section drafted with Simone; the 30-second walkthrough | the Devpost's permit numbers equal `ward_summary.json`; the walkthrough shows the hypertable, the aggregate query and the compression sizes | Y5 | 2.0 |
| Y10 | Checkpoints | — | — | present at Hours 6, 12, 18, 24 and 30 with the current `checks.py` output pasted in `/docs/decisions.md` | — | 2.0 |

Total about 22.5 hours.

**Re-plan approved 2026-10-17 (0.3):** Yuvi also builds the ward map (J5: section 6.5 and the J5 row in 8.3) in `web/src/components/WardMap/`, and owns next steps (8.5). His kickoff prompts for both are in 8.5.

**Kickoff prompt (paste into a fresh Claude Code session in the repo root, branch `yuvi`):**

```
You are working in the Suplex repo with me, Yuvi. Read CLAUDE.md first, then MASTERSPEC.md sections 1, 3, 4, 8.2, 9 and Appendices E and G. I own /pipeline, including /pipeline/tiger; edit nothing outside it. We are on branch yuvi. Raw data goes in data/raw/ and outputs in data/out/; both are gitignored, so never commit them.

Start with task Y1 from section 8.2: write pipeline/download.py with a --permits flag that downloads the two building permit CSVs from the URLs in Appendix G into data/raw/permits/, then pipeline/permits.py --report that loads both, prints the row count, the distinct values of STRUCTURE_TYPE, WORK and PROPOSED_USE with counts, how many rows have an integer DWELLING_UNITS_CREATED between 1 and 6, and how many rows Rule A from section 4.3 keeps with ISSUED_DATE between 2023-05-01 and 2024-11-30 by kind. The field names are verified; use them exactly. Do all spatial maths in EPSG:2952 with geopandas and shapely.

Then continue with Y3 and Y4. Print a check for everything you build (pipeline/checks.py) and paste the output into /docs/decisions.md through me. Ask Andrew before changing any contract or output file name.
```

### 8.3 Jayden: the web app

**Owns:** `/web`. **Branch:** `jayden`. Also writes `design-tokens.css` (sent to Andrew for `/contracts`; Simone reviews).

| ID | Task | Inputs | Outputs | Acceptance check | Depends on | Hours |
|---|---|---|---|---|---|---|
| J1 | Scaffold and the 3D test (Hour 0–1) | Appendix D; `fixtures/check.fits.json` | the Vite app from 6.1; a react-three-fiber scene showing the fixture lot polygon, its neighbours as boxes and a 5.5 × 17 × 10 m box inside the setbacks; tokens v0 sent to Andrew | 60 fps in Chrome on the demo laptop; a screenshot in `/docs/`; `npm run build` succeeds | A2 | 1.5 |
| J2 | Address search | `fixtures/search.json` | the autocomplete component (150 ms debounce, 2-character minimum, keyboard navigation, the outside-Toronto message); `src/api/client.ts` with the 3 s timeout and typed responses | typing "32 nine" lists the fixture address; Enter selects it and the URL gains `?a=`; a nonsense query shows the message | J1 | 2.0 |
| J3 | The 3D sequence v1 | section 6.3; the four `check.*.json` fixtures | `Lot3D/*` for steps 0 to 7 on one timeline; gable roofs for houses; seeded neighbour colours; golden-hour lighting; trees | the sequence plays from the fixture in about 6 s; switching a design tab replays steps 4 to 7; `prefers-reduced-motion` shortens everything | J1 | 4.5 |
| J4 | The result panel | section 6.4; the four fixtures; `contracts/copy/*.json` | `ResultPanel/*` including the explanation box that calls `/explain` (fixture first) with the eight-language picker and the "See your ward" button | all four result fixtures render; every state shows icon plus text; the checklist shows required, actual, margin and section; "cached" and "Template" badges appear when the response says so | J2 | 3.0 |
| J5 | The ward map | section 6.5; `fixtures/lots.04.sample.geojson`, `ward.04.json`, `permits.sample.geojson` | `WardMap/*`: layers, stripe pattern, design filter, legend, hover, click, panel with counters, "Get the ward briefing" | the fixture ward renders; the filter recolours by design; the sixplex options read "not allowed in this ward" when `sixplex_overlay` is `none`; hover never shows an address; the counters count up | J4 | 4.0 |
| J6 | The transition | section 6.6 | `Transition/*`; background preload of the ward data during the address check | lot → ward in about 4 s with the ripple, the dots and the counters; ward → lot in under 2 s; both work twice in a row without leaks | J3, J5 | 2.5 |
| J7 | The trend chart | `fixtures/trend.04.json` | the SVG chart with markers, tooltip, caption, hidden table | renders the fixture with markers at 2023-05 and 2026-10 | J5 | 1.5 |
| J8 | Live API switch and fail visuals | A7 then A9 running | the base URL config; the red slice and the striped slice with rule labels | a real dev-ward address renders end to end; the `no_fit` fixture shows the red slice at the failing edge | J3, A7 | 2.0 |
| J9 | 2D fallback, cached demo mode, accessibility | section 6.7; Andrew's cache files (A11) | `Fallback2D`; `?demo=1`; `public/demo-cache/`; keyboard and contrast pass | the demo flow runs with the API stopped; `?view=2d` shows the plan view with the same panel; Lighthouse accessibility 90 or better | J8, A11 | 2.5 |
| J10 | Polish and extras *(optional)* | — | lighting and material tuning; confetti on `fits`; leaves; cars | the Hour-30 rehearsal looks like the mockup video | J9 | 2.0 |
| J11 | Checkpoints | — | — | present at Hours 6, 12, 18, 24 and 30 with a build that runs on `main` | — | 1.5 |

Total about 27 hours (25 without J10).

**Re-plan approved 2026-10-17 (0.3):** J5 (the ward map) moved to Yuvi, J7 (the trend chart) to Simone, and the 3D work (J8, J10) to Andrew, who took over `web/src/components/Lot3D/`. Jayden gains 2 hours of polish on the landing search card and the UI that is not 3D, so his plan is 19.5 hours. His order is J4, J6, J9, the UI polish, then wiring in Yuvi's `WardMap` and mounting `NextSteps.tsx`. His revised kickoff prompt is in 8.5.

**Kickoff prompt (paste into a fresh Claude Code session in the repo root, branch `jayden`):**

```
You are working in the Suplex repo with me, Jayden. Read CLAUDE.md first, then MASTERSPEC.md sections 1, 2, 3, 6, 8.3, 9 and Appendices A, B, D and F. I own /web; edit nothing outside it. We are on branch jayden. Types come from /contracts/types.ts through the @contracts alias; never redefine them.

Start with task J1 from section 8.3: scaffold the Vite React TypeScript app in /web with three, @react-three/fiber, @react-three/drei, maplibre-gl and zustand; import ../contracts/design-tokens.css; then render /contracts/fixtures/check.fits.json as a react-three-fiber scene: the lot polygon from lot.polygon_local on the ground, each context.buildings[] footprint extruded to avg_height_m, and a 5.5 × 17 × 10 m box placed on designs[0].placement_local. Local coordinates are metres east and north from the lot centroid; map x to scene x and y to scene −z so north points away from the camera. Add golden-hour lighting and soft shadows. Check it runs at 60 fps.

Then continue with J2 and J3. Build everything against the fixtures first; the live API comes in J8 by changing one base URL. Fit or fail is never shown by colour alone. Never show an address on the ward map, and never add a list or export of lots. Ask Andrew before changing any contract.
```

### 8.4 Simone: the AI service, the briefing page, the story and all user-facing copy

**Owns:** `/ai`, `/docs`, `/pitch`, and `contracts/copy/*.json` (the only part of `/contracts` edited directly). **Branch:** `simone`.

| ID | Task | Inputs | Outputs | Acceptance check | Depends on | Hours |
|---|---|---|---|---|---|---|
| S1 | Hour-0 setup | Appendix H | a Gemini API key; the free-tier limits from AI Studio noted; Hack the Valley 11's rules on how many prizes one project can enter and on prepared code or data; the Sixplex Wide bedroom split recorded (3 and 4 bedrooms in the two upper homes, 12 in total, read from the plan set's code matrix) | three entries in `/docs/decisions.md` with sources; Andrew told if either rule changes the plan | — | 1.0 |
| S2 | Story first draft | sections 2 and 3 | `/pitch/hook.md` (the 30-second pitch), `/docs/devpost.md` outline answering the four questions with every dataset linked, `/pitch/qa.md` with the section 12 questions | the outline links every dataset in section 4.2 and credits the Toronto Multiplex Tracker | — | 1.0 |
| S3 | AI service scaffold and `/explain` v1 | sections 7.1 to 7.3; `fixtures/check.*.json`, `fixtures/explain.request.json` | `ai/main.py`, `config.py`, `gemini.py`, `numbers.py`, `cache.py`, `prompts/explain.md` | `curl -X POST localhost:8001/explain -H "content-type: application/json" -d @contracts/fixtures/explain.request.json` returns a valid `ExplainResponse` with placeholders resolved; the same call twice hits the cache | A2 | 3.0 |
| S4 | Validator, its test, the template fallback | sections 7.4 and 7.5 | `validator.py`, `templates.py`, `tests/test_validator.py` | `pytest ai/tests` passes every case listed in 7.4; forcing an invented number into a draft (a test hook) returns the template with `source: template` | S3 | 2.0 |
| S5 | `/briefing` v1 | section 7.8; `fixtures/ward.04.json`; `contracts/copy/questions.json` | `prompts/briefing.md`, the briefing handler | a valid `BriefingResponse` from the fixture with five sections, the three fixed questions, `validated: true` and a `numbers` map whose every key has a `source_url` | S4 | 2.5 |
| S6 | The briefing page | section 7.7; Appendix D | `ai/page/index.html`, `briefing.js`, `briefing.css`; the `/b/{ward_id}` route; fixture mode | `/b/04?lang=en&fixture=1` renders with linked numbers, the language picker, the copy button, print styles and the trend chart; every number is an `<a>` with a source | S5 | 4.0 |
| S7 | Translation, caching, pre-generation | section 7.6 | `translate.py`, `pregenerate.py` | `/b/04?lang=fr` renders with every placeholder preserved (the validator confirms); `pregenerate.py --ward 04 --langs all` fills the cache; afterwards the page serves all eight languages with Gemini unreachable | S6 | 2.5 |
| S8 | Real data switch | A9 running | `SUPLEX_API_URL` set; fixture mode off by default | the page works on a real ward; number links open the ward map at that ward | S7, A9 | 1.0 |
| S9 | Final copy and the backup addresses | engine results (A10) | `contracts/copy/labels.json`, `reasons.json`, `not_checked.json`, `questions.json`, `disclaimers.json` final; `/pitch/demo.md` with the two backup addresses and the demo ward, chosen with Andrew | Jayden's app and the AI service pick up the copy with no code changes; live, the first address gives `fits` and the second `borderline` or `no_fit` | A10 | 2.0 |
| S10 | Devpost, README, deck, demo script, Q&A | sections 2, 3, 12; the locked batch numbers | `/docs/devpost.md` final with the Gemini and Tiger Data sections; `README.md` (through Andrew); the deck in `/pitch/`; `/pitch/demo-script.md` with the 2.8 timings; `/pitch/qa.md` final answers; every pitch number checked against its source | every number on a slide has a source link beside it in the speaker notes or is cut; the Devpost is submitted by Hour 34 | S9 | 4.0 |
| S11 | Rehearsals and sponsor walkthroughs | everything on `main` | `/pitch/rehearsal-log.md` (10 timed runs); two 30-second walkthroughs (Gemini; Tiger Data with Yuvi) | 10 runs logged, at least 3 under 4:00 including one with a judge typing a random address and one with Wi-Fi off | S10, A13 | 2.5 |
| S12 | Checkpoints | — | — | present at Hours 6, 12, 18, 24 and 30 | — | 1.5 |
| S13 | DEV blog post *(after the event, optional)* | the Devpost | a post for the MLH DEV Writing Challenge | published | — | — |

Total about 27 hours.

**Re-plan approved 2026-10-17 (0.3):** Simone also ports her briefing-page chart into `web/src/components/WardMap/TrendChart.tsx` (J7) and reviews the next-steps copy (S14). Her kickoff prompt for J7 is in 8.5.

**Choosing the backup addresses and the demo ward (S9, with Andrew).** The demo ward is Ward 04 unless the batch results make another sixplex ward a clearer story. From `wards/04.geojson` and the API, pick: one lot whose Fourplex Narrow and Fourplex Wide both `fit`, with no flags, on a street with neighbours in the massing and a few street trees; and one lot that is `borderline` on `lot_width` (a 25-foot lot) or a clear `no_fit`. Prefer lots with no permit dot within 50 m, so the demo never implies anything about a particular owner's plans. Never a teammate's home unless they volunteer. Write both addresses, their expected results and their `address_id` values in `/pitch/demo.md`. **Done 2026-10-17:** Ward 04, with 326 Quebec Ave (all four designs fit), 281 Armadale Ave (the Fourplex Narrow is too close to call) and 155 Vine Ave (a row house), all checked on the citywide batch (decision 18).

**Kickoff prompt (paste into a fresh Claude Code session in the repo root, branch `simone`):**

```
You are working in the Suplex repo with me, Simone. Read CLAUDE.md first, then MASTERSPEC.md sections 1, 2, 7, 8.4, 9 and Appendices A, D and F. I own /ai, /docs, /pitch and contracts/copy/*.json; edit nothing else. We are on branch simone. The engine decides fit; the AI only phrases numbers it is given, as {{placeholders}}, and nothing reaches a user without passing the validator.

Start with task S3 from section 8.4: scaffold the FastAPI service in /ai on port 8001 with config.py reading GEMINI_API_KEY, GEMINI_MODEL (default gemini-3.5-flash-lite), SUPLEX_API_URL, SUPLEX_WEB_URL and AI_LANGS from the environment; numbers.py that builds the numbers map and allowed_numbers from a CheckResponse exactly as section 7.3 lists; gemini.py with one generate_json(prompt, schema) function using structured JSON output as in 7.9; and POST /explain that works against contracts/fixtures/explain.request.json and caches by a sha256 of its inputs. Then do S4 test-first: write ai/tests/test_validator.py with every case in section 7.4 before validator.py, and make it pass.

Use the neutral tone from section 2.5 in every prompt and every string: no candidate names, no threat or opportunity framing, "may fit" never "will be built", and "Screening only, not a permit or legal advice" where a result is shown. Ask Andrew before changing any contract other than contracts/copy.
```

### 8.5 Next-steps and re-plan tasks (approved 2026-10-17)

Yuvi owns next steps end to end, including its panel component, because his data work is finished and Jayden's list is the longest; the others each have one small piece. Andrew approved the feature and the re-plan on 2026-10-17: Yuvi builds the ward map (J5) first, then Y11 to Y14 (Y11, the sourcing, can fill gaps while he waits on the batch output). Besides `/pipeline`, Yuvi owns `web/src/components/WardMap/` (except `TrendChart.tsx`, which is Simone's) and four next-steps files: `engine/suplex_engine/next_steps.py`, `engine/tests/test_next_steps.py`, `contracts/copy/next_steps.json` and `web/src/components/ResultPanel/NextSteps.tsx`; `CLAUDE.md` lists these exceptions. Next steps merges before the Hour-24 demo cache if it can; if it lands later, Andrew regenerates the cache once more (one command). If the ward map runs late, next steps is cut at Hour 27.

| ID | Owner | Task | Inputs | Outputs | Acceptance check | Depends on | Hours |
|---|---|---|---|---|---|---|---|
| Y11 | Yuvi | Source every step | section 5.10; the City pages linked there; trca.ca; the City's Heritage Planning pages | `pipeline/reports/07-next-steps-sources.md`: for each of the 14 steps, the page URL, the exact sentence it rests on, and the date read; anything not confirmable is marked and its step reworded or cut | every step has a quote; the heritage and TRCA wording is confirmed on their own pages; the fourplex and sixplex fee wording matches the City's current page | — | 1.0 |
| A14 | Andrew | Contract and hook | Appendix A `NextStep` | `contracts/schemas/check.response.schema.json`, `types.ts`, the four `check.*.json` fixtures gain `next_steps`; `run_check` calls `build_next_steps` (a stub returning `[]` until Y13 lands); changelog line | `python contracts/validate.py` passes; `pytest engine api` green | approval | 0.5 |
| Y12 | Yuvi | Copy file | Y11 | `contracts/copy/next_steps.json` with all 14 steps, the `why` templates, the footer and a `sources` entry per step | Simone's tone review (S14) passes; no step names a business, a person or a candidate | Y11, A14 | 1.0 |
| Y13 | Yuvi | Engine module and tests | section 5.10; Y12 | `engine/suplex_engine/next_steps.py`; `engine/tests/test_next_steps.py` covering every trigger on synthetic fixtures and the six real lots in the 5.10 table | `pytest engine` green with the real-lot tests running; the six lots return exactly the steps in the table; no AI or network call in the module | A14, Y12 | 2.0 |
| Y14 | Yuvi | Render "Your next steps" | `fixtures/check.*.json` with `next_steps`; Jayden's panel styles | `web/src/components/ResultPanel/NextSteps.tsx`: the four group headings, each step with title, text, who, links and its `why` line as a muted chip; the footer; keyboard reachable; no colour-only state. Jayden mounts it at the end of the result panel with one line | all four fixtures render; a not-checked lot shows only `ask_zoning`; links open in a new tab; `npm run build` passes | A14, J4 | 1.5 |
| S14 | Simone | Tone and fact review | Y11, Y12 | review notes; `pitch/facts.md` corrected so development charges say "up to six units", citing By-law 845-2025; one demo line (2.8) | every step reads neutral and plain; nothing reads as legal advice or as a promise | Y12 | 0.5 |
| Y15 | Yuvi | "Near your lot" on the ward map (decision 19, 6.5) | a `CheckResponse` passed to `WardMap` by Jayden; the ward's lots file; S15's strings | in `web/src/components/WardMap/` only: an optional `check` prop, the circle layer and the panel box | on Ward 04 from 326 Quebec Ave the box reads about 370 lots and 7 permits (the 7 matching the plan view) and the circle sits on the lot; nothing shows without a check; no address or list anywhere; build and lint clean | S15 | 1.5 |
| S15 | Simone | The near-your-lot strings | decision 19 | in `contracts/copy/labels.json` `ward_map`: `near_heading` "Near your lot (within {{radius_m}} m)"; `near_could` "{{count}} lots in this ward may fit a free City design (an upper bound)" and `near_could_one` "{{count}} lot in this ward may fit a free City design (an upper bound)"; `near_did` "{{count}} multiplex permits issued since May 2023" and `near_did_one` "{{count}} multiplex permit issued since May 2023"; `near_ring_label` "The area within {{radius_m}} m of your lot" | `contracts/validate.py` passes; neutral wording | — | 0.25 |

Total about 8.25 hours, mostly Yuvi's (7.0), with Y15 and S15 added on 2026-10-17 (decision 19).

**Kickoff prompt for Yuvi's next steps (after J5):**

```
You are working in the Suplex repo with me, Yuvi. Read CLAUDE.md, then MASTERSPEC.md section 0, section 5.10 (Next steps), section 8.5 and Appendix A. I own /pipeline, and for this feature also engine/suplex_engine/next_steps.py, engine/tests/test_next_steps.py, contracts/copy/next_steps.json and web/src/components/ResultPanel/NextSteps.tsx; edit nothing else. Branch yuvi, opened fresh from main.

Start with Y11: for each of the 14 steps in the 5.10 table, open the linked City page (and trca.ca and the City's Heritage Planning pages for those two steps), copy the exact sentence the step rests on, and write pipeline/reports/07-next-steps-sources.md with URL, quote and date. Reword or cut any step you cannot confirm, and say so. Then Y12: write contracts/copy/next_steps.json exactly in the shape shown in 5.10. Then Y13, test-first: write engine/tests/test_next_steps.py from the six real lots in the 5.10 table and synthetic cases for every trigger, then engine/suplex_engine/next_steps.py with build_next_steps(result, copy) until it passes. The module is pure: no network, no AI, no new dependencies; values in the why lines use the checklist's rounding. Then Y14: web/src/components/ResultPanel/NextSteps.tsx, rendering CheckResponse.next_steps with the types from @contracts/types and the existing panel styles; do not edit any other web file (Jayden mounts it). Commit after each step, no Co-Authored-By trailers, never rewrite history, never merge your own PR, and open a PR to Andrew when pytest engine and npm run build are green.
```

**Kickoff prompt for Yuvi's ward map (J5, start now):**

```
You are working in the Suplex repo with me, Yuvi. Read CLAUDE.md first (it lists my approved exceptions), then MASTERSPEC.md section 0 (especially 0.3 and 0.4), section 6.5 (the ward map), section 8.3 row J5, and Appendix A (LotFeatureProps, PermitFeatureProps, WardResponse, TrendResponse). Besides /pipeline I own web/src/components/WardMap/ (except TrendChart.tsx, which is Simone's) and the four next-steps files; edit nothing else, and never App.tsx: Jayden wires the map in. Branch yuvi, opened fresh from main.

Task J5: build the ward map as React and TypeScript components in web/src/components/WardMap/, exported from index.ts as WardMap with props for the ward id, the searched lot id and an onSelectLot(lotId) callback. Use MapLibre with the neutral OpenFreeMap positron style, not the green landing-page BaseMap style, so the lot colours read. Layers: lots filled by result for the selected design (--suplex-fit for fits, a 12 px diagonal-stripe pattern for borderline, --suplex-nofit for no_fit, no fill for not_checked; thin outlines from zoom 15); gold permit dots (kind multiplex, issued since 2023-05-01) above the lots; a pulsing white outline on the searched lot. Controls: the five-option design filter (the sixplex options disabled with "not allowed in this ward" when sixplex_overlay is "none"); a legend that is always visible and ends with "Screening only, not a permit."; the ward panel with counters that count up over 1.5 s, the most common reason lots don't fit, the attached share, the flags line, the data dates, and a "Get the ward briefing" link to the AI service's /b/{ward_id}. Leave a slot in the panel for Simone's TrendChart (she adds TrendChart.tsx to the same folder). Hover shows only the result and the design, never an address or a parcel id; clicking a lot calls onSelectLot. No list, export or download of lots anywhere. Types from @contracts/types, strings from contracts/copy, colours from the design tokens. Build against contracts/fixtures/lots.04.sample.geojson, ward.04.json and permits.sample.geojson first, then the real data/out/wards/04.geojson from Andrew's batch. Acceptance: npm run build and npx oxlint pass in web/; the fixture ward renders; the filter recolours by design; hover never shows an address. Commit as you go, no Co-Authored-By trailers, never rewrite history, never merge your own PR; open a PR to Andrew when done, then start next steps with the prompt above.
```

**Kickoff prompt for Simone's chart (J7):**

```
You are working in the Suplex repo with me, Simone. Read CLAUDE.md first (it lists my approved exception), then MASTERSPEC.md section 0.3, section 6.8 (the trend chart) and Appendix A (TrendResponse). Besides /ai, /docs, /pitch and contracts/copy, I own exactly one web file, web/src/components/WardMap/TrendChart.tsx; edit no other web file (Yuvi owns the rest of WardMap/, Jayden the rest of the UI, Andrew the 3D scene). Branch simone, opened fresh from main.

Task J7: port the inline SVG monthly chart from ai/page/briefing.js into a React and TypeScript component, TrendChart.tsx, that takes a TrendResponse prop and draws the same chart: bars in var(--suplex-permit-bar, #A27100) (Andrew is adding the token to contracts/design-tokens.css), integer y ticks, the two dashed markers from markers[], a tooltip per month, the caption from section 6.8 with the source badge when source is "cache", and a visually hidden table for screen readers. No chart library. Types from @contracts/types, strings from contracts/copy. Check it against contracts/fixtures/trend.04.json. Acceptance: npm run build and npx oxlint pass in web/. Commit, no Co-Authored-By trailers, never merge your own PR; open a PR to Andrew.
```

**Revised kickoff prompt for Jayden (all UI that is not 3D):**

```
You are working in the Suplex repo with me, Jayden. Read CLAUDE.md first, then MASTERSPEC.md sections 0.3 and 0.4 (the review of my branch), 2.4, 6.2, 6.4, 6.6, 6.7 and Appendix A. I own /web except web/src/components/Lot3D/ (Andrew's now: he took over the 3D scene), web/src/components/WardMap/ (Yuvi's; TrendChart.tsx in it is Simone's) and web/src/components/ResultPanel/NextSteps.tsx (Yuvi's). Branch jayden, updated from main.

Start by opening a PR to Andrew for the four commits already on the jayden branch. Then do these in order, each with a commit, npm run build and npx oxlint passing:
1. J4: fill the result panel's tab panel in ResultPanel.tsx: the rule checklist (label, required, actual, signed margin with unit, a pass, borderline or fail icon plus text, the bylaw section, the detail line; "no limit here" for not_applicable rows), the collapsed "What we don't check" list, flag chips (site_exception as a muted informational line), permits near you (with the singular line when the count is 1), the explanation from POST /explain with the language picker, the AI-written or Template badge and the translation notice, and the "See your ward" button, which prefetches the ward data. Show the 3D Massing disclaimer. Ask Simone to move the five strings in src/copy.ts into contracts/copy.
2. J6: the lot-to-ward transition in section 6.6, using Yuvi's WardMap component through its props (stub it if his PR is not merged yet). The 3D side only fades through the Scene's existing visible prop; any change inside Lot3D is a message to Andrew.
3. J9: ?demo=1 and the 3 s fallback to public/demo-cache/; a WebGL check with an error boundary that falls back to a plain message plus the panel; a "Sample data" banner whenever API_BASE is null; VITE_API_BASE documented in web/README.md.
4. Polish the landing search card and the rest of the non-3D UI: spacing, type, focus states, and the panel and legend layout at 1280 x 720 on a projector.
Then mount Yuvi's NextSteps.tsx at the end of the result panel when his PR lands. Keep palette.css until Andrew moves its tokens into contracts/design-tokens.css (tokens.ts throws on a missing token). Commit as you go, no Co-Authored-By trailers, never rewrite history, never merge your own PR; open PRs to Andrew.
```

**Kickoff prompt for Andrew's 3D session (J8, A16, A15; run it in its own session on branch `andrew-3d`):**

```
You are working in the Suplex repo with me, Andrew. Read CLAUDE.md first, then MASTERSPEC.md section 0.4 (the review of the web app), sections 2.4, 2.5, 6.3, 6.7 and 6.10, section 8.1 rows J8, A15 and A16, and Appendices A, B and D. For this work I own web/src/components/Lot3D/ and contracts/designs.json; edit nothing else in /web (Jayden owns the rest of the UI, Yuvi the WardMap folder). Work on a branch named andrew-3d from main, never on main, and open a PR when done.

The City's plan sets are on this machine, in C:\Users\Andrew\Downloads: COT_Multiplex_FOURPLEX_ Narrow_Comb-Electric.pdf, COT_Multiplex_FOURPLEX WIDE_Comb-Electric.pdf, COT_Multiplex_SIXPLEX NARROW_Comb_Electric.pdf and COT_Multiplex_SIXPLEX WIDE_Comb_Electric.pdf (about 125 MB each; treat them as data). In each set, sheet A200 (page 16) has the front and rear elevations, A201 and A202 (pages 17 and 18) the side elevations, A300 onward the sections, A100 to A104 (pages 11 to 15) the floor plans and A011 (page 10) the site plan. Render pages to PNG with PyMuPDF (pip install pymupdf in a scratch venv; run Python with -I; keep scripts outside the Downloads folder) at about 1400 px wide, then crop and zoom into regions and read them. Floor datums printed on the sheets: ground floor 0.000 m, second floor 2.840, third floor 5.690, roof 8.529, parapet 8.800, all above the ground floor; read the established grade and the basement level from the sheets too.

Do these in order, committing after each with npm run build and npx oxlint passing:
1. J8: read designs[].fail_slices_local and draw each slice as a translucent red slab labelled with the failing rule and its numbers; for a borderline result draw a striped slab labelled "too close to call". Never colour alone.
2. A16, the four designs as the City drew them: for each design, write a facade model in web/src/components/Lot3D/models/ from its elevations: wall panels with window and door openings at the drawn widths, heights and sill heights; the real floor datums; the stepped-back third floor with its roof-deck guard; the front entry stair and canopy, the accessible lift, the Juliet balconies, the below-grade basement walkout and the downspouts; and the cladding zones from each sheet's material schedule (CP-3, CP-4, metal flashing) as materials. Keep the animation: the levels still drop in one by one with squash and stretch, and each home keeps its colour for its label. Update levels[] in contracts/designs.json to the drawn floor-to-floor heights and check with python contracts/validate.py.
3. A15, a realism pass on the whole scene that keeps every animation: an offline environment built from drei Lightformers (no downloaded HDR files: the demo must run with Wi-Fi off), ACES or AgX tone mapping, soft shadows and contact shadows, ambient occlusion through @react-three/postprocessing (N8AO), physically based materials, procedural window and brick textures on the neighbouring buildings, better roofs, a road and sidewalk strip along the frontage, and stylized trees with a gentle wind sway. Add a PerformanceMonitor that drops ambient occlusion and shadows when the frame rate falls under 45, and keep the current look behind ?look=classic as the fallback.
Acceptance: next to each A200 front elevation, the window count and positions match and the heights match the datums within 0.1 m; the whole sequence still plays; at least 50 fps on this laptop with 400 buildings; prefers-reduced-motion still works; npm run build and npx oxlint pass. No Co-Authored-By trailers, never rewrite history, never merge your own PR.
```

**Kickoff prompt for Yuvi's near-your-lot box (Y15; start once Simone's S15 strings are on `main`):**

```
You are working in the Suplex repo with me, Yuvi. Read CLAUDE.md first, then MASTERSPEC.md section 0.5 decision 19, section 6.5 ("Near your lot") and the Y15 row in 8.5. Pull main first: Simone's S15 strings should be in contracts/copy/labels.json under ward_map (if they aren't yet, build the rest and wire the strings last).

Build "Near your lot" inside web/src/components/WardMap/ only:
1. WardMap gets an optional prop check?: CheckResponse | null (the type from @contracts/types). Jayden passes the current check when the map opens from an address; with no check, nothing below shows.
2. A circle on the map around check.context.origin (the lot's centroid, lon and lat) with radius check.permits_nearby.radius_m (500 m, from engine_config): a 64-point polygon drawn as a thin dashed line in a design-token colour, no fill, above the lots and not clickable.
3. A box in the ward panel, under the headline: labels.ward_map.near_heading; then near_could, where N is the number of this ward's lots whose best result (b) is "fits" and whose polygon centroid lies within the radius of the origin (a flat-earth distance in metres is enough: dx = dlon * cos(lat) * 111320, dy = dlat * 110540); then near_did, where M is check.permits_nearby.count. Never recount the permits: the engine's count is what the 2D plan view shows. Use the _one strings when a count is 1.
4. No list, no addresses, no new data and no API calls; every string from contracts/copy; the counts are labelled as upper bounds, as the strings say.
Acceptance: on Ward 04 from 326 Quebec Ave (address 7986858) the box reads about 370 lots and 7 permits and the circle sits on the lot; on the fixtures dev page without a check, no box. npm run build and npx oxlint pass. Commit as "WardMap: near your lot (Y15)", push your branch and open a PR to Andrew; don't merge it yourself.
```

---

## 9. Git workflow and the root `CLAUDE.md`

### 9.1 Workflow

- **One repo,** `suplex`, on GitHub under Andrew's account, public by submission time (the Devpost links it). `main` must always run the demo. Only Andrew merges into `main`, through pull requests.
- **Branches:** Andrew works on `main`; `yuvi`, `jayden` and `simone` are the teammates' branches, opened by them from `main`. Nobody but Andrew commits to `main`. No other long-lived branches; a quick experiment is a branch off your own branch, merged back by you.
- **Folder ownership:** `/contracts`, `/engine`, `/api`, root files → Andrew · `/pipeline` → Yuvi · `/web` → Jayden · `/ai`, `/docs`, `/pitch`, `contracts/copy/` → Simone. Each person edits only their own folders. A change anyone needs in someone else's folder is a message to that person, not a commit. **Approved exceptions (2026-10-17):** Yuvi owns `web/src/components/WardMap/` (except `TrendChart.tsx`) and the four next-steps files listed in 8.5; Simone owns `web/src/components/WardMap/TrendChart.tsx`; Jayden wires both into the app. Every change reaches `main` through a PR to Andrew; nobody merges their own PR.
- **Contract changes** go through Andrew: describe the change, Andrew updates the schema, `types.ts` and the fixture together on `main` within the hour, and everyone rebases. `contracts/README.md` keeps a one-line changelog.
- **Commit small and often:** every working increment, with messages in the form `area: what changed` (`engine: lot width across the building band`, `web: ward map stripe pattern`). Push at least hourly so nothing is lost on a dead laptop.
- **Integration checkpoints** at Hours 6, 12, 18, 24, 30 and 34: each person opens a PR from their branch; Andrew runs `scripts/check.sh` (engine and AI tests, API start, web build, the demo flow by hand) and merges. Never one big merge at the end.
- **Conflicts** are rare because of folder ownership. When one appears, the branch owner rebases onto `main` and resolves it; Andrew never resolves conflicts inside someone else's folder.
- **Tags:** `headline-locked` on `main` at Hour 24 (the numbers in the pitch come from this state); `demo` at Hour 34 (what the judges see).
- **Data in git:** `data/` is ignored entirely. Only scripts, schemas, fixtures, `pipeline/data/sixplex_overlay_ward23.geojson` and small samples are committed. The full `data/out/` lives on the team drive; its path is in `.env` as `SUPLEX_DATA_DIR`.
- **Secrets:** `.env` is ignored; `.env.example` lists every variable with a placeholder.

`.gitignore`:

```
data/
.env
*.gpkg
*.parquet
*.zip
*.csv
node_modules/
dist/
.venv/
venv/
__pycache__/
*.pyc
.pytest_cache/
ai/cache/
ai/logs/
api/cache/
web/public/demo-cache/
!contracts/fixtures/**
!pipeline/data/*.geojson
```

### 9.2 Root `CLAUDE.md` (full text; Andrew commits it in A1)

````markdown
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
  Exception (MASTERSPEC decision 20): issued multiplex permits may be listed by street name only,
  never with a house number, with no export or download; lots that may fit are never listed.
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
````

---

## 10. Timeline and checkpoints

Hour 0 is when the team starts building from this spec. Checkpoints are integration merges by Andrew; everyone shows their current state in five minutes and the demo is run on `main`.

| Hours | Andrew | Yuvi | Jayden | Simone | Checkpoint |
|---|---|---|---|---|---|
| 0–1 | A1 repo scaffold, A2 contracts and fixtures, A3 Hour-0 checks (Sixplex Narrow sheet, `AVG_HEIGHT`, Ward 04) | Y1 permits fields and rule report ("Rule A works" or not, by Hour 1), Y2 Tiger sign-up | J1 scaffold and the 3D test box | S1 Gemini key, free-tier limits, HTV rules on prizes and prepared work, bedroom split recorded; S2 hook, Devpost outline, Q&A list | — |
| 1–6 | A4 lot geometry, A5 rules | Y3 permits file v1, Y4 downloads and the dev-ward GPKG | J2 search, J3 3D sequence v1 | S3 `/explain` v1 against fixtures | **Hour 6:** fixtures flow end to end on `main`; permits report in; dev-ward GPKG on the drive |
| 6–8 | A6 fit test, A7 API v1 on the dev ward → **one address works end to end, lot → fit check → 3D, no AI** | Y5 Tiger schema and load started | J3 continues; J4 result panel | S4 validator and test | **Hours 6–8:** a rough fit count on the dev ward (`batch.py --ward 04`); whether most lots fit or most don't decides the headline wording |
| 8–12 | A8 hand-checked test lots | Y5 aggregate, compression, `queries.py`, trend cache | J4, then J5 ward map | S5 `/briefing` v1 | **Hour 12:** all 4 designs, four result types, checklist and "permits near you" work on the dev ward |
| 12–16 | A9 citywide switch, ward endpoints, fallbacks | Y6 citywide build and the Ward 23 overlay polygon | J5 ward map, J6 transition | S6 briefing page | **Hour 14: Tiger Data go/no-go.** `/ward/04/trend` returns real data or Tiger is dropped and the local permits file carries the trend. **Hour 16:** any Toronto address works |
| 16–20 | A10 citywide batch run | Y7 data QA with Andrew's test lots | J6, J7 trend chart, J8 live API switch and fail visuals | S6, S7 translation, caching, pre-generation | **Hour 18:** ward map with coloured lots and permit dots on real data; briefing page with linked numbers and the language picker on fixtures |
| 20–24 | A10 finishes; A11 headline lock | Y8 trees (optional), Y9 refresh | J8, J9 2D fallback and cached demo mode | S8 real-data switch, S9 final copy and backup addresses with Andrew | **Hour 24: headline numbers locked** (`headline-locked` tag); trend chart in the ward view and on the briefing page; demo caches written |
| 24–30 | A13 demo laptop setup; integration | Y9 Tiger Data Devpost material with Simone | J9 finishes, J10 polish and extras | S10 Devpost, README, deck, demo script, Q&A | **Hour 30: offline rehearsal** (Wi-Fi off, API and AI stopped) passes on the cache |
| 30–36 | merges, final `demo` tag at Hour 34 | walkthrough rehearsal | extras only if everything works | S11 ten rehearsals including a judge typing a random address; **Devpost submitted early (Hour 34)** | **Hour 34:** submitted; `main` tagged `demo` |

**Approved re-plan, Hours 20 to 27:** Yuvi builds the ward map (J5), then next steps (Y11 to Y14, with Andrew's A14 contract hook and Simone's S14 review); Simone ports her chart (J7); Jayden does J4, J6 and J9 and the UI that is not 3D, then wires in the ward map and next steps; Andrew's separate 3D session does J8, A16 and A15 on branch `andrew-3d`. Next steps is cut at Hour 27 if it is not merged; the 3D work merges by Hour 27 or the current look ships.

**Cut first if behind, in this order:**

1. Tiger Data and the trend chart (go/no-go at Hour 14; the local permits file still powers the headline, the dots and "permits near you")
2. the sixplex designs (keep the two fourplexes; the overlay logic stays in the engine)
3. translation (keep English; the picker shows only English)
4. citywide coverage (fall back to wards 04, 19 and the ward that contains the venue; the search says which wards are covered)

Visual extras are not on this list because they never start before the core works. **Never cut:** the address check and 3D moment, the permission vs. reality headline, the "screening only" labels and the uncertainty band, the rehearsal.

---

## 11. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Permits data doesn't clearly flag multiplexes | Use "permits for new residential buildings with 2–6 units", labelled exactly that way (Rule B, section 4.3) |
| Permits don't join to address points on `GEO_ID` | Resolved: 98.5% join directly, 99.3% with the street-name fallback; the 55 unlocated permits stay in the counts and off the map |
| Lot geometry fails on odd shapes (corner, pie-shaped, irregular) | Return "too close to call" or "not checked: lot shape too irregular to measure"; never guess |
| A design detail turns out wrong | All four specs come from the City's A011 sheets; fix `designs.json` in one place and rerun the batch |
| Zoning edge cases | Support the five residential zones (R, RD, RS, RT, RM); anything else returns "not checked" with the reason; `ZN_STATUS` 5 lots return "an older zoning bylaw applies here" |
| The judge's address is a condo, not residential, or outside Toronto | A clear plain-language message, then a backup address |
| 3D is slow or buggy | Plain extruded boxes, no shadows, then the 2D view |
| Citywide data is slow | One-ward subset while developing; load once at API startup with a spatial index; precompute the ward files |
| AI writes a wrong or invented number | The validator, one regeneration, then the plain template; nothing unvalidated is shown |
| Gemini's free tier rate-limits the demo | Everything for the demo is pre-generated and cached with `gemini-3.5-flash-lite` (500 requests a day) before any `gemini-3.8-flash` pass (20 a day); the service never calls Gemini live during the demo |
| Tiger Data is unreachable or slow during the demo | Cached trend JSON served after a 2 s timeout; the address check never depends on it |
| 3D Massing is in Web Mercator, not WGS84 | Known (verified); the pipeline reprojects from EPSG:3857 |
| A judge knows the Toronto Multiplex Tracker | Credit it; we add the "could" half and the gap |
| API or Wi-Fi fails | Cached responses for the backup addresses and the demo ward, served by the web app |
| A judge knows LotMore | Lead with the City designs and the permission vs. reality gap |
| "This could arm opposition", "you're ranking wards" or "it's a developer target map" | Neutral wording, no rankings, no addresses on the map, no list or export of lots (section 12) |
| A pitch number is wrong | Every number on a slide has a checked source, or it is cut |
| Merge conflicts | Folder ownership plus small, frequent merges |
| Python wheels missing for the geo stack on a teammate's machine | Use Python 3.12 or 3.13 (not 3.14); `pip install geopandas pyogrio shapely pyproj` has wheels for both |

---

## 12. Q&A prep (Simone writes the final answers in `/pitch/qa.md`)

- **"Who will actually use this?"** Before you build: homeowners checking for free whether a City design could work. Before you vote: residents, journalists and community groups who need ward facts. The City itself is planning open houses to answer this question; we answer it for any address, at any hour.
- **"Will homeowners really rebuild?"** Most won't, and that's fine. Whether a design could fit is still the first question every one of them asks. Our own data shows many lots fit and few get built, so we say upfront that fit isn't the only barrier.
- **"Isn't cost the real barrier?"** Agreed, and our permission vs. reality gap shows it: the rules allow far more than gets built. Cost modelling is a next step.
- **"Why not LotMore?"** It exists to sell its own paid services. We're free, neutral, use the City's own designs, and show the ward picture.
- **"Isn't this a tool for developers?"** No. There's no list or export of lots, and the map never shows addresses. Opening one lot shows the same screening anyone can look up for an address, with "screening only" on every result.
- **"How accurate is it?"** It's a first screen, not a permit. We say what we check and what we don't, flag results within the uncertainty band, and hand-checked a set of real lots.
- **"Does it arm opposition to new homes?"** It shows the same facts to everyone, in neutral words: what's allowed, and how little has been built.
- **"Are you ranking wards?"** No. Each ward shows its own numbers.
- **"Doesn't the Toronto Multiplex Tracker already map permits?"** Yes, and we credit it. It shows what got permitted. We add what could be built with the City's free designs, and put the two side by side.
- **"Why does the Sixplex Narrow fail on so many lots?"** It is 19 m long, and the by-law allows 19 m for a detached houseplex only on lots at least 36 m deep (frontage under 10 m) or 40 m deep (frontage 10 m or more); elsewhere the limit is 17 m. That is a finding, not a bug, and the checklist shows the section.
- **"Why is the AI allowed anywhere near this?"** It never decides anything. It phrases numbers the engine computed, writes placeholders instead of digits, and a validator rejects any number it did not get. We can show the rejection log.
- **"Isn't the next-steps list legal advice?"** No. It lists the City's own published steps, with the City's links, picked by fixed rules from this lot's result, and it ends with "screening only, not a permit or legal advice". It tells you who to ask, not what the answer is.

---

## 13. Open TODOs with owners

| # | TODO | Owner | By | Why it matters |
|---|---|---|---|---|
| T1 | **Done (Simone):** one project may enter the challenge and the MLH prizes; all work after the 10 p.m. 2026-10-16 kickoff, which holds; never rewrite git history | Simone | Hour 0 | changes the sponsor-prize plan or forces the contracts to be rewritten at the event |
| T2 | **Done 2026-10-17 (Simone):** limits read in AI Studio; `GEMINI_MODEL` now defaults to `gemini-3.5-flash-lite` (section 7.1). Remaining: compare validator rejection rates between the two models before the Hour-24 pre-generation | Simone | Hour 20 | the pre-generation run must fit the quota |
| T3 | **Done 2026-10-17 (A3, `docs/decisions.md`): decision 17 stands.** Re-read the Sixplex Narrow A011 zoning matrix: does its "19 m allowable" refer to building depth (10.20.40.30(1)) rather than building length? Keep decision 17 unless the sheet shows a different provision | Andrew | Hour 0 | decides how often the Sixplex Narrow fits |
| T4 | **Done (Yuvi):** the height overlay column is `HT_LABEL`; coverage is `PRCNT_CVER` | Yuvi | Hour 1 | the pipeline's overlay join |
| T5 | **Done (Yuvi):** `GEO_ID` joins 98.5%; with the street fallback 99.3%; 55 permits unlocated | Yuvi | Hour 1 | permit dots and ward counts |
| T6 | **Done (Yuvi):** Rule A, with multiplex = units created 2 to 6; 446 against 452. Andrew's part done (contracts v0.1.6: one `permit_rule` string in every ward fixture); Simone puts the rule in the Devpost | Andrew, Simone | Hour 8 | the headline's "did" number |
| T7 | **Done 2026-10-17:** `addresses.is_primary` marks one address per lot; `/search` returns one result per lot preferring the primary address | Andrew | Hour 6 | search quality |
| T8 | **Done 2026-10-17 (A8):** footprints are clipped to the lot; `attached.cross_lot_m2` 20, `attached.tolerance_m` 0.05, `larger_building.avg_height_m` 16, footprint 350 m² and vacant 20 m² unchanged; evidence in `docs/test-lots.md`. Open: split semis with a massing gap read as detached; garages make 1.8% of lots `unmeasurable` | Andrew | Hour 10 | classification accuracy |
| T9 | Confirm the RT "no building length rule" and the RM "17 m applied to houseplexes" readings by re-reading 10.60.40.20 and 10.80.40.20 once; low priority | Andrew | Hour 12 | affects only Sixplex Narrow in RT and RM |
| T10 | Confirm the `u` (UNITS) override reading for the 2023 four-unit permission (600.60.40(1)(A) covers the overlay; the citywide 4-unit rule is treated as given); low priority | Andrew | Hour 12 | `units_allowed` rule |
| T11 | **Done (Yuvi):** Ward 23 is fully in the overlay (By-law 654-2025 Diagram 1 is the ward); no drawing needed. Andrew's part done (contracts v0.1.2: `sixplex_wards` gains "23", `partial_sixplex_wards` empty) | Andrew | Hour 8 | sixplex results in Ward 23 |
| T18 | **Done (Yuvi):** the real Tiger Data service is loaded and checked for all 25 wards; compression 3.59 MB to 2.60 MB; trend cache rebuilt from it; `TIGER_DSN` shared privately | Yuvi | Hour 12 | the Hour-14 go/no-go is passed |
| T19 | **Done 2026-10-17:** the site-exception policy is confirmed and built (`classify.INFORMATIONAL_FLAGS`, `review_flags`): the flag stays in the address check with the exception number, never an icon on the map, never counted as "need extra review"; `ward_summary.flags.site_exception` still counts it | Andrew | Hour 8 | 88% of Ward 04 lots carry an exception number |
| T20 | **Done 2026-10-17 (Andrew):** on a lot whose side lot lines both lean the same way by 2° or more (`placement.align_to_sides_deg`), the lot depth is measured along them and each design turns to follow them; width square to the sides; Ward 04: 1,411 results better, 90 worse (all checked), lots that may fit 3,611 → 3,992 (5.2 step 3, 5.5) | Andrew | before A10 | fit accuracy on tapered lots |
| T21 | **Done 2026-10-17:** [By-law 845-2025](https://www.toronto.ca/legdocs/bylaws/2025/law0845.pdf) (enacted July 24, 2025) waives development charges on the second to fourth units, reduces the fifth and sixth to $0, and waives parkland cash-in-lieu on the second to sixth, for lots with no more than six units. Say "up to six units" and cite the by-law; never name the councillors who moved it. The City's "Considerations" page saying four is out of date. Simone updated `pitch/facts.md`, the Devpost and the Q&A (d64baa4) | Simone | Hour 26 | a wrong fee claim in the pitch |
| T22 | **Done 2026-10-17 (Andrew):** next steps and the re-plan approved; `CLAUDE.md` and section 9 list the ownership exceptions | Andrew | Hour 20 | done |
| T23 | The 3D work (J8, A16, A15) merges from branch `andrew-3d` by Hour 27, or the current look ships; `?look=classic` stays as the fallback either way, and the demo laptop is tested at 50 fps or better before the merge **Done 2026-10-17 20:06: PR #19 merged after the check on this laptop: 104 fps with a 1920×1080 canvas at ×1.25 once the sequence rests, 82 to 144 fps through it, no drop in pixel ratio; `?look=classic` stays as the fallback.** **PR #21 (the session's final-review fixes) merged at 20:28: at full quality it draws the same as #19, and its step-down now holds and never recompiles shaders.** **PR #22 (the 3D street: brick and siding neighbours, lawns and gardens, a longer block, the sky) merged at 22:47.** | Andrew | Hour 27 | a half-finished 3D scene on stage |
| T24 | **Done 2026-10-17 (Andrew): keep 150 m.** Decide whether the `/check` context radius (`context_radius_m`, now 150 m) grows to 500 m so the plan view shows houses as far out as the permit dots. Recommended: keep 150 m. The 3D scene caps at 400 buildings, `/check` must answer in under a second, 500 m is about 11 times the area, and the plan view's street map already shows the streets beyond | Andrew | Hour 22 | the plan view's reach against 3D performance and response time |
| T25 | **Done 2026-10-17 22:33:** Half done: `suplex_batch_2026-10-17.zip` is on the data release (19:11, 16,243,073 bytes; unzip into `data/out/`). Remaining: the A11 demo cache for 326 Quebec Ave, 281 Armadale Ave, 155 Vine Ave and Ward 04, written at Hour 24 by `scripts/hour24.ps1` (on `main` since PR #20 merged at 19:57) The lock wrote the demo cache; `suplex_lock_2026-10-17.zip` is on the data release. | Andrew | Hour 24 | the demo cache |
| T12 | **Done 2026-10-17 (Andrew): Ward 04 with 326 Quebec Ave, 281 Armadale Ave and 155 Vine Ave** (decision 18). A switch to Ward 20 with 88 Manderley Dr and 37 Wanstead Ave at 18:41 was reversed: Ward 20 shows no sixplexes and its permit count differs from the City's. All three addresses were re-checked on the citywide batch (engine 0.2.0): 326 Quebec Ave fits all four designs, 281 Armadale Ave is too close to call for the Fourplex Narrow, 155 Vine Ave is a row house. Re-check after the Hour-24 refresh | Simone, Andrew | Hour 20 | demo safety |
| T13 | **Done (Simone):** every fact in `pitch/facts.md` with its page. Cut: the variance figure and "guidance is missing". Confirmed: 452 and 726, 75% renovations, declared values $1,012,782 and $216,090, the 285,000 target, 48.9% (13,928 starts against 28,500 in 2025), 23.3% single-detached, the 69% poll | Simone | Hour 28 | every slide number has a source or is cut |
| T14 | Put the mockup video and the ward-view image in `/docs/mockups/` | Andrew | Hour 0 | Jayden's visual target |
| T15 | Check the Street Tree GPKG field names before building the trees layer (not verified; optional layer) | Yuvi | Hour 20 | decoration only |
| T16 | Decide whether to use Vultr; only if free and under one hour of work | Andrew | Hour 26 | optional MLH prize |
| T17 | Half done (Simone): the briefing page's methodology footer is written in `contracts/copy/labels.json`; the Devpost's limitations paragraph is drafted and waits on the locked numbers | Simone | Hour 26 | the Responsible interpretation criterion |

---

## 14. Sources

**Product and policy**

- [City of Toronto: pre-approved multiplex designs (Oct 2, 2026)](https://www.toronto.ca/news/city-of-toronto-introduces-pre-approved-multiplex-designs-making-it-easier-to-build-more-homes-faster/)
- [Pre-approved multiplex building plans](https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-building-plans/pre-approved-multiplex-building-plans/); plan sets: [Fourplex Wide](https://www.toronto.ca/ext/digital_comm/pdfs/toronto-building/COT_Multiplex_FOURPLEX%20WIDE_Comb-Electric.pdf), [Sixplex Narrow](https://www.toronto.ca/ext/digital_comm/pdfs/toronto-building/COT_Multiplex_SIXPLEX%20NARROW_Comb_Electric.pdf), [Sixplex Wide](https://www.toronto.ca/ext/digital_comm/pdfs/toronto-building/COT_Multiplex_SIXPLEX%20WIDE_Comb_Electric.pdf) (the Fourplex Narrow set is linked from the same page)
- [City of Toronto: multiplex housing](https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/multiplex-housing/)
- [Multiplex monitoring report (2025)](https://www.toronto.ca/legdocs/mmis/2025/ph/bgrd/backgroundfile-256251.pdf) and [Attachment 4](https://www.toronto.ca/legdocs/mmis/2025/ph/bgrd/backgroundfile-255851.pdf)
- [Mayor's housing memo (May 2026)](https://www.toronto.ca/legdocs/mmis/2026/ph/bgrd/backgroundfile-286730.pdf)
- [Housing target dashboard](https://www.toronto.ca/wp-content/uploads/2026/02/8df8-city-planning-municipal-housing-target-dashboard-Q4.pdf)
- [Census backgrounder: housing](https://www.toronto.ca/wp-content/uploads/2022/09/8e3a-CityPlanning-2021-Census-Backgrounder-Housing-Indigenous-Peoples.pdf) and [dwelling types](https://www.toronto.ca/wp-content/uploads/2022/04/9654-City-Planning-2021-Census-Backgrounder-Age-Sex-Gender-DwellingType.pdf)
- [Ipsos poll for TRREB (Sept 2026)](https://www.ipsos.com/en-ca/node/1083601)
- [CBC: sixplexes approved in 9 wards](https://www.cbc.ca/lite/story/1.7571079)

**Zoning By-law 569-2013**

- [10.5 general](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter10_5.htm), [10.10 (R)](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter10_10.htm), [10.20 (RD)](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter10_20.htm), [10.40 (RS)](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter10_40.htm), [10.60 (RT)](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter10_60.htm), [10.80 (RM)](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter10_80.htm), [600.60 (sixplex overlay)](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter600_60.htm)
- [By-law 654-2025 (sixplex overlay)](https://www.toronto.ca/legdocs/bylaws/2025/law0654.pdf), [By-law 848-2025 (lot coverage)](https://www.toronto.ca/legdocs/bylaws/2025/law0848.pdf)

**Toronto Open Data**

- [Address Points](https://open.toronto.ca/dataset/address-points-municipal-toronto-one-address-repository/), [Property Boundaries](https://open.toronto.ca/dataset/property-boundaries/), [Zoning By-law](https://open.toronto.ca/dataset/zoning-by-law/), [Building Permits – Active](https://open.toronto.ca/dataset/building-permits-active-permits/), [Building Permits – Cleared](https://open.toronto.ca/dataset/building-permits-cleared-permits/), [3D Massing](https://open.toronto.ca/dataset/3d-massing/), [City Wards](https://open.toronto.ca/dataset/city-wards/), [Heritage Register](https://open.toronto.ca/dataset/heritage-register/), [Heritage Conservation Districts](https://open.toronto.ca/dataset/heritage-conservation-districts/), [Ravine Protection Area](https://open.toronto.ca/dataset/ravine-natural-feature-protection-area/), [Street Trees](https://open.toronto.ca/dataset/street-tree-data/)
- [CKAN API](https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=zoning-by-law) (`package_show` and `datastore_search`), [zoning readme](https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/aa11a6f1-17fd-49b7-bbe4-f381bbc36f94/download/zoning_readme.txt)
- [TRCA Regulated Area service](https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/ArcGIS/rest/services/TRCA_Regulation_Limit2/FeatureServer)

**Prior art and competitors**

- [Toronto Multiplex Tracker](https://malcolmkennedy.com/to-multiplex-map/) ([open data showcase](https://open.toronto.ca/?p=4591), [GitHub](https://github.com/zuzubak/to-multiplex-map))
- [LotMore](https://lotmore.ca/multiplex-toronto), [VanPlex PlexCheck](https://www.vanplex.ca/toronto-multiplex/)

**Permit process (next steps, read 2026-10-17)**

- [Pre-approved multiplex building plans](https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-building-plans/pre-approved-multiplex-building-plans/), [Considerations when building multiplexes](https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/multiplex-housing/considerations-when-building-multiplexes/), [Zoning Applicable Law Certificate](https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/preliminary-zoning-reviews-information/apply-for-a-zoning-review/zoning-applicable-law-certificate/), [When to apply for a tree or ravine permit](https://www.toronto.ca/services-payments/building-construction/tree-ravine-protection-permits/when-to-apply-for-a-tree-or-ravine-permit/), [Municipal Code Chapter 415](https://www.toronto.ca/legdocs/municode/1184_415.pdf), [By-law 845-2025](https://www.toronto.ca/legdocs/bylaws/2025/law0845.pdf), [Garden suites](https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/garden-suites/), [Laneway suites](https://www.toronto.ca/city-government/planning-development/planning-studies-initiatives/changing-lanes-laneway-suites-in-toronto/), [Committee of Adjustment](https://www.toronto.ca/city-government/planning-development/committee-of-adjustment/)

**Tools**

- [Tiger Data](https://www.tigerdata.com/), [Gemini API docs](https://ai.google.dev/gemini-api/docs), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [react-three-fiber](https://r3f.docs.pmnd.rs/), [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/), [OpenFreeMap](https://openfreemap.org/)

---

# Appendices

## Appendix A. Contracts: TypeScript types and schemas

`/contracts/types.ts` is the readable source of truth; `/contracts/schemas/*.schema.json` mirrors it one file per top-level type (`search.response`, `check.response`, `ward.response`, `trend.response`, `explain.request`, `explain.response`, `briefing.request`, `briefing.response`, `ward_summary.file`, `lot_feature.props`, `permit_feature.props`, `designs.file`, `engine_config.file`) with `additionalProperties: false`. `contracts/validate.py` checks every fixture against its schema (and, with `--url`, a live response). The Python side uses Pydantic models generated by hand from the same file in `engine/suplex_engine/models.py` and `ai/models.py`.

```ts
// contracts/types.ts
// Coordinates: LocalPoint = [x east, y north] in metres from the lot centroid (EPSG:2952).
// LonLat = [longitude, latitude] (EPSG:4326). Months are "YYYY-MM". Dates are "YYYY-MM-DD".

export type DesignId = "fourplex_narrow" | "fourplex_wide" | "sixplex_narrow" | "sixplex_wide";
export type DesignKey = "fn" | "fw" | "sn" | "sw";
export type Result = "fits" | "borderline" | "no_fit" | "not_checked";
export type LotClass = "condo" | "non_residential" | "older_bylaw" | "larger_building"
  | "unmeasurable" | "attached" | "checked";
export type RuleId = "detached_building" | "units_allowed" | "lot_width" | "lot_depth"
  | "building_length" | "height" | "lot_coverage";
export type FlagId = "heritage_register" | "heritage_district" | "ravine" | "trca" | "site_exception" | "vacant";
export type FlagKey = "hr" | "hd" | "rv" | "tr" | "ex" | "vc";
export type PermitKind = "multiplex" | "secondary_suite" | "laneway_garden" | "other";
export type ZoneCode = "R" | "RD" | "RS" | "RT" | "RM";
export type WardId = string;                         // "01" .. "25"
export type Lang = "en" | "fr" | "zh-Hans" | "zh-Hant" | "es" | "tl" | "ta" | "pt";
export type LocalPoint = [number, number];
export type LonLat = [number, number];

// ---------- designs.json ----------
export interface DesignHome { id: number; label: string; bedrooms: number; levels: number[];
  accessible: boolean; walkout: boolean; }
export interface DesignLevel { level: number; name: string; height_m: number; visible_m: number;
  area_m2: number | null; stepped_back: boolean; }
export interface Design {
  id: DesignId; key: DesignKey; name: string; units: number; bedrooms: number;
  width_m: number; length_m: number; height_m: number; storeys: number;
  building_area_m2: number; gfa_m2: number;
  side_yards_m: [number, number]; front_setback_m: number; rear_setback_m: number;
  min_lot_width_m: number; min_lot_depth_m: { r_rt: number; rd_rs_rm: number };
  where_allowed: "all_residential" | "sixplex_overlay";
  top_floor_stepback_m: number; homes: DesignHome[]; levels: DesignLevel[];
  source: { file: string; sheet: string; page: number; url: string };
}
export interface DesignsFile { version: string; released: string; designs: Design[]; }

// ---------- engine_config.json ----------
export interface EngineConfig {
  version: string;
  uncertainty_band_m: number; uncertainty_band_coverage_pp: number;
  larger_building: { avg_height_m: number; footprint_m2: number; address_points: number };
  attached: { cross_lot_m2: number; shared_edge_m: number; tolerance_m: number };
  vacant_min_footprint_m2: number;
  street_edge: { corridor_distance_m: number; merge_angle_deg: number; min_length_m: number };
  sample_step_m: number; nearby_permits_radius_m: number; context_radius_m: number;
  permits_since: string; permits_trend_since: string;
  sixplex_wards: WardId[]; partial_sixplex_wards: WardId[];
}

// ---------- GET /search ----------
export interface SearchResult { address_id: string; address_full: string; ward_id: WardId;
  ward_name: string; lon: number; lat: number; }
export interface SearchResponse { query: string; results: SearchResult[]; }

// ---------- GET /check ----------
export interface Reason { id: LotClass | "outside_toronto"; label: string; text: string; }
export interface Flag { id: FlagId; label: string; text: string; source_url: string | null; detail: string | null; }
export interface ZoneInfo {
  zn_zone: string | null; zn_string: string | null; gen_zone: number | null; zbl_sectn: string | null;
  zn_status: number | null; frontage_min_m: number | null; units_max: number | null;
  ht_overlay_m: number | null; coverage_overlay_pct: number | null; exception_no: number | null;
  sixplex_overlay: boolean;
}
export interface ExistingBuilding { building_id: number; avg_height_m: number; footprint_m2: number;
  footprint_local: LocalPoint[]; }
export interface Lot {
  lot_id: string; class: LotClass; reason: Reason | null; ward_id: WardId; ward_name: string;
  zone: ZoneInfo; width_m: number | null; depth_m: number | null; area_m2: number; stated_area: string | null;
  front_bearing_deg: number | null; frontage_edge_local: [LocalPoint, LocalPoint] | null;
  polygon_local: LocalPoint[]; polygon_wgs84: LonLat[];
  existing_building: ExistingBuilding | null; attached: boolean; vacant: boolean; flags: Flag[];
}
export interface RuleRow {
  rule_id: RuleId; label: string;
  required: number | string | null; actual: number | string | null; unit: "m" | "pct" | "units" | null;
  margin: number | null;            // positive = passes by this much; banded rules compare |margin| to the band
  pass: boolean | null;             // null when not_applicable
  borderline: boolean; not_applicable: boolean;
  bylaw_section: string;            // e.g. "10.20.40.70(3)"
  detail: string | null;            // e.g. "5.5 m building + 1.2 m + 0.9 m side yards"
}
export interface DesignResult {
  design_id: DesignId; result: Result; blocking_rule: RuleId | null; rules: RuleRow[];
  placement_local: LocalPoint[] | null;                    // 4 corners, front wall first
  buildable_local: LocalPoint[] | null;
  setbacks_local: { front: LocalPoint[]; rear: LocalPoint[]; left: LocalPoint[]; right: LocalPoint[] } | null;
  fail_slices_local: LocalPoint[][];                       // parts of the footprint outside buildable_local
}
export interface PermitsNearby { radius_m: number; since: string; count: number; points: LonLat[]; points_local: LocalPoint[]; }
export interface ContextBuilding { building_id: number; avg_height_m: number; kind: "house" | "large";
  on_lot: boolean; footprint_local: LocalPoint[]; }
export interface Context { origin: { lon: number; lat: number; x_2952: number; y_2952: number };
  radius_m: number; buildings: ContextBuilding[]; trees: LocalPoint[]; }
export interface Meta { engine_version: string; designs_version: string; config_version: string;
  data_dates: Record<string, string>; disclaimer: string; generated_at: string; cached: boolean; }
export interface CheckResponse {
  address: { address_id: string | null; address_full: string | null; lon: number; lat: number };
  lot: Lot; designs: DesignResult[]; not_checked: string[];
  permits_nearby: PermitsNearby; context: Context; meta: Meta;
}
// ---------- next steps (approved 2026-10-17, section 5.10; added to CheckResponse by A14) ----------
export type NextStepId = "survey" | "zoning_check" | "site_exception" | "heritage" | "ravine" | "trca" | "trees"
  | "designer" | "permit" | "demolition" | "fees" | "attached_options" | "custom_or_variance" | "ask_zoning";
export type NextStepGroup = "confirm" | "approvals" | "apply" | "alternatives";
export interface NextStep {
  id: NextStepId; group: NextStepGroup;
  title: string; text: string; who: string;
  why: string;                                   // the lot-specific reason, values filled by the engine
  links: { label: string; url: string }[];       // City pages; never a business or a person
}
// CheckResponse gains:  next_steps: NextStep[];   // ordered by group then catalogue order; never written by AI

// ---------- ward_summary.json and GET /ward/{id} ----------
export interface ResultCounts { fits: number; borderline: number; no_fit: number; not_checked: number; }
export interface WardSummaryEntry {
  ward_id: WardId; ward_name: string; sixplex_overlay: "full" | "partial" | "none";
  lots_total: number;                       // COMMON + CONDO parcels in the ward
  house_lots: number;                       // classes attached + checked
  classes: Record<LotClass, number>;
  any_design: ResultCounts;                 // best result across the four designs
  by_design: Record<DesignId, ResultCounts>;
  top_blocking_rules: { rule_id: RuleId; count: number }[];   // descending, over designs that do not fit
  attached_share_pct: number;
  flags: { heritage_register: number; heritage_district: number; ravine: number; trca: number;
           site_exception: number; vacant: number; any_on_fitting_lots: number };
  permits: { rule: string; since_may_2023: number; by_kind_since_may_2023: Record<PermitKind, number>;
             by_year: Record<string, number>; units_since_may_2023: number; source: "tigerdata" | "local" };
  headline: { could: number; could_pct_of_house_lots: number; did: number; lots_per_permit: number | null };
  data_dates: Record<string, string>; generated_at: string;
}
export interface WardSummaryFile { version: string; engine_version: string; designs_version: string;
  permit_rule: string; generated_at: string; data_dates: Record<string, string>;
  wards: Record<WardId, WardSummaryEntry>; city: WardSummaryEntry; }
export interface WardResponse extends WardSummaryEntry { lots_url: string; permits_url: string;
  trend_url: string; briefing_url: string; }

// ---------- GET /ward/{id}/trend ----------
export interface TrendPoint { month: string; permits: number; units: number; }
export interface TrendMarker { month: string; label: string; }
export interface TrendResponse { ward_id: WardId; source: "tigerdata" | "cache" | "local"; since: string;
  series: TrendPoint[]; markers: TrendMarker[]; generated_at: string; }

// ---------- wards/{id}.geojson and permits.geojson feature properties ----------
export interface LotFeatureProps { id: number; c: LotClass; b: Result; r: Record<DesignKey, Result>;
  k: RuleId | null;                 // the rule that limits the best design (blocking or borderline); null when it fits
  f: FlagKey[]; a: 0 | 1; v: 0 | 1; }
export interface PermitFeatureProps { id: number; d: string; w: WardId; u: number; k: PermitKind; }

// ---------- AI service ----------
export interface NumberEntry { value: number; unit: string | null; label: string; source_url: string; }
export interface ExplainRequest { check: CheckResponse; design_id: DesignId | null; lang: Lang; }
export interface ExplainResponse {
  lang: Lang; design_id: DesignId; template_text: string; text: string;
  numbers: Record<string, NumberEntry>; validated: true; source: "gemini" | "template";
  model: string | null; cached: boolean; translation_unavailable: boolean; disclaimer: string;
}
export interface BriefingRequest { ward: WardSummaryEntry; trend: TrendResponse | null; lang: Lang; }
export interface BriefingSection { id: "what_may_fit" | "blocking_rule" | "permits" | "not_checked" | "questions";
  heading: string; template_text: string; text: string; }
export interface BriefingResponse {
  ward_id: WardId; ward_name: string; lang: Lang; title: string; sections: BriefingSection[];
  questions: string[]; numbers: Record<string, NumberEntry>;
  links: { ward_map: string; datasets: { label: string; url: string }[]; methodology: string };
  disclaimer: string; data_dates: Record<string, string>; generated_at: string;
  validated: true; source: "gemini" | "template"; model: string | null; cached: boolean;
  translation_unavailable: boolean;
}
```

**Copy files (`/contracts/copy/`, Simone edits directly):**

- `labels.json`: `results` (Result → label), `classes`, `rules` (RuleId → label), `designs` (DesignId → name), `ui` (button and heading strings: `see_your_ward`, `back_to_your_lot`, `get_briefing`, `what_we_dont_check`, `permits_near_you`, `translate`, `copy`, `outside_toronto`, and so on).
- `reasons.json`: `classes` (LotClass → `{label, text}`), `flags` (FlagId → `{label, text, source_url}`), `rules_plain` (RuleId → the plain-words reason used in the ward panel, e.g. `lot_width` → "lot too narrow for the side yards"), `attached_note` (the basement/garden suite sentence).
- `not_checked.json`: the ordered list from section 5.6 as `[{id, label}]`.
- `questions.json`: `{"en": [three questions]}`. v0 text: "What, if anything, should the City do about its free multiplex designs on lots where they fit?" · "Should the City do more to tell residents what the multiplex rules allow on their street, and how?" · "The free designs are for detached lots. What should happen on streets where most homes are semis or row houses?" (Simone may rewrite; they stay neutral and the same for every ward.)
- `disclaimers.json`: `screening` ("Screening only, not a permit or legal advice."), `illustrative` ("Illustrative new-build scenario"), `upper_bound` ("Counts are upper bounds: a design may fit; nothing here says it will be built."), `permits_label` ("Multiplex permits since May 2023, before the free designs existed."), `massing` ("Neighbouring buildings are illustrative, from the City's 3D Massing data."), `no_building` ("No building here today."), `cached` ("Cached result").

**Rules every producer follows:** every response carries the disclaimer string; `numbers` keys are `snake_case`; `template_text` placeholders are `{{snake_case}}`; counts are integers; metres have two decimals; percentages one decimal; `generated_at` is ISO 8601 with a timezone.

---

## Appendix B. `/contracts/designs.json`

All dimensions were read from each plan set's sheet A011 "Site Plan" (page 10) and its "COT Zoning Matrix". Minimum lots are derived from each design's assumed setbacks (width = building + both side yards; depth = 6.0 m front + length + rear, where the rear is 7.5 m in R and RT and the greater of 7.5 m and 25% of lot depth in RD, RS and RM). Level heights and the 1.4 m top-floor stepback are **for the 3D view only**: the sheets give a 10.0 m building height and three storeys plus a basement; the Sixplex Wide sheet shows a 1,400 mm main wall stepback, and the other designs' third-floor areas imply about the same.

```json
{
  "version": "2026-10-17",
  "released": "2026-10-02",
  "designs": [
    {
      "id": "fourplex_narrow", "key": "fn", "name": "Fourplex Narrow",
      "units": 4, "bedrooms": 6,
      "width_m": 5.5, "length_m": 17.0, "height_m": 10.0, "storeys": 3,
      "building_area_m2": 94.7, "gfa_m2": 308.0,
      "side_yards_m": [1.2, 0.9], "front_setback_m": 6.0, "rear_setback_m": 7.5,
      "min_lot_width_m": 7.6, "min_lot_depth_m": { "r_rt": 30.5, "rd_rs_rm": 30.7 },
      "where_allowed": "all_residential", "top_floor_stepback_m": 1.4,
      "homes": [
        { "id": 1, "label": "Basement home", "bedrooms": 2, "levels": [-1], "accessible": false, "walkout": true },
        { "id": 2, "label": "Ground-floor home", "bedrooms": 1, "levels": [0], "accessible": true, "walkout": false },
        { "id": 3, "label": "Second-floor home", "bedrooms": 2, "levels": [1], "accessible": false, "walkout": false },
        { "id": 4, "label": "Third-floor home", "bedrooms": 1, "levels": [2], "accessible": false, "walkout": false }
      ],
      "levels": [
        { "level": -1, "name": "Basement", "height_m": 2.7, "visible_m": 1.0, "area_m2": 94.0, "stepped_back": false },
        { "level": 0, "name": "Ground floor", "height_m": 3.4, "visible_m": 3.4, "area_m2": 94.0, "stepped_back": false },
        { "level": 1, "name": "Second floor", "height_m": 3.3, "visible_m": 3.3, "area_m2": 94.0, "stepped_back": false },
        { "level": 2, "name": "Third floor", "height_m": 3.3, "visible_m": 3.3, "area_m2": 77.7, "stepped_back": true }
      ],
      "source": { "file": "COT_Multiplex_FOURPLEX_ Narrow_Comb-Electric.pdf", "sheet": "A011 Site Plan", "page": 10,
                  "url": "https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-building-plans/pre-approved-multiplex-building-plans/" }
    },
    {
      "id": "fourplex_wide", "key": "fw", "name": "Fourplex Wide",
      "units": 4, "bedrooms": 10,
      "width_m": 6.64, "length_m": 17.0, "height_m": 10.0, "storeys": 3,
      "building_area_m2": 113.3, "gfa_m2": 417.8,
      "side_yards_m": [1.2, 1.2], "front_setback_m": 6.0, "rear_setback_m": 7.5,
      "min_lot_width_m": 9.04, "min_lot_depth_m": { "r_rt": 30.5, "rd_rs_rm": 30.7 },
      "where_allowed": "all_residential", "top_floor_stepback_m": 1.4,
      "homes": [
        { "id": 1, "label": "Basement home", "bedrooms": 3, "levels": [-1], "accessible": false, "walkout": true },
        { "id": 2, "label": "Ground-floor home", "bedrooms": 2, "levels": [0], "accessible": true, "walkout": false },
        { "id": 3, "label": "Two-storey home A", "bedrooms": 3, "levels": [1, 2], "accessible": false, "walkout": false },
        { "id": 4, "label": "Two-storey home B", "bedrooms": 2, "levels": [1, 2], "accessible": false, "walkout": false }
      ],
      "levels": [
        { "level": -1, "name": "Basement", "height_m": 2.7, "visible_m": 1.0, "area_m2": 110.0, "stepped_back": false },
        { "level": 0, "name": "Ground floor", "height_m": 3.4, "visible_m": 3.4, "area_m2": 110.0, "stepped_back": false },
        { "level": 1, "name": "Second floor", "height_m": 3.3, "visible_m": 3.3, "area_m2": 110.0, "stepped_back": false },
        { "level": 2, "name": "Third floor", "height_m": 3.3, "visible_m": 3.3, "area_m2": 88.5, "stepped_back": true }
      ],
      "source": { "file": "COT_Multiplex_FOURPLEX_WIDE_Comb-Electric.pdf", "sheet": "A011 Site Plan", "page": 10,
                  "url": "https://www.toronto.ca/ext/digital_comm/pdfs/toronto-building/COT_Multiplex_FOURPLEX%20WIDE_Comb-Electric.pdf" }
    },
    {
      "id": "sixplex_narrow", "key": "sn", "name": "Sixplex Narrow",
      "units": 6, "bedrooms": 10,
      "width_m": 5.9, "length_m": 19.0, "height_m": 10.0, "storeys": 3,
      "building_area_m2": 114.1, "gfa_m2": 423.1,
      "side_yards_m": [1.2, 1.2], "front_setback_m": 6.0, "rear_setback_m": 7.5,
      "min_lot_width_m": 8.3, "min_lot_depth_m": { "r_rt": 32.5, "rd_rs_rm": 33.3 },
      "where_allowed": "sixplex_overlay", "top_floor_stepback_m": 1.4,
      "homes": [
        { "id": 1, "label": "Basement home A", "bedrooms": 1, "levels": [-1], "accessible": false, "walkout": true },
        { "id": 2, "label": "Basement home B", "bedrooms": 1, "levels": [-1], "accessible": false, "walkout": true },
        { "id": 3, "label": "Ground-floor home A", "bedrooms": 1, "levels": [0], "accessible": true, "walkout": false },
        { "id": 4, "label": "Ground-floor home B", "bedrooms": 1, "levels": [0], "accessible": false, "walkout": false },
        { "id": 5, "label": "Two-storey home A", "bedrooms": 3, "levels": [1, 2], "accessible": false, "walkout": false },
        { "id": 6, "label": "Two-storey home B", "bedrooms": 3, "levels": [1, 2], "accessible": false, "walkout": false }
      ],
      "levels": [
        { "level": -1, "name": "Basement", "height_m": 2.7, "visible_m": 1.0, "area_m2": 111.0, "stepped_back": false },
        { "level": 0, "name": "Ground floor", "height_m": 3.4, "visible_m": 3.4, "area_m2": 111.0, "stepped_back": false },
        { "level": 1, "name": "Second floor", "height_m": 3.3, "visible_m": 3.3, "area_m2": 111.0, "stepped_back": false },
        { "level": 2, "name": "Third floor", "height_m": 3.3, "visible_m": 3.3, "area_m2": 91.1, "stepped_back": true }
      ],
      "source": { "file": "COT_Multiplex_SIXPLEX_NARROW_Comb_Electric.pdf", "sheet": "A011 Site Plan", "page": 10,
                  "url": "https://www.toronto.ca/ext/digital_comm/pdfs/toronto-building/COT_Multiplex_SIXPLEX%20NARROW_Comb_Electric.pdf" }
    },
    {
      "id": "sixplex_wide", "key": "sw", "name": "Sixplex Wide",
      "units": 6, "bedrooms": 12,
      "width_m": 8.1, "length_m": 17.0, "height_m": 10.0, "storeys": 3,
      "building_area_m2": 137.6, "gfa_m2": 508.2,
      "side_yards_m": [1.2, 1.2], "front_setback_m": 6.0, "rear_setback_m": 7.5,
      "min_lot_width_m": 10.5, "min_lot_depth_m": { "r_rt": 30.5, "rd_rs_rm": 30.7 },
      "where_allowed": "sixplex_overlay", "top_floor_stepback_m": 1.4,
      "homes": [
        { "id": 1, "label": "Basement home A", "bedrooms": 2, "levels": [-1], "accessible": false, "walkout": true },
        { "id": 2, "label": "Basement home B", "bedrooms": 1, "levels": [-1], "accessible": false, "walkout": true },
        { "id": 3, "label": "Ground-floor home A", "bedrooms": 1, "levels": [0], "accessible": true, "walkout": false },
        { "id": 4, "label": "Ground-floor home B", "bedrooms": 1, "levels": [0], "accessible": false, "walkout": false },
        { "id": 5, "label": "Two-storey home A", "bedrooms": 3, "levels": [1, 2], "accessible": false, "walkout": false },
        { "id": 6, "label": "Two-storey home B", "bedrooms": 4, "levels": [1, 2], "accessible": false, "walkout": false }
      ],
      "levels": [
        { "level": -1, "name": "Basement", "height_m": 2.7, "visible_m": 1.0, "area_m2": 135.9, "stepped_back": false },
        { "level": 0, "name": "Ground floor", "height_m": 3.4, "visible_m": 3.4, "area_m2": 133.5, "stepped_back": false },
        { "level": 1, "name": "Second floor", "height_m": 3.3, "visible_m": 3.3, "area_m2": 133.5, "stepped_back": false },
        { "level": 2, "name": "Third floor", "height_m": 3.3, "visible_m": 3.3, "area_m2": 113.2, "stepped_back": true }
      ],
      "source": { "file": "COT_Multiplex_SIXPLEX_WIDE_Comb_Electric.pdf", "sheet": "A011 Site Plan", "page": 10,
                  "url": "https://www.toronto.ca/ext/digital_comm/pdfs/toronto-building/COT_Multiplex_SIXPLEX%20WIDE_Comb_Electric.pdf" }
    }
  ]
}
```

**All four designs at a glance.**

| Design | Units | Bedrooms | Building (W × L) | Height | Side yards | Min lot width | Min lot depth (R, RT / RD, RS, RM) | Where allowed |
|---|---|---|---|---|---|---|---|---|
| Fourplex Narrow | 4 | 6 | 5.5 × 17.0 m | 10.0 m | 1.2 + 0.9 m | 7.6 m | 30.5 / 30.7 m | All residential zones |
| Fourplex Wide | 4 | 10 | 6.64 × 17.0 m | 10.0 m | 1.2 + 1.2 m | 9.04 m | 30.5 / 30.7 m | All residential zones |
| Sixplex Narrow | 6 | 10 | 5.9 × 19.0 m | 10.0 m | 1.2 + 1.2 m | 8.3 m | 32.5 / 33.3 m, and the 19 m length needs a deep lot (decision 17) | Sixplex overlay only |
| Sixplex Wide | 6 | 12 | 8.1 × 17.0 m | 10.0 m | 1.2 + 1.2 m | 10.5 m | 30.5 / 30.7 m | Sixplex overlay only |

Other facts from the sheets: every design has 0 car spaces and 4 short-term bike stalls; one ground-floor unit per design is built to CSA B652:23 "accessible dwelling" with a lift; the plans leave lot area, frontage and depth blank ("dependent on site survey"); the heating variants (electric, gas, hybrid) appear to be the same building; the sixplex sheets list 10.5 m as allowable for five or six units under By-law 654-2025 section 600.60.40 but propose 10.0 m.

---

## Appendix C. `/contracts/engine_config.json`

Bylaw constants (6.0 m front, 7.5 m rear, 17.0 and 19.0 m lengths, 10.0 m height, the 45% coverage floor, the side-yard brackets) live in `engine/suplex_engine/rules.py` beside their section strings. This file holds only the band, the thresholds and the radii, which is why the web app also reads it (to print the band in the checklist).

```json
{
  "version": "0.1.0",
  "uncertainty_band_m": 0.5,
  "uncertainty_band_coverage_pp": 2,
  "larger_building": { "avg_height_m": 16, "footprint_m2": 350, "address_points": 4 },
  "attached": { "on_lot_m2": 10, "cross_lot_m2": 20, "shared_edge_m": 3, "tolerance_m": 0.05 },
  "vacant_min_footprint_m2": 20,
  "street_edge": { "corridor_distance_m": 0.5, "merge_angle_deg": 15, "min_length_m": 3 },
  "placement": { "align_to_sides_deg": 2 },
  "sample_step_m": 0.5,
  "nearby_permits_radius_m": 500,
  "context_radius_m": 150,
  "permits_since": "2023-05-01",
  "permits_trend_since": "2022-01-01",
  "sixplex_wards": ["04", "09", "10", "11", "12", "13", "14", "19", "23"],
  "partial_sixplex_wards": []
}
```

---

## Appendix D. `/contracts/design-tokens.css` (v0; Jayden finalizes by Hour 2, Simone reviews)

The three map colours are locked by the product spec. Everything else is a starting point chosen for a warm, animated look and projector contrast. Text is always `--suplex-ink` on `--suplex-paper` or `--suplex-surface` (contrast above 12:1); the green is never used as a text colour.

```css
/* contracts/design-tokens.css — shared by /web and /ai/page. Edit through Andrew. */
:root {
  /* Locked map colours */
  --suplex-fit: #22B573;             /* may fit */
  --suplex-nofit: #C9CCD6;           /* doesn't fit */
  --suplex-permit: #FFC83D;          /* multiplex permit dot */
  --suplex-permit-outline: #3A2E00;
  --suplex-permit-bar: #A27100;      /* chart bars: the gold fails 1.5:1 on white; this step passes 3:1 on the old and the Lime and Teal surfaces (Simone, 2026-10-17) */

  /* v0: result and UI colours */
  --suplex-borderline-base: #DDF3E7; /* pale green under the stripes */
  --suplex-borderline-stripe: #22B573;
  --suplex-fail: #D64545;            /* the red slice; always paired with an icon and text */
  --suplex-ink: #1C1F26;
  --suplex-ink-muted: #5B6170;
  --suplex-paper: #FBF8F2;           /* warm off-white page */
  --suplex-surface: #FFFFFF;
  --suplex-line: #E6E2DA;
  --suplex-accent: #2F6FED;          /* links, focus rings, primary buttons */
  --suplex-accent-ink: #FFFFFF;
  --suplex-searched: #FFFFFF;        /* the searched lot outline */

  /* v0: the 3D scene */
  --suplex-sky-top: #FFE2B8;
  --suplex-sky-bottom: #FFF7EA;
  --suplex-ground: #EFE9DF;
  --suplex-sun: #FFD9A0;
  --suplex-setback: rgba(47, 111, 237, 0.18);
  --suplex-buildable: rgba(34, 181, 115, 0.22);
  --suplex-home-1: #F4A261;
  --suplex-home-2: #E9C46A;
  --suplex-home-3: #E76F51;
  --suplex-home-4: #F6BD60;
  --suplex-home-5: #D98E73;
  --suplex-home-6: #F2CC8F;
  --suplex-neighbour-1: #D7E3F4;
  --suplex-neighbour-2: #E8DCCB;
  --suplex-neighbour-3: #DCE8D5;
  --suplex-neighbour-4: #F0DEE4;
  --suplex-neighbour-5: #E4E0F0;
  --suplex-roof: #C9B8A8;
  --suplex-tree: #7FB069;
  --suplex-trunk: #8C6A4F;

  /* Type and shape */
  --font-ui: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --text-xs: 12px; --text-sm: 14px; --text-md: 16px; --text-lg: 20px; --text-xl: 28px; --text-2xl: 40px;
  --radius: 12px; --radius-sm: 8px;
  --shadow: 0 8px 24px rgba(28, 31, 38, 0.08);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px;
}
```

Fonts: Inter and Space Grotesk from Google Fonts, loaded in `web/index.html` and `ai/page/index.html`, with the system fallback so the demo works offline.

---

## Appendix E. `/contracts/tiger/schema.sql` and the query module

```sql
-- contracts/tiger/schema.sql — run once on the Tiger Data service (psql "$TIGER_DSN" -f contracts/tiger/schema.sql)
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS permits (
  permit_id        text    NOT NULL,              -- PERMIT_NUM without its type suffix
  revision         text    NOT NULL DEFAULT '00', -- REVISION_NUM
  issued_at        date    NOT NULL,              -- ISSUED_DATE
  ward             text    NOT NULL,              -- "04"
  units_created    integer NOT NULL,              -- DWELLING_UNITS_CREATED, parsed
  units_lost       integer NOT NULL DEFAULT 0,
  kind             text    NOT NULL,              -- multiplex | secondary_suite | laneway_garden | other
  is_multiplex     boolean NOT NULL,
  lat              double precision,
  lon              double precision,
  address_point_id bigint,
  structure_type   text,
  work             text,
  PRIMARY KEY (permit_id, revision, issued_at)
);

SELECT create_hypertable('permits', 'issued_at',
  chunk_time_interval => INTERVAL '3 months', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS permits_ward_issued_idx ON permits (ward, issued_at DESC);

-- The continuous aggregate behind /ward/{id}/trend
CREATE MATERIALIZED VIEW IF NOT EXISTS permits_ward_month
WITH (timescaledb.continuous) AS
SELECT time_bucket(INTERVAL '1 month', issued_at) AS month,
       ward,
       count(*)           AS permits,
       sum(units_created) AS units
FROM permits
WHERE is_multiplex
GROUP BY month, ward
WITH NO DATA;

SELECT add_continuous_aggregate_policy('permits_ward_month',
  start_offset => INTERVAL '10 years', end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Compression for the full history (the before/after sizes go in /docs/tiger.md)
ALTER TABLE permits SET (timescaledb.compress,
  timescaledb.compress_segmentby = 'ward', timescaledb.compress_orderby = 'issued_at DESC');
SELECT add_compression_policy('permits', INTERVAL '7 days', if_not_exists => TRUE);

-- After load.py (also in pipeline/tiger/load.py):
--   CALL refresh_continuous_aggregate('permits_ward_month', NULL, NULL);
--   SELECT pg_size_pretty(hypertable_size('permits'));                      -- before
--   SELECT compress_chunk(c, if_not_compressed => TRUE) FROM show_chunks('permits') c;
--   SELECT pg_size_pretty(hypertable_size('permits'));                      -- after
--   SELECT * FROM hypertable_compression_stats('permits');
-- Newer Tiger Data releases call compression the columnstore (timescaledb.enable_columnstore,
-- add_columnstore_policy, hypertable_columnstore_stats); the names above still work as aliases.
```

`pipeline/tiger/queries.py` (used by the API and the batch run):

```python
import os, psycopg
from datetime import date

class TigerUnavailable(Exception): ...

def _conn():
    dsn = os.environ.get("TIGER_DSN")
    if not dsn:
        raise TigerUnavailable("TIGER_DSN not set")
    try:
        return psycopg.connect(dsn, connect_timeout=2, options="-c statement_timeout=2000")
    except Exception as e:
        raise TigerUnavailable(str(e)) from e

def ward_trend(ward_id: str, since: str = "2022-01-01") -> list[dict]:
    """Monthly multiplex permits and units for one ward, zero-filled through the current month."""
    sql = """SELECT to_char(month, 'YYYY-MM') AS month, permits, units
             FROM permits_ward_month WHERE ward = %s AND month >= %s ORDER BY month"""
    with _conn() as c:
        rows = {m: (p, u) for m, p, u in c.execute(sql, (ward_id, since)).fetchall()}
    return [{"month": m, "permits": rows.get(m, (0, 0))[0], "units": rows.get(m, (0, 0))[1]}
            for m in _months(since, date.today())]

def ward_count_since(ward_id: str, since: str = "2023-05-01") -> int:
    with _conn() as c:
        return c.execute("SELECT count(*) FROM permits WHERE ward = %s AND is_multiplex AND issued_at >= %s",
                         (ward_id, since)).fetchone()[0]

def all_wards_count_since(since: str = "2023-05-01") -> dict[str, int]:
    with _conn() as c:
        return dict(c.execute("SELECT ward, count(*) FROM permits WHERE is_multiplex AND issued_at >= %s GROUP BY ward",
                              (since,)).fetchall())
```

`cache_trends.py` calls `ward_trend` for `"01"` to `"25"` and writes `data/out/trend_cache/{id}.json` in the `TrendResponse` shape with `source: "cache"`, plus the two markers.

---

## Appendix F. Fixtures (`/contracts/fixtures/`)

Every fixture is **synthetic**: the address is "100 Fixture St", the lot is a 7.62 × 33.5 m rectangle, and every count is made up to exercise the shapes. `contracts/fixtures/README.md` says so in its first line, and no fixture number may ever appear in the pitch, the Devpost or a briefing. Files: `search.json`, `check.fits.json`, `check.borderline.json`, `check.no_fit.json`, `check.not_checked.json`, `ward.04.json`, `ward_summary.sample.json`, `trend.04.json`, `lots.04.sample.geojson` (a dozen lots covering every class and result), `permits.sample.geojson`, `explain.request.json`, `explain.response.json`, `briefing.request.json`, `briefing.04.en.json`, `briefing.04.fr.json`.

**`check.borderline.json`** (abridged; the full file carries all four designs and all rule rows):

```json
{
  "address": { "address_id": "fixture-1", "address_full": "100 Fixture St", "lon": -79.4700, "lat": 43.6500 },
  "lot": {
    "lot_id": "fixture-lot-1", "class": "checked", "reason": null, "ward_id": "04", "ward_name": "Parkdale-High Park",
    "zone": { "zn_zone": "RD", "zn_string": "RD (f7.5; a230)", "gen_zone": 0, "zbl_sectn": "10.20", "zn_status": 0,
              "frontage_min_m": 7.5, "units_max": null, "ht_overlay_m": null, "coverage_overlay_pct": 35,
              "exception_no": null, "sixplex_overlay": true },
    "width_m": 7.62, "depth_m": 33.5, "area_m2": 255.27, "stated_area": "255.3 sq.m",
    "front_bearing_deg": 180,
    "frontage_edge_local": [[-3.81, -16.75], [3.81, -16.75]],
    "polygon_local": [[-3.81, -16.75], [3.81, -16.75], [3.81, 16.75], [-3.81, 16.75], [-3.81, -16.75]],
    "polygon_wgs84": [[-79.47005, 43.64985], [-79.46995, 43.64985], [-79.46995, 43.65015], [-79.47005, 43.65015], [-79.47005, 43.64985]],
    "existing_building": { "building_id": 100001, "avg_height_m": 7.2, "footprint_m2": 66.0,
                           "footprint_local": [[-3.0, -9.0], [3.0, -9.0], [3.0, 2.0], [-3.0, 2.0]] },
    "attached": false, "vacant": false, "flags": []
  },
  "designs": [
    {
      "design_id": "fourplex_narrow", "result": "borderline", "blocking_rule": null,
      "rules": [
        { "rule_id": "detached_building", "label": "Detached lot", "required": "detached", "actual": "detached", "unit": null,
          "margin": null, "pass": true, "borderline": false, "not_applicable": false, "bylaw_section": "600.60.20 (detached houseplex)", "detail": null },
        { "rule_id": "units_allowed", "label": "Homes allowed", "required": 4, "actual": 6, "unit": "units",
          "margin": 2, "pass": true, "borderline": false, "not_applicable": false, "bylaw_section": "600.60.40(1)", "detail": "inside the sixplex overlay" },
        { "rule_id": "lot_width", "label": "Lot width", "required": 7.6, "actual": 7.62, "unit": "m",
          "margin": 0.02, "pass": true, "borderline": true, "not_applicable": false, "bylaw_section": "10.20.40.70(3)",
          "detail": "5.5 m building + 1.2 m + 0.9 m side yards" },
        { "rule_id": "lot_depth", "label": "Lot depth", "required": 31.38, "actual": 33.5, "unit": "m",
          "margin": 2.12, "pass": true, "borderline": false, "not_applicable": false, "bylaw_section": "10.20.40.70(1), 10.20.40.70(2)",
          "detail": "6.0 m front + 17.0 m building + 8.38 m rear (25% of 33.5 m)" },
        { "rule_id": "building_length", "label": "Building length", "required": 17.0, "actual": 17.0, "unit": "m",
          "margin": 0.0, "pass": true, "borderline": false, "not_applicable": false, "bylaw_section": "10.20.40.20(1)", "detail": null },
        { "rule_id": "height", "label": "Height", "required": 10.0, "actual": 10.0, "unit": "m",
          "margin": 0.0, "pass": true, "borderline": false, "not_applicable": false, "bylaw_section": "10.20.40.10(1)(C)", "detail": null },
        { "rule_id": "lot_coverage", "label": "Lot coverage", "required": 45.0, "actual": 37.1, "unit": "pct",
          "margin": 7.9, "pass": true, "borderline": false, "not_applicable": false, "bylaw_section": "10.20.30.40(1)(D)",
          "detail": "94.7 m² building on a 255.3 m² lot; overlay 35% raised to the 45% houseplex minimum" }
      ],
      "placement_local": [[-2.6, -10.75], [2.9, -10.75], [2.9, 6.25], [-2.6, 6.25]],
      "buildable_local": [[-2.61, -10.75], [2.91, -10.75], [2.91, 8.37], [-2.61, 8.37]],
      "setbacks_local": { "front": [[-3.81, -16.75], [3.81, -16.75], [3.81, -10.75], [-3.81, -10.75]],
                          "rear": [[-3.81, 8.37], [3.81, 8.37], [3.81, 16.75], [-3.81, 16.75]],
                          "left": [[-3.81, -10.75], [-2.61, -10.75], [-2.61, 8.37], [-3.81, 8.37]],
                          "right": [[2.91, -10.75], [3.81, -10.75], [3.81, 8.37], [2.91, 8.37]] },
      "fail_slices_local": []
    },
    { "design_id": "fourplex_wide", "result": "no_fit", "blocking_rule": "lot_width", "rules": ["... lot_width required 9.04, actual 7.62, margin -1.42 ..."],
      "placement_local": [[-3.32, -10.75], [3.32, -10.75], [3.32, 6.25], [-3.32, 6.25]], "buildable_local": "...", "setbacks_local": "...",
      "fail_slices_local": [[[-3.32, -10.75], [-2.61, -10.75], [-2.61, 6.25], [-3.32, 6.25]], [[2.61, -10.75], [3.32, -10.75], [3.32, 6.25], [2.61, 6.25]]] },
    { "design_id": "sixplex_narrow", "result": "no_fit", "blocking_rule": "lot_width", "rules": ["... lot_width margin -0.68; building_length required 17.0, actual 19.0, margin -2.0 ..."] },
    { "design_id": "sixplex_wide", "result": "no_fit", "blocking_rule": "lot_width", "rules": ["... lot_width margin -2.88 ..."] }
  ],
  "not_checked": ["Site-specific exceptions", "Lots still under pre-2013 bylaws", "Heritage designation or districts", "..."],
  "permits_nearby": { "radius_m": 500, "since": "2023-05-01", "count": 2,
                      "points": [[-79.4712, 43.6509], [-79.4688, 43.6493]], "points_local": [[-97.0, 100.0], [97.0, -78.0]] },
  "context": {
    "origin": { "lon": -79.4700, "lat": 43.6500, "x_2952": 311000.0, "y_2952": 4834000.0 }, "radius_m": 150,
    "buildings": [
      { "building_id": 100001, "avg_height_m": 7.2, "kind": "house", "on_lot": true, "footprint_local": [[-3.0, -9.0], [3.0, -9.0], [3.0, 2.0], [-3.0, 2.0]] },
      { "building_id": 100002, "avg_height_m": 7.8, "kind": "house", "on_lot": false, "footprint_local": [[-10.6, -9.0], [-4.6, -9.0], [-4.6, 2.5], [-10.6, 2.5]] },
      { "building_id": 100003, "avg_height_m": 6.9, "kind": "house", "on_lot": false, "footprint_local": [[4.6, -9.5], [10.6, -9.5], [10.6, 1.5], [4.6, 1.5]] },
      { "building_id": 100004, "avg_height_m": 14.5, "kind": "large", "on_lot": false, "footprint_local": [[-30.0, -60.0], [-6.0, -60.0], [-6.0, -40.0], [-30.0, -40.0]] }
    ],
    "trees": [[-6.0, -19.0], [5.0, -19.5], [-14.0, -19.2]]
  },
  "meta": { "engine_version": "0.1.0", "designs_version": "2026-10-17", "config_version": "0.1.0",
            "data_dates": { "address_points": "2026-10-16", "property_boundaries": "2026-10-16", "zoning": "2026-02-20",
                            "permits_active": "2026-10-16", "permits_cleared": "2026-10-16", "massing": "2025-12-02", "wards": "2026-02-20" },
            "disclaimer": "Screening only, not a permit or legal advice.", "generated_at": "2026-10-17T00:00:00Z", "cached": false }
}
```

`check.fits.json` uses a 12.2 × 40.0 m lot (all four designs fit; Sixplex Narrow passes the deep-lot test with frontage 12.2 ≥ 10 and depth 40 ≥ 40). `check.no_fit.json` uses a 6.1 × 30.0 m lot (every design fails on `lot_width`, Fourplex Narrow by 1.5 m). `check.not_checked.json` is a condo (`class: "condo"`, `reason: {"id": "condo", "label": "Condo building", "text": "..."}`, four `not_checked` designs with empty rules).

**`ward.04.json`** (synthetic counts):

```json
{
  "ward_id": "04", "ward_name": "Parkdale-High Park", "sixplex_overlay": "full",
  "lots_total": 18000, "house_lots": 12000,
  "classes": { "condo": 900, "non_residential": 2100, "older_bylaw": 300, "larger_building": 1500, "unmeasurable": 1200, "attached": 4300, "checked": 7700 },
  "any_design": { "fits": 3900, "borderline": 1400, "no_fit": 6700, "not_checked": 6000 },
  "by_design": {
    "fourplex_narrow": { "fits": 3900, "borderline": 1400, "no_fit": 6700, "not_checked": 6000 },
    "fourplex_wide":   { "fits": 2600, "borderline": 900,  "no_fit": 8500, "not_checked": 6000 },
    "sixplex_narrow":  { "fits": 400,  "borderline": 150,  "no_fit": 11450, "not_checked": 6000 },
    "sixplex_wide":    { "fits": 1700, "borderline": 600,  "no_fit": 9700, "not_checked": 6000 }
  },
  "top_blocking_rules": [ { "rule_id": "detached_building", "count": 4300 }, { "rule_id": "lot_width", "count": 2100 }, { "rule_id": "lot_depth", "count": 300 } ],
  "attached_share_pct": 35.8,
  "flags": { "heritage_register": 210, "heritage_district": 640, "ravine": 380, "trca": 150, "site_exception": 420, "vacant": 35, "any_on_fitting_lots": 310 },
  "permits": { "rule": "A: permits creating 1-6 units, non-SFD structure (Toronto Multiplex Tracker rule), multiplex kind",
               "since_may_2023": 41, "by_kind_since_may_2023": { "multiplex": 41, "secondary_suite": 120, "laneway_garden": 35, "other": 10 },
               "by_year": { "2022": 20, "2023": 25, "2024": 30, "2025": 28, "2026": 15 }, "units_since_may_2023": 139, "source": "local" },
  "headline": { "could": 3900, "could_pct_of_house_lots": 32.5, "did": 41, "lots_per_permit": 95 },
  "data_dates": { "permits_active": "2026-10-16", "permits_cleared": "2026-10-16", "zoning": "2026-02-20" },
  "generated_at": "2026-10-17T00:00:00Z",
  "lots_url": "/static/wards/04.geojson", "permits_url": "/static/permits.geojson",
  "trend_url": "/ward/04/trend", "briefing_url": "http://localhost:8001/b/04"
}
```

**`trend.04.json`**: `{"ward_id": "04", "source": "cache", "since": "2022-01", "series": [{"month": "2022-01", "permits": 1, "units": 3}, {"month": "2022-02", "permits": 0, "units": 0}, "... one entry per month through 2026-10 ..."], "markers": [{"month": "2023-05", "label": "Multiplexes allowed citywide"}, {"month": "2026-10", "label": "Free designs released"}], "generated_at": "2026-10-17T00:00:00Z"}`

**One feature from `lots.04.sample.geojson`:** `{"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[-79.47005, 43.64985], [-79.46995, 43.64985], [-79.46995, 43.65015], [-79.47005, 43.65015], [-79.47005, 43.64985]]]}, "properties": {"id": 1, "c": "checked", "b": "borderline", "r": {"fn": "borderline", "fw": "no_fit", "sn": "no_fit", "sw": "no_fit"}, "k": "lot_width", "f": [], "a": 0, "v": 0}}`

**One feature from `permits.sample.geojson`:** `{"type": "Feature", "geometry": {"type": "Point", "coordinates": [-79.4712, 43.6509]}, "properties": {"id": 1, "d": "2024-03-14", "w": "04", "u": 4, "k": "multiplex"}}`

**`explain.response.json`** (for the borderline fixture, English):

```json
{
  "lang": "en", "design_id": "fourplex_narrow",
  "template_text": "The Fourplex Narrow is too close to call on this lot. It needs {{lot_width_required}} m of lot width and the lot measures about {{lot_width_actual}} m, a difference inside our {{uncertainty_band_m}} m uncertainty band, because the City's lot lines are not survey-accurate. Depth, height and lot coverage all pass. This is a screening, not a permit: a survey and the City's zoning examiner can confirm.",
  "text": "The Fourplex Narrow is too close to call on this lot. It needs 7.6 m of lot width and the lot measures about 7.62 m, a difference inside our 0.5 m uncertainty band, because the City's lot lines are not survey-accurate. Depth, height and lot coverage all pass. This is a screening, not a permit: a survey and the City's zoning examiner can confirm.",
  "numbers": {
    "lot_width_required": { "value": 7.6, "unit": "m", "label": "Lot width the Fourplex Narrow needs", "source_url": "http://localhost:5173/?a=fixture-1#checklist" },
    "lot_width_actual": { "value": 7.62, "unit": "m", "label": "This lot's width across the building", "source_url": "https://open.toronto.ca/dataset/property-boundaries/" },
    "uncertainty_band_m": { "value": 0.5, "unit": "m", "label": "Uncertainty band", "source_url": "http://localhost:8001/b/04#methodology" }
  },
  "validated": true, "source": "gemini", "model": "gemini-3.8-flash", "cached": false, "translation_unavailable": false,
  "disclaimer": "Screening only, not a permit or legal advice."
}
```

**`briefing.04.en.json`** (abridged): the title "Ward 04, Parkdale–High Park: multiplexes, before you vote"; five sections whose `template_text` uses `{{could_lots}}`, `{{could_pct}}`, `{{did_permits}}`, `{{lots_per_permit}}`, `{{attached_pct}}`, `{{top_rule_count}}`, `{{not_checked_lots}}`; `questions` equal to `contracts/copy/questions.json` `en`; `numbers` with a `source_url` for every key; `links.ward_map` = `http://localhost:5173/?ward=04`; `links.datasets` = the two permits datasets, Property Boundaries and the Zoning By-law; `links.methodology` = `#methodology`; `validated: true`, `source: "gemini"`.

---

## Appendix G. Dataset field reference and download URLs (verified 2026-10-17 through the City's CKAN API)

Base: `https://ckan0.cf.opendata.inter.prod-toronto.ca`. Each dataset page's `package_show` response lists every resource; the direct URLs below were read from those responses so `download.py` needs no browsing. Sizes are bytes as reported.

| Dataset | Resource to download | Size | Direct URL |
|---|---|---|---|
| Address Points | `address-points-4326.gpkg` (daily; 2026-10-16) | 208,187,392 | `/dataset/abedd8bc-e3dd-4d45-8e69-79165a76e4fa/resource/f9557b4f-724f-47ff-9326-c9d55050f648/download/address-points-4326.gpkg` |
| Address Points (metres) | `address-points-2952.gpkg` (same date) | 208,220,160 | `/dataset/abedd8bc-e3dd-4d45-8e69-79165a76e4fa/resource/9a7495b3-055c-4c9c-b3b3-e164c3cc6b03/download/address-points-2952.gpkg` |
| Property Boundaries | `property-boundaries-4326.gpkg` (2026-10-03) | 160,681,984 | `/dataset/1acaa8b0-f235-4df6-8305-02025ccdeb07/resource/7e9fff54-71c8-4958-b74a-2419f727c8a7/download/property-boundaries-4326.gpkg` |
| Zoning Area | `zoning-area-4326.gpkg` (2026-02-20) | 20,860,928 | `/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/f9b16f51-e957-4a2a-88e6-4b9679668e11/download/zoning-area-4326.gpkg` |
| Zoning Height Overlay | `zoning-height-overlay-4326.gpkg` | 6,852,608 | `/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/11587cb9-87be-43df-be16-c14136a4c845/download/zoning-height-overlay-4326.gpkg` |
| Zoning Lot Coverage Overlay | `zoning-lot-coverage-overlay-4326.gpkg` | 3,883,008 | `/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/bdd702b6-c004-4853-9b1d-a3cd8aa32930/download/zoning-lot-coverage-overlay-4326.gpkg` |
| Zoning readme | `zoning_readme.txt` | 5,842 | `/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/aa11a6f1-17fd-49b7-bbe4-f381bbc36f94/download/zoning_readme.txt` |
| Building Permits – Active | `building-permits-active-permits.csv` (daily; 202,039 rows) | 68,384,844 | `/dataset/108c2bd1-6945-46f6-af92-02f5658ee7f7/resource/dfce3b7b-4f17-4a9d-9155-5e390a5ffa97/download/building-permits-active-permits.csv` |
| Building Permits – Active (datastore) | resource id `6d0229af-bc54-46de-9c2b-26759b01dd05` | — | `/api/3/action/datastore_search?resource_id=6d0229af-bc54-46de-9c2b-26759b01dd05&limit=5` |
| Building Permits – Cleared since 2017 | `cleared-building-permits-since-2017.csv` (daily) | 150,272,506 | `/dataset/9e42a85b-180f-4dc5-b0d7-d46661a6c0ec/resource/b41c3e9e-4d2d-4b09-a789-9569d8da407c/download/cleared-building-permits-since-2017.csv` |
| Building Permits – Cleared (datastore) | resource id `a96c0ba4-3026-402b-b09d-5b1268b8f810` | — | `/api/3/action/datastore_search?resource_id=a96c0ba4-3026-402b-b09d-5b1268b8f810&limit=5` |
| 3D Massing | `3DMassingShapefile_2025_WGS84.zip` (2025-12-02) | 81,415,175 | `/dataset/387b2e3b-2a76-4199-8b3b-0b7d22e2ec10/resource/667237d6-4d3c-4cf3-8cb7-e91c48d59375/download/3dmassingshapefile_2025_wgs84.zip` |
| City Wards | `city-wards-data-4326.gpkg` (2026-02-20) | 528,384 | `/dataset/5e7a8234-f805-43ac-820f-03d7c360b588/resource/6f638349-66c8-4830-a82a-f403d7a5219e/download/city-wards-data-4326.gpkg` |
| Heritage Register, Heritage Conservation Districts, Ravine Protection Area, Street Trees | the newest GPKG resource in each dataset's `package_show` response (not fetched while writing this spec) | — | `download.py` resolves them through `package_show` at run time |
| TRCA Regulated Area | ArcGIS FeatureServer layer 0, `query?where=1%3D1&geometry=<bbox>&geometryType=esriGeometryEnvelope&inSR=4326&outFields=*&f=geojson` | — | `https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/ArcGIS/rest/services/TRCA_Regulation_Limit2/FeatureServer/0/query` (confirm the layer index on first call) |

**Verified field lists.**

- **Address Points (38):** `_id, ADDRESS_POINT_ID, ADDRESS_ID, ADDRESS_STRING_ID, LINEAR_NAME_ID, CENTRELINE_ID, MAINT_STAGE, ADDRESS_NUMBER, LINEAR_NAME_FULL, LO_NUM, LO_NUM_SUF, HI_NUM, HI_NUM_SUF, LINEAR_NAME, LINEAR_NAME_TYPE, LINEAR_NAME_DIR, LINEAR_NAME_DESC, CENTRELINE_SIDE, CENTRELINE_MEASURE, CENTRELINE_OFFSET, GENERAL_USE_CODE, GENERAL_USE, CLASS_FAMILY, CLASS_FAMILY_DESC, ADDRESS_CLASS, ADDRESS_CLASS_DESC, ADDRESS_POINT_ID_LINK, ADDRESS_ID_LINK, PLACE_NAME, PLACE_NAME_ALL, ADDRESS_STATUS, OBJECTID, MUNICIPALITY, MUNICIPALITY_NAME, WARD, WARD_NAME, ADDRESS_FULL, geometry`. Sample: `ADDRESS_POINT_ID 1020891`, `ADDRESS_FULL "32 Nineteenth St"`, `WARD "03"`, `ADDRESS_CLASS "L"`, `CLASS_FAMILY_DESC "Land, Structure, Structure Entrance"`, `MAINT_STAGE "REGULAR"`. There is **no `GEO_ID`** column in the current schema.
- **Property Boundaries (6):** `_id, PARCELID, FEATURE_TYPE, STATEDAREA, OBJECTID, geometry`. Sample: `PARCELID 5126707`, `FEATURE_TYPE "COMMON"`, `STATEDAREA "18544.72 sq.m"`.
- **Zoning Area (25):** `_id, GEN_ZONE, ZN_ZONE, ZN_HOLDING, HOLDING_ID, FRONTAGE, ZN_AREA, UNITS, DENSITY, COVERAGE, FSI_TOTAL, PRCNT_COMM, PRCNT_RES, PRCNT_EMMP, PRCNT_OFFC, ZN_EXCPTN, EXCPTN_NO, STAND_SET, ZN_STATUS, ZN_STRING, AREA_UNITS, ZBL_CHAPT, ZBL_SECTN, ZBL_EXCPTN, geometry`. Sample: `GEN_ZONE 2`, `ZN_ZONE "UT"`, `FRONTAGE -1`, `ZN_STATUS 2`, `ZBL_CHAPT "100"`, `ZBL_SECTN "100.10"`. Readme: `ZN_STATUS` 0–4 and 6 = in By-law 569-2013, **5 = not part of By-law 569-2013**; `GEN_ZONE` codes as in section 4.2; `FRONTAGE` is the required minimum lot frontage (the `f` value); `UNITS` the `u` value; `COVERAGE` a percentage. Height overlay fields per the readme: `HT_STRING` ("HT 10.5, ST 3"), `HT_HEIGHT` (m), `HT_STORIES`; **in the GPKG the metres column is `HT_LABEL`** (Yuvi, 2026-10-17). Coverage overlay: `PRCNT_CVER`. In the current file `ZN_STATUS` only takes the values 0 to 3.
- **Building Permits, active and cleared (32, identical):** `_id, PERMIT_NUM, REVISION_NUM, PERMIT_TYPE, STRUCTURE_TYPE, WORK, STREET_NUM, STREET_NAME, STREET_TYPE, STREET_DIRECTION, POSTAL, GEO_ID, WARD_GRID, APPLICATION_DATE, ISSUED_DATE, COMPLETED_DATE, STATUS, DESCRIPTION, CURRENT_USE, PROPOSED_USE, DWELLING_UNITS_CREATED, DWELLING_UNITS_LOST, EST_CONST_COST, ASSEMBLY, INSTITUTIONAL, RESIDENTIAL, BUSINESS_AND_PERSONAL_SERVICES, MERCANTILE, INDUSTRIAL, INTERIOR_ALTERATIONS, DEMOLITION, BUILDER_NAME`. Samples: `PERMIT_NUM "22 128979 PLB"`, `PERMIT_TYPE "Plumbing(PS)"`, `STRUCTURE_TYPE "2 Unit - Detached"`, `WORK "Building Permit Related(PS)"`, `GEO_ID "5507727"`, `WARD_GRID "E2034"`, `ISSUED_DATE "2022-06-09"`, `CURRENT_USE "Sfd"`, `PROPOSED_USE "2 Unit Dwelling"`, `DWELLING_UNITS_CREATED null`; cleared sample `STRUCTURE_TYPE "SFD - Semi-Detached"`, `WORK "Back Water Valve (Sewer only)"`, `STATUS "Closed"`.
- **3D Massing 2025 shapefile (9 attributes, 428,184 features):** `MIN_HEIGHT, MAX_HEIGHT, AVG_HEIGHT, HEIGHT_MSL, SURF_ELEV, HEIGHT_SRC, BLDG_SRC, LONGITUDE, LATITUDE`. `.prj`: `WGS_1984_Web_Mercator_Auxiliary_Sphere` (EPSG:3857). Samples: `AVG_HEIGHT 5.69`, `MAX_HEIGHT 8.59`, `HEIGHT_SRC "Lidar-Derived"`, `BLDG_SRC "Photogrammetrics"`. No id column.
- **City Wards (20):** `_id, AREA_ID, DATE_EFFECTIVE, DATE_EXPIRY, AREA_ATTR_ID, AREA_TYPE_ID, PARENT_AREA_ID, AREA_TYPE, AREA_CLASS_ID, AREA_CLASS, AREA_SHORT_CODE, AREA_LONG_CODE, AREA_NAME, AREA_DESC, FEATURE_CODE, FEATURE_CODE_DESC, TRANS_ID_CREATE, TRANS_ID_EXPIRE, OBJECTID, geometry`. Sample: `AREA_SHORT_CODE "07"`, `AREA_NAME "Humber River-Black Creek"`, `AREA_DESC "Humber River-Black Creek (7)"`.

The datastore previews (`datastore_search`) and the GPKG files are produced from the same source tables; the GPKG column names are expected to match (no `_id`, no `geometry` text column). Yuvi confirms with `pyogrio.read_info()` at Hour 0 (T4).

---

## Appendix H. Verification log (what was checked on 2026-10-17, and what was not)

The prompt marked some items VERIFY. Each was checked where it could be done online or from files on this machine. "Verified" means the source itself was read; "not verified" means it stays a TODO with an owner in section 13.

| Item | Where it was checked | Result | Status |
|---|---|---|---|
| Building permits datasets: active or retired, refresh, formats, size | CKAN `package_show` for both datasets | Both `is_retired: false`, state active, refresh daily, last refreshed 2026-10-16. Active: CSV 68 MB (202,039 rows), XML 257 MB, JSON 189 MB, plus a datastore resource. Cleared since 2017: CSV 150 MB, XML 563 MB, JSON 414 MB, plus a datastore resource and a 2000–2016 CSV | verified |
| Building permits field names | CKAN `datastore_search` on both resources | 32 identical fields (Appendix G); `DWELLING_UNITS_CREATED` is text and often null; `GEO_ID` present; `WARD_GRID` is a grid code, not a ward | verified |
| The Toronto Multiplex Tracker's permit rule | its GitHub README | units created 1–6, `STRUCTURE_TYPE` not like `SFD%` except `WORK` in (`Second Suite (New)`, `New Laneway / Rear Yard Suite`); joins on `GEO_ID` with a street-name fallback; `basement_units` hidden by default; 1,505 permits dropped and 11,749 of 11,761 with units lost = 0 in its notes | verified |
| 3D Massing file name, size, fields and height field | CKAN `package_show`; the 2025 shapefile downloaded and its DBF header read | `3DMassingShapefile_2025_WGS84.zip`, 81,415,175 bytes, 428,184 features; fields `MIN_HEIGHT, MAX_HEIGHT, AVG_HEIGHT, HEIGHT_MSL, SURF_ELEV, HEIGHT_SRC, BLDG_SRC, LONGITUDE, LATITUDE`; no id column; `.prj` is Web Mercator (EPSG:3857) | verified; `AVG_HEIGHT` adopted |
| Address Points, Property Boundaries, Zoning, City Wards: file names, sizes, field names | CKAN `package_show` and `datastore_search`; the zoning readme | as in Appendix G; Address Points has `ADDRESS_POINT_ID` and no `GEO_ID`; `ZN_STATUS` 5 = not part of 569-2013; `GEN_ZONE` codes; height overlay fields named `HT_HEIGHT`/`HT_STRING`/`HT_STORIES` in the readme | verified, except the GPKG column names (T4) |
| How pre-2013 bylaw lots appear in the data | the zoning readme | `ZN_STATUS = 5`; the readme recommends hiding those objects | verified |
| RT (10.60) building length, setbacks, height, coverage | the by-law chapter page | no length or depth rule for a houseplex (10.60.40.20 covers townhouses and apartment buildings on major streets); side 0.9 m for a detached houseplex (10.60.40.70(3)(B)); rear 7.5 m; front 6.0 m; height greater of HT and 10.0 m (10.60.40.10(1)(C)); 45% coverage floor (10.60.30.40(1)(D)) | verified |
| RM (10.80) building length, setbacks, height, coverage | the by-law chapter page | length 17.0 m for a detached or semi-detached house (10.80.40.20(1)); depth: rear main wall within 19.0 m of the required front setback (10.80.40.30(1)); side 1.2 m for a detached houseplex (10.80.40.70(3)); rear greater of 7.5 m and 25% (10.80.40.70(2)); front 6.0 m; height greater of HT and 10.0 m; 45% floor | verified; 17 m applied to houseplexes conservatively (T9) |
| RD (10.20) length rule and the 19 m conditions | the by-law chapter page | 10.20.40.20(1): 17.0 m for a permitted residential building (no type named); 10.20.40.20(3): 19.0 m for a detached houseplex on a lot ≥ 36 m deep with frontage < 10 m or ≥ 40 m deep with frontage ≥ 10 m; 10.20.40.30: the rear main wall within 19.0 m of the required front setback; side-yard table as in section 5.4; rear, height, coverage and FSI sections as in section 5.4 | verified |
| The Sixplex Narrow sheet's "19 m allowable under 600.60.40" | the online 600.60 page and the full text of By-law 654-2025 (PDF, read on this machine) | 600.60.40 has three parts: (1) building types and the `u` override, (2) the 10.5 m height conditions, (3) conversions. **No depth or length provision anywhere in By-law 654-2025.** The overlay is the TEYCC area as of June 26, 2025 plus the Steeles / Neilson–Rouge / 401 / Midland lands; sixplexes must be detached houseplexes with at least one unit above another | verified; decision 17 adopted; T3 asks Andrew to re-read the sheet once |
| Sixplex Wide bedroom split | the plan set PDF on this machine (sheet A010 code matrix and A011 unit table, text extracted) | basement 2 + 1, ground 1 + 1, the two two-storey homes 1 + 2 = **3** and 1 + 3 = **4**; "TOTAL BEDROOMS 12"; building area 137.6 m², GFA 508.2 m², levels 135.9 / 133.5 / 133.5 / 113.2 m², 8,100 mm width, 17,000 mm length, 1,200 mm side yards, 1,400 mm main wall stepback, 10.0 m proposed and 10.5 m allowable | verified |
| Gemini model ids and free-tier limits | the Gemini models and rate-limits pages | current stable ids include `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-4-argon`; `gemini-2.5-flash` still listed; `gemini-2.0-flash` and `gemini-3-pro-preview` shut down. The rate-limits page no longer prints free-tier numbers ("view your active rate limits in AI Studio"); preview models are more restricted | model verified; limits not verified (T2) |
| Gemini structured output API shape | the structured-output docs page | `client.interactions.create(model=..., input=..., response_format={"type": "text", "mime_type": "application/json", "schema": ...})` and `Model.model_validate_json(interaction.output_text)`; "not all JSON Schema features are supported"; large or deeply nested schemas may be rejected | verified |
| Hack the Valley 11 rules (prize count, prepared work) | web search | nothing found for HTV 11; an MLH listing describes Hack the Valley as a 36-hour UTSC hackathon in its 11th iteration | not verified (T1) |
| Pitch facts: the variance figure, construction costs, the housing target and the 48.9% figure | not checked (City PDFs not read) | as the prompt left them | not verified (T13) |
| The `GEO_ID` to `ADDRESS_POINT_ID` join | not checkable without the data | assumption 3 | not verified (T5) |
| Street Tree Data field names | not checked | — | not verified (T15) |
| The mockup video and ward image | this machine | not found in the project folder, Downloads, Desktop, Documents, Pictures or Videos | not found (T14) |

---

## Appendix I. Report for Andrew: decisions made while you were away, and the questions this spec would have asked

You asked for every decision to be made rather than asked. Here is each one, why, and what to do if you disagree. Nothing in the project folder was created except `MASTERSPEC.md`; no repo was initialized, no files from the appendices were written to disk, and nothing was pushed anywhere.

**Decisions (the ★ items in section 1)**

1. **Ward 04, Parkdale–High Park, as the dev and demo ward.** Reason: it is in the sixplex overlay (all four designs apply), it mixes wide Swansea and High Park lots with narrow Bloor West, Junction and Roncesvalles lots (so fits, borderline and no-fit all show up), and it has many semis (so the attached-house finding shows). Ward 19 (Beaches–East York) was the runner-up: more detached bungalows on 25-foot lots, so even more "too close to call". Switch by changing `--ward` and the demo cache; nothing else depends on it. If citywide is cut, the fallback set is 04, 19 and the ward that contains the venue so a local judge's address works.
2. **Gemini `gemini-3.8-flash` by default.** Superseded on 2026-10-17: Simone read the free-tier limits in AI Studio (20 requests a day for `gemini-3.8-flash`, 500 for `gemini-3.5-flash-lite`) and the default became `gemini-3.5-flash-lite`, with `gemini-3.8-flash` kept for the one-off demo pre-generation and `gemini-2.5-flash` dropped. The original reasoning was that the models page lists `gemini-3.8-flash` as the current stable Flash model; the quota settled it.
3. **Eight translation languages** (en, fr, zh-Hans, zh-Hant, es, tl, ta, pt), chosen as languages widely spoken in Toronto without quoting any statistic. Simone owns the list; changing it is one line in `/ai/config.py`.
4. **Placeholders for every number in AI output.** The prompt asked for a validator that rejects invented numbers; making the model write `{{keys}}` instead of digits makes the validator simple and exact, makes "every number links to its source" a rendering step rather than a parsing problem, and makes translation safe (the placeholders must survive). The cost is a slightly stiffer prompt.
5. **The three candidate questions are fixed copy, not generated.** The prompt says "the same questions for everyone"; generating them per ward would make them differ and would risk an opinion slipping in.
6. **Identifiers:** `ADDRESS_POINT_ID`, `PARCELID`, the massing feature index, `AREA_SHORT_CODE`. These are the only unique keys the verified schemas offer.
7. **Sixplex Narrow and the 19 m rule.** By-law 654-2025 has no depth or length provision, so the only 19 m allowance that exists is 10.20.40.20(3) for deep lots. The engine applies that. It means the Sixplex Narrow will "fit" rarely, which is a finding to say out loud, not hide. T3 asks you to glance at the sheet's zoning matrix once in case it cites a provision this spec did not see.
8. **RT has no length rule for a houseplex; RM's 17 m is applied to houseplexes conservatively.** Both from the chapter text; both affect only the Sixplex Narrow outside RD/RS.
9. **Ports, Python 3.12/3.13, one root virtualenv, GeoPackage (not DuckDB) for the processed file.** One dependency set for four people; GeoPandas plus pyogrio reads a GPKG with a spatial index fast enough, and nobody has to learn a second query engine during a hackathon.
10. **The AI service reads ward data from the API over HTTP** rather than from files, with a fixtures fallback. It keeps `/ai` independent of pipeline paths and lets Simone demo the briefing page alone.
11. **The processed permits keep permit numbers only in the internal parquet.** The public GeoJSON has no permit number, since a permit number can be looked up to an address on the City's portal, and the product promise is "never addresses".
12. **Hour estimates** total about 26.5 (Andrew), 22.5 (Yuvi), 27 (Jayden) and 27 (Simone). Jayden's and Simone's are the fullest; J10 (polish) and S13 (blog post) are the first to drop, and the cut list in section 10 protects the core.

**Questions this spec would have asked, and the answer chosen**

| Question | Answer chosen | Change it by |
|---|---|---|
| Should the masterspec also scaffold the repo (create `/contracts`, `CLAUDE.md`, `.gitignore`)? | No; the deliverable was the spec. Appendices A to E are copy-ready, so A1 and A2 are about an hour. | ask for the scaffold as a follow-up |
| Where should the mockups live? | `/docs/mockups/`; they were not on this machine | put them there at Hour 0 (T14) |
| Which ward if citywide is cut? | 04, 19, and the venue's ward | section 10 cut list |
| Is `/explain` called per design or once per lot? | per design, on tab change, cached | section 7.2 |
| Should the briefing page be a Vite app or plain HTML? | plain HTML, CSS and JS: no build step, nothing to break at Hour 30 | section 7.7 |
| Should "permits near you" count all kinds or only multiplexes? | only the `multiplex` kind since May 2023, matching the map dots | section 4.3 and 5.1 |
| What if the Address Points `GEO_ID` join fails? | street-number and street-name fallback, rate reported | section 4.3 step 6 |
| Should the web app draw the trend chart with a library? | no, a 60-line SVG component; the briefing page uses Chart.js because it has no build step | sections 6.8 and 7.7 |

**First five things to do when you are back**

1. Read section 1 and Appendix I (this), then skim 3.8 and Appendix A: those are the contracts everyone will build against, and they are the one thing that is expensive to change after Hour 2.
2. Put the mockup video and the ward image where Jayden can see them (`/docs/mockups/`).
3. Decide whether to accept the Ward 04 choice and the Sixplex Narrow decision (17), or change them before anyone starts.
4. Do A1 and A2 (repo and contracts), or ask for the scaffold to be generated from the appendices.
5. Send each teammate their section's kickoff prompt and the shared sections to read.

---

## Appendix J. Status log (every report, word for word)

Section 0 is rewritten on each update; this appendix keeps what it said before, so nothing is lost. Newest first. The entries below were section 0 from 2026-10-17 03:40 to 17:00.

### 2026-10-17, 23:41: the demo scripts set the web URL

- `scripts/demo.ps1` and `demo.sh` now set `SUPLEX_WEB_URL=http://127.0.0.1:4173`, the app's address under `vite preview`, so the links in the AI explanations and briefings open the demo app instead of the dev port (8fe1c36). The AI cache on the demo laptop already held entries for that setting: 20 of 20 demo requests still hit with Gemini off. The demo laptop's folder is pulled up to date.

### 2026-10-17, 23:31: the AI cache is on the demo laptop

- Merged between 23:21 and 23:25 (from Andrew's account): Simone's PR #29 (the explain key without `generated_at` and `cached`, browser-style numbers, the [LOCKED] numbers, `ui.sample_data`), the 3D lighting pass PR #31, Jayden's PR #32 (near your lot in `WardStage`) and Simone's PR #33 (the explain key without `next_steps`).
- Simone's re-keyed cache (`suplex_ai_cache_2026-10-17.zip`, 205 entries) hit all 20 demo requests with the default URLs, but the explain key includes the web and AI URLs and `scripts/demo.ps1` sets `SUPLEX_AI_URL=http://127.0.0.1:8001`, so under the demo script all 12 explanations missed. The cached values hold `{{placeholder}}` text, not URLs, so 25 copies under the demo's keys (captured by running the AI service's own code) fix it with no Gemini calls. Installed in `ai/cache/` (230 entries): 20 of 20 hit with the defaults, with `demo.ps1` as it is, and with `SUPLEX_WEB_URL=http://127.0.0.1:4173` added.
- Left for Andrew: `demo.ps1` never sets `SUPLEX_WEB_URL`, so the explanations' checklist links point at the dev port (5173) while the demo serves the app on 4173.

### 2026-10-17, 23:21: Simone's 3.8 pass is done; the explain key leaves out next steps

- Simone ran the one `gemini-3.8-flash` pass (20 requests, 0 rejections) on `suplex_lock_2026-10-17.zip`, the 22:34 upload: the "b" zip with the 22:58 demo cache was made in `data/out/` but never uploaded. Her cache is `suplex_ai_cache_2026-10-17.zip` on the release.
- Checked on the demo laptop: the three check files now differ from hers only in `meta.generated_at` and `next_steps` (PR #24's wording), so her explanations would miss. With `next_steps` also left out of the key, old and new checks hash the same. `ward.04.json` is byte-identical and the trend is not in the briefing key, so all eight Ward 04 briefings match.
- Plan: rather than restoring the old checks (which would bring back the pre-S14 next-steps wording), PR #29's explain key also leaves out `next_steps`, which the AI ignores anyway; Simone re-keys her cache without new Gemini calls and re-uploads it; Andrew merges #29 and unzips the cache into the demo laptop's `ai/cache/`.

### 2026-10-17, 23:09: permit lists allowed (decision 20); PR 28 checked in the browser

- Andrew allowed lists of issued multiplex permits as an exception to "no list of lots": street name only, never a house number, no export or download; lots that may fit are never listed. Recorded as decision 20 and in CLAUDE.md.
- Yuvi's PR #28 (the permitted-multiplexes data, map, near-an-address panel and "Search for Suplex"; 36 files, +4,862) on a merged production build in the browser: the landing button opens the search page; the list (1,553 permits, 4,619 units), street search, filters and sort work; the main address check still works; no console errors. Tests, build and lint pass on the merged tree.
- Not merged yet: at laptop size the map stays blank on first load until you zoom (Yuvi's fix), and its one `App.tsx` line needs Jayden's OK. Still open from the review: about a hundred strings in `WardMap/multiplex/*Copy.ts` belong in `contracts/copy`, the multiplex data has no contract type, and its near-an-address count measures from the address point, so it can differ by a permit or two from the engine's.

### 2026-10-17, 23:10: the demo cache after PR 24; the PR 22 review fixes (PR 30)

- PR #24 changed next-steps wording that every cached check carries, so the cache step was re-run at 22:58 (`scripts\hour24.ps1 -From 3`, 15 s, on 188e92c): the three checks keep their results (326 Quebec Ave fits all four, 281 Armadale Ave Fourplex Narrow borderline, 155 Vine Ave attached), now with the Property Information Report and the By-law 845-2025 opener; `api/cache/` and `data/out/demo-cache/` are identical (40 files). The headline numbers don't change.
- That makes the 22:32 cache in `suplex_lock_2026-10-17.zip` (on the release since 22:33) stale for Simone's pass: the explain key hashes the whole check except `context`, `next_steps` included, so explanations made on it would miss on the demo laptop. `data/out/suplex_lock_2026-10-17b.zip` (43 files, 846,647 bytes: the 22:58 demo cache, `ward_summary.json`, `batch_report.md`, `data_dates.json`) replaces it; Andrew uploads it. If Simone already ran the pass on the 22:32 zip, the demo laptop takes those three check files back instead (the ward briefing keys are unaffected either way).
- Also built: `data/out/suplex_batch_locked_2026-10-17.zip` (28 files, 16,243,540 bytes: `ward_summary.json`, `batch_report.md`, `data_dates.json`, `wards/*.geojson`) and `suplex_demo_cache_2026-10-17.zip` (the 40 files alone, for Jayden).
- The refresh itself, for the record: all pipeline checks passed (`data/out/checks_20261017_2210.txt`); 7,407 permit rows, 446 multiplex against the City's 452; Tiger Data reloaded with 7,352 rows; all 495,456 lots and every may-fit count came out identical, so only the permit counts moved (city 1,444 to 1,447; wards 02, 04 (+2), 11 and 20 up, 25 down 2). `pipeline/tiger/tiger_stats.json` is rewritten by the load and left uncommitted for Yuvi.
- PR #22 review (two review agents plus a check of each finding): the garden appeared behind designs that don't fit or are too close to call (281 Armadale Ave), which reads as built, with fences crossing the building on width or depth failures; neighbour sheds were never merged and were walked every frame; glass, trim and doors cast shadows; the lawn clones were never disposed. Fixed in PR #30 (`andrew-3d-garden`, build and lint clean), waiting for Andrew's merge. Not changed: the per-window boxes (smooth on the demo laptop) and about 86 decorative colour literals, kept as named constants like the merged A15 work rather than as shared tokens.
- PR #25 review: `useNearYourLot` never compares the check's ward with the shown ward; Jayden's call site guards it, and Yuvi's follow-up adds the same guard inside the hook.
- TODO: T3, T6 and T11 marked done (their remaining parts landed as A3, contracts v0.1.6 and v0.1.2).

### 2026-10-17, 22:55: PRs 24 and 25 merged; the 3D street is in

- Yuvi's PR #24 (Simone's S14 review applied to next steps) and PR #25 (near your lot, Y15) merged at 22:53 as 4bfc577 and e823077, each pinned to its reviewed head. The 3D street, PR #22, was merged at 22:47 (26ff07a; 21 files, all in `Lot3D/`).
- Checked on the real `main` after all three: 38 fixtures validate, 444 tests pass, the web builds and lints clean.
- Still to do for near your lot: Jayden's four lines in `WardStage` (the box shows in the app only after them) and Yuvi's follow-up dropping the six fallback strings from `WardMap/copy.ts`.

### 2026-10-17, 22:42: Yuvi's PRs 24 and 25 reviewed

- PR #24 applies Simone's S14 review to Yuvi's next-steps files: six rewordings that say what the City's rule says instead of telling the reader what to do, three missing source quotes, a new `intro` shown by `NextSteps.tsx`, the longer footer (it keeps the screening line) and the Property Information Report on `zoning_check`.
- PR #25 is Y15, near your lot, all inside `WardMap/`: an optional `check` on `WardMap`, the dashed circle and the panel box (dashed border, not colour alone), the maths in a pure `nearYourLot.ts`. Around 326 Quebec Ave N is 370 lots (368 with exact EPSG:2952 distances; the spec's "about 358" was measured from the address point and is corrected) and M is the engine's 7. Its six fallback strings are dead now that PR #23 is on `main`, and go in a follow-up.
- Both merge cleanly with `main` (after Jayden's PR #26) and pass together: 38 fixtures, 444 tests, build and lint clean. Jayden's `WardStage` builds the ward view from the map's pieces, so the box shows in the app only after he passes `nearRing` and `near` there.

### 2026-10-17, 22:36: the lock is done; Jayden's J4, J6, J9 merged

- The Hour-24 lock finished at 22:33: the batch's 78 sanity checks all pass (495,456 lots, 1,323 s, permits from Tiger Data). City: 191,174 lots may fit (45.4% of house lots, an upper bound) against 1,447 multiplex permits since May 2023 (1,444 before the refresh). Ward 04: 3,992 (22.0%) against 83 (81 before). 326 Quebec Ave fits all four designs, 281 Armadale Ave is too close to call for the Fourplex Narrow, 155 Vine Ave is a row house; the cached checks carry the 15-item "What we don't check" list.
- `headline-locked` pushed on 9037f44 (the code the lock ran on; nothing that affects results changed after). `suplex_lock_2026-10-17.zip` (877 KB: the 40-file demo cache, `ward_summary.json`, `batch_report.md`, `data_dates.json`) is on the `data-2026-10-17` release for Simone's pass.
- Jayden's branch (J4 the result panel, J6 the transition, J9 demo mode; 33 files, all his part of `/web`) went in as PR #26 at 22:35, opened by Andrew. On a test merge: 38 fixtures validate, 444 tests pass, the web builds and lints clean; checklist rows pair the icon with text, and the screening and massing lines show. Two follow-ups: the sample-data banner string still sits in `web/src/copy.ts`, and `WardStage` (his) builds the ward view from Yuvi's map parts, so Yuvi's near-your-lot PR (#25) needs the check passed there.

### 2026-10-17, 22:24: Simone's 3.8 pass needs the locked files

- Simone asked for the `headline-locked` tag and the locked data before her `gemini-3.8-flash` pass, since her cache keys depend on the exact /ward and /check responses; or to run the pass against the demo laptop's API.
- Checked in `ai/explain.py`: the explain key hashes the whole check except `context`, so `meta.generated_at` (new on every live request) and `meta.cached` are in it. A pass against any live API, hers or the demo laptop's, would never hit on stage. The ward briefing key is stable: the ward entry's `generated_at` is the batch's.
- Plan: Simone's small PR leaves those two fields out of the key; after the lock (batch running at 22:21), Andrew pushes the tag and puts the lock's demo cache, `ward_summary.json`, `batch_report.md` and `data_dates.json` on the data release; she runs the pass on that cache with `SUPLEX_DEMO_CACHE=1` and the default URLs, and sends back `ai/cache/`. The 580 MB GeoPackage doesn't need to move, and the demo laptop's API doesn't need opening to the network.

### 2026-10-17, 22:16: PR 23 merged

- PR #23 (S15, Simone's six near-your-lot strings) merged at 22:16 (e19187c), pinned to the reviewed head 955ce8f. Since the test merge, `main` had only changed `MASTERSPEC.md`, so its checks stand: 38 fixtures validate, 444 tests pass, the web builds and lints clean.
- Yuvi's Y15 has its strings. Simone's follow-up, the briefing page's `--trend-bar` on the shared `--suplex-permit-bar` token, can go ahead.

### 2026-10-17, 22:15: Simone's S15 (PR 23) reviewed

- S15 is PR #23: one commit, only `contracts/copy/labels.json`, the six near-your-lot strings (`near_heading`, `near_could` and `_one`, `near_did` and `_one`, `near_ring_label`) word for word as in 8.5. On a test merge with `main`: 38 fixtures validate, 444 tests pass, the web builds and lints clean. It unblocks Yuvi's Y15. Waiting for Andrew's OK to merge.
- Simone has merged `main` into her branch, so her 3.8 explanations will be keyed on the merged "What we don't check" list. After the lock she pulls the locked data and compares it, runs the 3.8 pass (20 requests in stage order), fills every [LOCKED] number, updates the deck, takes real screenshots and re-reads the French Ward 04 briefing.
- Her follow-up after #23: the briefing page's `--trend-bar` reads the shared `--suplex-permit-bar` token instead of its own `#A27100`.

### 2026-10-17, 22:05: PR 17 merged; palette in the tokens; demo and check scripts; the lock running

- PR #17 (Simone: S8 on real data, S9 back on Ward 04, the S14 review, `pregenerate --addresses-only`, the French glossary forbidding "unifamilial(e)", and `not_checked.json` naming water, hydro and topography) reviewed in a scratch checkout and merged at 21:54 (998ff8a) with the `not_checked` list in `check.{fits,borderline,no_fit,not_checked}.json` and `explain.request.json`. On the merge: validate 38 ok, `pytest engine api ai/tests` 444 passed (her two new tests included), the web builds. Review notes, none blocking: `--ward` is still required with `--addresses-only` (harmless); `not_checked.json` was reflowed to one key per line.
- The Hour-24 lock started at 21:55 (`scripts\hour24.ps1 -Workers 10`) after a clean dry run (TIGER_DSN set, Tiger Data reachable with 7,342 permits; 3 of 11 City datasets changed upstream: active and cleared permits, property boundaries). The refresh's lot build runs about 45 s a ward, so the lock should finish about 22:40.
- The final Lime and Teal palette moved into `contracts/design-tokens.css` value for value (25 tokens, checked), with the new `--suplex-permit-bar` (`#A27100`); the locked map colours, the borderline and fail colours, the new homes and the type tokens are unchanged (contracts v0.1.10, 617cffc). `web/src/styles/palette.css` stays (Jayden's) and now repeats the same values.
- A13: `scripts/demo.ps1` and `scripts/demo.sh` build the web with `VITE_API_BASE=/api` (without it the app serves the fixtures), start the API on 127.0.0.1:8000 (`SUPLEX_DATA_DIR=data/out`, the locked `suplex.gpkg`, `-DemoCache` / `--demo-cache` for `SUPLEX_DEMO_CACHE=1`), the AI service on 8001 and `vite preview` on 4173, wait for each to answer, print the URLs and stop all three on Ctrl+C or when any one stops. A12: `scripts/check.sh` runs validate, `pytest engine api ai/tests`, an API start with `/health`, and `npm run build`. All three were run live: every step passes, and `/api/check` and `/ai/health` answer through the preview proxy (a1978bb).

### 2026-10-17, 21:54: near your lot added; PR 17 goes first

- Andrew added "Near your lot" to the ward map (decision 19): the could-versus-did gap within 500 m of the searched lot, as two counts and a circle, with no list and no addresses. Yuvi builds it (Y15, 1.5 h, prompt in 8.5) after Simone's strings (S15); Jayden passes the check to `WardMap`. A rental search was dropped: there is no open data for it. On tonight's data, 326 Quebec Ave shows about 358 lots and 7 permits.
- Simone flagged the order: PR #17 carries the new "What we don't check" list, which the engine copies into every check, and her cached explanations are keyed on the check. So PR #17 and the fixture update merge first (a separate session is doing it now), then the Hour-24 lock, then her one `gemini-3.8-flash` pass.

### 2026-10-17, 20:28: PR 21 merged

- PR #21 (head 26f3776, nine files, all in `web/src/components/Lot3D/`): fixes from the 3D session's final review that missed the #19 merge by minutes. The quality step-down now goes through the Canvas `dpr` prop and holds; ambient occlusion is switched off inside the composer and the sun keeps casting at zero shadow strength, so a step-down never recompiles shaders; the engine's slices are drawn only when the label names lot width or depth, else the named rule's slab; maximum rules (length, height, coverage, homes) label the engine's signed margin with `labels.ui.column_margin`, and lot width and depth keep "Needs · This lot"; touching walkout pits share open edges; the frontage road stops where its centreline meets a building (12 to 120 m). The debug hook `window.__suplex3d` mounts in dev only.
- The branch already held `main`, so the merge result is the tested commit: the web builds and lints clean, 38 fixtures validate, 442 tests pass. Merged at 20:28 (1ea9070), pinned to the reviewed head.
- Deferred (minor): an opening that crosses a floor datum shows a thin strip of wall at the cut (six side doors on the two wide designs).

### 2026-10-17, 20:10: PR 19 merged; Simone's S14 hand-off

- T23 checked in the app's browser on this laptop, with the merged scene served from a scratch copy: 104 fps with a 1920×1080 canvas at ×1.25 once the sequence rests, 82 to 144 fps through it from the click, the pixel ratio never dropped; the borderline label reads "Too close to call · Lot width · Needs 7.6 m · This lot 7.62 m" over "By-law section 10.20.40.70(3)".
- PR #19 merged at 20:06 (197edf8), pinned to the reviewed head 2be3716. `main` builds and lints clean, 38 fixtures validate, 442 tests pass; `npm install` on the demo laptop added the three new packages without touching the lockfile. Contracts changelog v0.1.9 (d8583aa) logs the `designs.json` levels (v0.1.7 and v0.1.8 were already taken).
- Simone: S14 done in `docs/next-steps-review.md` (PR #17) with the exact JSON for Yuvi, who applies it in his own PR. Her `not_checked.json` change waits to be pushed: `engine/tests/test_fit.py` pins the engine's list to the four check fixtures, so Andrew updates those and `explain.request.json` in the same merge.

### 2026-10-17, 20:00: PR 20 merged

- PR #20 (A11's cache writer and the Hour-24 scripts) was merged at 19:57 from Andrew's GitHub account, as a merge commit (186c28c) whose PR head is the reviewed commit cf1b82e; the main folder pulled it at 19:58.
- `main` after the merge: 38 fixtures validate, 442 tests pass. The lock is now one command from the repo root: `powershell -ExecutionPolicy Bypass -File scripts\hour24.ps1 -DryRun`, then `-Workers 10`.
- PR #19 (the 3D scene) stays open until Andrew's own 50 fps check on the demo laptop (T23).

### 2026-10-17, 19:56: PRs 19 and 20 reviewed

- PR #20 (A11, head cf1b82e, only `api/` and `scripts/`): `python -m api.cache_demo` writes the Ward 04 demo (33 searches, the three checks, the ward, its trend, its lots, the permits) only after every answer is a 200 that matches its contract, else nothing; 10 tests write only to temporary folders. `scripts/hour24.ps1` and `.sh` run the refresh, the batch and the cache, stop at the first failure, resume with `-From N`, load `.env` without printing it, and quote the repo path. Known: a lot clicked on the ward map is not cached; cache-only mode still logs a harmless GeoPackage error at start.
- PR #19 (the 3D scene, head 2be3716): fail slabs drawn from the engine's slices, rules and margins, coloured from the design tokens, hatched and labelled from `contracts/copy`; the four designs as drawn; the realism pass, with no downloads and the dev switches dev-only. Outside `Lot3D/`: two packages in Jayden's `web/package.json`, and `designs.json` `levels[]`, now summing to the 10.0 m `height_m` the engine checks (it said 11.0); no result changes.
- One test merge of both with `main`: 38 fixtures validate, 442 tests pass, the web builds and lints clean; ruff is clean on `api/` (22 older findings in the engine tests, unchanged). Simone's PR #17 was updated at 19:50 and does not overlap either.

### 2026-10-17, 19:35: S14 goes through Yuvi

- S14 can start now that PR #18 is on `main`. `contracts/copy/next_steps.json` is Yuvi's file (CLAUDE.md: each file has one owner), so Simone sends him her review changes, including her draft's intro and footer lines and the Property Information Report link, and he applies them. Her `not_checked.json` additions go in her own file.
- Corrects the message to Simone sent with the PR #18 review, which asked her to edit Yuvi's file directly.

### 2026-10-17, 19:30: next steps merged

- Yuvi's PR #18 merged after checking that the only change since review was `main` merged into his branch (his code identical, no spec edits of his own).
- Andrew's placeholder test in `engine/tests/test_fit.py` now checks the real steps; `pytest engine api ai/tests` gives 432 passed, `contracts/validate.py` 38 ok.
- Next: Simone's S14 review of the copy (folding in her draft); Jayden mounts `NextSteps` in the result panel.

### 2026-10-17, 19:19: next steps ready, Simone's next-steps draft

- Yuvi's PR #18 (next steps Y11 to Y14, the ward map on Simone's strings and chart) was reviewed: clean, with one expected failure in Andrew's placeholder test.
- Simone sent a separate "What happens next" draft. Recommended: fold it into Yuvi's copy during S14 instead of a second section; keep her intro, footer, the Property Information Report link and the `not_checked.json` additions; drop the AI Pre-Check link (two units or fewer).

### 2026-10-17, 19:11: the batch outputs are shared

- `suplex_batch_2026-10-17.zip` (16,243,073 bytes: `ward_summary.json`, `batch_report.md`, `wards/01..25.geojson`) is on the `data-2026-10-17` release; Simone's S8 and pre-generation pass can start.
- The A9-A10 session has ended; A11's cache writer and an Hour-24 runbook are being built in a new session on its own branch. The 3D session is still working.

### 2026-10-17, 19:05: the demo goes back to Ward 04

- Andrew reversed the 18:41 switch to Ward 20: Ward 04 shows all four designs, its permit count matches the City's (42 and 42) and holds the hand-checked lots.
- Demo addresses, checked on the citywide batch: 326 Quebec Ave (all four fit), 281 Armadale Ave (the Fourplex Narrow too close to call), 155 Vine Ave (a row house).
- Simone's PR #17 (Ward 20 across the pitch) is not merged; she revises it to Ward 04. Updated: decision 18, decision 11, 0.3, 7.7, 7.9, 8.4, T12, T25.

### 2026-10-17, 19:00: Simone's S9 report, Ward 20 recorded across the spec

- Simone (PR #17, clean, `pitch/` and `docs/` only): S9 on real data; 73 Manderley Dr proposed as the "fits" opener beside Andrew's picks (88 Manderley Dr, 37 Wanstead Ave); 12 of 12 explanations clean on real data; Ward 20 across the demo file, script, deck, Devpost, Q&A, rehearsal log and README draft; a facts warning that Ward 20's permit count differs from the City's (16 against our 23).
- Her two flags, fixed here: 0.3 step 3 said Ward 04 for the demo cache (now Ward 20), and the one `gemini-3.8-flash` pass cannot cover everything (about 28 requests against 20 a day), so it runs about 18 in stage order (7.9).
- Recorded: decision 18 (demo ward 20), decision 11 amended, the S9 note in 8.4, `--ward 20` in 7.7, T25 (confirm the opener, share the batch zip).

### 2026-10-17, 19:05: Andrew's main session: A14 done, backup addresses chosen, T24 settled

- **A14 done** (Andrew confirmed next steps in his main session). `CheckResponse.next_steps: NextStep[]` is in `check.response.schema.json` (required), `types.ts` and the four `check.*.json` fixtures, which carry their 5.10 lists (wording drafted from the 5.10 table; live text comes from Yuvi's `contracts/copy/next_steps.json`; the fees step says up to six units under By-law 845-2025, T21). `explain.request.schema.json` accepts the field without requiring it, so `/explain` keeps working when the web forwards the whole check. `run_check` ends with `build_next_steps(result, copy)`; `engine/suplex_engine/next_steps.py` is a stub returning [] that Yuvi replaces in Y13 (his file from here on), and `copy.next_steps_copy()` returns {} until his copy file exists. `pytest engine` 175, `pytest api` 73, `pytest ai/tests` 118, `validate.py` 37 ok, `npm run build` passes. Yuvi can start Y12 to Y14 from `main`.
- **T12: backup addresses 88 Manderley Dr and 37 Wanstead Ave; demo ward 20** (Andrew's pick). 88 Manderley Dr is too close to call for both fourplexes, 37 Wanstead Ave is a semi or row lot; neither is a clean "fits" (73 to 83 Manderley Dr are, if the demo needs one). Details in the T12 row.
- **T24: the context radius stays 150 m** (Andrew).
- **Batch outputs packed for sharing:** `data/out/suplex_batch_2026-10-17.zip` (16 MB); Andrew uploads it to the data release; teammates unzip it into `data/out/`.

### 2026-10-17, 18:45: Andrew's main session: A9, A10 and T20 pushed

- **A9 done.** `SUPLEX_DEMO_CACHE=1` serves `api/cache/` whenever a file answers the request (`api/demo_cache.py`; the file names are the web's `public/demo-cache/` names, so one writer fills both) and lets the API start with no data at all (`/health` says `demo_cache_only`; anything uncached is 503 `data_unavailable`). Unexpected errors are JSON 500s that keep the CORS headers. The review minors are fixed: permits with a null date, malformed optional files, a GeoPackage layer not in EPSG:2952, and a test that buildings, trees and permits reach the engine. On the citywide file: 5.5 s load, 2.4 GB peak, `/check` at most 43 ms over 100 addresses in all 25 wards, `/ward/{id}` valid for all 25, `/ward/04/trend` from Tiger Data in 0.36 s and from the cache when Tiger is down.
- **A10 done.** `python -m suplex_engine.batch --ward 04 | --all` (3.4 "As built"). Citywide at 18:19: 495,456 lots, 0 engine errors, 1,290 s on 10 workers, 78 of 78 sanity checks (schema, all 25 wards, every count sums to its lots, one valid feature per lot, every ward file under 1.1 MB gzipped against the 8 MB limit, the 19 hand-checked lots unchanged). Permit counts from Tiger Data, equal to `permit_counts.json` in every ward. 300 random lots: the map file and `/check?lot_id=` agree on all 300. Before the batch the engine was made about three times faster (copy files cached, cross-sections shared across designs, a cheaper centroid frame), checked byte-identical on 600 random Ward 04 checks. The engine is now installed editable (`-e ./engine` in `requirements.txt`): teammates re-run `pip install -r requirements.txt`.
- **T20 done, before the citywide run.** When both side lot lines lean the same way by 2° or more (`placement.align_to_sides_deg`, a new key in `engine_config.json`, its schema and `types.ts`), the lot depth is measured along them and each design turns to follow them, with its width square to the sides (5.2 step 3, 5.5). A pie lot tapers rather than leans and is unchanged (4 Olympus Ave). Ward 04: 1,411 design results better, 90 worse; may fit 3,611 → 3,992. ENGINE_VERSION 0.2.0.
- **Preliminary numbers, not for the Devpost until the Hour-24 lock:** city 191,174 lots may fit (45.4% of house lots), 1,444 multiplex permits since May 2023, about 1 for every 132 lots that could; attached share 30.0%; the most common blocking rule is the detached-building rule (126,543 lots). Ward 04: 3,992 (22.0%), 81 permits, about 1 for every 49.
- **Held at Andrew's request until the next-steps decision is confirmed in this session:** A11 (the demo cache and the lock) and any change to `engine/suplex_engine/check.py` (A14's hook lives there). Known limit left in `check.py` for that reason: the lot-level `width_m` is still the street-parallel cross-section at 6 m, which overstates the width of a skewed lot.
- **Decisions made without asking:** the skew threshold (2°, where the old square placement stays within about 0.3 m of the side yards over a 17 m building); "both side lines lean the same way" as the test for a skew; a turned design's depth row = front setback + length + the clearance behind its rear wall, square to the street; the map file's feature id is the parcel id (needed for the click to `/check?lot_id=`, never shown); `flags` count every lot in a ward, `any_on_fitting_lots` only lots whose best design fits; the city permits add the 17 with no ward; `engine_config.json` keeps `version` 0.1.0 (the check fixtures pin it).

### 2026-10-17, 18:25: PR 16 merged, the batch ran clean

- Andrew had Simone's PR #16 (the last eight hard-coded strings) merged at 18:20, after checking it still matched the reviewed commit. No PRs are open.
- The citywide batch finished at 18:19 in Andrew's main session: 25 wards, 495,456 lots, 1,290 s, 78 of 78 sanity checks pass, permit counts from Tiger Data. The code and outputs are not on GitHub yet.

### 2026-10-17, 18:22: Simone's night report

- Simone: PR #13 merged (J7 `TrendChart.tsx`, the five pending web strings, the six-unit development charges in facts, Devpost and Q&A); PR #16 opened with the last eight hard-coded strings, reviewed and clean.
- Her asks: Andrew merges #16 and pushes A10; Yuvi switches the ward map to `labels.ward_map` and mounts `TrendChart`; Jayden switches the pending strings and shows the 3D Massing disclaimer. The `Plan/copy.ts` cleanup goes to Jayden, since the plan view is his UI after the merge (decision 17).
- The batch reached 24 of 25 ward files by 18:18.

### 2026-10-17, 18:18: the ward map is merged

- Andrew had Yuvi's PR #15 (J5, the ward map) merged at 18:17, after checking it still matched the reviewed commit.
- The citywide batch reached 22 of 25 ward files by 18:17.

### 2026-10-17, 18:15: the ward map is ready, the batch is running

- Yuvi's PR #15 (J5, the ward map) was reviewed: only `WardMap/`, merges cleanly onto `main`, builds and lints clean, follows the map rules in 6.5. Not merged yet.
- The citywide batch is running in Andrew's main session: 18 of 25 ward files written by 18:13.
- Yuvi asked whether to raise the `/check` context radius from 150 m to 500 m for his plan view (T24; recommended: keep 150 m).

### 2026-10-17, 18:10: PRs 12 and 13 merged

- Andrew had PRs #12 (Yuvi's 2D plan view, carrying Jayden's four commits) and #13 (Simone's `TrendChart.tsx` and pending strings) merged at 18:08; GitHub marks Jayden's #14 merged through #12.
- Andrew's 3D session was asked to commit, then merge `origin/main` into its branch, because #12 changed 11 files in `Lot3D/`.
- Simone pushed the six-unit development-charge wording to the pitch files (d64baa4).

### 2026-10-17, 18:05: Simone's evening report, PRs 12 to 14, development charges settled

- Simone: S8 part one on the 19 real lots (19 of 19 clean after a margin-as-depth fix), the plan-view strings, the 11-slide deck, the Devpost, the demo script with both sponsor walkthroughs, the Q&A, the README draft; PR #13 (J7 `TrendChart.tsx` and the web's five pending strings) is clean.
- Yuvi: PR #12, a 2D plan view tab that also carries Jayden's four unmerged commits; merged with #13 onto `main` in a test checkout it builds and lints clean. Jayden's PR #14 conflicts and is superseded by #12.
- T21: By-law 845-2025 (July 24, 2025) waives development charges and parkland cash-in-lieu for multiplexes of up to six units. The 18:00 board said "four, never six"; that was wrong and is corrected.
- Andrew's 3D session started at 18:00 on its own branch; his A9-A10 session continues on `main`.

### 2026-10-17, 18:00: approvals and merges

- Andrew approved "Your next steps" and the re-plan (Yuvi takes the ward map J5, Simone the trend chart J7); `CLAUDE.md` gained the ownership exceptions.
- PRs #8 (Simone) and #9 (Yuvi, Y7 closed) were merged after review: Simone's 118 tests and the 37 contract fixtures pass.
- Andrew took over the 3D scene from Jayden (J8, J10, and two new tasks: A16 the four designs from the elevation sheets, A15 a realism pass); Jayden keeps all UI that is not 3D.
- The 17:40 board counted 70.4 of 103 planned hours (68%) on the original task split; after the re-plan and the 3D handover it counts 72.4 of 115.5 (63%), including two hours for Andrew's unpushed A10 batch.

### Status as recorded up to 2026-10-17, 17:00

Read this before anything else. Repo: https://github.com/andrewl746/htv26 (branch `main`; all six PRs merged). The engine now runs on real City data: 19 hand-checked Ward 04 lots pin it (`docs/test-lots.md`), `pytest engine api` gives 199 passed and `contracts/validate.py` 37 ok. The citywide batch (A10) has not run yet, so no headline number exists; nothing is locked until Hour 24.

**Done and green on `main`**

| Task | State | How to verify |
|---|---|---|
| A1 repo scaffold | done: folders, `CLAUDE.md`, `.gitignore`, `.gitattributes`, `requirements.txt`, `.env.example`, `README.md` stub, `docs/decisions.md`, `contracts/README.md`; root `.venv` on Python 3.14 (the only interpreter on Andrew's machine; 3.12 to 3.14 all work) | `pip install -r requirements.txt` |
| A2 contracts and fixtures | done: 13 schemas, `types.ts`, `designs.json`, `engine_config.json` (plus `attached.on_lot_m2`, see decisions), `design-tokens.css` v0, `copy/*.json` v0, `tiger/schema.sql`, 15 fixtures, `validate.py` | `python contracts/validate.py` prints "35 ok, 0 failed" |
| A3 hour-0 checks | done in `docs/decisions.md` (19 m rule, `AVG_HEIGHT`, Ward 04, Python 3.14); the Sixplex Narrow sheet itself was not re-read (T3 still open) | read `docs/decisions.md` |
| A4 lot geometry | done: `engine/suplex_engine/geometry.py` and `config.py`, 22 tests | `pytest engine/tests/test_geometry.py` |
| A5 rules, config, designs | done: `rules.py` (every value with its by-law section), `designs.py`, 45 tests | `pytest engine/tests/test_rules.py` |
| A6 classification, attached, fit, placement | done: `classify.py`, `attached.py`, `fit.py`, `models.py`, `copy.py`, `check.py` with `run_check(LotInput, cfg, designs, data_dates) -> CheckResult` (`.to_dict()` is the `CheckResponse`); the four `check.*.json` fixtures are reproduced; 38 tests | `pytest engine` prints 153 passed (2026-10-17 afternoon count, with A8) |
| A7 API v1 (plus the `/ward`, `/trend` and `/health` parts of A9) | done 2026-10-17 afternoon: `api/__init__.py`, `api/store.py` (GeoPackage layers with STRtree indexes, single-part MultiPolygons unwrapped, `LotInput` built as `pipeline/smoke_engine.py` does), `api/main.py` (`/health`, `/designs`, `/search`, `/check` by `address_id`, `lot_id` or `lon`+`lat`, `/ward/{id}`, `/ward/{id}/trend` with the 2 s Tiger budget then `trend_cache`, `/static/permits.geojson`, `/static/wards/{id}.geojson`, JSON errors, CORS for localhost, gzip), 44 tests that skip without the data. Measured: `/check` 22 to 43 ms warm, Ward 04 load 0.3 s, citywide load 3.9 s and 2.3 GB; every `validate.py --url` check passes; `/ward/04/trend` says `cache` with `TIGER_DSN` unset; `/ward/{id}` answers 503 `ward_summary_unavailable` until A10 writes `ward_summary.json`. New optional env: `SUPLEX_GPKG` (path override), `SUPLEX_CORS_ORIGINS`. The API converts the pipeline's `data_dates.json` keys and timestamps to the contract's `data_dates` (`api/store.py` `normalise_data_dates`); the batch needs the same, or the pipeline writes contract keys (Yuvi) | `SUPLEX_DATA_DIR=data/out uvicorn api.main:app --port 8000`, then `python contracts/validate.py --url "http://127.0.0.1:8000/check?address_id=7986858"` (326 Quebec Ave); `pytest api` |
| A8 hand-checked test lots | done 2026-10-17 afternoon: 19 real Ward 04 parcels in `engine/tests/test_lots.py` (loader `engine/tests/real_lots.py`, skips without `data/out/suplex.gpkg`), each measured without the engine and agreeing within 0.05 m on every regular lot; `docs/test-lots.md` lists them with the threshold tables. Thresholds in `engine_config.json`: `attached.cross_lot_m2` 4 → 20, `attached.tolerance_m` 0.3 → 0.05, `larger_building.avg_height_m` 12 → 16 (footprint 350 m² unchanged, now on the clipped footprint). Two engine fixes came out of it: rear lanes are never the frontage (5.2 step 1) and a design wider than the lot reports the lot's depth (5.5). Ward 04 attached share: 60.6% under the old numbers, **41.6%** now (the fixture guessed 35.8%) | `pytest engine/tests/test_lots.py`; `docs/test-lots.md` |
| Web scaffold (start of J1) | done by Andrew: Vite + React 19 + TypeScript in `/web`, `@contracts/types` alias, dev proxy to :8000 and :8001, three / fiber / drei / maplibre / zustand installed; `App.tsx` renders only a heading (TODO: disclaimer from `contracts/copy/disclaimers.json`) | `cd web && npm install && npm run build` |
| J1, J2, J3 (Jayden) | done on fixtures: the 3D test scene from `check.fits.json`, the address search, and the 3D sequence v1; branch `jayden`, PR #6, merged into `main` by Jayden on 2026-10-17 (web files only, so no conflict with the engine work) | `cd web && npm run dev` |
| Landing hero and fly-in (Jayden, PR #7, merged as c3f63f1; web only; `npm run build` passes) | a MapLibre hero map of Toronto on the landing page that flies down into the 3D sequence (the pin-drop and swoop beat of 6.3), with a smooth handoff (no shader stalls, steadier tiles); `context.buildings[]` keyed by array position (Andrew's note); the dev proxy on 127.0.0.1; the "Try:" chips read fixture addresses until S9 supplies the real backup addresses. **Palette:** Jayden's UI palette (Charcoal `#605B56`, Grey `#837A75`, Muted Olive `#ACC18A`, Tea Green `#DAFEB7`) lives in `web/src/styles/palette.css` as a web-only override of the UI tokens, with measured contrast (ink on Tea Green 12.8:1); the locked map colours and the 3D scene tokens are untouched, and the 3D lot keeps the warm off-white so a lime lot never reads as "fits". **Andrew:** move those values into `contracts/design-tokens.css` (6.10) so the briefing page matches, then Jayden deletes `palette.css`; Simone reviews | `cd web && npm run dev`, open the landing page |
**Simone, four reports on 2026-10-17 (branch `simone`, 17 commits, PR #3 merged into `main` as 8353357; touches only `ai/`, `docs/`, `pitch/` and `contracts/copy/`; `pytest ai/tests` gives 107 passed)**

| Task | State | How to verify |
|---|---|---|
| S1 Gemini key and limits | done; recorded in `docs/decisions.md` with the model split (section 7.1) | `docs/decisions.md` |
| S1 Sixplex Wide bedroom split | recorded (3 and 4 bedrooms in the two upper homes, 12 in total) | `docs/decisions.md` |
| S1 Hack the Valley 11 rules | **closed (T1):** one project may enter the School of Cities challenge and the MLH prizes; all work must happen during the event, which began 10 p.m. Eastern on 2026-10-16, and every commit is dated after that. **Do not rewrite or squash git history: the timestamps are the evidence.** Section 1 assumption 2 is withdrawn | `docs/decisions.md` |
| S2 story drafts | done: `pitch/hook.md`, `docs/devpost.md`, `pitch/qa.md` | `pitch/` |
| S3 `/explain` | done: FastAPI on 8001, `POST /explain`, `GET /health`, structured output, sha256 cache, template fallback; Gemini only ever sees placeholder names, never values | `curl` per 8.4 S3 |
| S4 validator | done test-first: every 7.4 case; reject, one retry, then template; every rejection logged for the Devpost count; Gemini mocked in tests | `pytest ai/tests` |
| S5 `/briefing` | done: ward numbers map, the three fixed questions, shared validation policy | `pytest ai/tests` |
| S6 briefing page | done: `/b/{ward_id}?lang=xx` with linked numbers, language picker, copy and print, a monthly chart, a methodology footer; works with Wi-Fi off; `&fixture=1` shows sample data behind a "made-up numbers" banner. Differences from 7.7: an inline SVG chart instead of Chart.js (no external request), bars in `#B47F00` because the permit gold is 1.5:1 on white | `localhost:8001/b/04?lang=en&fixture=1` |
| S7 translation and pre-generation | done: all eight languages revalidated per language with the English placeholders required; `pregenerate.py` paces to the model's rate limit and resumes; Ward 04 cached in all eight languages and served with Gemini off; about 25 of the day's 500 requests used. One allowance: translations may write the month of `permits_since` as a digit (Chinese writes "2023年5月"); English stays strict | `python -m ai.pregenerate --ward 04 --langs all` |
| T13 pitch facts | done: `pitch/facts.md` with page numbers; "216 variance applications" and "guidance is missing" cut; the 48.9% figure confirmed (13,928 starts in 2025 against a 28,500 annual target); costs become "declared value"; the Mayor is not named | `pitch/facts.md` |
| S10 drafts | done: full Devpost, demo script with both sponsor walkthroughs, 11-slide deck content, sourced Q&A, README draft; Hour-24 numbers marked [LOCKED] | `pitch/`, `docs/devpost.md` |
| S9 copy | first pass done: no "will be built" even negated, "since May 2023" everywhere, a singular line for one permit; backup-address sheet ready | `contracts/copy/*.json` |
| S11 | rehearsal log ready for the ten timed runs | `pitch/rehearsal-log.md` |
| S8, S9 addresses | waiting on A7 (API) and A10 (batch) | — |

**Simone asks of others:** Andrew: `.env.example` updated (done: `GEMINI_MODEL=gemini-3.5-flash-lite`, `SUPLEX_AI_URL`, `AI_LOG_DIR`); fix "1-6 units" in the two fixtures; decide the site-exception policy (T19); pick one percentage unit across fixtures (`pct` in the check rows, `%` in the briefing fixture). Jayden: `/explain` is live on the dev proxy (show `text` and `disclaimer`, badge from `source`, notice from `translation_unavailable`, the singular permit line when the count is 1); "Get the ward briefing" links to `/b/{ward_id}`; add `--suplex-permit-bar: #B47F00` as a shared token so both charts match. Everyone: ten minutes each on a translation review sheet for the language you read. Team: whether the first candidate question should be more neutral (done: the flatter wording is in `questions.json`).

**Simone, PR #5 (`ai/`, `docs/`, `pitch/`, `contracts/copy/`; 112 tests):** the French review applied ("quartier", never "circonscription"; heading 4 fixed); a per-language translation glossary (`ai/prompts/translate_glossary.json`) with forbidden words that trigger a reject-and-retry like an invented number, and fixed strings, part of the cache key; "multiplex" can no longer become "duplex" or "triplex" in any language; the review badge under the language picker ("Reviewed by a speaker" for en and fr, "Machine translation, not yet reviewed" for the rest, driven by `languages.*.reviewed` in `labels.json`); the Hour-30 keep-or-drop checklist in the rehearsal log; the Devpost and `pitch/facts.md` updated with the real Tiger Data numbers and the ward check (fact 15), plus a locked-numbers table (Ward 04 "did" = 81, final after Hour 24). Open question answered by Andrew: the French word for a house lot is "terrains" everywhere, heading included.

**Decision (Simone, 2026-10-17, accepted): `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`.** At 20 requests a day, `gemini-3.8-flash` cannot support development; one clean demo pre-generation alone takes 16 requests. `gemini-3.8-flash` is used only for the one-off pre-generation after the Hour-24 lock, and `gemini-2.5-flash` is dropped. Before committing to the split she compares the validator's rejection rate for the two models; if flash-lite is as clean, it does everything. Touches `/ai/config.py` and `.env` only; no contract changes. Sections 1 (decision 12), 7.1, 7.9, 8.4, 11, 13 and Appendix I were updated to match.

**Yuvi, reported 2026-10-17 (branch `yuvi`, 6 commits, merged into `main` the same day as 2123951; full write-up in `pipeline/REPORT.md`, to go into `docs/decisions.md` through Simone)**

| Task | State | How to verify |
|---|---|---|
| Y1 permits fields and rule | done: **Rule A works**, 446 multiplex permits May 2023 to Nov 2024 against the City's 452 (−1.3%); Rule B not needed | `python pipeline/permits.py --report` |
| Y3 permits file | done: 7,397 projects since 2022; `GEO_ID` join 98.5%, geocode 99.3% with the street fallback; 55 unlocated (counted, not mapped); `permits.parquet`, `permits.geojson` (1.1 MB), `permit_counts.json`, `data_dates.json` on the drive | `python pipeline/checks.py --permits` |
| Y4, Y6 dev-ward and citywide build | done: `suplex.gpkg` with all 25 wards (507 MB, 193 s build) on the drive; `checks.py --all` passes every check | `python pipeline/checks.py --all` |
| Y5 Tiger Data code and trend cache | done against a local TimescaleDB 2.30.2 in Docker: `schema.sql`, `load.py`, `queries.py`, `cache_trends.py`, `trend_cache/01..25.json` on the drive, so `/ward/{id}/trend` already works from the cache | `python pipeline/tiger/ping.py` once `TIGER_DSN` exists |
| Y2 Tiger Data sign-up | **done (T18 closed):** the real service is loaded and checked against `permit_counts.json` for all 25 wards; compression took the hypertable from 3.59 MB to 2.60 MB; the trend cache is rebuilt from the real service. `TIGER_DSN` goes to Andrew privately, never into GitHub; without it the API serves the cache | `python pipeline/tiger/ping.py` with `TIGER_DSN` set |
| Y7 QA | partly done (PR #2): `pipeline/smoke_engine.py` runs the real engine on real lots. First run failed on every lot because 409,164 of 428,184 massing buildings were single-part `MultiPolygon`s the engine's geometry reader could not take; fixed in `build_lots.py` (single-part shapes are now `Polygon`, the 221 true multi-part buildings keep their largest part) and the data release replaced. After the fix all 21,300 Ward 04 lots run through `run_check` in 163 s (8 ms a lot) with 0 errors; wards 09, 19 and 23 clean on 800-lot samples. Plumbing only, not accuracy: the hand-checked lots (A8) still decide that | `PYTHONPATH=engine python pipeline/smoke_engine.py --ward 04` |
| Y8 trees, Y9 refresh | done (PR #2): optional `trees` layer, `pipeline/refresh.py`, new `lots` columns (`bldg_count`, `bldg_area_on_lot_m2`, `bldg_max_footprint_m2`, `bldg_avg_height_m`, `is_sliver`), `addresses.is_primary`, a Tiger Data Devpost draft in `pipeline/tiger/devpost_tiger.md` | PR #2 |

Data is distributed as the GitHub release `data-2026-10-17` on the repo: `suplex_ward04.gpkg` (25 MB, for A7), `suplex_citywide.gpkg.gz` (241 MB), and a small permits-and-trend zip. The files were replaced after the MultiPolygon fix, so re-download if fetched before. PR #2 touched only `pipeline/` and is merged into `main` as 3f9ddcc.

**Yuvi, PR #4 (pipeline only; reports 4 and 5):** the real Tiger Data compression numbers are 3,588,096 to 2,596,864 bytes (−27.6% total, indexes −77.7%, 20 quarterly chunks all compressed), recorded in `pipeline/tiger/tiger.md` and `devpost_tiger.md`, with `walkthrough.sql` and `demo.py` for the sponsor walkthrough. **Ward-by-ward check against the City's own table** (council background file 255851, Figure 10): Ward 04 is 42 against 42; all wards 438 against 452, correlation 0.969, mean absolute difference 3.0. That closes the Y3 comparison with the Toronto Multiplex Tracker: our counts are now checked against the City directly.

**Notes for A7 from Yuvi's real-data run:** `pipeline/smoke_engine.py` already builds a `LotInput` from the GPKG, so the API loader can copy it; unwrap single-part MultiPolygons when loading; `parcelid` and `address_point_id` are integers in the file but `LotInput` wants strings; `addresses.is_primary` marks one address per lot for the autocomplete (T7). **For A8 (resolved):** the 59% attached share in the smoke run was mostly eaves crossings and near-touching detached roofs; after the hand-checked lots set the thresholds the share is 41.6% (table above).

**Known data limits (Yuvi, 2026-10-17; this is the material for the Devpost's limitations paragraph, T17, and for the pitch's "say about, never exactly" rule).** The release `data-2026-10-17` matches Yuvi's local files hash for hash; `checks.py --all` passes every check (median lot area equals the City's stated area, 99.9% of addresses join a lot, all 25 wards present, 99.3% of permits geocoded; Tiger Data live with 7,342 permits in 20 chunks, all compressed, per-ward totals equal to `permit_counts.json`).

1. **Permits:** we count 446 multiplex permits for May 2023 to Nov 2024 against the City's 452. Ward 04 matches exactly (42); some wards differ by up to about 11; 17 permits have no ward and are counted but not mapped. Say "about", never "exactly".
2. **Lot shapes** are not survey-accurate and carry no frontage field; frontage is computed from geometry.
3. **Streets:** the parcel file has no CORRIDOR parcels, so the street layer is derived; water or rail edges can occasionally read as street.
4. **Buildings** are the 2025 3D Massing, labelled "illustrative only" by the City; one polygon often covers a row of houses, and about 24,000 lots have no building at all.
5. **Zoning:** 4.8% of lots have no zone polygon ("older bylaw" is inferred); 88% carry a site-specific exception we do not read; the zoning data is dated February 2026 and the ravine layer 2019.
6. **Trees** are decoration only.

**Not proven yet:** fit accuracy beyond the 19 hand-checked lots; and the **Hour-24 refresh**, when Yuvi re-runs the data and permit counts may shift slightly. Nobody hard-codes a number before then, and every Devpost number must equal the final `ward_summary.json`.

**What Yuvi found that changes the spec** (each applied to its section; the engine-side actions are Andrew's):

1. **Multiplex means units created 2 to 6.** The step 5 branch that let a structure type naming 2 to 6 units count as a multiplex picks up about 830 one-unit suites and gives 1,278. Units created decide; named counts are reported only. The `permit_rule` string is now "A: permits creating 2-6 units, non-SFD structure, one row per project (Toronto Multiplex Tracker rule), multiplex kind". **Andrew:** change the string in `fixtures/ward.04.json` and `ward_summary.sample.json` (they say 1-6).
2. **No CORRIDOR parcels exist** in the current Property Boundaries file (COMMON 491,687, CONDO 3,769, RESERVE 2,983). The `corridors` layer is derived: ward area minus every parcel, cut into 250 m tiles, negative synthetic `parcelid`; 98.0% of lots touch it. Water and rail edges can read as street. **Andrew:** the engine uses the layer as-is and keeps the nearest-address-point fallback.
3. **The height overlay column is `HT_LABEL`** (float metres); coverage is `PRCNT_CVER`. Ward 04 has no coverage overlay polygons; 57% of lots citywide do. T4 closed.
4. **No zone polygon carries `ZN_STATUS` 5** (values 0 to 3). "Older bylaw" is now inferred: a lot with no zone polygon covering at least 25% of it gets `zn_zone` null and `zn_status` 5 (4.8% of COMMON lots). The engine rule in 5.3 is unchanged.
5. **Ward 23 is fully in the sixplex overlay.** By-law 654-2025 Diagram 1 is the "Scarborough North (23) Ward Area" and matches the City Wards polygon; Diagram 2 is the eight TEYCC wards. No ward is partial; `pipeline/data/sixplex_overlay_ward23.geojson` is the ward polygon. **Andrew:** `engine_config.json` `sixplex_wards` gains "23" and `partial_sixplex_wards` becomes `[]`; `sixplex_overlay: "partial"` never occurs (the type keeps the value; the web's partial case can go). T11 closed.
6. **One massing polygon often covers a whole row of houses.** 78% of lots get a building by largest overlap, about 97% intersect one. **Andrew:** use footprint-intersects-lot (clipped to the lot) for `vacant` and for building area; a merged row polygon can exceed the 350 m² `larger_building` threshold without the lot being a larger building, so apply that threshold to the clipped area and tune on the test lots (T8). The cross-lot footprint is still the attached-house signal.
7. **88% of Ward 04 lots have `zn_exception` = Y** (359,326 zone polygons citywide). A `site_exception` flag on every lot says nothing. ★ **Decision (needs Andrew's confirmation):** the address check keeps one muted line ("this zone has a site-specific exception, x1234, which Suplex does not read"), the map shows no exception icon, and the ward panel's "need extra review" count excludes exceptions; `ward_summary.flags.site_exception` is still reported.
8. **`permits.geojson` carries all four kinds in `k`;** the web filters to `multiplex` for the dots (section 6.5 already says so). `permit_counts.json` `since_may_2023` and `by_year` are multiplex only; `by_kind_since_may_2023` and `by_year_by_kind` hold every kind; `unlocated` holds the 55.
9. Checkpoint numbers worth knowing: multiplex permits since May 2023 by ward run from 5 (Ward 13) to 177 (Ward 09); Ward 04 has 81. 35.6% of lots are in the sixplex overlay. Zones: RD 233,604, R 103,487, RM 54,248, RS 29,529, RT 14,739. Flags: heritage register 2.3%, heritage district 2.3%, ravine 6.6%, TRCA 7.2%.

**Andrew, 2026-10-17 afternoon (branch `main`, 12 commits 883c945..0c35ec8; `pytest engine` 153 passed, `pytest api` 44 passed, `validate.py` 37 ok)**

What the real Ward 04 data changed, beyond Yuvi's items (details and tables in `docs/test-lots.md`):

1. **Rear lanes.** The derived street-space layer includes public lanes: 34% of Ward 04 lots have two or more street edges and 78% of those are a street plus a lane behind, not a corner. The shorter-edge corner rule faced the lane on 2,451 house lots (13%); the pairwise walk moves about 258 more, 189 of them house lots. Section 5.2 step 1 now walks the street edges from the one nearest the address point outward and drops every edge opposite an edge already kept, then applies the corner rule; of an opposite pair the edge nearer the address point wins (a corner lot addressed from the street half of its long side loses its lane; one addressed from the lane half keeps it, a known limit). Lots without an address point (33) keep the old rule.
2. **Eaves are not party walls.** The massing polygons are roof outlines. A detached house's roof crosses the lot line by 4 to 20 m² and sits 0.1 to 0.5 m from the neighbour's, so `cross_lot_m2 = 4` and `tolerance_m = 0.3` called 3,438 detached houses attached. With 20 m² and 0.05 m the attached share of measured house lots is 41.6% (was 60.6%; Yuvi's smoke run said 59%). Known limit: a semi whose party wall the massing splits with a visible gap (602 Indian Rd, 95 Grenadier Rd) reads as detached; those lots still fail on lot width.
3. **3-storey houses are not larger buildings.** 12 to 16 m average massing heights are almost all small-footprint single-address houses (274 of 318); apartments in the sample all exceed the 350 m² footprint rule anyway. `avg_height_m` is 16.
4. **Garages.** 343 house lots (1.8%) are `unmeasurable` because a detached garage over 20 m² counts as a second building (5.2 step 6). Left as the spec says; a second-building threshold would be a contract change.
5. **Depth row when the design does not fit the lot's width** (34 Rexford Rd read 24.6 m on a 33.5 m lot): now the lot's centre-line depth whenever the width row fails. Designs that fit the width are still measured under the placed rectangle; on skewed lots that reads short (542 Ward 04 results, pessimistic: a wider rule was tried and withdrawn because they then read "fits" or "too close to call" while the 3D view drew the building over the side yard). Fix before A10: align the placement to the lot's sides on skewed lots.

Asks: **Simone** — `ai/numbers.py` lines 125 and 132 emit `"%"`; the fixtures now say `"pct"` everywhere and `ai/tests` has one failure (`test_matches_the_english_briefing_fixture`) until that changes; the `site_exception` flag text in `contracts/copy/reasons.json` was edited by Andrew (an `{exception}` placeholder the engine fills, plus `text_without_number`), please read it over; `docs/test-lots.md` is Andrew's A8 deliverable placed in `/docs` as 8.1 says. **Jayden** — `context.buildings[]` can repeat a `building_id` (the on-lot clipped part plus the off-lot remainders of one massing polygon), so key on array position; `lot.existing_building` is the clipped part; the exception line is informational (`site_exception` is never in `f` or in "needs extra review"); use `127.0.0.1` rather than `localhost` for the API on Windows (about 2 s per new connection otherwise). **Yuvi** — `data/out/data_dates.json` carries dataset slugs (`3d-massing`, `_fetched_at`) and timestamps; the API maps them to the contract keys and dates in `api/store.py` `normalise_data_dates`; writing the contract keys from `download.py` would let the batch share it.

A stale `origin/feat/pipeline` branch also exists from before the rename; delete it once `yuvi` is merged.

**Next, in order**

1. Andrew: send each teammate their kickoff prompt (section 8) and this section. Teammates clone, create `.venv`, run `pip install -r requirements.txt`, open branch `yuvi` / `jayden` / `simone` from `main`.
2. Yuvi: put `suplex.gpkg`, the permit files and `trend_cache/` on the drive (done on his machine); sign up for Tiger Data (Y2) and load it; then Y7 when Andrew sends the test lots.
3. Andrew: **done 2026-10-17 afternoon** — the engine-side items 1, 5, 6 and 7 from Yuvi's findings (commits ebe4ccd, 6aaea16, 032bd83, a813998, plus 6d32489 for the `pct` unit), A7 (merged as 0c35ec8) and A8 (af59c65, 14d5311, caf3c0c) are on `main`; see the table above. **Next for Andrew:** A10 citywide batch (`engine/suplex_engine/batch.py`: `ward_summary.json`, `wards/{id}.geojson` with `f` from `classify.review_flags`, reuse or move the API's `normalise_data_dates`), A9's `SUPLEX_DEMO_CACHE` mode and A11 demo cache, the deferred review minors listed in `docs/test-lots.md` and the API report (null permit dates, CRS check, malformed optional files, a test that context reaches the engine, CORS on 500s).
4. Jayden: J1 to J3 and the landing hero are merged; A7 is live, so J8 (the live API switch) can happen alongside J4 (the result panel, with `/explain` on the proxy), then J5 (ward map, which needs A10's per-ward files; fixtures until then) and J6 (transition). Read `levels[]` and `homes[]` from `designs.json` (section 6.3 used to say `floors[]`).
5. Simone: S1 to S7, S10 drafts and T13 are merged; next are the translation review sheets, then S8 and S9 once the API and the batch exist.

**Decisions made in the first session without Andrew** (full list with reasons in `docs/decisions.md`): `attached.on_lot_m2 = 10` added to `engine_config.json`, its schema and `types.ts`; lot-level `width_m` is the cross-section at the 6.0 m setback line and `depth_m` the centroid line; the band is inclusive (|margin| of 0.5 m is still borderline); street edges under 3 m are never the frontage; the buildable area is the lot clipped by the setback lines; `ward.04.json` `by_year` changed to sum to 41; the city summary entry uses `ward_id: "city"`; `BriefingRequest.ward` also accepts the full `/ward/{id}` response; 8.375 rounds to 8.38; React 19 rather than 18; branches renamed to `main` / `yuvi` / `jayden` / `simone`.

**Open items carried forward**: T1 (HTV 11 rules, Simone), T3 (re-read the Sixplex Narrow zoning matrix), mockups not yet in `/docs/mockups/`, the TRCA flag links to the ArcGIS FeatureServer because there is no City dataset, the `web/src/App.tsx` disclaimer TODO. Closed since the first version: T2 (Gemini limits read; model decision above).
