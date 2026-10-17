# Demo ward and backup addresses (S9)

Status: filled 2026-10-17 from the citywide batch (A10) and the API on the citywide GeoPackage (`data-2026-10-17`). **Re-check all three after the Hour-24 refresh**: lot lines and permits can shift slightly.

## Demo ward

**Ward 20, Scarborough Southwest** (Andrew, T12). Sixplexes are not allowed in Ward 20, so the two sixplex designs read "doesn't fit" on `units_allowed` there; the demo shows the fourplexes. Numbers come only from `ward_summary.json` at `headline-locked` (`[LOCKED]` everywhere until then).

## Backup addresses

Criteria (MASTERSPEC 8.4): address 1 fits with no flags, on a street with neighbours in the massing and some trees; address 2 is too close to call or a clear no-fit; no multiplex permit within 50 m; never a teammate's home.

| | Address (as typed) | `address_id` | Lot | FN / FW / SN / SW | Deciding rule | Flags | Permits ≤ 50 m | 3D context | Checked live |
|---|---|---|---|---|---|---|---|---|---|
| Backup 1 (too close to call), Andrew's pick | 88 Manderley Dr | 358991 | RD (f9.0), 9.14 × 31.09 m | borderline / borderline / no_fit / no_fit | FN: depth 31.09 m against 30.77 m; FW: width 9.14 m against 9.04 m; sixplexes not allowed in Ward 20 | none (site exception only, informational) | 0 (8 within 500 m) | 145 buildings, 86 trees | 2026-10-17 19:00 |
| Backup 2 (attached), Andrew's pick | 37 Wanstead Ave | 30107712 | RS (f12.0), 6.09 × 37.42 m | no_fit on all four | `detached_building`: a semi or row-house lot, so no free design fits | none | 0 (3 within 500 m) | 95 buildings, 100 trees | 2026-10-17 19:00 |
| The script's "fits" moment | 73 Manderley Dr | 358976 | RD (f9.0), 9.14 × 31.42 m | **fits** / borderline / no_fit / no_fit | FN fits outright; FW width 9.14 m against 9.04 m (inside the 0.5 m band) | none | 0 (5 within 500 m) | 167 buildings, 115 trees | 2026-10-17 19:00 |

**How the script uses them.** Neither backup is a clean "fits" (Andrew, T12), and the demo needs one design that rises and fits, so the script opens on **73 Manderley Dr**, a few doors along from 88, where the Fourplex Narrow fits. It then types **88 Manderley Dr** on the same street: both fourplexes are too close to call, which shows the uncertainty band. **37 Wanstead Ave** is the answer when a judge asks about semis and row houses. 75 to 83 Manderley Dr give the same result as 73 if 73 is ever unsuitable. The A11 demo cache covers 88 Manderley Dr, 37 Wanstead Ave and Ward 20; **Andrew: add 73 Manderley Dr to it**, since the script leads with it.

**The explanations** for all three addresses and all four designs were generated on real data with `gemini-3.5-flash-lite` (12 requests, 0 validator rejections) and read: each says "may fit", "too close to call" with the 0.5 m band, or the attached-house note as it should.

## After choosing

- **Andrew (A11):** the demo cache for 88 Manderley Dr, 37 Wanstead Ave, 73 Manderley Dr and Ward 20: `python -m api.cache_demo`.
- **Jayden:** the landing chips in `web/src/examples.ts` still use 326 Quebec Ave and 281 Armadale Ave (both check out on real data); switch them to the confirmed backup addresses, or keep them as extra examples.
- **Simone, before the lock:** once `ward_summary.json` is in `data/out/`, fill the cache on `gemini-3.5-flash-lite` for both wards: `python -m ai.pregenerate --ward 20 --langs all --address-id 358976 --address-id 358991 --address-id 30107712`, then `python -m ai.pregenerate --ward 04 --langs all`.
- **Simone, after the Hour-24 lock (10 p.m.):** the one `gemini-3.8-flash` pass, which has 20 requests a day: everything for both wards (16 briefings in eight languages plus 12 explanations = 28) does not fit, so it covers what is on stage, in this order, about 18 requests: Ward 20 in English and French (`--ward 20 --langs en,fr`, 2), Ward 20's other six languages (`--langs all`, 6), Ward 04 in English and French (2), then the explanations for 73 and 88 Manderley Dr (`--address-id 358976 --address-id 358991`, four designs each, 8). Each command is `pregenerate.py --model gemini-3.8-flash --refresh …`; it stops cleanly at the limit and the rest stays on the flash-lite cache, which is validated the same way. Gemini's daily quota resets at midnight Pacific (3 a.m. in Toronto) if anything is left over. Then re-read the French Ward 20 briefing.
