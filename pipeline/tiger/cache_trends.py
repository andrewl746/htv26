"""Write data/out/trend_cache/{01..25}.json from Tiger Data (spec Appendix E): the API's fallback when Tiger is down.

    python pipeline/tiger/cache_trends.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ping import load_env
from queries import ward_trend

OUT = Path(__file__).resolve().parents[2] / "data" / "out" / "trend_cache"
MARKERS = [{"month": "2023-05", "label": "Multiplexes allowed citywide"},
           {"month": "2026-10", "label": "Free designs released"}]


def main() -> None:
    load_env()
    OUT.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for i in range(1, 26):
        wid = f"{i:02d}"
        series = ward_trend(wid)
        doc = {"ward_id": wid, "source": "cache", "since": "2022-01", "series": series, "markers": MARKERS, "generated_at": now}
        (OUT / f"{wid}.json").write_text(json.dumps(doc, separators=(",", ":")))
        print(f"{wid}: {len(series)} months, {sum(p['permits'] for p in series)} permits")


if __name__ == "__main__":
    main()
