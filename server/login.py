"""Portfolio login: the shared package's /sso routes, who is logged in, logging out, and what the page is told."""
from flask import Flask, abort, current_app, jsonify, redirect, request, session
from ronovo_portfolio_auth import portfolio_sso

APP_ID = "ttrpg-toolkit"
# Requests that change something must carry this header. A form on another site cannot add it, and a script
# there cannot either without a CORS preflight this server never grants.
SAME_SITE_HEADER = "X-Requested-With"
SAME_SITE_VALUE = "fetch"


def account() -> str | None:
    """The id of the portfolio account logged in on this session, or None."""
    return session.get("portfolio_sub") if current_app.config["PORTFOLIO_LOGIN"] else None


def check_same_site() -> None:
    if request.headers.get(SAME_SITE_HEADER) != SAME_SITE_VALUE:
        abort(403)


def logged_in(portfolio_account, next_path):
    session.permanent = True
    session["portfolio_sub"] = portfolio_account["sub"]
    session["portfolio_user"] = portfolio_account["username"]
    return redirect(next_path or "/")


def refused(reason):
    session["login_error"] = portfolio_sso.LOGIN_MESSAGES[reason]
    return redirect("/")


def add_routes(app: Flask) -> None:
    enabled = app.config["PORTFOLIO_LOGIN"]
    if enabled:
        portfolio_sso.add_flask_routes(app, APP_ID, logged_in, refused)

    @app.get("/api/me")
    def me():
        if not enabled:
            return jsonify(enabled=False)
        response = jsonify(enabled=True, username=session.get("portfolio_user"),
                           portfolioUrl=portfolio_sso.portfolio_url(), loginError=session.pop("login_error", None))
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.post("/api/logout")
    def logout():
        check_same_site()
        session.pop("portfolio_sub", None)
        session.pop("portfolio_user", None)
        return "", 204
