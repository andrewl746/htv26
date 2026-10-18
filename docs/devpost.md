# Devpost draft

Status: full draft (S10), 2026-10-17. Paste each section into the matching Devpost field. Before submitting:

- Fill every `[LOCKED: …]` from `ward_summary.json` at the `headline-locked` tag (Hour 24). Never use fixture numbers.

**Numbers filled from the `headline-locked` ward_summary.json (2026-10-17, 22:33).** Every number below equals it; the briefing and explanations were pre-generated on the same data with `gemini-3.8-flash`.
- Every other fact comes from [`/pitch/facts.md`](../pitch/facts.md); if a sentence isn't backed there, cut it.
- Check the challenge's own questions (still to confirm, see the note below) and map these sections onto them.
- No candidate names, no ward rankings, "may fit" never "will be built".

> The spec asks for "the four questions" but doesn't list them. The sections below cover problem, what it does, how it works, and limits; rename or regroup them to match the Hack the Valley × School of Cities brief.

**Tagline:** *Before you build, before you vote.* (alternatives in `/pitch/hook.md`)

**Links:** [github.com/andrewl746/htv26](https://github.com/andrewl746/htv26) · demo video `[link]` · example briefing `[LOCKED: public URL of /b/04]`

---

## Inspiration

Since May 2023, multiplexes of up to four homes have been allowed on residential lots across Toronto. In the first 18 months the City issued 452 multiplex permits, creating about 726 net new homes, and three quarters of those permits were renovations or conversions rather than new buildings. Development charges and parkland fees are already waived on the added homes of a multiplex of up to six units ([By-law 845-2025](https://www.toronto.ca/legdocs/bylaws/2025/law0845.pdf)), and on October 2, 2026 the City released free pre-approved designs for fourplexes and sixplexes. But nothing tells a resident whether one of those designs fits their lot, and nobody publishes, ward by ward, where multiplexes could go compared with where they've actually been permitted.

With Toronto's municipal election on October 26, 2026, and 69% of GTA residents saying housing affordability will affect their vote (Ipsos, September 2026), we wanted residents, journalists and community groups to have the same sourced, neutral facts: what's allowed, and what got built.

## What it does

- **Check any address.** Type a Toronto address and the street builds itself in 3D while the City's design rises on the lot. A rules engine, not an AI, tests all four free designs against the lot's shape and Zoning By-law 569-2013 and gives each one a result: **Fits**, **Too close to call**, **Doesn't fit**, or **Not checked**. Each result shows the rule, the margin and the by-law section (for example, the Fourplex Narrow needs a lot at least 7.6 m wide once its side yards are included), plus what we don't check and multiplex permits nearby.
- **Permission vs. reality.** "See your ward" zooms out to a ward map: lots where a free design may fit ("could") next to multiplex permits issued since May 2023 ("did"). In Ward 04, 3,992 house lots may fit a free design, and 83 multiplex permits have been issued since May 2023. Each ward shows only its own numbers: no rankings, no addresses on the map, no list or export of lots.
- **Ward briefing.** A one-page, plain-language briefing for any ward, written by Gemini from the engine's numbers only. Every number links to its source, it reads in English or French, and it ends with three neutral questions a resident could ask candidates.

Every result says **"Screening only, not a permit or legal advice."**

## How we built it

- **Data:** City of Toronto open data (below), processed into one GeoPackage in EPSG:2952 so every distance and area is in metres.
- **Rules engine (Python, Shapely, GeoPandas):** measures each lot where the building would sit, applies the zoning rules for its zone with the by-law section on every rule, and places the design on the lot. The same engine serves the live address check and the citywide batch run, so a lot never gets a different answer on the map than in the check. 495,456 lots citywide.
- **API (FastAPI)** and **web app (React, TypeScript, Vite)**, with react-three-fiber for the 3D street and MapLibre GL with OpenFreeMap tiles for the ward map.
- **AI service (FastAPI + Gemini):** see "How we used Gemini".
- **Tiger Data (TimescaleDB):** see "How we used Tiger Data".

### Data sources (all City of Toronto Open Data unless noted)

| Dataset | Used for |
|---|---|
| [Address Points](https://open.toronto.ca/dataset/address-points-municipal-toronto-one-address-repository/) | address search, address to lot |
| [Property Boundaries](https://open.toronto.ca/dataset/property-boundaries/) | lot shapes, width and depth |
| [Zoning By-law](https://open.toronto.ca/dataset/zoning-by-law/) (zone areas, height and lot coverage overlays) | the rules each lot is tested against |
| [Building Permits – Active](https://open.toronto.ca/dataset/building-permits-active-permits/) and [Cleared](https://open.toronto.ca/dataset/building-permits-cleared-permits/) | the "did" half: multiplex permits |
| [3D Massing](https://open.toronto.ca/dataset/3d-massing/) | neighbouring buildings in 3D; the larger-building test |
| [City Wards](https://open.toronto.ca/dataset/city-wards/) | the 25 wards |
| [Heritage Register](https://open.toronto.ca/dataset/heritage-register/), [Heritage Conservation Districts](https://open.toronto.ca/dataset/heritage-conservation-districts/), [Ravine and Natural Feature Protection](https://open.toronto.ca/dataset/ravine-natural-feature-protection-area/) | flags only, never calculated |
| [TRCA Regulated Area](https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/ArcGIS/rest/services/TRCA_Regulation_Limit2/FeatureServer) (Toronto and Region Conservation Authority) | flag only |
| [Street Tree Data](https://open.toronto.ca/dataset/street-tree-data/) | decoration in the 3D view |
| [Pre-approved multiplex building plans](https://www.toronto.ca/services-payments/building-construction/building-permit/before-you-apply-for-a-building-permit/pre-approved-building-plans/pre-approved-multiplex-building-plans/) | the four designs' dimensions |
| [Zoning By-law 569-2013, Chapter 10](https://www.toronto.ca/zoning/bylaw_amendments/ZBL_NewProvision_Chapter10_5.htm), [By-law 654-2025](https://www.toronto.ca/legdocs/bylaws/2025/law0654.pdf), [By-law 848-2025](https://www.toronto.ca/legdocs/bylaws/2025/law0848.pdf) | the rules, each cited by section |

Data as of permits as of October 17, 2026, lots and addresses as of October 17, 2026, zoning as of February 20, 2026.

### Credit: the Toronto Multiplex Tracker

The [Toronto Multiplex Tracker](https://malcolmkennedy.com/to-multiplex-map/) ([GitHub](https://github.com/zuzubak/to-multiplex-map)) maps building permits creating 1 to 6 homes since 2022. It is the prior art for our "did" half: we use its permit filtering rule. Our multiplex count is permits creating 2 to 6 homes, one row per project. We checked it against the City's own ward-by-ward table of the 452 multiplex permits issued from May 2023 to November 2024: Ward 04 matches exactly (42 and 42), and across all 25 wards the counts track closely (446 citywide against the City's 452). It is our count, not the City's official one, and most wards differ by a few permits. What we add is the "could" half: every lot checked against the City's free designs, side by side with what was permitted.

## How we used Gemini

Gemini writes the plain-language explanation for each address check and the ward briefing, and translates both. It never decides anything:

1. **Placeholders, not numbers.** The model sees the engine's facts as named placeholders with labels (`{{could_lots}}`: "house lots where at least one free design may fit"), never the values, and returns structured JSON. Our code fills in each value and links it to its source.
2. **A validator checks every draft before anyone sees it.** It rejects any digit that didn't come from the engine and any placeholder that doesn't exist. A rejected draft is regenerated once with the reason; if it fails again, a plain template written in the same tone is shown instead.
3. **Translation into French** is a second Gemini pass over the checked English, and every translated string is validated again: a translation that drops or changes a number is rejected.
4. **Caching and pre-generation** keep the demo inside the free tier and working offline.

The validator caught 4 drafts during the event. One real example, from when we were testing more languages: both Chinese translations were rejected because they wrote "May 2023" as "2023年5月", adding a digit we hadn't supplied. We then allowed that one month number in translations only.

## How we used Tiger Data

The "did" half of the headline is the permits the City has actually issued. We load every permit that passes the tracker's rule (7,342 located permits since January 2022, of which multiplexes are the ones creating 2 to 6 homes) into a TimescaleDB hypertable on Tiger Data. The hypertable is split into 20 quarterly chunks. A continuous aggregate, `permits_ward_month`, keeps multiplex permits and homes per ward per month, so each ward's trend chart is one indexed read, refreshed by a policy. Compression is on and shrinks the table's total footprint by 27.6% (indexes by 77.7%), with every chunk compressed. The table is small today; the point is that it keeps working as the permit history grows. If Tiger Data is unreachable, the API serves a cached trend within two seconds and the chart says so. The address check never touches Tiger Data.

## Challenges we ran into

- **The City's data has gaps.** The parcel file has no street corridors, so we derived the street from the space between parcels; zoning amendments in the GIS data stop at June 2023, so the multiplex permissions are coded by hand; one 3D-massing polygon often covers a whole row of houses.
- **Lot lines aren't survey-accurate.** Rather than pretend to precision, any rule passed or failed by less than 0.5 m (or 2 percentage points of lot coverage) reads "Too close to call".
- **Matching the City's permit count.** A literal reading of the tracker's rule gave 1,278 multiplex permits; counting only permits that create 2 to 6 homes gives 446 against the City's 452.
- **Keeping AI honest across languages:** see the Chinese example above.

## Accomplishments we're proud of

- 421,204 house lots checked citywide against all four designs, with the by-law section on every rule.
- An AI layer that cannot introduce a number: every number on screen came from the engine and links to its source.
- A neutral civic tool: no candidate names, no rankings, no addresses on the map, "screening only" on every result.

## What we learned

`[Team: two or three honest sentences, written after the event.]`

## Limitations

Suplex is a first screen, not a permit or legal advice. Lot lines in the City's data are not survey-accurate, so results within 0.5 m (or 2 percentage points of coverage) are labelled "Too close to call". Counts of lots where a design may fit are upper bounds: they show where a design may fit under the rules we check, not what gets built. We don't check site-specific exceptions (three quarters of the City's zoning areas carry one), lots under pre-2013 by-laws, heritage, ravine and flood areas (flagged only), protected trees, sewer capacity and several other rules; the full list is on every result. Permit counts are gross: homes lost are rarely recorded. The 3D neighbours are illustrative.

## What's next

- Re-run as the City's data refreshes, and watch whether permits change now that the free designs exist (the trend chart's October 2026 marker is the baseline).
- Cost and financing estimates: fit is not the only barrier.
- Read site-specific exceptions where the City publishes their text.

## Built with

Python · FastAPI · GeoPandas · Shapely · React · TypeScript · Vite · three.js · react-three-fiber · MapLibre GL · OpenFreeMap · Gemini API · Tiger Data (TimescaleDB) · City of Toronto Open Data

## Prizes entered

Hack the Valley × School of Cities challenge · MLH Best Use of Gemini API · MLH Best Use of Tiger Data (one project may enter all; T1)
