# Contracts

The only interface between people. Changes go through Andrew (schema, `types.ts` and fixture together),
except `copy/*.json`, which Simone edits directly. Run `python contracts/validate.py` after touching anything here.

## Changelog

- 2026-10-17 · v0.1.0 · initial contracts from MASTERSPEC.md Appendices A to F.
- 2026-10-17 · v0.1.1 · engine_config.json: added `attached.on_lot_m2` (10 m², the 'footprint intersecting the lot by over 10 m²' threshold from MASTERSPEC 5.7) so the engine holds no literal; schema and types.ts updated together.
