import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import server
from tests.python.helpers import make_app


class SiteTests(unittest.TestCase):
    def setUp(self):
        site = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(site.cleanup)
        dist = Path(site.name) / "dist"
        (dist / "assets").mkdir(parents=True)
        (dist / "index.html").write_text("<h1>Toolkit</h1>")
        (dist / "assets" / "index-abc.js").write_text("console.log(1)")
        (dist / "dice").mkdir()
        (dist / "dice" / "base.glb").write_bytes(b"glTF")
        coverage = Path(site.name) / "coverage" / "js"
        coverage.mkdir(parents=True)
        (coverage.parent / "index.html").write_text("reports")
        (coverage / "index.html").write_text("js report")
        for name, path in (("DIST", dist), ("COVERAGE", coverage.parent)):
            patch = mock.patch.object(server, name, path)
            patch.start()
            self.addCleanup(patch.stop)
        self.client = make_app(self).test_client()

    def fetch(self, path):
        """Status, body and Cache-Control of a page, with the file it came from closed again."""
        with self.client.get(path) as response:
            return response.status_code, response.data, response.headers.get("Cache-Control", "")

    def test_serves_the_built_site(self):
        self.assertEqual(self.fetch("/"), (200, b"<h1>Toolkit</h1>", "no-cache"))
        status, body, caching = self.fetch("/assets/index-abc.js")
        self.assertEqual((status, body), (200, b"console.log(1)"))
        self.assertIn("max-age=31536000", caching)
        self.assertEqual(self.fetch("/dice/base.glb")[:2], (200, b"glTF"))
        self.assertEqual(self.fetch("/dice/missing.glb")[0], 404)

    def test_serves_the_coverage_reports(self):
        self.assertEqual(self.fetch("/coverage/")[1], b"reports")
        self.assertEqual(self.fetch("/coverage/js/")[1], b"js report")
        self.assertEqual(self.fetch("/coverage/js/index.html")[1], b"js report")
        self.assertEqual(self.fetch("/coverage")[0], 308)

    def test_data_folder_comes_from_the_environment(self):
        with mock.patch.dict(os.environ, {"DATA_DIR": "elsewhere", "SECURE_COOKIES": "1", "TOOLKIT_SECRET_KEY": "k"}):
            app = server.create_app()
        self.assertEqual((app.config["DATA_DIR"], app.config["SESSION_COOKIE_SECURE"], app.secret_key), ("elsewhere", True, "k"))
