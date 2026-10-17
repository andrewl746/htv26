# Contracts

The only interface between people. Changes go through Andrew (schema, `types.ts` and fixture together),
except `copy/*.json`, which Simone edits directly. Run `python contracts/validate.py` after touching anything here.

## Changelog

- 2026-10-17 · v0.1.0 · initial contracts from MASTERSPEC.md Appendices A to F.
- 2026-10-17 · v0.1.1 · engine_config.json: added `attached.on_lot_m2` (10 m², the 'footprint intersecting the lot by over 10 m²' threshold from MASTERSPEC 5.7) so the engine holds no literal; schema and types.ts updated together.
- 2026-10-17 · v0.1.2 · engine_config.json: Ward 23 is fully in the sixplex overlay (By-law 654-2025 Diagram 1 is the whole ward, MASTERSPEC section 0 item 5), so `sixplex_wards` gains "23" and `partial_sixplex_wards` is `[]`; schema and types.ts unchanged; the file's `version` stays 0.1.0.
- 2026-10-17 · v0.1.3 · `site_exception` is an informational flag (MASTERSPEC section 0 item 7): still in `CheckResponse.lot.flags` with the exception number (`detail` "x1234"; copy `flags.site_exception.text` takes `{exception}`, `text_without_number` when there is none), but never in `LotFeatureProps.f` or `flags.any_on_fitting_lots`; `ward_summary.flags.site_exception` still counts it. Comments only in types.ts, no schema change; `lots.04.sample.geojson` lot 11 drops its `ex` key to match.
