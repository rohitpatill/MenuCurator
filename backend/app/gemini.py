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
import re

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


def _build_contents(user_prompt: str, history: list[dict] | None) -> list[dict]:
    """Build Gemini's multi-turn `contents` array.

    `history` is a list of prior turns, each {"role": "user"|"ai", "text": ...},
    in chronological order — exactly the thread the frontend already holds. We
    map our "ai" role to Gemini's "model" role, append the current question last,
    and skip any empty turns. With no history this is a single user turn (the
    previous behaviour), so existing callers are unaffected.
    """
    contents: list[dict] = []
    for turn in history or []:
        text = (turn.get("text") or "").strip()
        if not text:
            continue
        role = "model" if turn.get("role") == "ai" else "user"
        contents.append({"role": role, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": user_prompt}]})
    return contents


def _payload(system_prompt: str, user_prompt: str, max_tokens: int, json_mode: bool,
             history: list[dict] | None = None) -> dict:
    generation_config: dict = {
        "maxOutputTokens": max_tokens,
        # Keep the thinking budget at the model's minimum so tokens go to the
        # visible answer, not silent thinking. gemini-2.5-flash-lite rejects
        # anything below 512 with a 400, so 512 is the floor we use.
        "thinkingConfig": {"thinkingBudget": 512},
    }
    if json_mode:
        generation_config["responseMimeType"] = "application/json"
    return {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": _build_contents(user_prompt, history),
        "generationConfig": generation_config,
    }


def _extract_text(data: dict) -> str:
    return "".join(
        part.get("text", "")
        for candidate in data.get("candidates", [])
        for part in candidate.get("content", {}).get("parts", [])
        if part.get("text")
    )


def _call(system_prompt: str, user_prompt: str, max_tokens: int, json_mode: bool,
          history: list[dict] | None = None) -> str:
    model = _normalize_model(config.GEMINI_MODEL)
    payload = _payload(system_prompt, user_prompt, max_tokens, json_mode, history)
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


_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


def extract_json(text: str) -> dict:
    """Best-effort parse of a JSON object from an LLM response.

    Gemini's JSON mode usually returns clean JSON, but models occasionally wrap
    it in ```json fences, add a prose preamble, or emit trailing commas. This
    peels all that away so a stray backtick never breaks a feature:

      1. try a direct json.loads
      2. strip surrounding ```json ... ``` fences and retry
      3. slice from the first '{' to the last '}' (drops any prose) and retry
      4. remove trailing commas before } or ] and retry

    Raises GeminiError only if nothing yields valid JSON.
    """
    candidates = []

    stripped = text.strip()
    candidates.append(stripped)

    unfenced = _FENCE_RE.sub("", stripped).strip()
    if unfenced != stripped:
        candidates.append(unfenced)

    start, end = unfenced.find("{"), unfenced.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidates.append(unfenced[start : end + 1])

    for cand in list(candidates):
        no_trailing = re.sub(r",(\s*[}\]])", r"\1", cand)
        if no_trailing != cand:
            candidates.append(no_trailing)

    for cand in candidates:
        try:
            parsed = json.loads(cand)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue

    raise GeminiError(f"Could not parse JSON from response: {text[:300]}")


def generate_json(system_prompt: str, user_prompt: str, max_tokens: int = 2048) -> dict:
    """Call Gemini in JSON mode and parse the result into a dict.

    Uses extract_json so the result survives stray ``` fences or prose that the
    model may add despite JSON mode being requested.
    """
    text = _call(system_prompt, user_prompt, max_tokens, json_mode=True)
    return extract_json(text)


def generate_text(system_prompt: str, user_prompt: str, max_tokens: int = 1024,
                  history: list[dict] | None = None) -> str:
    """Call Gemini for a plain-text answer.

    `history` (optional) is the prior conversation turns so multi-turn chats
    (dish Q&A, refine) keep context within a session.
    """
    return _call(system_prompt, user_prompt, max_tokens, json_mode=False, history=history).strip()
