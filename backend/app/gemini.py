"""Single-provider Gemini client.

Distilled from the multi-provider platform down to just Gemini, since that is
the only model we use here. Two entry points:

  - generate_json(...) : non-streaming structured (JSON) call
  - generate_text(...) : non-streaming plain-text call

The Flask routes call these synchronously, so this module uses the blocking
`requests`-style flow via httpx.Client (no async needed for our simple use).
"""
from __future__ import annotations

import json

import httpx

import config

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiError(Exception):
    pass


def _normalize_model(model: str) -> str:
    if model == "gemini-2.5-flash-lite-preview-09-2025":
        return "gemini-2.5-flash-lite"
    return model


def _headers() -> dict[str, str]:
    return {"x-goog-api-key": config.GEMINI_API_KEY, "Content-Type": "application/json"}


def _payload(system_prompt: str, user_prompt: str, max_tokens: int, json_mode: bool) -> dict:
    generation_config: dict = {
        "maxOutputTokens": max_tokens,
        # Keep the thinking budget small so tokens go to the visible answer and
        # the response isn't truncated mid-sentence.
        "thinkingConfig": {"thinkingBudget": 256},
    }
    if json_mode:
        generation_config["responseMimeType"] = "application/json"
    return {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": generation_config,
    }


def _extract_text(data: dict) -> str:
    return "".join(
        part.get("text", "")
        for candidate in data.get("candidates", [])
        for part in candidate.get("content", {}).get("parts", [])
        if part.get("text")
    )


def _call(system_prompt: str, user_prompt: str, max_tokens: int, json_mode: bool) -> str:
    model = _normalize_model(config.GEMINI_MODEL)
    payload = _payload(system_prompt, user_prompt, max_tokens, json_mode)
    try:
        with httpx.Client(timeout=120) as client:
            response = client.post(
                f"{BASE_URL}/{model}:generateContent",
                json=payload,
                headers=_headers(),
            )
    except httpx.HTTPError as exc:  # network-level failure
        raise GeminiError(f"Gemini request failed: {exc}") from exc
    if response.status_code >= 400:
        raise GeminiError(f"Gemini request failed ({response.status_code}): {response.text[:500]}")
    text = _extract_text(response.json())
    if not text:
        raise GeminiError("Gemini response contained no text")
    return text


def generate_json(system_prompt: str, user_prompt: str, max_tokens: int = 2048) -> dict:
    """Call Gemini in JSON mode and parse the result into a dict/list."""
    text = _call(system_prompt, user_prompt, max_tokens, json_mode=True)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise GeminiError(f"Gemini returned invalid JSON: {text[:300]}") from exc


def generate_text(system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
    """Call Gemini for a plain-text answer."""
    return _call(system_prompt, user_prompt, max_tokens, json_mode=False).strip()
