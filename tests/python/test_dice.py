import base64
import os
import unittest
from unittest import mock

from server import dice
from tests.python.helpers import SAME_SITE, WEBP, good_model, log_in, make_app, upload


class LoggedOutTests(unittest.TestCase):
    def test_sets_need_a_login(self):
        client = make_app(self, portfolio=True).test_client()
        self.assertEqual(client.get("/api/dice").get_json(), {"sets": []})
        self.assertEqual(upload(client).status_code, 401)
        self.assertEqual(client.get("/api/dice/abc.glb").status_code, 404)
        self.assertEqual(client.delete("/api/dice/abc", headers=SAME_SITE).status_code, 404)

    def test_uploads_are_off_with_portfolio_login(self):
        client = make_app(self).test_client()
        self.assertEqual(upload(client).status_code, 401)


class UploadTests(unittest.TestCase):
    def setUp(self):
        self.app = make_app(self, portfolio=True)
        self.client = self.app.test_client()
        log_in(self.client)

    def test_uploads_a_set_and_serves_it_to_its_owner_only(self):
        created = upload(self.client, label=" Seafoam ")
        self.assertEqual(created.status_code, 201)
        set_id = created.get_json()["id"]
        self.assertEqual(created.get_json(), {"id": set_id, "label": "Seafoam", "thumbnail": False})
        self.assertEqual(self.client.get("/api/dice").get_json(), {"sets": [created.get_json()]})
        with self.client.get(f"/api/dice/{set_id}.glb") as model:
            self.assertEqual((model.status_code, model.mimetype, model.data), (200, "model/gltf-binary", good_model()))
            self.assertIn("max-age=31536000", model.headers["Cache-Control"])
        self.assertEqual(self.client.get(f"/api/dice/{set_id}/thumb").status_code, 404)

        other = self.app.test_client()
        log_in(other, sub="2", name="guest")
        self.assertEqual(other.get("/api/dice").get_json(), {"sets": []})
        self.assertEqual(other.get(f"/api/dice/{set_id}.glb").status_code, 404)
        self.assertEqual(other.delete(f"/api/dice/{set_id}", headers=SAME_SITE).status_code, 404)

    def test_keeps_a_screenshot_and_deletes_it_with_the_set(self):
        created = upload(self.client, thumbnail=WEBP).get_json()
        self.assertTrue(created["thumbnail"])
        with self.client.get(f"/api/dice/{created['id']}/thumb") as thumb:
            self.assertEqual((thumb.status_code, thumb.mimetype), (200, "image/webp"))
        folder = os.path.join(self.app.config["DATA_DIR"], "dice")
        self.assertEqual(sorted(os.listdir(folder)), [f"{created['id']}.glb", f"{created['id']}.webp"])
        self.assertEqual(self.client.delete(f"/api/dice/{created['id']}").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/dice/{created['id']}", headers=SAME_SITE).status_code, 204)
        self.assertEqual(os.listdir(folder), [])
        self.assertEqual(self.client.get("/api/dice").get_json(), {"sets": []})

    def test_deleting_survives_a_model_file_that_is_already_gone(self):
        created = upload(self.client).get_json()
        os.remove(os.path.join(self.app.config["DATA_DIR"], "dice", f"{created['id']}.glb"))
        self.assertEqual(self.client.delete(f"/api/dice/{created['id']}", headers=SAME_SITE).status_code, 204)

    def refusal(self, **kwargs):
        response = upload(self.client, **kwargs)
        self.assertEqual(response.status_code, 400)
        return response.get_json()["error"]

    def test_refuses_bad_names_files_and_screenshots(self):
        self.assertEqual(upload(self.client, headers={}).status_code, 403)
        self.assertEqual(self.refusal(label="  "), "Give the set a name of up to 40 characters.")
        self.assertEqual(self.refusal(label="x" * 41), "Give the set a name of up to 40 characters.")
        self.assertEqual(self.refusal(filename="seafoam.blend"), "Choose a .glb model exported from Blender.")
        self.assertEqual(self.refusal(model=b"not a model"), "That file is not a .glb model.")
        self.assertEqual(self.refusal(thumbnail="data:image/gif;base64,R0lGOD"),
                         "The screenshot must be a WebP, PNG or JPEG picture.")
        self.assertEqual(self.refusal(thumbnail="hello"), "The screenshot must be a WebP, PNG or JPEG picture.")
        self.assertEqual(self.refusal(thumbnail="data:image/png;base64,***"), "The screenshot could not be read.")
        self.assertEqual(self.refusal(thumbnail="data:image/png;base64," + base64.b64encode(b"RIFF").decode()),
                         "The screenshot could not be read.")
        with mock.patch.object(dice, "MAX_THUMBNAIL", 8):
            self.assertEqual(self.refusal(thumbnail=WEBP), "The screenshot is too big.")
        self.assertEqual(self.client.get("/api/dice").get_json(), {"sets": []})

    def test_no_model_field_is_refused(self):
        response = self.client.post("/api/dice", data={"label": "Seafoam"}, headers=SAME_SITE)
        self.assertEqual(response.get_json()["error"], "Choose a .glb model exported from Blender.")

    def test_limits_the_size_and_the_number_of_sets(self):
        with mock.patch.object(dice, "MAX_MODEL", 10):
            self.assertEqual(self.refusal(), "The model is too big. 0 MB is the most.")
        with mock.patch.object(dice, "MAX_SETS", 1):
            self.assertEqual(upload(self.client).status_code, 201)
            self.assertEqual(self.refusal(), "You already have 1 sets. Delete one first.")

    def test_an_oversized_request_gets_a_json_answer(self):
        self.app.config["MAX_CONTENT_LENGTH"] = 100
        response = upload(self.client)
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.get_json(), {"error": "That upload is too big."})
