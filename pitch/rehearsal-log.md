# Rehearsal log (S11)

Goal (MASTERSPEC 8.4 S11): **10 timed runs, at least 3 under 4:00**, including one where a judge-stand-in types a random address and one with Wi-Fi off (API and AI service stopped, cache only). Plus the two 30-second sponsor walkthroughs.

How to run one: start a timer, follow [`demo-script.md`](demo-script.md) end to end without stopping, note the time at each beat, then write one line below. Fix the top problem before the next run.

| # | When | Total | Hook / Check / Ward / Briefing / Limits (end times) | Conditions | What went wrong | Fix before next run |
|---|---|---|---|---|---|---|
| 1 | | | 0:__ / 1:__ / 2:__ / 3:__ / 4:__ | normal | | |
| 2 | | | | | | |
| 3 | | | | random address typed by a stand-in judge | | |
| 4 | | | | | | |
| 5 | | | | Wi-Fi off, API and AI stopped (Hour 30 check) | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |
| 10 | | | | | | |

**Runs under 4:00:** _ of 10 · **Random address passed:** ☐ · **Offline passed:** ☐

## Technical pre-flight (not a timed run)

`node ai/stage_check.mjs` makes every request the demo makes, the way the browser makes them, and checks each answer: autocomplete keystroke by keystroke for the three addresses, `/check` against `demo.md`'s expected results, all 24 explanations (4 designs × English and French) and both Ward 04 briefings served from the cache, the locked headline (3,992 / 83), the trend, the map layers and `/b/04`. Run it on the demo laptop after unzipping the caches, and again just before going on stage.

| When | Setup | Result |
|---|---|---|
| 2026-10-18, about 00:05 | Simone's laptop: API on the citywide data with the demo cache, AI service with **no Gemini key** | all OK; every request under 2 s; trend live from Tiger Data |
| 2026-10-18, about 00:10 | API on the demo cache **only** (empty data folder), Tiger Data unreachable, no Gemini key | all OK; every request under 2 s. Note for Andrew: in cache-only mode the trend is the recorded response, so it still says `source: tigerdata` and the page shows no "Cached data" badge (data mode labels it "cache" correctly) |

## Sponsor walkthroughs (30 s each)

| Walkthrough | Presenter | Time | Passed |
|---|---|---|---|
| Gemini: placeholders, click a source, translate, show a rejection | Simone | | ☐ |
| Tiger Data: hypertable, aggregate, compression, cached fallback | Yuvi | | ☐ |

## Hour 30: translation check (Andrew's rule)

Suplex now offers English and French only (`AI_LANGS=en,fr`), both reviewed, so the check is French alone.

| Language | Reviewed? | Wording flagged? | Keep or drop |
|---|---|---|---|
| French | yes (Andrew) | fixed | keep |

After the Hour-24 regeneration, read the **French** Ward 04 briefing once more: it is the one translated on stage.

## Things to check every run

- "Screening only, not a permit or legal advice" is visible when a result is on screen.
- Nobody says "will be built", a candidate's name, or ranks a ward.
- Every number spoken matches `ward_summary.json` at `headline-locked` or [`facts.md`](facts.md).
