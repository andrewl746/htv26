# Deck content (S10)

Status: slide-by-slide draft, 2026-10-17. Build the slides after the Hour-24 lock, when the `[LOCKED: …]` numbers exist. Rule (S10 acceptance): **every number on a slide has its source in that slide's speaker notes, or it's cut.** Sources are rows of [`facts.md`](facts.md) or `ward_summary.json` at `headline-locked`.

Design: the app's tokens (`contracts/design-tokens.css`): warm paper background, ink text, green for "may fit", grey for "doesn't fit", gold for permits. One idea per slide; big numbers; screenshots from the real app, never mock-ups. Footer on every slide with a result: "Screening only, not a permit or legal advice."

---

### 1 · Title
**Suplex**
*Before you build, before you vote.*
Hack the Valley 11 · School of Cities challenge · team names

Notes: none.

### 2 · Allowed since 2023
"Since May 2023, every house lot in Toronto has been allowed four homes."
"In 18 months: 452 permits. About 726 net new homes."

Notes: facts.md rows 1, 4, 5 (Attachment 4 p3; monitoring presentation p11–12).

### 3 · Free designs, no answers
"October 2, 2026: the City released free pre-approved designs."
Four small drawings: Fourplex Narrow · Fourplex Wide · Sixplex Narrow · Sixplex Wide.
"But will one fit on your street?"

Notes: facts.md row 3 (news release Oct 2 2026; plans page).

### 4 · Demo
(Live demo slide: switch to the app. Fallback: a 20-second screen recording of the address check.)

### 5 · Could vs. did, Ward 04
Big: "`[LOCKED: could]` lots could fit a free design." / "`[LOCKED: did]` multiplex permits since May 2023."
Small: "Upper bound: where a design may fit, not what gets built."
Screenshot: the ward map with green/grey lots and gold dots (no addresses).

Notes: `ward_summary.json` wards.04.headline at `headline-locked`; permit rule = Rule A (facts.md row 4 for the sanity check).

### 6 · Why lots don't fit
The most common reason in plain words, with its count: `[LOCKED: top rule]`, `[LOCKED: count]`.
"`[LOCKED: attached_pct]`% of house lots are semis or row houses, where the free designs don't apply."

Notes: `ward_summary.json` wards.04.top_blocking_rules and attached_share_pct.

### 7 · The ward briefing
Screenshot of `/b/04` with a number link hovered, and the language picker open (eight languages).
"Written by Gemini from the engine's numbers. Every number links to its source."

Notes: no numbers on this slide besides "eight" languages (the AI_LANGS list).

### 8 · How it works
Three columns:
- **City open data**: lots, zoning, permits, 3D buildings.
- **Rules in code**: every rule carries its Zoning By-law 569-2013 section.
- **AI only phrases**: placeholders, not digits; a validator rejects any number the engine didn't produce (`[LOCKED: rejection count]` rejected this weekend).
Logos only if the sponsors ask: Gemini, Tiger Data.

Notes: rejection count from `ai/logs/rejections.jsonl` at submission time.

### 9 · Limits, said plainly
- Screening only, not a permit or legal advice.
- Lot lines aren't survey-accurate: within 0.5 m reads "too close to call".
- Counts are upper bounds.
- Not checked: site-specific exceptions, heritage, trees, sewers and more (full list on every result).

Notes: band from `contracts/engine_config.json`; the list from `contracts/copy/not_checked.json`.

### 10 · Why it matters now
"Election day: Monday, October 26."
"69% of GTA residents say housing affordability will affect their vote."
"Before you build, before you vote."

Notes: facts.md rows 11 (Ipsos for TRREB, Sept 16 2026; GTA and Barrie sample) and 14.

### 11 · Thank you
Repo link · Devpost link · "Built on City of Toronto open data. Permit rule credit: the Toronto Multiplex Tracker."

---

**Not on any slide** (cut in T13, see facts.md): "about 216 variance applications", "guidance is missing", the Mayor's name, "housing is a top issue" without a figure.
