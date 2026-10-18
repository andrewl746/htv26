# Pipeline reports

One report per push to the `yuvi` branch (newest last). Each says what changed, what it means for Andrew, the check output, and what is left.

| # | Report | Covers |
|---|---|---|
| 1 | [`../REPORT.md`](../REPORT.md) | Y1 to Y6: downloads, Rule A permits, lots build, corridors, Ward 23 overlay, Tiger Data code. Includes the spec deviations. |
| 2 | [`02-qa-trees-refresh.md`](02-qa-trees-refresh.md) | Y7 QA columns, Y8 trees layer, Y9 refresh script. |
| 3 | [`03-morning-review.md`](03-morning-review.md) | Overnight: engine smoke test and the geometry fix, whole-repo review, design-doc status, open items, cleanup commands. |
| 4 | [`04-tiger-data-live.md`](04-tiger-data-live.md) | Tiger Data service live: schema, load, real compression numbers, verification. |
| 5 | [`05-ward-check-vs-city.md`](05-ward-check-vs-city.md) | Ward-by-ward comparison with the City's 452 (Ward 04: 42 vs 42). |
| 6 | [`06-y7-closed-refresh-dry-run.md`](06-y7-closed-refresh-dry-run.md) | Y7 closed on the citywide file (Andrew's 19 test lots pass), `refresh.py --dry-run` for Hour 24. |
| 8 | [`08-multiplexes-phase1.md`](08-multiplexes-phase1.md) | "Multiplexes near you" Phase 1: `pipeline/multiplexes.py`, 1,553 permitted multiplexes with street-only locations, source decision vs the Tracker. |
