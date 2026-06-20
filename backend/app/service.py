"""Business logic for the three diner features, backed by Gemini.

Each function pre-filters the menu deterministically (menu.apply_filters), then
asks Gemini to do the judgement part (which to recommend, how to phrase the
"why", how to answer a question). If MOCK_MODE is on (no API key), we fall back
to simple deterministic responses so the UI is fully usable offline.
"""
from __future__ import annotations

import json

import config

from . import menu
from .gemini import GeminiError, generate_json, generate_text

# --------------------------------------------------------------------------
# Prompts
# --------------------------------------------------------------------------

RECOMMEND_SYSTEM = """You are Maître, a warm, concise restaurant menu concierge.
You are given a list of AVAILABLE candidate dishes (already filtered to the
diner's preferences) and their party context. Recommend dishes ONLY from the
candidate list — never invent dishes or ids.

Return STRICT JSON with this shape:
{
  "individual": [ { "id": "<dish id>", "why": "<one short sentence, max ~14 words>" } ],
  "combos": [
    {
      "title": "<short evocative name, e.g. 'The Comfort Spread'>",
      "why": "<one short sentence on who this set suits>",
      "items": [ "<dish id>", "<dish id>" ]
    }
  ]
}

Rules:
- "individual": 4-6 strong picks, ordered best first.
- "combos": EXACTLY 3 complete sets. Each set should suit the chosen course
  (a full meal => a starter + main + dessert (+ drink if any); desserts-only =>
  different desserts per card). Dishes MAY repeat across combos. Vary the 3
  combos by style (e.g. comfort / lighter / chef-driven).
- Respect the diner's stated note (occasion, allergies) if present.
- Never recommend a dish id that is not in the candidate list.
- Keep every "why" short, specific, and inviting. No prices in the text."""

DISH_SYSTEM = """You are Maître, a warm, concise restaurant concierge answering a
diner's question about ONE specific dish. Use ONLY the dish facts provided.
If a fact isn't given, say you're not certain and suggest asking the server.
Answer in 1-3 short sentences, friendly and direct. No markdown."""

REFINE_SYSTEM = """You are Maître, a warm, concise restaurant concierge. The diner
has already picked some dishes. Help them refine: judge whether it's enough for
their party, what's missing (e.g. no dessert, no main), and what pairs well.
You may suggest dishes ONLY from the provided available menu list (use exact
names). Answer in 1-4 short sentences, friendly and specific. No markdown."""


# --------------------------------------------------------------------------
# Feature 2 — form-based recommendations (individual + 3 combos)
# --------------------------------------------------------------------------

def recommend(filters: dict, extras: dict, note: str, party_size: int) -> dict:
    candidates = menu.apply_filters(filters, extras)
    drinks = menu.drink_candidates(filters.get("drinks", "None"))
    pool = candidates + drinks

    if not pool:
        return {"individual": [], "combos": [], "candidates": [], "note": "no_matches"}

    if config.MOCK_MODE:
        result = _mock_recommend(candidates, drinks, filters, party_size)
    else:
        user_prompt = json.dumps(
            {
                "party_size": party_size,
                "filters": filters,
                "extras": {k: v for k, v in (extras or {}).items() if v},
                "diner_note": note or "",
                "candidates": [menu.compact(d) for d in pool],
            },
            ensure_ascii=False,
        )
        try:
            raw = generate_json(RECOMMEND_SYSTEM, user_prompt, max_tokens=2048)
            result = _hydrate(raw, pool)
        except GeminiError:
            result = _mock_recommend(candidates, drinks, filters, party_size)

    result["candidates"] = [menu.compact(d) for d in pool]
    return result


def _hydrate(raw: dict, pool: list[dict]) -> dict:
    by_id = {d["id"]: d for d in pool}

    individual = []
    for item in raw.get("individual", []):
        d = by_id.get(item.get("id"))
        if d:
            individual.append({**_dish_card(d), "why": item.get("why", "")})

    combos = []
    for c in raw.get("combos", [])[:3]:
        items = [by_id[i] for i in c.get("items", []) if i in by_id]
        if not items:
            continue
        combos.append(
            {
                "title": c.get("title", "Suggested Set"),
                "why": c.get("why", ""),
                "groups": _group_by_course(items),
                "total": sum(d["price"] for d in items),
            }
        )
    return {"individual": individual, "combos": combos}


def _dish_card(d: dict) -> dict:
    return {
        "id": d["id"],
        "name": d["name"],
        "cuisine": d["cuisine"],
        "course": d["course"],
        "diet": d["diet"],
        "price": d["price"],
        "serves": d["serves"],
        "pieces": d.get("pieces"),
        "spice": d.get("spice"),
        "tag": d.get("tag"),
    }


_COURSE_ORDER = {"Starter": 0, "Main": 1, "Dessert": 2, "Drink": 3}
_COURSE_LABEL = {"Starter": "Starter", "Main": "Main Course", "Dessert": "Dessert", "Drink": "Drinks"}


def _group_by_course(items: list[dict]) -> list[dict]:
    buckets: dict[str, list[dict]] = {}
    for d in items:
        buckets.setdefault(d["course"], []).append(d)
    ordered = sorted(buckets.items(), key=lambda kv: _COURSE_ORDER.get(kv[0], 9))
    return [
        {"course": _COURSE_LABEL.get(course, course), "items": [_dish_card(d) for d in dishes]}
        for course, dishes in ordered
    ]


# --------------------------------------------------------------------------
# Feature 1 — ask about a dish
# --------------------------------------------------------------------------

def ask_dish(dish_id: str, question: str) -> str:
    d = menu.get_dish(dish_id)
    if not d:
        return "I couldn't find that dish on the menu."
    if config.MOCK_MODE:
        return _mock_dish_answer(d, question)
    facts = {
        "name": d["name"], "cuisine": d["cuisine"], "course": d["course"],
        "diet": d["diet"], "jain": d.get("jain"), "spice": d.get("spice"),
        "price": d["price"], "serves": d["serves"], "pieces": d.get("pieces"),
        "allergens": d.get("allergens", []), "ingredients": d.get("ingredients", []),
        "description": d.get("desc", ""), "no_onion_garlic": d.get("nog"),
    }
    user_prompt = f"Dish facts:\n{json.dumps(facts, ensure_ascii=False)}\n\nDiner question: {question}"
    try:
        return generate_text(DISH_SYSTEM, user_prompt, max_tokens=512)
    except GeminiError:
        return _mock_dish_answer(d, question)


# --------------------------------------------------------------------------
# Feature 3 — refine my picks
# --------------------------------------------------------------------------

def refine(picked_ids: list[str], question: str, party_size: int) -> str:
    picked = [menu.get_dish(i) for i in picked_ids if menu.get_dish(i)]
    if not picked:
        return "Select a few dishes first and I'll help you balance the order."
    if config.MOCK_MODE:
        return _mock_refine(picked, question, party_size)
    payload = {
        "party_size": party_size,
        "picked": [menu.compact(d) for d in picked],
        "available_menu": [menu.compact(d) for d in menu.available_dishes()],
        "question": question or "Is this a good, balanced order for us?",
    }
    try:
        return generate_text(REFINE_SYSTEM, json.dumps(payload, ensure_ascii=False), max_tokens=600)
    except GeminiError:
        return _mock_refine(picked, question, party_size)


# --------------------------------------------------------------------------
# Mock fallbacks (used when MOCK_MODE / no API key / Gemini error)
# --------------------------------------------------------------------------

def _rank(d: dict) -> int:
    return {"bestseller": 3, "chefspecial": 2}.get(d.get("tag"), 0)


def _mock_recommend(candidates, drinks, filters, party_size) -> dict:
    ranked = sorted(candidates, key=_rank, reverse=True)
    full = filters.get("course") == "Full meal"

    def why(d):
        lead = "A house favourite" if d.get("tag") == "bestseller" else (
            "Chef's special" if d.get("tag") == "chefspecial" else f"{d['cuisine']} {d['course'].lower()}")
        heat = f"{d['spice'].lower()} heat" if d.get("spice") else "no chilli"
        serve = f"easily serves your {party_size}" if d["serves"] >= party_size else "perfect for sharing"
        return f"{lead} — {heat}, {serve}."

    individual = [{**_dish_card(d), "why": why(d)} for d in ranked[:6]]
    for dr in drinks[:1]:
        individual.append({**_dish_card(dr), "why": "A refreshing drink to start."})

    def by_course(c):
        return [d for d in ranked if d["course"] == c]

    combos = []
    styles = [("The Comfort Spread", "Rich, familiar and easy to love"),
              ("Light & Fresh", "Lighter on the palate, nothing too heavy"),
              ("Chef's Adventure", "Bolder, more chef-driven flavours")]
    for i, (title, sub) in enumerate(styles):
        if full:
            picks = (by_course("Starter")[i:i+1] or by_course("Starter")[:1]) \
                + (by_course("Main")[i:i+1] or by_course("Main")[:1]) \
                + (by_course("Dessert")[i:i+1] or by_course("Dessert")[:1])
        else:
            chunk = ranked[i*2:i*2+2] or ranked[:2]
            picks = chunk
        picks = [p for p in picks if p]
        if drinks:
            picks = picks + drinks[i % len(drinks):i % len(drinks) + 1]
        if not picks:
            continue
        combos.append({
            "title": title,
            "why": f"{sub} — built for your party of {party_size}.",
            "groups": _group_by_course(picks),
            "total": sum(p["price"] for p in picks),
        })
    return {"individual": individual, "combos": combos}


def _mock_dish_answer(d, q) -> str:
    s = (q or "").lower()
    has = lambda *w: any(x in s for x in w)
    if has("contain", "ingredient", "what's in", "whats in", "made of"):
        return f"It's {d.get('desc','')} Key ingredients: {', '.join(d.get('ingredients', []))}."
    if has("piece", "how many"):
        return f"Each portion comes with {d['pieces']} pieces." if d.get("pieces") else \
            "It's served as a shared portion rather than by the piece — generous enough to pass around."
    if has("enough", "people", "group", "feed", "serve", "portion"):
        return f"One portion comfortably serves about {d['serves']}. For a larger group, order two."
    if has("spic", "hot", "mild", "heat"):
        return f"{d['spice']} on the heat scale." if d.get("spice") else "It isn't a spicy dish."
    if has("veg", "jain", "non-veg", "nonveg"):
        base = "Pure vegetarian" if d["diet"] == "veg" else "Non-vegetarian"
        return base + (", and can be prepared Jain (no onion or garlic)." if d.get("jain") else ".")
    if has("price", "cost", "much"):
        return f"It's ₹{d['price']}."
    if has("allerg", "nut", "dairy", "gluten"):
        al = d.get("allergens", [])
        return f"Heads up — it contains {', '.join(al)}." if al else "No common allergens listed."
    return f"{d['name']} is {d.get('desc','')} It serves about {d['serves']}. Anything specific you'd like to know?"


def _mock_refine(picked, q, party_size) -> str:
    s = (q or "").lower()
    has = lambda *w: any(x in s for x in w)
    courses = {}
    for d in picked:
        courses[d["course"]] = courses.get(d["course"], 0) + 1
    total_serves = sum(d["serves"] for d in picked)
    if has("dessert", "sweet"):
        if courses.get("Dessert"):
            return "You already have dessert covered — that's plenty of sweetness."
        return "There's no dessert yet — a Saffron Pista Kulfi or Gulab Jamun would round things off nicely."
    if has("enough", "group", "people", "portion"):
        if total_serves >= party_size:
            return f"Yes — your picks serve roughly {total_serves}, comfortably covering your party of {party_size}."
        return f"It's a touch light — serves about {total_serves} for {party_size}. Add one sharing main."
    if has("pair", "go well", "add", "more", "else"):
        if not courses.get("Main"):
            return "No main yet — Dal Vermillion or Butter Chicken would anchor the table."
        if not courses.get("Dessert"):
            return "Your savoury line-up is solid — finish with a light dessert like the kulfi."
        return "Your selection is well balanced — a round of drinks is all I'd add."
    names = ", ".join(d["name"] for d in picked)
    fit = f"enough for your {party_size}" if total_serves >= party_size else f"a touch light for {party_size}"
    return f"Your picks: {names}. They're {fit}. Ask about adding a dessert, a bread, or what pairs well."
