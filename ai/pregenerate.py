"""Pre-generation (MASTERSPEC 7.7, 7.9, S7): fill the cache so the demo never waits on Gemini.

    python -m ai.pregenerate --ward 04 --langs all
    python -m ai.pregenerate --ward 04 --langs all --address-id <id> --address-id <id>
    python -m ai.pregenerate --ward 04 --langs all --model gemini-3.8-flash --refresh   # only after headline-locked
    python -m ai.pregenerate --ward 04 --langs en,fr --fixture                          # fixture data, for testing

Ward data and checks come from SUPLEX_API_URL (or /contracts/fixtures with --fixture). Calls are paced to the
model's free-tier requests per minute. If Gemini fails (quota or network) the run stops; everything cached so
far is kept, and running the same command later resumes where it stopped.
"""
from __future__ import annotations

import argparse
import sys
import time
from dataclasses import replace

import httpx

from ai.briefing import briefing
from ai.cache import JsonCache
from ai.config import DEFAULT_RPM, MODEL_RPM, Settings, contract, load_settings
from ai.explain import explain
from ai.gemini import GeminiError, generate_json

PACING_MARGIN_S = 0.5


class Paced:
    """Wraps generate_json: waits between calls to respect the requests-per-minute limit, and records
    whether Gemini failed so the run can stop instead of caching nothing."""

    def __init__(self, rpm: int, generate=generate_json, sleep=time.sleep, clock=time.monotonic):
        self.interval = 60 / rpm + PACING_MARGIN_S
        self.generate, self.sleep, self.clock = generate, sleep, clock
        self.last: float | None = None
        self.calls = 0
        self.failed: str | None = None

    def __call__(self, prompt, schema, *, model=None):
        if self.last is not None:
            wait = self.interval - (self.clock() - self.last)
            if wait > 0:
                self.sleep(wait)
        self.last = self.clock()
        self.calls += 1
        try:
            return self.generate(prompt, schema, model=model)
        except GeminiError as e:
            self.failed = str(e)
            raise


def _get(url: str) -> dict:
    response = httpx.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def ward_data(settings: Settings, ward_id: str, fixture: bool) -> tuple[dict, dict | None]:
    if fixture:
        return contract(f"fixtures/ward.{ward_id}.json"), contract(f"fixtures/trend.{ward_id}.json")
    ward = _get(f"{settings.suplex_api_url}/ward/{ward_id}")
    try:
        trend = _get(f"{settings.suplex_api_url}/ward/{ward_id}/trend")
    except httpx.HTTPError:
        trend = None
    return ward, trend


def check_data(settings: Settings, address_id: str, fixture: bool) -> dict:
    if fixture:
        for name in ("borderline", "fits", "no_fit", "not_checked"):
            check = contract(f"fixtures/check.{name}.json")
            if check["address"]["address_id"] == address_id:
                return check
        raise SystemExit(f"no fixture check with address_id {address_id}")
    return _get(f"{settings.suplex_api_url}/check?address_id={address_id}")


def report(label: str, result: dict) -> None:
    flags = [result["source"], "cached" if result["cached"] else "new"]
    if result.get("translation_unavailable"):
        flags.append("TRANSLATION UNAVAILABLE")
    print(f"  {label:<34} {', '.join(flags)}")


def run(args: argparse.Namespace, settings: Settings, paced: Paced) -> int:
    cache = JsonCache(settings.cache_dir)
    langs = list(settings.langs) if args.langs == "all" else [code.strip() for code in args.langs.split(",")]
    unknown = [code for code in langs if code not in settings.langs]
    if unknown:
        raise SystemExit(f"unknown language(s) {unknown}; AI_LANGS is {list(settings.langs)}")
    langs = ["en", *[code for code in langs if code != "en"]]  # English first: every translation starts from it

    def stopped() -> bool:
        if paced.failed:
            print(f"\nStopped: Gemini failed ({paced.failed}). Everything cached so far is kept; "
                  "run the same command later to resume.")
        return paced.failed is not None

    # --addresses-only: explanations only, so no requests are spent on the ward briefing
    briefing_langs = [] if args.addresses_only else langs
    if briefing_langs:
        print(f"Ward {args.ward} briefing, model {settings.gemini_model}, {len(langs)} language(s)")
        ward, trend = ward_data(settings, args.ward, args.fixture)
    for lang in briefing_langs:
        # refresh regenerates the English once; translations are keyed by the English text, so they follow.
        result = briefing({"ward": ward, "trend": trend, "lang": lang}, settings, cache, paced,
                          refresh=args.refresh and lang == "en")
        if stopped():
            return 2
        report(f"briefing {lang}", result)

    for address_id in args.address_id:
        print(f"Address {address_id}: explanations for every design, {len(langs)} language(s)")
        check = check_data(settings, address_id, args.fixture)
        for design in check["designs"]:
            for lang in langs:
                # As for the briefing: refresh the English; the translations are keyed by it and follow.
                result = explain({"check": check, "design_id": design["design_id"], "lang": lang}, settings, cache,
                                 paced, refresh=args.refresh and lang == "en")
                if stopped():
                    return 2
                report(f"explain {design['design_id']} {lang}", result)

    print(f"\nDone: {paced.calls} Gemini request(s) this run.")
    return 0


def main(argv: list[str] | None = None, *, generate=generate_json, sleep=time.sleep) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--ward", required=True, help='ward id, e.g. "04"')
    parser.add_argument("--langs", default="all", help='"all" or a comma list such as en,fr')
    parser.add_argument("--address-id", action="append", default=[], help="backup address (repeatable)")
    parser.add_argument("--model", help="override GEMINI_MODEL for this run")
    parser.add_argument("--refresh", action="store_true", help="regenerate even when cached (e.g. with a new model)")
    parser.add_argument("--fixture", action="store_true", help="use /contracts/fixtures instead of the API")
    parser.add_argument("--addresses-only", action="store_true",
                        help="only the --address-id explanations; skip the ward briefing (saves requests with --refresh)")
    args = parser.parse_args(argv)
    if args.addresses_only and not args.address_id:
        parser.error("--addresses-only needs at least one --address-id")

    settings = load_settings()
    if args.model:
        settings = replace(settings, gemini_model=args.model)
    if not settings.gemini_api_key and generate is generate_json:
        raise SystemExit("GEMINI_API_KEY is not set (put it in .env at the repo root)")
    paced = Paced(MODEL_RPM.get(settings.gemini_model, DEFAULT_RPM), generate=generate, sleep=sleep)
    return run(args, settings, paced)


if __name__ == "__main__":
    sys.exit(main())
