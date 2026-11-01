import base64
import io
import json
import os
import tempfile
import time
import unittest
from unittest import mock
from urllib.parse import parse_qs, urlsplit

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from flask import Flask

from server import create_app
from server.glb import CHUNK, DICE, HEADER, JSON_CHUNK, MAGIC, canonical_bounds
from server.login import SAME_SITE_HEADER, SAME_SITE_VALUE

NO_PORTFOLIO = {"PORTFOLIO_SSO_URL": "", "PORTFOLIO_SSO_PUBLIC_KEY": ""}
SAME_SITE = {SAME_SITE_HEADER: SAME_SITE_VALUE}

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PUBLIC_KEY = base64.b64encode(KEY.public_key().public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)).decode()

with open("src/dice3d/dice.json", encoding="utf-8") as shapes_file:
    BOUNDS = canonical_bounds(json.load(shapes_file)["dice"])

# A tiny WebP: the RIFF header is all the server looks at.
WEBP = "data:image/webp;base64," + base64.b64encode(b"RIFF\x00\x00\x00\x00WEBPVP8 ").decode()


def issue(sub="1", name="ronovo", aud="ttrpg-toolkit"):
    now = int(time.time())
    return jwt.encode({"iss": "portfolio", "aud": aud, "sub": sub, "name": name, "iat": now, "exp": now + 300},
                      KEY, algorithm="RS256")


def make_app(test: unittest.TestCase, portfolio: bool = False, **config) -> Flask:
    """An app with its own temporary data folder. Portfolio login is on only when asked for, whatever the shell
    running the tests has set."""
    data_dir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    test.addCleanup(data_dir.cleanup)
    env = mock.patch.dict(os.environ, {"PORTFOLIO_SSO_URL": "http://portfolio.test",
                                       "PORTFOLIO_SSO_PUBLIC_KEY": PUBLIC_KEY} if portfolio else NO_PORTFOLIO)
    env.start()
    test.addCleanup(env.stop)
    return create_app({"TESTING": True, "SECRET_KEY": "test", "DATA_DIR": data_dir.name, **config})


def log_in(client, sub="1", token=None, name="ronovo"):
    query = parse_qs(urlsplit(client.get("/sso/login").location).query)
    assert query["app"] == ["ttrpg-toolkit"]
    return client.post("/sso/callback", data={"state": query["state"][0], "token": token or issue(sub, name)})


def make_glb(gltf, version=2, chunk_type=JSON_CHUNK, trailing=b"") -> bytes:
    """A .glb holding this glTF JSON (or raw bytes) and nothing else."""
    body = gltf if isinstance(gltf, bytes) else json.dumps(gltf).encode()
    body += b" " * (-len(body) % 4)
    chunk = CHUNK.pack(len(body), chunk_type) + body + trailing
    return HEADER.pack(MAGIC, version, HEADER.size + len(chunk)) + chunk


def dice_gltf(**changes) -> dict:
    """A glTF with the seven dice at the toolkit's bounds. `changes` replace a die's node by name."""
    nodes = [{"name": die, "mesh": i, "translation": [i * 3.2, 0, 0]} for i, die in enumerate(DICE)]
    meshes = [{"name": die, "primitives": [{"attributes": {"POSITION": i}}]} for i, die in enumerate(DICE)]
    accessors = [{"min": list(BOUNDS[die][0]), "max": list(BOUNDS[die][1]), "count": 8} for die in DICE]
    for die, node in changes.items():
        nodes[DICE.index(die)] = node
    return {"asset": {"version": "2.0"}, "nodes": nodes, "meshes": meshes, "accessors": accessors}


def good_model() -> bytes:
    return make_glb(dice_gltf())


def upload(client, label="Seafoam", model=None, filename="seafoam.glb", thumbnail=None, headers=SAME_SITE):
    data = {"label": label, "model": (io.BytesIO(model if model is not None else good_model()), filename)}
    if thumbnail is not None:
        data["thumbnail"] = thumbnail
    return client.post("/api/dice", data=data, headers=headers, content_type="multipart/form-data")
