import io
import json
import os
import unittest
from unittest import mock

from server import sheet
from tests.python.helpers import SAME_SITE, log_in, make_app

PDF = b"%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n"


def put_sheet(client, data=PDF, filename="Thorin.pdf", headers=SAME_SITE):
    return client.put("/api/sheet", data={"file": (io.BytesIO(data), filename)}, headers=headers,
                      content_type="multipart/form-data")


def put_values(client, body, headers=SAME_SITE):
    return client.put("/api/sheet/values", data=body, headers=headers)


class LoggedOutTests(unittest.TestCase):
    def test_every_route_needs_a_login(self):
        client = make_app(self, portfolio=True).test_client()
        self.assertEqual(client.get("/api/sheet").status_code, 401)
        self.assertEqual(client.get("/api/sheet/file").status_code, 401)
        self.assertEqual(put_sheet(client).status_code, 401)
        self.assertEqual(put_values(client, "{}").status_code, 401)
        self.assertEqual(client.delete("/api/sheet", headers=SAME_SITE).status_code, 401)

    def test_sheets_are_off_without_portfolio_login(self):
        client = make_app(self).test_client()
        self.assertEqual(client.get("/api/sheet").status_code, 401)


class SheetTests(unittest.TestCase):
    def setUp(self):
        self.app = make_app(self, portfolio=True)
        self.client = self.app.test_client()
        log_in(self.client)

    def sheets_folder(self):
        return os.path.join(self.app.config["DATA_DIR"], "sheets")

    def refusal(self, response):
        self.assertEqual(response.status_code, 400)
        return response.get_json()["error"]

    def test_starts_with_no_sheet(self):
        response = self.client.get("/api/sheet")
        self.assertEqual((response.get_json(), response.headers["Cache-Control"]), ({"sheet": None}, "no-store"))
        self.assertEqual(self.client.get("/api/sheet/file").status_code, 404)
        self.assertEqual(put_values(self.client, "{}").status_code, 404)
        self.assertEqual(self.client.delete("/api/sheet", headers=SAME_SITE).status_code, 404)

    def test_uploads_serves_and_keeps_the_values_for_its_owner_only(self):
        uploaded = put_sheet(self.client).get_json()["sheet"]
        self.assertEqual({key: uploaded[key] for key in ("name", "size", "values")},
                         {"name": "Thorin.pdf", "size": len(PDF), "values": {}})
        with self.client.get("/api/sheet/file") as response:
            self.assertEqual((response.status_code, response.mimetype, response.data), (200, "application/pdf", PDF))
            self.assertEqual(response.headers["Cache-Control"], "no-store")

        values = {"25R": {"value": "Thorin"}, "31R": {"value": True}}
        self.assertEqual(put_values(self.client, json.dumps(values)).status_code, 204)
        self.assertEqual(self.client.get("/api/sheet").get_json()["sheet"]["values"], values)

        other = self.app.test_client()
        log_in(other, sub="2", name="guest")
        self.assertEqual(other.get("/api/sheet").get_json(), {"sheet": None})
        self.assertEqual(other.get("/api/sheet/file").status_code, 404)

    def test_a_new_upload_replaces_the_sheet_and_its_values(self):
        first = put_sheet(self.client).get_json()["sheet"]
        put_values(self.client, json.dumps({"25R": {"value": "Thorin"}}))
        second = put_sheet(self.client, data=PDF + b"%more", filename="Gimli.PDF").get_json()["sheet"]
        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual((second["name"], second["values"]), ("Gimli.PDF", {}))
        self.assertEqual(os.listdir(self.sheets_folder()), [f"{second['id']}.pdf"])

    def test_removes_the_sheet(self):
        uploaded = put_sheet(self.client).get_json()["sheet"]
        self.assertEqual(self.client.delete("/api/sheet").status_code, 403)
        self.assertEqual(self.client.delete("/api/sheet", headers=SAME_SITE).status_code, 204)
        self.assertEqual(self.client.get("/api/sheet").get_json(), {"sheet": None})
        self.assertNotIn(f"{uploaded['id']}.pdf", os.listdir(self.sheets_folder()))

    def test_names_the_download_after_the_uploaded_file(self):
        for uploaded, expected in (("C:\\Users\\me\\Thorin", "Thorin.pdf"), ("../../etc/sheet.pdf", "sheet.pdf"),
                                   ("", "character-sheet.pdf"), ("x" * 200 + ".pdf", "character-sheet.pdf")):
            self.assertEqual(sheet.file_name(uploaded), expected)

    def test_refuses_what_is_not_a_pdf(self):
        self.assertEqual(put_sheet(self.client, headers={}).status_code, 403)
        self.assertEqual(self.refusal(put_sheet(self.client, data=b"GIF89a" + b"x" * 2000)), "That file is not a PDF.")
        self.assertEqual(put_sheet(self.client, data=b"\n" * 100 + PDF).status_code, 200)
        response = self.client.put("/api/sheet", data={}, headers=SAME_SITE, content_type="multipart/form-data")
        self.assertEqual(self.refusal(response), "Choose a PDF to upload.")
        with mock.patch.object(sheet, "MAX_SHEET", 10):
            self.assertEqual(self.refusal(put_sheet(self.client)), "The PDF is too big. 0 MB is the most.")

    def test_refuses_values_it_cannot_keep(self):
        put_sheet(self.client)
        self.assertEqual(put_values(self.client, "{}", headers={}).status_code, 403)
        self.assertEqual(self.refusal(put_values(self.client, "not json")), "The sheet's values could not be read.")
        self.assertEqual(self.refusal(put_values(self.client, "[1, 2]")), "The sheet's values could not be read.")
        with mock.patch.object(sheet, "MAX_VALUES", 4):
            self.assertEqual(self.refusal(put_values(self.client, '{"a": 1}')), "The sheet's values are too big to save.")
