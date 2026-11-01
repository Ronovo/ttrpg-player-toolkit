"""The toolkit's server: it serves the built site, and adds portfolio login, each account's own dice sets and its
character sheet."""
import os
from pathlib import Path

from flask import Flask, send_from_directory
from ronovo_portfolio_auth import portfolio_sso

from server import dice, login, sheet, storage

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
COVERAGE = ROOT / "coverage"
YEAR = 365 * 24 * 60 * 60


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.update(
        SECRET_KEY=os.environ.get("TOOLKIT_SECRET_KEY") or os.urandom(24).hex(),
        DATA_DIR=os.environ.get("DATA_DIR", "data"),
        SESSION_COOKIE_SECURE=os.environ.get("SECURE_COOKIES") == "1",
        SESSION_COOKIE_SAMESITE="Lax",
        MAX_CONTENT_LENGTH=max(dice.MAX_REQUEST, sheet.MAX_REQUEST),
        PORTFOLIO_LOGIN=portfolio_sso.enabled(),
    )
    if config:
        app.config.update(config)
    storage.add_error_handlers(app)
    login.add_routes(app)
    dice.add_routes(app)
    sheet.add_routes(app)
    add_site(app)
    return app


def add_site(app: Flask) -> None:
    """The built site from dist/, as nginx served it before, and the coverage reports."""
    @app.get("/")
    def home():
        response = send_from_directory(DIST, "index.html")
        response.headers["Cache-Control"] = "no-cache"
        return response

    @app.get("/assets/<path:filename>")
    def assets(filename):
        return send_from_directory(DIST / "assets", filename, max_age=YEAR)

    @app.get("/<path:filename>")
    def public(filename):
        return send_from_directory(DIST, filename)

    @app.get("/coverage/", defaults={"path": ""}, strict_slashes=True)
    @app.get("/coverage/<path:path>")
    def coverage(path):
        if not path or path.endswith("/"):
            path += "index.html"
        return send_from_directory(COVERAGE, path)
