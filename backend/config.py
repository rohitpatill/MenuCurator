"""Backend configuration — reads from environment / .env.

No database. The only secret is the Gemini API key. Everything else has a
sensible default so the app runs out of the box once GEMINI_API_KEY is set.
"""
from __future__ import annotations

import os
from pathlib import Path

# Load .env if python-dotenv is available (optional dependency).
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except Exception:  # pragma: no cover - dotenv is optional
    pass

# --- Gemini ---------------------------------------------------------------
GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite").strip()

# When true, the LLM layer returns canned responses so the app is fully usable
# without an API key (useful for UI work / demos). Auto-enabled if no key set.
MOCK_MODE: bool = os.environ.get("MOCK_MODE", "").lower() in {"1", "true", "yes"} or not GEMINI_API_KEY

# --- Server ---------------------------------------------------------------
HOST: str = os.environ.get("HOST", "127.0.0.1")
PORT: int = int(os.environ.get("PORT", "5000"))
DEBUG: bool = os.environ.get("FLASK_DEBUG", "true").lower() in {"1", "true", "yes"}

# Comma-separated list of allowed CORS origins for the frontend dev server.
CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

# Restaurant identity (shown in the UI header).
RESTAURANT_NAME: str = os.environ.get("RESTAURANT_NAME", "Vermillion")
RESTAURANT_TAGLINE: str = os.environ.get("RESTAURANT_TAGLINE", "Kitchen & Bar")
