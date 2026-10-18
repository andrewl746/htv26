# Demo ward and backup addresses (S9)

Status: filled 2026-10-17 from the citywide batch (A10) and the API on the citywide GeoPackage (`data-2026-10-17`). **Re-check all three after the Hour-24 refresh**: lot lines and permits can shift slightly.

## Demo ward

**Ward 04, Parkdale–High Park** (decision 18; Andrew reversed the brief switch to Ward 20). Why: it shows all four designs including the sixplexes, our permit count matches the City's exactly there (42 and 42 for May 2023 to November 2024), and the 19 hand-checked lots are in it. Numbers come only from `ward_summary.json` at `headline-locked` (`[LOCKED]` everywhere until then).

## The addresses

Criteria (MASTERSPEC 8.4): one that fits with no flags, on a street with neighbours in the massing and some trees; one too close to call or a clear no-fit; no multiplex permit within 50 m; never a teammate's home.

| Role | Address (as typed) | `address_id` | Lot | FN / FW / SN / SW | Deciding rule | Flags | Permits ≤ 50 m | 3D context | Checked live |
|---|---|---|---|---|---|---|---|---|---|
| The opener (fits) | 326 Quebec Ave | 7986858 | R (d0.6), 12.5 × 48.18 m | **fits / fits / fits / fits** | every rule passes; deep lot, so the 19 m Sixplex Narrow is allowed | none (site exception only, informational) | 0 (7 within 500 m) | 92 buildings, 95 trees | 2026-10-17 evening |
| Too close to call | 281 Armadale Ave | 7955411 | R (d0.6), 7.45 × 41.45 m | **borderline** / no_fit / no_fit / no_fit | FN: width 7.45 m against 7.6 m (inside the 0.5 m band); the others fail on width | none | 0 (4 within 500 m) | 103 buildings, 100 trees | 2026-10-17 evening |
| The semis question | 155 Vine Ave | 9085619 | R (d0.6), 5.0 × 31.35 m | no_fit on all four | `detached_building`: a row house, so no free design applies | none | 0 (6 within 500 m) | 67 buildings, 119 trees | 2026-10-17 evening |

**How the script uses them.** It opens on **326 Quebec Ave**: all four designs rise and fit. Then **281 Armadale Ave**: the Fourplex Narrow is too close to call, 7.45 m against 7.6 m, which shows the uncertainty band. **155 Vine Ave** answers a question about semis and row houses. Both 326 Quebec Ave and 281 Armadale Ave are also among the 19 hand-checked lots (`docs/test-lots.md`), and they are the landing page's example chips.

**The explanations** for all three addresses and all four designs were generated on the citywide data with `gemini-3.5-flash-lite` (0 validator rejections) and read: "may fit" for each design at 326 Quebec Ave, "too close to call … short by 0.15 m inside the 0.5 m uncertainty band" at 281 Armadale Ave, and the attached-house note at 155 Vine Ave.

## After choosing

- **Andrew (A11):** the demo cache for 326 Quebec Ave, 281 Armadale Ave, 155 Vine Ave and Ward 04: `python -m api.cache_demo`.
- **Simone, before the lock:** the `gemini-3.5-flash-lite` cache for Ward 04 in all eight languages (since cut to English and French; see the last item) is filled from the real batch; explanations for the three addresses too.
- **Simone, after the Hour-24 lock (10 p.m.):** the one `gemini-3.8-flash` pass is exactly 20 requests, its whole daily budget: Ward 04 in eight languages (8) plus the three addresses' explanations (12). Run it in stage order so a failure leaves the most important part done:
  1. `python -m ai.pregenerate --ward 04 --langs en,fr --model gemini-3.8-flash --refresh` (2)
  2. `python -m ai.pregenerate --ward 04 --langs all --model gemini-3.8-flash` (the other six, 6; English is reused from step 1)
  3. `python -m ai.pregenerate --ward 04 --addresses-only --address-id 7986858 --address-id 7955411 --model gemini-3.8-flash --refresh` (326 Quebec Ave and 281 Armadale Ave, 8)
  4. `python -m ai.pregenerate --ward 04 --addresses-only --address-id 9085619 --model gemini-3.8-flash --refresh` (155 Vine Ave, 4)
- **Simone, after the 3.8 pass: English and French only.** Suplex now offers two languages (`AI_LANGS=en,fr`). The three addresses' explanations are cached in French too: 12 translations of the `gemini-3.8-flash` English with `gemini-3.5-flash-lite`, 0 rejections, all served from the cache with no Gemini key:
  `python -m ai.pregenerate --ward 04 --addresses-only --langs en,fr --address-id 7986858 --address-id 7955411 --address-id 9085619` (12)

  `--addresses-only` skips the ward briefing, so steps 3 and 4 spend nothing on it: 2 + 6 + 8 + 4 = 20. A validator retry costs one more request, so the last step may fall short; `pregenerate.py` stops cleanly at the limit, anything not redone stays on the validated flash-lite cache, and Gemini's quota resets at midnight Pacific (3 a.m. in Toronto). Then re-read the French Ward 04 briefing.
