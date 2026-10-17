# Contracts

The only interface between people. Changes go through Andrew (schema, `types.ts` and fixture together),
except `copy/*.json`, which Simone edits directly. Run `python contracts/validate.py` after touching anything here.

## Changelog

- 2026-10-17 · v0.1.0 · initial contracts from MASTERSPEC.md Appendices A to F.
- 2026-10-17 · v0.1.1 · engine_config.json: added `attached.on_lot_m2` (10 m², the 'footprint intersecting the lot by over 10 m²' threshold from MASTERSPEC 5.7) so the engine holds no literal; schema and types.ts updated together.
- 2026-10-17 · v0.1.2 · engine_config.json: Ward 23 is fully in the sixplex overlay (By-law 654-2025 Diagram 1 is the whole ward, MASTERSPEC section 0 item 5), so `sixplex_wards` gains "23" and `partial_sixplex_wards` is `[]`; schema and types.ts unchanged; the file's `version` stays 0.1.0.
