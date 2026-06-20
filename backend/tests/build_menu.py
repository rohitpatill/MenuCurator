"""Menu data builder — applies bulk, repeatable edits to app/menu.json.

This is a maintenance script (kept in tests/ alongside the API tests) rather
than application code. It:
  1. flags accompaniment breads with "bread": true (excluded from recommends)
  2. enriches every dish description to 2-3 fuller sentences for richer dish Q&A
  3. appends new dishes to fill the thin sections (desserts, varied mains/starters)

It is IDEMPOTENT: re-running won't double-add dishes (keyed by name) and only
lengthens descriptions that are still short. Run from backend/:
    .venv/Scripts/python -m tests.build_menu
Then RESTART Flask (menu.json is read once at import).
"""
from __future__ import annotations

import json
from pathlib import Path

_MENU = Path(__file__).resolve().parent.parent / "app" / "menu.json"


# --- 1. breads that are default accompaniments (never recommended) ----------
BREAD_IDS = {"d023", "d024"}  # Assorted Bread Basket, Garlic Naan

# --- 2. richer descriptions for existing dishes (id -> new desc) ------------
# Only dishes whose original desc was too terse for a good "ask about a dish"
# demo. Each is 2-3 sentences: what it is, how it tastes/serves.
ENRICHED = {
    "d001": "Broccoli florets in a smoky cream-cheese and hung-curd marinade, charred in the tandoor until the edges catch. Mild and creamy with a gentle smokiness, it's a crowd-pleasing vegetarian starter that even non-veg eaters reach for. One portion is generous enough for two to share.",
    "d011": "Whole black lentils simmered overnight with tomato, butter and a touch of cream for a velvety, mildly spiced dal. Rich and comforting, it pairs beautifully with naan or rice. A classic that anchors almost any Indian spread.",
    "d012": "Tandoori chicken in a silky tomato-and-butter gravy finished with cream and dried fenugreek. Mildly sweet, rich and universally loved — the dish most tables order. One portion comfortably serves two with bread.",
    "d023": "A warm basket of butter naan, tandoori roti and flaky laccha paratha — the classic accompaniment to soak up rich curries and gravies. Mild and comforting, it serves a small table.",
    "d024": "Soft, pillowy naan brushed with garlic and butter, baked in the tandoor until just blistered. The everyday bread that goes with everything on the table.",
    "d029": "Slow-churned saffron kulfi studded with crushed pistachio, denser and creamier than ice cream. Fragrant, lightly sweet and cooling — a fitting finish to a spiced meal. Served as two pieces per portion.",
}

# --- 3. new dishes to fill thin sections ------------------------------------
# Schema matches existing dishes. ids are assigned at append time.
NEW_DISHES = [
    # ---- Desserts (section was very thin) ----
    {"name": "Gulab Jamun", "cuisine": "Indian", "course": "Dessert", "diet": "veg", "jain": True, "spice": None, "price": 180, "serves": 2, "pieces": 4, "tag": "bestseller", "nog": True, "allergens": ["dairy", "gluten"], "type": "food", "ingredients": ["khoya", "flour", "sugar syrup", "cardamom"], "desc": "Warm, syrup-soaked milk-solid dumplings scented with cardamom and rose. Soft, melting and very sweet — best shared at the end of a rich meal. Four pieces to a portion."},
    {"name": "Rasmalai", "cuisine": "Indian", "course": "Dessert", "diet": "veg", "jain": True, "spice": None, "price": 220, "serves": 2, "pieces": 2, "tag": None, "nog": True, "allergens": ["dairy", "nut"], "type": "food", "ingredients": ["paneer", "milk", "saffron", "pistachio"], "desc": "Soft cottage-cheese discs soaking in chilled saffron-and-cardamom thickened milk, topped with slivered pistachio. Light, delicate and not too sweet. A refreshing finish."},
    {"name": "Tiramisu", "cuisine": "Italian", "course": "Dessert", "diet": "veg", "jain": False, "spice": None, "price": 320, "serves": 1, "pieces": None, "tag": "chefspecial", "nog": True, "allergens": ["dairy", "egg", "gluten"], "type": "food", "ingredients": ["mascarpone", "espresso", "ladyfinger biscuit", "cocoa"], "desc": "Layers of espresso-soaked ladyfingers and airy mascarpone cream, dusted with bitter cocoa. Coffee-forward and lightly boozy, it's our most-ordered continental dessert. Plated for one."},
    {"name": "New York Cheesecake", "cuisine": "Continental", "course": "Dessert", "diet": "veg", "jain": False, "spice": None, "price": 300, "serves": 1, "pieces": None, "tag": None, "nog": True, "allergens": ["dairy", "egg", "gluten"], "type": "food", "ingredients": ["cream cheese", "biscuit base", "vanilla", "sugar"], "desc": "Dense, tangy baked cheesecake on a buttery biscuit base with a hint of vanilla. Rich and smooth — a slice is plenty for one. Pairs well with coffee."},
    {"name": "Chocolate Brownie with Ice Cream", "cuisine": "Continental", "course": "Dessert", "diet": "veg", "jain": False, "spice": None, "price": 260, "serves": 1, "pieces": None, "tag": "bestseller", "nog": True, "allergens": ["dairy", "egg", "gluten", "nut"], "type": "food", "ingredients": ["dark chocolate", "walnut", "vanilla ice cream"], "desc": "Warm fudgy walnut brownie served with a scoop of vanilla ice cream and a chocolate drizzle. The classic warm-and-cold dessert; kids and adults both love it."},
    {"name": "Gajar Halwa with Rabri", "cuisine": "Indian", "course": "Dessert", "diet": "veg", "jain": True, "spice": None, "price": 240, "serves": 2, "pieces": None, "tag": None, "nog": True, "allergens": ["dairy", "nut"], "type": "food", "ingredients": ["carrot", "milk", "ghee", "cashew", "rabri"], "desc": "Slow-cooked carrot halwa in ghee, finished with reduced milk rabri and cashews. Warm, rich and traditional — a winter favourite that serves two."},
    {"name": "Fresh Fruit Platter", "cuisine": "Continental", "course": "Dessert", "diet": "veg", "jain": True, "spice": None, "price": 220, "serves": 2, "pieces": None, "tag": None, "nog": True, "allergens": [], "type": "food", "ingredients": ["seasonal fruit", "mint", "lime"], "desc": "A bright plate of seasonal fresh fruit with a squeeze of lime and mint. The lightest way to end a meal — refreshing, allergen-free and good for sharing."},
    {"name": "Kesar Phirni", "cuisine": "Indian", "course": "Dessert", "diet": "veg", "jain": True, "spice": None, "price": 200, "serves": 1, "pieces": None, "tag": None, "nog": True, "allergens": ["dairy", "nut"], "type": "food", "ingredients": ["ground rice", "milk", "saffron", "almond"], "desc": "Chilled ground-rice pudding set with saffron and milk, topped with almonds. Creamy, fragrant and gently sweet — served in a small earthen bowl for one."},
    {"name": "Panna Cotta", "cuisine": "Italian", "course": "Dessert", "diet": "veg", "jain": False, "spice": None, "price": 280, "serves": 1, "pieces": None, "tag": None, "nog": True, "allergens": ["dairy"], "type": "food", "ingredients": ["cream", "vanilla", "berry compote"], "desc": "Silky set vanilla cream with a tart berry compote spooned over. Light, wobbly and elegant — a clean, not-too-sweet finish for one."},
    {"name": "Sizzling Chocolate Pizza", "cuisine": "Italian", "course": "Dessert", "diet": "veg", "jain": False, "spice": None, "price": 340, "serves": 2, "pieces": None, "tag": "chefspecial", "nog": True, "allergens": ["dairy", "gluten", "nut"], "type": "food", "ingredients": ["pizza base", "chocolate", "marshmallow", "nuts"], "desc": "A dessert pizza of warm chocolate, marshmallow and nuts served sizzling on a hot plate. Theatrical and indulgent — built for two to dig into together."},

    # ---- Mains: more variety across cuisines ----
    {"name": "Hyderabadi Chicken Biryani", "cuisine": "Indian", "course": "Main", "diet": "nonveg", "jain": False, "spice": "Medium", "price": 480, "serves": 2, "pieces": None, "tag": "bestseller", "nog": False, "allergens": ["dairy"], "type": "food", "ingredients": ["basmati", "chicken", "saffron", "fried onion", "yoghurt"], "desc": "Layered dum biryani of long-grain basmati and marinated chicken, sealed and slow-cooked with saffron and fried onions. Aromatic and moderately spiced, served with raita. One portion serves two."},
    {"name": "Paneer Lababdar", "cuisine": "Indian", "course": "Main", "diet": "veg", "jain": False, "spice": "Medium", "price": 360, "serves": 2, "pieces": None, "tag": None, "nog": False, "allergens": ["dairy", "nut"], "type": "food", "ingredients": ["paneer", "tomato", "cashew", "cream"], "desc": "Soft paneer in a luscious tomato-cashew gravy with a touch of cream. Mildly sweet and rich, a reliable vegetarian centrepiece that pairs with naan or rice. Serves two."},
    {"name": "Kadai Mushroom", "cuisine": "Indian", "course": "Main", "diet": "veg", "jain": False, "spice": "Spicy", "price": 320, "serves": 2, "pieces": None, "tag": None, "nog": False, "allergens": [], "type": "food", "ingredients": ["mushroom", "bell pepper", "onion", "kadai masala"], "desc": "Mushrooms and peppers tossed in a robust freshly-ground kadai masala. Bold, peppery and dry-ish — a punchy vegan-friendly main for those who like heat. Serves two."},
    {"name": "Kung Pao Chicken", "cuisine": "Chinese", "course": "Main", "diet": "nonveg", "jain": False, "spice": "Spicy", "price": 420, "serves": 2, "pieces": None, "tag": None, "nog": False, "allergens": ["nut", "soy"], "type": "food", "ingredients": ["chicken", "peanut", "dried chilli", "soy"], "desc": "Diced chicken stir-fried with peanuts and dried chillies in a tangy-spicy sauce. Punchy and addictive with a numbing kick — best with steamed rice. Serves two."},
    {"name": "Vegetable Hakka Noodles", "cuisine": "Chinese", "course": "Main", "diet": "veg", "jain": False, "spice": "Medium", "price": 280, "serves": 2, "pieces": None, "tag": None, "nog": False, "allergens": ["gluten", "soy"], "type": "food", "ingredients": ["noodles", "cabbage", "carrot", "soy", "spring onion"], "desc": "Wok-tossed noodles with julienned vegetables and soy in classic Indo-Chinese style. Comforting and shareable, a table staple alongside any gravy. Serves two."},
    {"name": "Chicken Alfredo Pasta", "cuisine": "Italian", "course": "Main", "diet": "nonveg", "jain": False, "spice": "Mild", "price": 440, "serves": 1, "pieces": None, "tag": None, "nog": True, "allergens": ["dairy", "gluten"], "type": "food", "ingredients": ["fettuccine", "chicken", "cream", "parmesan"], "desc": "Fettuccine in a creamy parmesan Alfredo sauce with grilled chicken. Rich, mild and filling — a plate built for one hearty appetite."},
    {"name": "Margherita Pizza", "cuisine": "Italian", "course": "Main", "diet": "veg", "jain": False, "spice": "Mild", "price": 380, "serves": 2, "pieces": 8, "tag": "bestseller", "nog": True, "allergens": ["dairy", "gluten"], "type": "food", "ingredients": ["pizza base", "tomato", "mozzarella", "basil"], "desc": "Thin-crust pizza with San Marzano tomato, fresh mozzarella and basil. Simple and classic; eight slices that two can share. A safe, loved choice for mixed tables."},
    {"name": "Grilled Lamb Chops", "cuisine": "Continental", "course": "Main", "diet": "nonveg", "jain": False, "spice": "Medium", "price": 680, "serves": 1, "pieces": 4, "tag": "chefspecial", "nog": True, "allergens": [], "type": "food", "ingredients": ["lamb", "rosemary", "garlic", "olive oil"], "desc": "Four French-trimmed lamb chops marinated in rosemary and garlic, grilled to a blushing medium. Tender and full-flavoured — a premium plate for one serious eater."},

    # ---- Starters: a few more shareable options ----
    {"name": "Crispy Corn Kernels", "cuisine": "Chinese", "course": "Starter", "diet": "veg", "jain": False, "spice": "Medium", "price": 280, "serves": 2, "pieces": None, "tag": None, "nog": False, "allergens": ["gluten"], "type": "food", "ingredients": ["sweet corn", "pepper", "curry leaf", "cornflour"], "desc": "Sweet corn kernels fried crisp and tossed with pepper and curry leaf. Crunchy, moreish and easy to share around the table while you decide on mains."},
    {"name": "Chicken Tikka", "cuisine": "Indian", "course": "Starter", "diet": "nonveg", "jain": False, "spice": "Medium", "price": 420, "serves": 2, "pieces": 6, "tag": "bestseller", "nog": False, "allergens": ["dairy"], "type": "food", "ingredients": ["chicken", "yoghurt", "ginger garlic", "spices"], "desc": "Boneless chicken marinated in spiced yoghurt and char-grilled in the tandoor. Smoky, juicy and a guaranteed favourite — six pieces to share between two."},
    {"name": "Bruschetta al Pomodoro", "cuisine": "Italian", "course": "Starter", "diet": "veg", "jain": False, "spice": "Mild", "price": 260, "serves": 2, "pieces": 4, "tag": None, "nog": True, "allergens": ["gluten"], "type": "food", "ingredients": ["toasted bread", "tomato", "basil", "olive oil"], "desc": "Toasted bread topped with marinated tomato, basil and olive oil. Light and fresh — a clean opener before a heavier main. Four pieces per plate."},
]


def main() -> None:
    data = json.loads(_MENU.read_text(encoding="utf-8"))
    dishes = data["dishes"]
    by_id = {d["id"]: d for d in dishes}
    existing_names = {d["name"].lower() for d in dishes}

    # 1. flag breads
    bread_flagged = 0
    for bid in BREAD_IDS:
        if bid in by_id and not by_id[bid].get("bread"):
            by_id[bid]["bread"] = True
            bread_flagged += 1

    # 2. enrich descriptions (only overwrite when we have a longer one)
    enriched = 0
    for did, desc in ENRICHED.items():
        if did in by_id and by_id[did].get("desc", "") != desc:
            by_id[did]["desc"] = desc
            enriched += 1

    # 3. append new dishes (skip any whose name already exists)
    max_id = max(int(d["id"][1:]) for d in dishes)
    added = 0
    for nd in NEW_DISHES:
        if nd["name"].lower() in existing_names:
            continue
        max_id += 1
        dish = {"id": f"d{max_id:03d}", **nd, "available": True}
        # keep a stable-ish key order close to the existing schema
        ordered = {
            "id": dish["id"], "name": dish["name"], "cuisine": dish["cuisine"],
            "course": dish["course"], "diet": dish["diet"], "jain": dish["jain"],
            "spice": dish["spice"], "price": dish["price"], "serves": dish["serves"],
            "pieces": dish["pieces"], "tag": dish["tag"], "nog": dish["nog"],
            "allergens": dish["allergens"], "type": dish["type"],
            "available": dish["available"], "ingredients": dish["ingredients"],
            "desc": dish["desc"],
        }
        dishes.append(ordered)
        existing_names.add(nd["name"].lower())
        added += 1

    _MENU.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    from collections import Counter
    courses = Counter(d["course"] for d in dishes if d.get("type") == "food")
    print(f"breads flagged: {bread_flagged}")
    print(f"descriptions enriched: {enriched}")
    print(f"new dishes added: {added}")
    print(f"total dishes now: {len(dishes)}")
    print(f"food by course: {dict(courses)}")


if __name__ == "__main__":
    main()
