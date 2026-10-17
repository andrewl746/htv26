"""S6: the briefing page route (MASTERSPEC 7.7). The page's rendering is checked in a browser; these tests
cover what the server is responsible for: the injected boot data, the assets and the static contracts."""
from __future__ import annotations

import json
import re
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from ai.config import AI_DIR, contract, load_settings
from ai.main import app, get_settings


@pytest.fixture
def client():
    settings = replace(load_settings(), suplex_api_url="http://localhost:8000", suplex_web_url="http://localhost:5173")
    app.dependency_overrides[get_settings] = lambda: settings
    yield TestClient(app)
    app.dependency_overrides.clear()


def boot(html: str) -> dict:
    match = re.search(r"window\.SUPLEX = (\{.*?\});</script>", html)
    assert match, "window.SUPLEX was not injected"
    return json.loads(match.group(1))


def test_page_injects_the_boot_data(client):
    response = client.get("/b/04?lang=fr")
    assert response.status_code == 200 and response.headers["content-type"].startswith("text/html")
    data = boot(response.text)
    assert data == {
        "apiUrl": "http://localhost:8000", "webUrl": "http://localhost:5173", "wardId": "04", "lang": "fr",
        "langs": ["en", "fr", "zh-Hans", "zh-Hant", "es", "tl", "ta", "pt"],
    }


def test_unknown_language_falls_back_to_english(client):
    assert boot(client.get("/b/04?lang=xx").text)["lang"] == "en"


@pytest.mark.parametrize("ward", ["00", "26", "4", "city", "04x"])
def test_unknown_ward_is_a_404(client, ward):
    response = client.get(f"/b/{ward}")
    assert response.status_code == 404 and response.json() == {"error": "ward_not_found"}


@pytest.mark.parametrize("path", [
    "/page/briefing.js", "/page/briefing.css", "/static/design-tokens.css", "/static/copy/labels.json",
    "/static/copy/not_checked.json", "/static/engine_config.json", "/static/fixtures/ward.04.json",
    "/static/fixtures/trend.04.json",
])
def test_every_asset_the_page_loads_is_served(client, path):
    assert client.get(path).status_code == 200


def test_page_has_no_external_dependencies(client):
    html = client.get("/b/04").text
    js = client.get("/page/briefing.js").text
    assert not re.search(r"""(src|href)=["']https?://""", html)  # works offline: nothing from a CDN
    assert "innerHTML" not in js  # data is always set as text, never parsed as HTML


def test_every_page_string_key_exists_in_the_copy():
    labels = contract("copy/labels.json")
    js = (AI_DIR / "page" / "briefing.js").read_text("utf-8")
    for group, keys in (("briefing_page", re.findall(r"\bP\.([a-z_]+)", js)), ("ui", re.findall(r"\bUI\.([a-z_]+)", js))):
        missing = sorted(set(keys) - labels[group].keys())
        assert not missing, (group, missing)
