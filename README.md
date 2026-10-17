# Suplex

*Before you build, before you vote.* A Hack the Valley 11 project for the Hack the Valley × School of Cities challenge.

Type any Toronto address and watch the City's four free pre-approved multiplex designs tested against the lot
in 3D; see your ward's lots that *could* fit a design against the multiplex permits that *did* get issued;
read a plain-language ward briefing.

`MASTERSPEC.md` is the source of truth. `CLAUDE.md` has the rules and run commands.
Simone writes the full README (Devpost answers, dataset links); Andrew merges it.

## Quick start

```
python -m venv .venv
.venv\Scripts\activate        # or: source .venv/bin/activate
pip install -r requirements.txt
python contracts/validate.py
pytest engine
```
