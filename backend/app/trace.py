"""Per-session request/prompt tracing.

Every frontend session (one page load) gets ONE JSONL file under backend/logs/,
named `session-<id>.jsonl`. Every transaction the diner triggers — a recommend
run, a dish question, a refine turn — is appended as ONE structured JSON line so
you can replay exactly what happened:

  - which endpoint, the raw request payload from the frontend
  - the EXACT dynamic system + user prompt sent to Gemini
  - whether the call hit GEMINI or fell back to MOCK (and the reason/error)
  - the raw model output and the final response returned to the frontend
  - timing (ms)

This is a diagnostic trail, not application state. Logs are gitignored. The
writer never raises — a logging failure must never break a diner's request.

Usage (from service.py):

    tr = trace.start("recommend", session_id, request_payload)
    tr.prompt(system=..., user=...)        # what we built
    tr.gemini(raw_text)                     # or tr.mock("reason")
    tr.result(final_dict)
    tr.finish()                             # writes the line
"""
from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

_LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
_LOCK = threading.Lock()


def _safe_session(session_id: str | None) -> str:
    """Keep only filename-safe chars; fall back to 'anon'."""
    sid = (session_id or "").strip() or "anon"
    return "".join(c for c in sid if c.isalnum() or c in "-_")[:64] or "anon"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


class Trace:
    """One transaction. Collects fields, writes a single JSONL line on finish()."""

    def __init__(self, endpoint: str, session_id: str | None, request_payload: dict):
        self.session = _safe_session(session_id)
        self._t0 = time.perf_counter()
        self.record: dict = {
            "ts": _now_iso(),
            "session": self.session,
            "endpoint": endpoint,
            "request": request_payload,
            "mode": None,            # "gemini" | "mock"
            "prompt": None,          # {system, user}
            "gemini_raw": None,      # raw text/dict from the model
            "fallback_reason": None, # set when we fell back to mock
            "result": None,          # final response handed to the frontend
            "ms": None,
        }

    def prompt(self, system: str, user: str) -> "Trace":
        self.record["prompt"] = {"system": system, "user": user}
        return self

    def gemini(self, raw) -> "Trace":
        self.record["mode"] = "gemini"
        self.record["gemini_raw"] = raw
        return self

    def mock(self, reason: str) -> "Trace":
        self.record["mode"] = "mock"
        self.record["fallback_reason"] = reason
        return self

    def result(self, final) -> "Trace":
        self.record["result"] = final
        return self

    def finish(self) -> None:
        self.record["ms"] = round((time.perf_counter() - self._t0) * 1000, 1)
        self._write()

    def _write(self) -> None:
        try:
            _LOG_DIR.mkdir(parents=True, exist_ok=True)
            path = _LOG_DIR / f"session-{self.session}.jsonl"
            line = json.dumps(self.record, ensure_ascii=False, default=str)
            with _LOCK:
                with path.open("a", encoding="utf-8") as f:
                    f.write(line + "\n")
        except Exception:
            # Tracing must never break a request.
            pass


def start(endpoint: str, session_id: str | None, request_payload: dict) -> Trace:
    return Trace(endpoint, session_id, request_payload)
