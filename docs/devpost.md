# Devpost outline

Status: first-draft outline (S2). The final text, with the Gemini and Tiger Data sections written out, is S10. Every number in brackets is filled from the locked batch run (`headline-locked`, Hour 24) and checked against its source; fixture numbers never appear here.

> **To confirm at Hour 0 (S1):** the spec asks for "the four questions" but doesn't list them. This outline uses four questions drawn from the challenge framing in the spec (problem, what it does, how it works, limits). Swap in the Hack the Valley × School of Cities challenge's own questions once we have the brief, and map these sections onto them.

**Tagline:** *[pick from `/pitch/hook.md`]*

**Links:** repo `[github.com/<andrew>/suplex]` (public by submission) · demo video `[link]` · briefing page example `[/b/04?lang=en]`

---

## 1. What problem does this address, and for whom?

- Multiplexes have been allowed on residential lots since May 2023, but few get built: 452 permits and about 726 net new homes in the first 18 months ([monitoring report](https://www.toronto.ca/legdocs/mmis/2025/ph/bgrd/backgroundfile-256251.pdf)).
- On October 2, 2026 the City released four free pre-approved designs ([City release](https://www.toronto.ca/news/city-of-toronto-introduces-pre-approved-multiplex-designs-making-it-easier-to-build-more-homes-faster/)). Nothing tells a resident whether one fits a given lot.
- Housing is a top issue for the October 26, 2026 municipal election, and no one publishes ward-level facts on where multiplexes could go compared with where they have been permitted.
- Users, "before you build, before you vote":
  - homeowners checking for free whether a City design could work, before paying a designer
  - residents and neighbours who want to know what is allowed on their street
  - journalists and community groups who need sourced ward numbers

## 2. What does Suplex do?

- **Address check.** Type any Toronto address; the street builds itself in 3D and the City's design rises on the lot. A rules engine tests all four designs and returns Fits, Too close to call, Doesn't fit or Not checked, with the rule, the margin and the Zoning By-law 569-2013 section.
- **Permission vs. reality.** A ward map compares lots where a free design may fit ("could") with multiplex permits issued since May 2023 ("did"). Headline: "[X] lots here could fit a free City design. [Y] multiplex permits have been issued since 2023." Each ward shows only its own numbers; no rankings.
- **Ward briefing.** A shareable, plain-language page per ward, written by Gemini from engine numbers only. Every number links to its source, and the page translates into eight languages with one click.
- Every result says **"Screening only, not a permit or legal advice."**

## 3. How does it work, and what data does it use?

### Data (all City of Toronto open data unless noted)

| Dataset | Used for |
|---|---|
| [Address Points](https://open.toronto.ca/dataset/address-points-municipal-toronto-one-address-repository/) | address search and address to lot |
| [Property Boundaries](https://open.toronto.ca/dataset/property-boundaries/) | lot shapes, width and depth |
| [Zoning By-law](https://open.toronto.ca/dataset/zoning-by-law/) (zone areas, height overlay, lot coverage overlay) | the rules each lot is tested against |
| [Building Permits – Active](https://open.toronto.ca/dataset/building-permits-active-permits/) | the "did" half: multiplex permits |
| [Building Permits – Cleared](https://open.toronto.ca/dataset/building-permits-cleared-permits/) | the "did" half: multiplex permits |
| [3D Massing](https://open.toronto.ca/dataset/3d-massing/) | neighbouring buildings in the 3D view; the larger-building test |
| [City Wards](https://open.toronto.ca/dataset/city-wards/) | the 25 wards |
| [Heritage Register](https://open.toronto.ca/dataset/heritage-register/) | flag only |
| [Heritage Conservation Districts](https://open.toronto.ca/dataset/heritage-conservation-districts/) | flag only |
| [Ravine and Natural Feature Protection Area](https://open.toronto.ca/dataset/ravine-natural-feature-protection-area/) | flag only |
| [TRCA Regulated Area](https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/ArcGIS/rest/services/TRCA_Regulation_Limit2/FeatureServer) (Toronto and Region Conservation Authority) | flag only |
| [Street Tree Data](https://open.toronto.ca/dataset/street-tree-data/) | decoration in the 3D view only |
| [Pre-approved multiplex building plans](https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-building-plans/pre-approved-multiplex-building-plans/) | the four designs' dimensions |
| [Zoning By-law 569-2013, Chapter 10](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter10_5.htm), [By-law 654-2025](https://www.toronto.ca/legdocs/bylaws/2025/law0654.pdf), [By-law 848-2025](https://www.toronto.ca/legdocs/bylaws/2025/law0848.pdf) | the rules, each cited by section |

Data dates: `[from data_dates.json at the locked run]`.

### Credit: the Toronto Multiplex Tracker

The [Toronto Multiplex Tracker](https://malcolmkennedy.com/to-multiplex-map/) ([GitHub](https://github.com/zuzubak/to-multiplex-map), [Open Data showcase](https://open.toronto.ca/?p=4591)) is prior art for our "did" half. It maps building permits creating 1–6 dwelling units since 2022. We mirror its permit rule, use its ward totals as a sanity check, and add the "could" half: every lot checked against the City's free designs.

- Permit rule used: `[Rule A (the tracker's rule, multiplex kind only) or Rule B, from ward_summary.json permit_rule]`
- Sanity check: `[our count for May 2023 to Nov 2024]` against the City's 452

### How it's built

- Rules engine in Python (GeoPandas, Shapely, EPSG:2952). One engine serves both the live address check and the citywide batch run, so a lot never gets a different answer on the map than in the check.
- FastAPI API; React + TypeScript + Vite web app; react-three-fiber for the 3D lot; MapLibre with OpenFreeMap tiles for the ward map.
- **Gemini** *(S10: write out)*: structured JSON output; the model writes `{{placeholders}}` rather than digits; a validator rejects any number not in its input, regenerates once, then falls back to a plain template. `[N]` drafts rejected over the event (from `ai/logs/rejections.jsonl`). One-click translation into eight languages.
- **Tiger Data** *(S10 with Yuvi: write out)*: permits as a TimescaleDB hypertable, a monthly per-ward continuous aggregate behind the trend chart, compression from `[before]` to `[after]` (`/docs/tiger.md`).

## 4. What are its limits, and what's next?

- **Limitations** *(T17: write the full paragraph by Hour 26)*:
  - screening only, not a permit or legal advice
  - lot lines are not survey-accurate, so results within the uncertainty band (0.5 m, 2 percentage points of coverage) read "Too close to call"
  - what we don't check (the list in `contracts/copy/not_checked.json`)
  - counts of lots that may fit are upper bounds
  - site-specific exceptions, heritage, ravine and flood areas are flagged, never evaluated
  - permit unit counts are gross
- **Responsible design:** the AI never decides fit. There are no candidate names, no ward rankings, no addresses on the map, and no list or export of lots.
- **What's next:** cost modelling; refreshing as the City's data updates; measuring whether permits change after the free designs arrived (the trend chart's October 2026 marker is the baseline).

## Built with

Python · FastAPI · GeoPandas · Shapely · React · TypeScript · Vite · three.js · react-three-fiber · MapLibre GL · OpenFreeMap · Gemini API · Tiger Data (TimescaleDB) · City of Toronto Open Data

## Prizes entered

`[confirm at S1 what the rules allow]` Hack the Valley × School of Cities challenge · MLH Best Use of Gemini API · MLH Best Use of Tiger Data
