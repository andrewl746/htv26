"""The cache key must not depend on how a client spells a number: JavaScript's JSON.stringify writes the
float 22.0 as 22, so a briefing pre-generated from Python must still be found when the browser asks."""
from __future__ import annotations

import json

from ai.cache import cache_key


def test_whole_floats_and_ints_give_the_same_key():
    python_side = {"headline": {"could_pct_of_house_lots": 22.0, "did": 83}, "rows": [{"required": 17.0}]}
    browser_side = json.loads('{"headline": {"could_pct_of_house_lots": 22, "did": 83}, "rows": [{"required": 17}]}')
    assert cache_key(python_side) == cache_key(browser_side)


def test_real_fractions_still_differ():
    assert cache_key({"x": 7.62}) != cache_key({"x": 7.6})
    assert cache_key({"x": 0.5}) != cache_key({"x": 1})


def test_booleans_are_not_numbers():
    assert cache_key({"x": True}) != cache_key({"x": 1})
