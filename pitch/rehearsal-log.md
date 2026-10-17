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

## Sponsor walkthroughs (30 s each)

| Walkthrough | Presenter | Time | Passed |
|---|---|---|---|
| Gemini: placeholders, click a source, translate, show a rejection | Simone | | ☐ |
| Tiger Data: hypertable, aggregate, compression, cached fallback | Yuvi | | ☐ |

## Hour 30: translation check (Andrew's rule)

For each language still marked "Machine translation, not yet reviewed" (`reviewed: false` in `contracts/copy/labels.json`): if anyone has flagged wording in it and no speaker has reviewed it, **drop that one language** (remove its code from `AI_LANGS` in the demo laptop's `.env`). Keep the feature and every other language.

| Language | Reviewed? | Wording flagged? | Keep or drop |
|---|---|---|---|
| French | yes (Andrew) | fixed | keep |
| Simplified Chinese | | | |
| Traditional Chinese | | | |
| Spanish | | | |
| Tagalog | | | |
| Tamil | | question 1 drops "if anything" | |
| Portuguese | | | |

After the Hour-24 regeneration, read the **French** Ward 04 briefing once more: it is the one translated on stage.

## Things to check every run

- "Screening only, not a permit or legal advice" is visible when a result is on screen.
- Nobody says "will be built", a candidate's name, or ranks a ward.
- Every number spoken matches `ward_summary.json` at `headline-locked` or [`facts.md`](facts.md).
