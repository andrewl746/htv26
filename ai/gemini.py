"""Calling Gemini (MASTERSPEC 7.9): one function, generate_json(prompt, schema), with structured JSON output.

Retries once after a short wait on a 429 or a reply that doesn't parse, then raises GeminiError;
the caller falls back to the plain template.
"""
from __future__ import annotations

import time
from typing import TypeVar

from google import genai
from google.genai import errors
from pydantic import BaseModel, ValidationError

from ai.config import load_settings

T = TypeVar("T", bound=BaseModel)

RETRY_WAIT_S = 2
RATE_LIMITED = 429


class GeminiError(Exception):
    """Gemini could not produce a usable reply; serve the template instead."""


_clients: dict[str, genai.Client] = {}


def _client(api_key: str) -> genai.Client:
    if api_key not in _clients:
        _clients[api_key] = genai.Client(api_key=api_key)
    return _clients[api_key]


def _call(client, model: str, prompt: str, schema: type[T]) -> T:
    if hasattr(client, "interactions"):
        interaction = client.interactions.create(
            model=model,
            input=prompt,
            response_format={"type": "text", "mime_type": "application/json", "schema": schema.model_json_schema()},
        )
        text = interaction.output_text
    else:  # older SDKs
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={"response_mime_type": "application/json", "response_schema": schema},
        )
        text = response.text
    return schema.model_validate_json(text or "")


def generate_json(prompt: str, schema: type[T], *, model: str | None = None, client=None) -> T:
    settings = load_settings()
    model = model or settings.gemini_model
    if client is None:
        if not settings.gemini_api_key:
            raise GeminiError("GEMINI_API_KEY is not set")
        client = _client(settings.gemini_api_key)

    for attempt in (1, 2):
        try:
            return _call(client, model, prompt, schema)
        except errors.APIError as e:
            if e.code != RATE_LIMITED or attempt == 2:
                raise GeminiError(f"Gemini API error {e.code}") from e
        except (ValidationError, ValueError) as e:
            if attempt == 2:
                raise GeminiError("Gemini reply did not match the schema") from e
        except Exception as e:  # network errors and anything else: fall back, never crash the request
            raise GeminiError(f"Gemini call failed: {type(e).__name__}") from e
        time.sleep(RETRY_WAIT_S)
    raise GeminiError("unreachable")
