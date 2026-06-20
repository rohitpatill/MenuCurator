"""Flask routes — the API the React frontend calls.

Endpoints:
  GET  /api/health              -> liveness + mode
  GET  /api/menu                -> restaurant info + full available menu (grouped)
  POST /api/recommend           -> Feature 2: individual picks + 3 combos
  POST /api/dish/<id>/ask       -> Feature 1: Q&A about a dish
  POST /api/refine              -> Feature 3: refine a chosen selection
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request

import config

from . import menu, service

api = Blueprint("api", __name__)


@api.get("/health")
def health():
    return jsonify({"status": "ok", "mock_mode": config.MOCK_MODE, "model": config.GEMINI_MODEL})


@api.get("/menu")
def get_menu():
    """Full available menu, grouped by cuisine then course, for the browse/ask
    and pick screens."""
    avail = menu.available_dishes()
    return jsonify(
        {
            "restaurant": menu.RESTAURANT,
            "tagline": menu.TAGLINE,
            "currency": menu.CURRENCY,
            "dishes": avail,
        }
    )


@api.post("/recommend")
def recommend():
    body = request.get_json(silent=True) or {}
    filters = body.get("filters", {})
    extras = body.get("extras", {})
    note = body.get("note", "")
    party_size = int(body.get("party_size", 3) or 3)
    result = service.recommend(filters, extras, note, party_size)
    return jsonify(result)


@api.post("/dish/<dish_id>/ask")
def ask_dish(dish_id: str):
    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400
    answer = service.ask_dish(dish_id, question)
    return jsonify({"answer": answer})


@api.post("/refine")
def refine():
    body = request.get_json(silent=True) or {}
    picked_ids = body.get("picked_ids", [])
    question = (body.get("question") or "").strip()
    party_size = int(body.get("party_size", 3) or 3)
    answer = service.refine(picked_ids, question, party_size)
    return jsonify({"answer": answer})
