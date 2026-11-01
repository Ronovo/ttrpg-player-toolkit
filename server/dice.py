"""A logged-in account's own dice sets: a .glb model each, with an optional thumbnail, kept under DATA_DIR."""
import base64
import json
import re
import secrets
import time
from pathlib import Path

from flask import Flask, abort, current_app, jsonify, request, send_from_directory

from server import glb
from server.login import account, check_same_site
from server.storage import Refused, query
from server.storage import folder as data_folder

MAX_MODEL = 12 * 1024 * 1024
MAX_THUMBNAIL = 300 * 1024
MAX_REQUEST = MAX_MODEL + MAX_THUMBNAIL + 64 * 1024
MAX_SETS = 10
MAX_LABEL = 40
YEAR = 365 * 24 * 60 * 60
# The pictures the page may send as a thumbnail: the file extension and the first bytes of each kind.
THUMBNAIL_TYPES = {
    "image/webp": ("webp", b"RIFF"),
    "image/png": ("png", b"\x89PNG"),
    "image/jpeg": ("jpg", b"\xff\xd8\xff"),
}
MIME_OF = {extension: mime for mime, (extension, _) in THUMBNAIL_TYPES.items()}
DATA_URL = re.compile(r"data:(image/[a-z]+);base64,(.+)", re.S)
SHAPES_FILE = Path(__file__).resolve().parent.parent / "src" / "dice3d" / "dice.json"


def folder() -> Path:
    return data_folder("dice")


def set_json(row) -> dict:
    return {"id": row["id"], "label": row["label"], "thumbnail": row["thumbnail"] is not None}


def owned(set_id: str):
    """The set with this id when it belongs to the logged-in account; otherwise 404."""
    row = query("SELECT * FROM sets WHERE id = ? AND account = ?", (set_id, account()), one=True)
    if row is None:
        abort(404)
    return row


def decode_thumbnail(text: str | None):
    """The bytes and file extension of a thumbnail sent as a data URL, or None when none was sent."""
    if not text:
        return None
    match = DATA_URL.fullmatch(text)
    kind = THUMBNAIL_TYPES.get(match.group(1)) if match else None
    if kind is None:
        raise Refused("The screenshot must be a WebP, PNG or JPEG picture.")
    extension, magic = kind
    try:
        data = base64.b64decode(match.group(2), validate=True)
    except ValueError:
        data = b""
    if not data.startswith(magic):
        raise Refused("The screenshot could not be read.")
    if len(data) > MAX_THUMBNAIL:
        raise Refused("The screenshot is too big.")
    return data, extension


def upload():
    owner = account()
    if owner is None:
        abort(401)
    check_same_site()
    label = request.form.get("label", "").strip()
    if not label or len(label) > MAX_LABEL:
        raise Refused(f"Give the set a name of up to {MAX_LABEL} characters.")
    model = request.files.get("model")
    if model is None or not model.filename.lower().endswith(".glb"):
        raise Refused("Choose a .glb model exported from Blender.")
    data = model.read()
    if len(data) > MAX_MODEL:
        raise Refused(f"The model is too big. {MAX_MODEL // (1024 * 1024)} MB is the most.")
    glb.check(data, current_app.config["DICE_BOUNDS"])
    if query("SELECT COUNT(*) AS n FROM sets WHERE account = ?", (owner,), one=True)["n"] >= MAX_SETS:
        raise Refused(f"You already have {MAX_SETS} sets. Delete one first.")
    thumbnail = decode_thumbnail(request.form.get("thumbnail"))
    set_id = secrets.token_hex(8)
    extension = None
    (folder() / f"{set_id}.glb").write_bytes(data)
    if thumbnail:
        picture, extension = thumbnail
        (folder() / f"{set_id}.{extension}").write_bytes(picture)
    query("INSERT INTO sets VALUES (?, ?, ?, ?, ?)", (set_id, owner, label, extension, time.time()))
    return jsonify(set_json(owned(set_id))), 201


def add_routes(app: Flask) -> None:
    app.config.setdefault("DICE_BOUNDS", glb.canonical_bounds(json.loads(SHAPES_FILE.read_text())["dice"]))

    @app.errorhandler(glb.ModelError)
    def bad_model(error):
        return jsonify(error=str(error)), 400

    @app.get("/api/dice")
    def sets():
        rows = query("SELECT * FROM sets WHERE account = ? ORDER BY created", (account(),))
        return jsonify(sets=[set_json(row) for row in rows])

    app.post("/api/dice", endpoint="upload_set")(upload)

    @app.get("/api/dice/<set_id>.glb")
    def model(set_id):
        owned(set_id)
        return send_from_directory(folder(), f"{set_id}.glb", mimetype="model/gltf-binary", max_age=YEAR)

    @app.get("/api/dice/<set_id>/thumb")
    def thumbnail(set_id):
        row = owned(set_id)
        if row["thumbnail"] is None:
            abort(404)
        return send_from_directory(folder(), f"{set_id}.{row['thumbnail']}", mimetype=MIME_OF[row["thumbnail"]],
                                   max_age=YEAR)

    @app.delete("/api/dice/<set_id>")
    def delete(set_id):
        check_same_site()
        row = owned(set_id)
        (folder() / f"{set_id}.glb").unlink(missing_ok=True)
        if row["thumbnail"]:
            (folder() / f"{set_id}.{row['thumbnail']}").unlink(missing_ok=True)
        query("DELETE FROM sets WHERE id = ?", (set_id,))
        return "", 204
