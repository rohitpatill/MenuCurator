"""Menu data access. Loads menu.json once and exposes lookup + filtering.

The filtering here mirrors the chip filters in the UI. It does the cheap,
deterministic narrowing (diet, course, budget, etc.) BEFORE we hand a compact
candidate list to Gemini, so the model only reasons over relevant, in-stock
dishes — never something sold out or outside the diner's constraints.
"""
from __future__ import annotations

import json
from pathlib import Path

_MENU_PATH = Path(__file__).resolve().parent / "menu.json"

with _MENU_PATH.open(encoding="utf-8") as _f:
    _DATA = json.load(_f)

DISHES: list[dict] = _DATA["dishes"]
RESTAURANT = _DATA.get("restaurant", "Vermillion")
TAGLINE = _DATA.get("tagline", "Kitchen & Bar")
CURRENCY = _DATA.get("currency", "INR")

_BY_ID = {d["id"]: d for d in DISHES}

_SPICE_RANK = {"Mild": 1, "Medium": 2, "Spicy": 3}
_BUDGET_CAP = {
    "Up to ₹1000": 1000,
    "Up to ₹2000": 2000,
    "Up to ₹5000": 5000,
    "Up to ₹10,000": 10000,
    "No limits": float("inf"),
}
_COURSE_MAP = {"Starters": "Starter", "Main course": "Main", "Desserts": "Dessert"}


def get_dish(dish_id: str) -> dict | None:
    return _BY_ID.get(dish_id)


def available_dishes() -> list[dict]:
    return [d for d in DISHES if d.get("available", True)]


def apply_filters(filters: dict, extras: dict | None = None) -> list[dict]:
    """Deterministic pre-filter. `filters` keys: budget, veg, party, drinks,
    course, cuisine, spice. `extras` keys (booleans): light, hearty, nut, dairy,
    gluten, nog, best, chef, hot."""
    extras = extras or {}
    f = filters
    out = available_dishes()

    # Diet
    veg = f.get("veg")
    if veg == "Veg":
        out = [d for d in out if d["diet"] == "veg"]
    elif veg == "Non-veg":
        out = [d for d in out if d["diet"] == "nonveg"]
    elif veg == "Jain":
        out = [d for d in out if d.get("jain")]

    # Course (drinks are handled by the drinks filter, not the course filter)
    course = f.get("course")
    if course and course != "Full meal":
        mapped = _COURSE_MAP.get(course)
        if mapped:
            out = [d for d in out if d["course"] == mapped]

    # Cuisine
    cuisine = f.get("cuisine")
    if cuisine and cuisine != "Any":
        out = [d for d in out if d["cuisine"] == cuisine]

    # Spice ceiling (skip dishes spicier than chosen; dishes with no spice stay)
    spice = f.get("spice")
    if spice and spice in _SPICE_RANK:
        cap = _SPICE_RANK[spice]
        out = [d for d in out if not d.get("spice") or _SPICE_RANK.get(d["spice"], 0) <= cap]

    # Budget
    cap = _BUDGET_CAP.get(f.get("budget"), float("inf"))
    out = [d for d in out if d["price"] <= cap]

    # Extras
    if extras.get("best"):
        out = [d for d in out if d.get("tag") == "bestseller"]
    if extras.get("chef"):
        out = [d for d in out if d.get("tag") == "chefspecial"]
    if extras.get("nog"):
        out = [d for d in out if d.get("nog")]
    for allergen in ("nut", "dairy", "gluten"):
        if extras.get(allergen):
            out = [d for d in out if allergen not in d.get("allergens", [])]

    return out


def drink_candidates(drinks_filter: str) -> list[dict]:
    """Return drink dishes matching the drinks chip selection."""
    if drinks_filter in (None, "None"):
        return []
    avail = available_dishes()
    if drinks_filter == "Mocktails":
        return [d for d in avail if d["type"] == "mocktail"]
    if drinks_filter == "Cocktails":
        return [d for d in avail if d["type"] == "cocktail"]
    if drinks_filter == "Both":
        return [d for d in avail if d["type"] in ("mocktail", "cocktail")]
    return []


def compact(dish: dict) -> dict:
    """Slim dish representation for the LLM prompt (keeps tokens down)."""
    return {
        "id": dish["id"],
        "name": dish["name"],
        "cuisine": dish["cuisine"],
        "course": dish["course"],
        "diet": dish["diet"],
        "spice": dish.get("spice"),
        "price": dish["price"],
        "serves": dish["serves"],
        "pieces": dish.get("pieces"),
        "tag": dish.get("tag"),
        "allergens": dish.get("allergens", []),
    }
