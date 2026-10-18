# Demo script (4 minutes)

Status: draft (S10), 2026-10-17. Timings from MASTERSPEC 2.8. Fill `[LOCKED: …]` from the Hour-24 batch run; every other number is in [`facts.md`](facts.md). Rehearse with a timer and log each run in [`rehearsal-log.md`](rehearsal-log.md).

**Numbers filled from the `headline-locked` ward_summary.json (2026-10-17, 22:33).** Every number below equals it; the briefing and explanations were pre-generated on the same data with `gemini-3.8-flash`.

**Before judges arrive:** demo laptop on the demo cache (`SUPLEX_DEMO_CACHE=1`), API on :8000, AI service on :8001, web on :5173, browser zoom 100%, the backup addresses from [`demo.md`](demo.md) on a sticky note (326 Quebec Ave: all four designs fit; 281 Armadale Ave: too close to call; 155 Vine Ave: a row house), `/b/04?lang=en` pre-loaded in a second tab, Wi-Fi off once everything is cached (the rehearsal at Hour 30 proves this works).

**Words to never say:** "will be built", "threat", "opportunity", "best/worst ward", any candidate's or party's name. Say "may fit", "could", "screening".

---

## 0:00–0:30 · Hook (speaker: `[name]`)

> "Since 2023, every house lot in Toronto has been allowed four homes. This month, the City gave away free blueprints. But nobody can tell you whether they fit on your street, or whether the policy is working.
> Type any address and watch the City's design rise on that lot in 3D. Then zoom out: in your ward, 3,992 lots could fit a free design, but only 83 multiplex permits have been issued since 2023."

*If a judge looks sceptical about the numbers:* "Both come from City open data, and every number in the app links to its source."

## 0:30–1:30 · Address check (driver: `[name]`)

1. **Offer the keyboard:** "Want to try your street, or a family member's?" (Never press for a home address; if they decline, type 326 Quebec Ave.)
2. As the street builds: "These are the real neighbouring buildings from the City's 3D data. The old house is replaced by an illustrative new build."
3. When the design rises: "That's the City's own Fourplex Narrow. The result comes from code, not AI: lot width, depth, building length, height, coverage, each with its by-law section."
4. Open the checklist on the deciding rule: read the required value, the lot's value and the margin.
5. Type **281 Armadale Ave** (or use the judge's lot if it is borderline): "Here the Fourplex Narrow is too close to call: 7.45 m of lot width against the 7.6 m it needs. The City's lot lines aren't survey-accurate, so anything within half a metre we call too close to call instead of pretending to know."
6. Point at "Screening only, not a permit or legal advice" and "What we don't check".
7. Scroll to **Your next steps** (if time): "What to confirm next and who to contact, each step sourced from a City page: a survey, the zoning check, then applying with the City's design. A first screen, not legal advice."

*If the address isn't found or is outside Toronto:* the app says so; switch to 326 Quebec Ave. *If a judge asks about semis or row houses:* 155 Vine Ave: "Attached, so none of the free designs apply; a basement or garden suite might, and we don't check those." *If the API is down:* the demo cache serves the backup addresses.

## 1:30–2:30 · Permission vs. reality (driver)

1. Click **See your ward**. "The street fades into the ward map."
2. As lots fill and permit dots drop: "Green lots may fit a free design. Grey lots don't. Gold dots are multiplex permits actually issued since May 2023, before the free designs existed."
3. Read the counters: "3,992 lots could; 83 permits did. About one permit for every 48 lots that could."
4. Name the most common reason lots don't fit: the house is attached (a semi or row house).
5. Point at the trend chart: "Permits per month from Tiger Data; this marker is when the free designs arrived, so this is the baseline for whether they change anything."
6. "There are no addresses on this map and no list of lots, on purpose."

## 2:30–3:20 · Ward briefing (driver, Simone narrates)

1. Click **Get the ward briefing** (opens `/b/04`).
2. "Gemini writes this from the engine's numbers. Every number is a link." Click one number and show its source (the ward map or the City dataset).
3. Switch the language picker to French (or the language a judge speaks; all eight are cached). "Translated in one click; the numbers are checked again after translation."
4. "Three neutral questions for candidates, the same in every ward."

## 3:20–4:00 · How it works and limits (Simone)

> "Everything comes from City open data. The rules are in code, with the by-law section on every one. The AI only phrases numbers the engine computed: it writes placeholders instead of digits, and a validator rejects any number it didn't get; it caught 4 drafts this weekend.
> It's a screening, not a permit. We show what we don't check, we flag anything within the uncertainty band, and the counts are upper bounds: where a design may fit, not what gets built."

End on the one-liner: *"Before you build, before you vote."*

---

## Sponsor walkthroughs (30 seconds each, S11)

### Gemini (Simone)

1. **(0:00)** Briefing page, English: "Gemini writes from placeholders, never digits."
2. **(0:08)** Click a number: it opens its source.
3. **(0:14)** Switch to Simplified Chinese: "A second Gemini pass translates; every number is re-validated."
4. **(0:20)** Open `ai/logs/rejections.jsonl`: "Here the validator rejected a Chinese draft that wrote '2023年5月', a digit we hadn't supplied. It's regenerated or replaced by a template. Nothing unvalidated reaches a user."

### Tiger Data (Yuvi)

Script in `pipeline/tiger/devpost_tiger.md` (branch `yuvi`): hypertable, the `permits_ward_month` continuous aggregate behind the trend chart, compression stats measured on the real service, then unset `TIGER_DSN` to show the cached fallback.
