"""Business logic for the three diner features, backed by Gemini.

Each function pre-filters the menu deterministically (menu.apply_filters), then
asks Gemini to do the judgement part (which to recommend, how to phrase the
"why", how to answer a question). If MOCK_MODE is on (no API key), we fall back
to simple deterministic responses so the UI is fully usable offline.
"""
from __future__ import annotations

import json
import math

import config

from . import menu, trace
from .gemini import GeminiError, generate_json, generate_text

# --------------------------------------------------------------------------
# Prompts
# --------------------------------------------------------------------------

RECOMMEND_SYSTEM = """You are the MenuCurator — a warm, perceptive dining concierge \
for the restaurant Marigold. A diner has tapped a few preferences and you must \
turn the AVAILABLE candidate dishes into delightful, sensible recommendations.

INPUT
You receive a single JSON object with:
- "party_size": integer, how many people are dining.
- "filters": the diner's chip selections (budget, veg/diet, course, cuisine,
  spice ceiling, drinks). The diet/course/cuisine/spice were ALREADY applied to
  the candidate list — use those only to phrase the "why".
- "budget_total_cap": the diner's budget as a TOTAL spend ceiling for the whole
  order in rupees (null means no limit). This is NOT a per-dish limit — it is
  the most the WHOLE table wants to spend. You MUST respect it (see HARD RULES).
- "extras": optional booleans the diner toggled (e.g. nut-free, bestsellers).
- "diner_note": optional free text (occasion, allergies, mood). Honour it.
- "candidates": the ONLY dishes you may use. Each has id, name, cuisine, course,
  diet, spice, price, serves, pieces, tag, allergens.

HARD RULES
- Recommend dishes ONLY by an "id" that appears in "candidates". NEVER invent a
  dish, a name, or an id. If you are unsure an id exists, do not use it.
- BUDGET: if "budget_total_cap" is not null, the SUM of the prices of all items
  in EACH combo MUST be at or under that number. Add up the candidate prices
  yourself and drop or swap to cheaper dishes until each combo's total fits. A
  combo that exceeds the cap is WRONG. If even a minimal sensible combo can't fit
  the cap, get as close as possible with the fewest essential dishes. (Still keep
  variety where the budget allows — fit the cap first, then maximise variety.)
- Output MUST be a single valid JSON object and NOTHING else: no prose, no
  explanation, no markdown, no ``` fences. Start with { and end with }.
- All text fields must be plain text (no markdown, no emojis, no prices).

OUTPUT SHAPE (exactly this)
{
  "individual": [ { "id": "<candidate id>", "why": "<=14 words, specific>" } ],
  "combos": [
    { "title": "<short evocative name>",
      "why": "<one sentence: who this set suits / its mood>",
      "items": [ "<candidate id>", "<candidate id>", ... ] }
  ]
}

THINK LIKE A REAL PERSON ORDERING FOR THIS TABLE
This is the most important rule. Picture "party_size" real people sitting down
together and order the way a thoughtful host actually would. Reason from common
sense — do NOT apply a fixed dish count.
- A bigger table needs MORE variety across EVERY part of the meal: more
  starters, more mains, AND a real choice of drinks and desserts — roughly one
  different drink and one different dessert per 2-3 people (so a table of 8 has
  about 3-4 drink options and 3-4 desserts, not one or two token items). Nobody
  shares a single drink across a big group. A solo diner wants just a dish or
  two, not a feast.
- Use each dish's "serves" against "party_size" to judge how many distinct
  dishes are enough to actually feed and satisfy the group. If one portion of a
  popular dish won't feed everyone, say so in the "why" in plain words (e.g.
  "you'll want a couple of portions of this for the group") — never add quantity
  fields; we only suggest.
- Balance the spread sensibly: enough food, a sensible mix of proteins/cuisines,
  and — when drinks/desserts are available — a VARIETY of them proportional to
  the group, not just one token item.
Always ask yourself: "If I were ordering this for N people, would this feel
right, or too little / too much?" Adjust until it feels right.

DO NOT recommend breads/naan/roti (a side accompaniment, not a decision). If any
bread-like dish is in candidates, leave it out — diners add bread by default.

HOW TO CHOOSE
- "individual": the strongest single dishes, best first — a few for a small
  party, more for a large one. Prefer "bestseller"/"chefspecial", with variety
  across course/cuisine, fitting the party and any note.
- "combos": EXACTLY 3 complete sets, each a different mood (one comforting/
  familiar, one lighter/fresher, one bolder/chef-driven). Size and vary EACH
  combo for the table using the reasoning above.
    * filters.course == "Full meal": span courses (starters + mains + desserts,
      scaled to the group) and include drinks — more than one kind for a larger
      party — only when drink candidates are present.
    * A single course chosen (e.g. only Starters/Desserts): pick a sensible
      number of different dishes of that course for the party size.
- Dishes MAY repeat across combos, but each combo's own items must be distinct.
- Every "why" is concrete and inviting — name a flavour, texture, who it suits,
  or a portion hint for big groups. Never mention price. Never promise something
  not in the dish facts.
- If the candidate pool is small, still return the best you can (fewer combos is
  acceptable only if there genuinely aren't enough dishes to build 3)."""

DISH_SYSTEM = """You are the MenuCurator at the restaurant Marigold, answering a \
diner's question about ONE specific dish.

You are given a JSON object of that dish's FACTS (name, cuisine, course, diet,
jain, spice, price, serves, pieces, allergens, ingredients, description,
no_onion_garlic) and the diner's question.

You are in an ongoing chat with the diner — earlier turns of THIS conversation
are part of your context. Treat it like a live chat: you may freely refer back
to what was asked or said earlier (e.g. "what did I ask before?", "repeat that")
and answer naturally from the conversation itself.

RULES
- Answer DISH questions using ONLY the provided dish facts. Do not guess, infer
  hidden ingredients, or invent nutrition, cooking method, or availability.
- If a DISH question asks for something NOT in the facts (calories, exact recipe,
  customisations, today's freshness, off-menu requests, other dishes), say
  plainly that you only have this dish's listed details and suggest they ask the
  restaurant manager or their server. Do not make something up.
- Questions ABOUT the conversation itself (what was asked, recap) are fine to
  answer directly from the chat history — that is not "outside" information.
- Be warm, concise and direct: 1-3 short sentences. Plain text only — no
  markdown, no bullet points, no emojis.
- When useful, quote the concrete fact (e.g. "It serves about 2" or "8 pieces").
- Stay on this one dish; do not recommend or compare other dishes."""

REFINE_SYSTEM = """You are the MenuCurator at the restaurant Marigold. The diner has \
hand-picked some dishes and wants help refining their selection.

INPUT (JSON)
- "party_size": how many are dining.
- "picked": the dishes they've already chosen (id, name, course, diet, spice,
  price, serves, pieces, tag, allergens).
- "available_menu": every other in-stock dish you may suggest from.
- "question": what they're asking (may be a general "is this balanced?").

WHAT TO DO
- Judge the picked set for the party: is it enough food for party_size (sum the
  "serves"), is the spread balanced across courses, is anything important
  missing (no main, no dessert, no shared starter, no drink)?
- Suggest concrete improvements: what to add, swap, or what pairs well. When you
  name a dish to add, use the EXACT name of a dish from "available_menu" only —
  never invent a dish or suggest something already picked unless adding a second
  portion makes sense for the group.
- Directly answer their "question" first if it asks something specific.

RULES
- Be warm, specific and concise: 1-4 short sentences. Plain text only — no
  markdown, no bullets, no emojis, no prices unless the diner asks.
- Never claim a dish exists that isn't in picked/available_menu. If nothing
  needs adding, say the selection is already well balanced."""


# --------------------------------------------------------------------------
# Feature 2 — form-based recommendations (individual + 3 combos)
# --------------------------------------------------------------------------

def recommend(filters: dict, extras: dict, note: str, party_size: int, session_id: str | None = None) -> dict:
    tr = trace.start("recommend", session_id, {
        "filters": filters, "extras": extras, "note": note, "party_size": party_size,
    })
    candidates = menu.apply_filters(filters, extras)
    drinks = menu.drink_candidates(filters.get("drinks", "None"))
    pool = candidates + drinks

    if not pool:
        result = {"individual": [], "combos": [], "candidates": [], "note": "no_matches"}
        tr.mock("no candidates after filtering").result(result).finish()
        return result

    if config.MOCK_MODE:
        result = _mock_recommend(candidates, drinks, filters, party_size)
        tr.mock("MOCK_MODE on (no API key)")
    else:
        cap = menu.budget_cap(filters.get("budget"))
        user_prompt = json.dumps(
            {
                "party_size": party_size,
                "filters": filters,
                "budget_total_cap": None if cap == float("inf") else int(cap),
                "extras": {k: v for k, v in (extras or {}).items() if v},
                "diner_note": note or "",
                "candidates": [menu.compact(d) for d in pool],
            },
            ensure_ascii=False,
        )
        tr.prompt(RECOMMEND_SYSTEM, user_prompt)
        try:
            raw = generate_json(RECOMMEND_SYSTEM, user_prompt, max_tokens=2048)
            tr.gemini(raw)
            result = _hydrate(raw, pool)
            # If the model returned JSON but nothing usable (all ids invalid /
            # empty), fall back so the diner never sees an empty result.
            if not result["individual"] and not result["combos"]:
                result = _mock_recommend(candidates, drinks, filters, party_size)
                tr.mock("Gemini JSON had no usable dishes")
        except GeminiError as exc:
            result = _mock_recommend(candidates, drinks, filters, party_size)
            tr.mock(f"GeminiError: {exc}")

    result["candidates"] = [menu.compact(d) for d in pool]
    tr.result(result).finish()
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

def _clean_history(history: list[dict] | None) -> list[dict]:
    """Normalise the frontend chat thread into prior turns for Gemini.

    Keeps only {role, text} with non-empty text, drops any leading "ai" turns
    (the client greeting / opening summary) so the prior turns sensibly start
    with the diner, and caps length to the most recent turns to bound tokens.
    """
    turns = [
        {"role": t.get("role"), "text": (t.get("text") or "").strip()}
        for t in (history or [])
        if (t.get("text") or "").strip()
    ]
    while turns and turns[0]["role"] == "ai":
        turns.pop(0)
    return turns[-20:]


def ask_dish(dish_id: str, question: str, session_id: str | None = None,
             history: list[dict] | None = None) -> str:
    tr = trace.start("ask_dish", session_id, {
        "dish_id": dish_id, "question": question, "history_len": len(history or []),
    })
    d = menu.get_dish(dish_id)
    if not d:
        answer = "I couldn't find that dish on the menu."
        tr.mock("unknown dish id").result(answer).finish()
        return answer
    if config.MOCK_MODE:
        answer = _mock_dish_answer(d, question)
        tr.mock("MOCK_MODE on (no API key)").result(answer).finish()
        return answer
    facts = {
        "name": d["name"], "cuisine": d["cuisine"], "course": d["course"],
        "diet": d["diet"], "jain": d.get("jain"), "spice": d.get("spice"),
        "price": d["price"], "serves": d["serves"], "pieces": d.get("pieces"),
        "allergens": d.get("allergens", []), "ingredients": d.get("ingredients", []),
        "description": d.get("desc", ""), "no_onion_garlic": d.get("nog"),
    }
    # The dish facts always lead the conversation so the model keeps them in
    # context for every follow-up; the running history (this session's turns)
    # comes next, and the live question is appended last by the client layer.
    facts_block = f"Dish facts for this conversation:\n{json.dumps(facts, ensure_ascii=False)}"
    convo = [{"role": "user", "text": facts_block}] + _clean_history(history)
    user_prompt = question
    tr.prompt(DISH_SYSTEM, f"{facts_block}\n\n[history: {len(convo) - 1} turns]\n\nDiner question: {question}")
    try:
        answer = generate_text(DISH_SYSTEM, user_prompt, max_tokens=512, history=convo)
        tr.gemini(answer).result(answer).finish()
        return answer
    except GeminiError as exc:
        answer = _mock_dish_answer(d, question)
        tr.mock(f"GeminiError: {exc}").result(answer).finish()
        return answer


# --------------------------------------------------------------------------
# Feature 3 — refine my picks
# --------------------------------------------------------------------------

def refine(picked_ids: list[str], question: str, party_size: int, session_id: str | None = None,
           history: list[dict] | None = None) -> str:
    tr = trace.start("refine", session_id, {
        "picked_ids": picked_ids, "question": question, "party_size": party_size,
        "history_len": len(history or []),
    })
    picked = [menu.get_dish(i) for i in picked_ids if menu.get_dish(i)]
    if not picked:
        answer = "Select a few dishes first and I'll help you balance the order."
        tr.mock("no valid picked dishes").result(answer).finish()
        return answer
    if config.MOCK_MODE:
        answer = _mock_refine(picked, question, party_size)
        tr.mock("MOCK_MODE on (no API key)").result(answer).finish()
        return answer
    context = {
        "party_size": party_size,
        "picked": [menu.compact(d) for d in picked],
        "available_menu": [menu.compact(d) for d in menu.available_dishes()],
    }
    # The picks + available menu lead the conversation as context, then this
    # session's prior turns, then the current question last — so follow-ups like
    # "what did I ask before?" or "list my picks" stay grounded.
    context_block = f"Selection context for this conversation:\n{json.dumps(context, ensure_ascii=False)}"
    convo = [{"role": "user", "text": context_block}] + _clean_history(history)
    user_prompt = question or "Is this a good, balanced order for us?"
    tr.prompt(REFINE_SYSTEM, f"{context_block}\n\n[history: {len(convo) - 1} turns]\n\nDiner question: {user_prompt}")
    try:
        answer = generate_text(REFINE_SYSTEM, user_prompt, max_tokens=600, history=convo)
        tr.gemini(answer).result(answer).finish()
        return answer
    except GeminiError as exc:
        answer = _mock_refine(picked, question, party_size)
        tr.mock(f"GeminiError: {exc}").result(answer).finish()
        return answer


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

    # Variety scales smoothly with the group size (a deterministic stand-in for
    # the LLM's reasoning): roughly one main per ~2 diners, with starters,
    # desserts and drinks each given a proportional number of DIFFERENT options
    # so a big table never ends up with one lone drink or dessert. Capped so we
    # don't overflow a card, floored at 1 where the course applies.
    n_main = max(1, math.ceil(party_size / 2))
    n_start = max(1, round(party_size / 3))
    n_dess = max(1, round(party_size / 3))
    n_drink = max(1, round(party_size / 3))
    n_main, n_start, n_dess, n_drink = min(n_main, 5), min(n_start, 4), min(n_dess, 4), min(n_drink, 4)
    if party_size <= 1:  # a solo diner: a dish or two, not a spread
        n_main, n_start, n_dess, n_drink = 1, 0, 0, 1

    cap = menu.budget_cap(filters.get("budget"))

    def fit_budget(items):
        """Drop the priciest items until the total is within the budget cap,
        keeping at least one dish so a combo is never empty."""
        kept = list(items)
        while kept and sum(p["price"] for p in kept) > cap and len(kept) > 1:
            # remove the single most expensive item
            kept.remove(max(kept, key=lambda p: p["price"]))
        return kept

    n_individual = min(6, max(4, party_size))
    individual = [{**_dish_card(d), "why": why(d)} for d in ranked[:n_individual]]
    for dr in drinks[:1]:
        individual.append({**_dish_card(dr), "why": "A refreshing drink to start."})

    def by_course(c):
        return [d for d in ranked if d["course"] == c]

    def take(seq, start, count):
        """Pick `count` items beginning at offset `start`, wrapping if short."""
        if not seq or count <= 0:
            return []
        return [seq[(start + k) % len(seq)] for k in range(min(count, len(seq)))]

    combos = []
    styles = [("The Comfort Spread", "Rich, familiar and easy to love"),
              ("Light & Fresh", "Lighter on the palate, nothing too heavy"),
              ("Chef's Adventure", "Bolder, more chef-driven flavours")]
    for i, (title, sub) in enumerate(styles):
        if full:
            picks = take(by_course("Starter"), i, n_start) \
                + take(by_course("Main"), i, n_main) \
                + take(by_course("Dessert"), i, n_dess)
        else:
            picks = take(ranked, i * 2, max(1, n_main))
        # de-dup within a combo while preserving order
        seen, picks = set(), [p for p in picks if not (p["id"] in seen or seen.add(p["id"]))]
        if drinks:
            picks = picks + take(drinks, i, n_drink)
        # Keep the whole combo total within the diner's budget ceiling.
        picks = fit_budget(picks)
        if not picks:
            continue
        big = party_size >= 7
        tail = " Order a couple of portions of the popular dishes for the group." if big else ""
        combos.append({
            "title": title,
            "why": f"{sub} — built for your party of {party_size}.{tail}",
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
