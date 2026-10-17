"""Suplex live API (MASTERSPEC 3.3): `uvicorn api.main:app --port 8000`.

The engine is not pip-installed and Yuvi's Tiger Data modules are plain files without a package, so
importing `api` puts <repo>/engine and <repo>/pipeline/tiger on sys.path (the engine only when
`suplex_engine` is not importable already).
"""
import importlib.util
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if importlib.util.find_spec("suplex_engine") is None:
    sys.path.insert(0, str(_ROOT / "engine"))
if str(_ROOT / "pipeline" / "tiger") not in sys.path:
    sys.path.append(str(_ROOT / "pipeline" / "tiger"))
