"""End-to-end API tests for the MenuCurator backend.

Hits every endpoint the React frontend calls, with payloads shaped EXACTLY the
way `frontend/src/api.js` + `useMenuApp.js` send them, across many realistic
scenarios. Runs against a live Flask app using Flask's built-in test client (no
network port needed), so it exercises the real routes -> service -> menu ->
gemini path. If a GEMINI_API_KEY is set it makes real Gemini calls; otherwise
MOCK_MODE answers — either way the response SHAPE is validated identically.

Run from the backend/ folder:
    .venv/Scripts/python -m tests.test_api
    .venv/Scripts/python -m pytest tests/test_api.py -v   # if pytest installed

Exit code is non-zero if any scenario fails, so it doubles as a CI smoke test.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

# Make `import server`, `config`, `app` resolve when run from anywhere.
_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

import config  # noqa: E402
from server import create_app  # noqa: E402

app = create_app()
client = app.test_client()

# --------------------------------------------------------------------------
# Tiny assertion harness (so it runs with OR without pytest)
# --------------------------------------------------------------------------
_PASS = 0
_FAIL = 0
_FAILURES: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    global _PASS, _FAIL
    if cond:
        _PASS += 1
        print(f"  PASS  {label}")
    else:
        _FAIL += 1
        msg = f"{label}" + (f" -> {detail}" if detail else "")
        _FAILURES.append(msg)
        print(f"  FAIL  {label}  {detail}")


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def post(path: str, body: dict):
    r = client.post(path, json=body)
    try:
        data = r.get_json()
    except Exception:
        data = None
    return r.status_code, data


def get(path: str):
    r = client.get(path)
    return r.status_code, r.get_json()


# --------------------------------------------------------------------------
# Response-shape validators (mirror what the React screens consume)
# --------------------------------------------------------------------------

def valid_dish_card(d: dict) -> bool:
    needed = {"id", "name", "cuisine", "course", "diet", "price", "serves"}
    return isinstance(d, dict) and needed.issubset(d)


def valid_combo(c: dict) -> bool:
    if not isinstance(c, dict):
        return False
    if not {"title", "why", "groups", "total"}.issubset(c):
        return False
    if not isinstance(c["groups"], list) or not c["groups"]:
        return False
    for g in c["groups"]:
        if not {"course", "items"}.issubset(g):
            return False
        if not all(valid_dish_card(it) for it in g["items"]):
            return False
    return isinstance(c["total"], (int, float))


def valid_recommend(data: dict) -> tuple[bool, str]:
    if not isinstance(data, dict):
        return False, "not a dict"
    for key in ("individual", "combos", "candidates"):
        if key not in data:
            return False, f"missing key '{key}'"
        if not isinstance(data[key], list):
            return False, f"'{key}' not a list"
    for d in data["individual"]:
        if not valid_dish_card(d):
            return False, f"bad individual card: {d}"
        if "why" not in d:
            return False, f"individual card missing 'why': {d}"
    for c in data["combos"]:
        if not valid_combo(c):
            return False, f"bad combo: {json.dumps(c)[:200]}"
    return True, ""


def all_ids_in_pool(data: dict) -> bool:
    """Every recommended id must come from the candidate pool (no hallucination)."""
    pool = {c["id"] for c in data.get("candidates", [])}
    for d in data.get("individual", []):
        if d["id"] not in pool:
            return False
    for c in data.get("combos", []):
        for g in c["groups"]:
            for it in g["items"]:
                if it["id"] not in pool:
                    return False
    return True


# --------------------------------------------------------------------------
# Scenarios
# --------------------------------------------------------------------------

def test_health():
    section("GET /api/health")
    code, data = get("/api/health")
    check("200", code == 200, str(code))
    check("has status ok", data and data.get("status") == "ok", str(data))
    check("reports mock_mode", data and "mock_mode" in data, str(data))
    print(f"  (mock_mode={data.get('mock_mode')}, model={data.get('model')})")


def test_menu():
    section("GET /api/menu")
    code, data = get("/api/menu")
    check("200", code == 200, str(code))
    check("has dishes list", isinstance(data.get("dishes"), list))
    check("restaurant name present", bool(data.get("restaurant")))
    dishes = data.get("dishes", [])
    check("only available dishes returned", all(d.get("available", True) for d in dishes))
    # sold-out ids must NOT appear
    ids = {d["id"] for d in dishes}
    check("sold-out d037 hidden", "d037" not in ids)
    check("sold-out d067 hidden", "d067" not in ids)
    print(f"  ({len(dishes)} available dishes)")


# Payloads exactly as the frontend builds them (DEFAULT_FILTERS + variants).
RECOMMEND_SCENARIOS = [
    ("default full-meal, both, party 3", {
        "filters": {"budget": "Up to ₹2000", "veg": "Both", "party": "2–3",
                     "drinks": "None", "course": "Full meal", "cuisine": "Any", "spice": "Medium"},
        "extras": {}, "note": "", "party_size": 3,
    }),
    ("veg only, starters, indian, mild", {
        "filters": {"budget": "Up to ₹1000", "veg": "Veg", "party": "2–3",
                     "drinks": "None", "course": "Starters", "cuisine": "Indian", "spice": "Mild"},
        "extras": {}, "note": "", "party_size": 3,
    }),
    ("non-veg, mains, chinese, spicy, party 6", {
        "filters": {"budget": "Up to ₹5000", "veg": "Non-veg", "party": "5–6",
                     "drinks": "None", "course": "Main course", "cuisine": "Chinese", "spice": "Spicy"},
        "extras": {}, "note": "", "party_size": 6,
    }),
    ("desserts only, no limits", {
        "filters": {"budget": "No limits", "veg": "Both", "party": "2–3",
                     "drinks": "None", "course": "Desserts", "cuisine": "Any", "spice": "Mild"},
        "extras": {}, "note": "", "party_size": 2,
    }),
    ("full meal + mocktails", {
        "filters": {"budget": "Up to ₹2000", "veg": "Both", "party": "2–3",
                     "drinks": "Mocktails", "course": "Full meal", "cuisine": "Any", "spice": "Medium"},
        "extras": {}, "note": "", "party_size": 3,
    }),
    ("full meal + cocktails", {
        "filters": {"budget": "Up to ₹5000", "veg": "Both", "party": "5–6",
                     "drinks": "Cocktails", "course": "Full meal", "cuisine": "Any", "spice": "Medium"},
        "extras": {}, "note": "", "party_size": 6,
    }),
    ("full meal + both drinks", {
        "filters": {"budget": "No limits", "veg": "Both", "party": "2–3",
                     "drinks": "Both", "course": "Full meal", "cuisine": "Any", "spice": "Spicy"},
        "extras": {}, "note": "", "party_size": 4,
    }),
    ("jain, full meal", {
        "filters": {"budget": "Up to ₹5000", "veg": "Jain", "party": "2–3",
                     "drinks": "None", "course": "Full meal", "cuisine": "Any", "spice": "Mild"},
        "extras": {}, "note": "", "party_size": 3,
    }),
    ("custom party size 12 with note", {
        "filters": {"budget": "Up to ₹10,000", "veg": "Both", "party": "Custom",
                     "drinks": "None", "course": "Full meal", "cuisine": "Any", "spice": "Medium"},
        "extras": {}, "note": "It's my daughter's birthday, no peanuts, not too heavy", "party_size": 12,
    }),
    ("extras: nut-free + bestsellers", {
        "filters": {"budget": "Up to ₹5000", "veg": "Both", "party": "2–3",
                     "drinks": "None", "course": "Full meal", "cuisine": "Any", "spice": "Medium"},
        "extras": {"nut": True, "best": True}, "note": "", "party_size": 3,
    }),
    ("extras: no onion garlic + chef specials", {
        "filters": {"budget": "No limits", "veg": "Veg", "party": "2–3",
                     "drinks": "None", "course": "Full meal", "cuisine": "Any", "spice": "Mild"},
        "extras": {"nog": True, "chef": True}, "note": "", "party_size": 2,
    }),
]


def test_recommend():
    section("POST /api/recommend")
    for label, payload in RECOMMEND_SCENARIOS:
        code, data = post("/api/recommend", payload)
        ok_code = code == 200
        check(f"[{label}] 200", ok_code, str(code))
        if not ok_code or data is None:
            continue
        shape_ok, why = valid_recommend(data)
        check(f"[{label}] valid shape", shape_ok, why)
        # If there were candidates, we expect non-empty results.
        if data.get("candidates"):
            check(f"[{label}] has individual picks", len(data["individual"]) > 0)
            check(f"[{label}] has combos", len(data["combos"]) > 0)
        check(f"[{label}] no hallucinated ids", all_ids_in_pool(data))
        # Drinks scoping: when drinks=None, no Drink-course dish should appear.
        if payload["filters"]["drinks"] == "None":
            drink_in_individual = any(d["course"] == "Drink" for d in data["individual"])
            check(f"[{label}] no drinks when None", not drink_in_individual)


# Edge cases that should degrade gracefully, not 500.
def test_recommend_edge():
    section("POST /api/recommend — edge cases")
    # Empty body
    code, data = post("/api/recommend", {})
    check("empty body -> 200", code == 200, str(code))
    check("empty body has keys", data and "individual" in data and "combos" in data)

    # Impossible combo (Jain + Non-veg cuisine that likely yields nothing) — must
    # still be a clean 200 with the documented shape, never a crash.
    code, data = post("/api/recommend", {
        "filters": {"budget": "Up to ₹1000", "veg": "Jain", "party": "2–3",
                     "drinks": "None", "course": "Desserts", "cuisine": "Italian", "spice": "Mild"},
        "extras": {"gluten": True, "dairy": True, "nut": True}, "note": "", "party_size": 2,
    })
    check("over-constrained -> 200", code == 200, str(code))
    shape_ok, why = valid_recommend(data) if data else (False, "no data")
    check("over-constrained valid shape", shape_ok, why)


def first_available_dish_id() -> str:
    _, data = get("/api/menu")
    return data["dishes"][0]["id"]


def test_ask_dish():
    section("POST /api/dish/<id>/ask")
    did = first_available_dish_id()
    questions = [
        "What's in it?",
        "How many pieces?",
        "Is it enough for 3 of us?",
        "How spicy is it?",
        "Is it veg or Jain?",
        "How many calories does it have?",          # beyond facts -> should defer
        "Can you make it without dairy specially?",  # customisation -> should defer
    ]
    for q in questions:
        code, data = post(f"/api/dish/{did}/ask", {"question": q})
        check(f"[{q[:28]}] 200", code == 200, str(code))
        check(f"[{q[:28]}] has answer text", bool(data and data.get("answer")), str(data))

    # Missing question -> 400 (route guards this)
    code, data = post(f"/api/dish/{did}/ask", {})
    check("missing question -> 400", code == 400, str(code))

    # Unknown dish id -> graceful 200 with a 'couldn't find' answer, not a crash
    code, data = post("/api/dish/d999/ask", {"question": "what is this?"})
    check("unknown dish -> 200", code == 200, str(code))
    check("unknown dish has answer", bool(data and data.get("answer")))


def test_refine():
    section("POST /api/refine")
    _, menu_data = get("/api/menu")
    dishes = menu_data["dishes"]
    starters = [d["id"] for d in dishes if d["course"] == "Starter"][:1]
    mains = [d["id"] for d in dishes if d["course"] == "Main"][:1]
    desserts = [d["id"] for d in dishes if d["course"] == "Dessert"][:1]

    scenarios = [
        ("balanced full set, opening summary", starters + mains + desserts, "", 4),
        ("only starters, ask if enough", [d["id"] for d in dishes if d["course"] == "Starter"][:2],
         "Is this enough for our group?", 6),
        ("mains only, ask for dessert", mains, "Can you suggest a dessert that suits us?", 3),
        ("ask what pairs well", starters + mains, "What would pair well with these?", 3),
        ("ask for a swap", starters + mains + desserts, "Is there anything I should swap for something better?", 4),
    ]
    for label, ids, q, party in scenarios:
        code, data = post("/api/refine", {"picked_ids": ids, "question": q, "party_size": party})
        check(f"[{label}] 200", code == 200, str(code))
        check(f"[{label}] has answer", bool(data and data.get("answer")), str(data))

    # No picks -> graceful prompt, not a crash
    code, data = post("/api/refine", {"picked_ids": [], "question": "", "party_size": 3})
    check("no picks -> 200", code == 200, str(code))
    check("no picks has answer", bool(data and data.get("answer")))

    # Garbage ids -> graceful
    code, data = post("/api/refine", {"picked_ids": ["nope1", "nope2"], "question": "balanced?", "party_size": 2})
    check("garbage ids -> 200", code == 200, str(code))
    check("garbage ids has answer", bool(data and data.get("answer")))


def test_conversation_history():
    """Each chat turn must carry the session's history so the model stays
    contextual (the 'feels alive' requirement). We send a prior thread and ask a
    question that is ONLY answerable from that history."""
    section("Conversation history (multi-turn context)")
    did = first_available_dish_id()

    # --- Dish Q&A: a thread, then "what did I ask before?" ---
    dish_history = [
        {"role": "ai", "text": "Hi! Ask me anything about this dish."},
        {"role": "user", "text": "what does it contain?"},
        {"role": "ai", "text": "It contains the listed ingredients."},
        {"role": "user", "text": "is it spicy?"},
        {"role": "ai", "text": "It's mild."},
    ]
    code, data = post(f"/api/dish/{did}/ask", {
        "question": "what did I ask you before this?", "history": dish_history,
    })
    check("dish recall 200", code == 200, str(code))
    ans = (data or {}).get("answer", "").lower()
    check("dish has answer", bool(ans))
    if not config.MOCK_MODE:
        # The model can only mention 'spicy'/'contain' if history reached it.
        check("dish answer reflects history", ("spicy" in ans or "contain" in ans or "ingredient" in ans), ans[:120])

    # --- Refine: a thread, then "what did I ask before?" ---
    refine_history = [
        {"role": "ai", "text": "Your picks look good but you're missing a dessert."},
        {"role": "user", "text": "is this enough for us?"},
        {"role": "ai", "text": "Yes, it comfortably serves your group."},
    ]
    code, data = post("/api/refine", {
        "picked_ids": [did], "question": "what did I ask you before?",
        "party_size": 3, "history": refine_history,
    })
    check("refine recall 200", code == 200, str(code))
    ans = (data or {}).get("answer", "").lower()
    check("refine has answer", bool(ans))
    if not config.MOCK_MODE:
        check("refine answer reflects history", ("enough" in ans or "serve" in ans or "group" in ans), ans[:120])


def test_tracing():
    section("Session tracing -> backend/logs/")
    log_dir = _BACKEND / "logs"
    sid = "pytest-trace-session"
    log_path = log_dir / f"session-{sid}.jsonl"
    if log_path.exists():
        log_path.unlink()

    # Three transactions in one session -> three lines in one file.
    did = first_available_dish_id()
    post("/api/recommend", {**RECOMMEND_SCENARIOS[0][1], "session_id": sid})
    post(f"/api/dish/{did}/ask", {"question": "What's in it?", "session_id": sid})
    post("/api/refine", {"picked_ids": [did], "question": "balanced?", "party_size": 3, "session_id": sid})

    check("session log file created", log_path.exists(), str(log_path))
    if not log_path.exists():
        return
    lines = [json.loads(l) for l in log_path.read_text(encoding="utf-8").splitlines() if l.strip()]
    check("one line per transaction (3)", len(lines) == 3, f"got {len(lines)}")
    endpoints = {r["endpoint"] for r in lines}
    check("all three endpoints traced", endpoints == {"recommend", "ask_dish", "refine"}, str(endpoints))
    for r in lines:
        check(f"[{r['endpoint']}] has request payload", bool(r.get("request")))
        check(f"[{r['endpoint']}] mode recorded", r.get("mode") in ("gemini", "mock"), str(r.get("mode")))
        check(f"[{r['endpoint']}] timing recorded", isinstance(r.get("ms"), (int, float)))
        # When a real call was made, the dynamic prompt must be captured.
        if r["mode"] == "gemini":
            check(f"[{r['endpoint']}] prompt captured", bool(r.get("prompt") and r["prompt"].get("system") and r["prompt"].get("user")))
    # Report whether this run actually exercised Gemini (diagnoses silent mock).
    modes = {r["endpoint"]: r["mode"] for r in lines}
    print(f"  (modes: {modes})")
    if not config.MOCK_MODE:
        check("real Gemini used (not silently mocking)", all(m == "gemini" for m in modes.values()), str(modes))

    log_path.unlink()  # tidy up the test's own log


def main():
    t0 = time.time()
    print("MenuCurator backend API tests")
    print(f"MOCK_MODE = {config.MOCK_MODE}  |  model = {config.GEMINI_MODEL}")
    if not config.MOCK_MODE:
        print("(real Gemini calls — this will take longer and use API quota)")

    test_health()
    test_menu()
    test_recommend()
    test_recommend_edge()
    test_ask_dish()
    test_refine()
    test_conversation_history()
    test_tracing()

    dt = time.time() - t0
    print(f"\n{'='*48}")
    print(f"RESULT: {_PASS} passed, {_FAIL} failed  ({dt:.1f}s)")
    if _FAILURES:
        print("\nFailures:")
        for f in _FAILURES:
            print(f"  - {f}")
    return 1 if _FAIL else 0


# pytest entry points (optional) ------------------------------------------
def test_suite_passes():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
