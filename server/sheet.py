"""A logged-in account's character sheet: one PDF, kept as uploaded, and the values typed into its form fields."""
import json
import secrets
import time
from pathlib import PurePath

from flask import Flask, abort, jsonify, request, send_from_directory

from server.login import account, check_same_site
from server.storage import Refused, folder, query

MAX_SHEET = 20 * 1024 * 1024
MAX_VALUES = 512 * 1024
MAX_REQUEST = MAX_SHEET + 64 * 1024
MAX_NAME = 120
DEFAULT_NAME = "character-sheet.pdf"
# The PDF format allows a little junk before its header, so it is looked for in the first kilobyte.
HEADER = b"%PDF-"
HEADER_WINDOW = 1024


def logged_in() -> str:
    owner = account()
    if owner is None:
        abort(401)
    return owner


def stored():
    """The logged-in account's sheet; 404 when it has none."""
    row = query("SELECT * FROM sheets WHERE account = ?", (logged_in(),), one=True)
    if row is None:
        abort(404)
    return row


def sheet_json(row) -> dict:
    return {"id": row["id"], "name": row["name"], "size": row["size"], "values": json.loads(row["field_values"])}


def file_name(uploaded: str) -> str:
    """The name the sheet downloads under: the uploaded file's own name, ending in .pdf."""
    name = PurePath(uploaded.replace("\\", "/")).name.strip()
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    return name if len(name) <= MAX_NAME and name != ".pdf" else DEFAULT_NAME


def remove_file(row) -> None:
    (folder("sheets") / f"{row['id']}.pdf").unlink(missing_ok=True)


def upload():
    owner = logged_in()
    check_same_site()
    uploaded = request.files.get("file")
    if uploaded is None:
        raise Refused("Choose a PDF to upload.")
    data = uploaded.read()
    if len(data) > MAX_SHEET:
        raise Refused(f"The PDF is too big. {MAX_SHEET // (1024 * 1024)} MB is the most.")
    if HEADER not in data[:HEADER_WINDOW]:
        raise Refused("That file is not a PDF.")
    old = query("SELECT * FROM sheets WHERE account = ?", (owner,), one=True)
    if old is not None:
        remove_file(old)
    sheet_id = secrets.token_hex(8)
    (folder("sheets") / f"{sheet_id}.pdf").write_bytes(data)
    query("INSERT OR REPLACE INTO sheets VALUES (?, ?, ?, ?, ?, ?)",
          (owner, sheet_id, file_name(uploaded.filename or ""), len(data), "{}", time.time()))
    return jsonify(sheet=sheet_json(stored()))


def save_values():
    check_same_site()
    row = stored()
    text = request.get_data(as_text=True)
    if len(text.encode()) > MAX_VALUES:
        raise Refused("The sheet's values are too big to save.")
    try:
        values = json.loads(text)
    except ValueError:
        values = None
    if not isinstance(values, dict):
        raise Refused("The sheet's values could not be read.")
    query("UPDATE sheets SET field_values = ?, updated = ? WHERE account = ?",
          (json.dumps(values), time.time(), row["account"]))
    return "", 204


def add_routes(app: Flask) -> None:
    @app.get("/api/sheet")
    def sheet():
        row = query("SELECT * FROM sheets WHERE account = ?", (logged_in(),), one=True)
        response = jsonify(sheet=sheet_json(row) if row else None)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/sheet/file")
    def sheet_file():
        row = stored()
        response = send_from_directory(folder("sheets"), f"{row['id']}.pdf", mimetype="application/pdf")
        response.headers["Cache-Control"] = "no-store"
        return response

    app.put("/api/sheet", endpoint="upload_sheet")(upload)
    app.put("/api/sheet/values", endpoint="save_sheet_values")(save_values)

    @app.delete("/api/sheet")
    def delete_sheet():
        check_same_site()
        row = stored()
        remove_file(row)
        query("DELETE FROM sheets WHERE account = ?", (row["account"],))
        return "", 204
