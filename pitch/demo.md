# Demo ward and backup addresses (S9)

Status: filled 2026-10-17 from the citywide batch (A10) and the API on the citywide GeoPackage (`data-2026-10-17`). **Re-check all three after the Hour-24 refresh**: lot lines and permits can shift slightly.

## Demo ward

**Ward 20, Scarborough Southwest** (Andrew, T12). Sixplexes are not allowed in Ward 20, so the two sixplex designs read "doesn't fit" on `units_allowed` there; the demo shows the fourplexes. Numbers come only from `ward_summary.json` at `headline-locked` (`[LOCKED]` everywhere until then).

## Backup addresses

Criteria (MASTERSPEC 8.4): address 1 fits with no flags, on a street with neighbours in the massing and some trees; address 2 is too close to call or a clear no-fit; no multiplex permit within 50 m; never a teammate's home.

| | Address (as typed) | `address_id` | Lot | FN / FW / SN / SW | Deciding rule | Flags | Permits ≤ 50 m | 3D context | Checked live |
|---|---|---|---|---|---|---|---|---|---|
| 1 (fits) **proposed** | 73 Manderley Dr | 358976 | RD (f9.0), 9.14 × 31.42 m | **fits** / borderline / no_fit / no_fit | FW: width 9.14 m against 9.04 m (inside the 0.5 m band); sixplexes not allowed in Ward 20 | none (site exception only, informational) | 0 (5 within 500 m) | 167 buildings, 115 trees | 2026-10-17 19:00 |
| 2 (too close to call) | 88 Manderley Dr | 358991 | RD (f9.0), 9.14 × 31.09 m | borderline / borderline / no_fit / no_fit | FN: depth 31.09 m against 30.77 m; FW: width 9.14 m against 9.04 m | none | 0 (8 within 500 m) | 145 buildings, 86 trees | 2026-10-17 19:00 |
| 3 (attached, fallback) | 37 Wanstead Ave | 30107712 | RS (f12.0), 6.09 × 37.42 m | no_fit on all four | `detached_building`: a semi or row house | none | 0 (3 within 500 m) | 95 buildings, 100 trees | 2026-10-17 19:00 |

**Why 73 Manderley Dr is proposed as address 1 (Andrew to confirm, T12):** Andrew's two picks (88 Manderley Dr and 37 Wanstead Ave) are a borderline and an attached lot, so neither shows a design that fits. 73 Manderley Dr is on the same street and the Fourplex Narrow fits outright, with no flags and no permit nearby; 75 to 83 Manderley Dr give the same result if 73 is ever unsuitable. Same street, one fits and one is too close to call, is also a clear way to show the uncertainty band on stage. 37 Wanstead Ave stays as the attached-house example if a judge asks about semis.

**The explanations** for all three addresses and all four designs were generated on real data with `gemini-3.5-flash-lite` (12 requests, 0 validator rejections) and read: each says "may fit", "too close to call" with the 0.5 m band, or the attached-house note as it should.

## After choosing

- **Andrew (A11):** the demo cache for the confirmed addresses (add 73 Manderley Dr if approved) and Ward 20: `python -m api.cache_demo`.
- **Jayden:** the landing chips in `web/src/examples.ts` still use 326 Quebec Ave and 281 Armadale Ave (both check out on real data); switch them to the confirmed backup addresses, or keep them as extra examples.
- **Simone:** once `ward_summary.json` is shared, `python -m ai.pregenerate --ward 20 --langs all --address-id 358976 --address-id 358991 --address-id 30107712`; after the Hour-24 lock, the same with `--model gemini-3.8-flash --refresh` (the 20-a-day model: one ward in eight languages plus the explanations is close to the limit, so run English and French first). Then re-read the French briefing.
