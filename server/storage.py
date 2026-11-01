"""Where the server keeps what accounts upload: folders under DATA_DIR, and one SQLite database with a table for
each kind of upload."""
import sqlite3
from contextlib import closing
from pathlib import Path

from flask import Flask, current_app, jsonify

DATABASE = "toolkit.db"
SCHEMAS = (
    """CREATE TABLE IF NOT EXISTS sets (
        id TEXT PRIMARY KEY, account TEXT NOT NULL, label TEXT NOT NULL, thumbnail TEXT, created REAL NOT NULL)""",
    """CREATE TABLE IF NOT EXISTS sheets (
        account TEXT PRIMARY KEY, id TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL,
        field_values TEXT NOT NULL, updated REAL NOT NULL)""",
)


class Refused(ValueError):
    """Why an upload was turned down, in words for the player."""


def folder(name: str) -> Path:
    path = Path(current_app.config["DATA_DIR"]) / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def query(sql: str, params: tuple = (), one: bool = False):
    data_dir = Path(current_app.config["DATA_DIR"])
    data_dir.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(data_dir / DATABASE)) as db, db:
        db.row_factory = sqlite3.Row
        for schema in SCHEMAS:
            db.execute(schema)
        rows = db.execute(sql, params).fetchall()
    return (rows[0] if rows else None) if one else rows


def add_error_handlers(app: Flask) -> None:
    @app.errorhandler(Refused)
    def refused(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(413)
    def too_big(_):
        return jsonify(error="That upload is too big."), 413
