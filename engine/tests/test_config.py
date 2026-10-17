"""engine_config.json values the pipeline's findings pinned down (MASTERSPEC section 0, item 5)."""
from __future__ import annotations

from suplex_engine.config import load_config


def test_ward_23_is_fully_in_the_sixplex_overlay():
    cfg = load_config()
    assert "23" in cfg.sixplex_wards
    assert cfg.partial_sixplex_wards == ()
