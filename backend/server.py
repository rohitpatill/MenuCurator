"""Flask application entry point.

Run:  python app.py   (or)   flask --app app run
"""
from __future__ import annotations

from flask import Flask
from flask_cors import CORS

import config
from app.routes import api


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, origins=config.CORS_ORIGINS)
    app.register_blueprint(api, url_prefix="/api")

    @app.get("/")
    def index():
        return {
            "name": f"{config.RESTAURANT_NAME} AI Menu API",
            "mock_mode": config.MOCK_MODE,
            "model": config.GEMINI_MODEL,
            "endpoints": ["/api/health", "/api/menu", "/api/recommend", "/api/dish/<id>/ask", "/api/refine"],
        }

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
