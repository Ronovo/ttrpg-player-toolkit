import unittest

from tests.python.helpers import SAME_SITE, issue, log_in, make_app


class PortfolioOffTests(unittest.TestCase):
    def test_login_is_off_without_the_portfolio_settings(self):
        client = make_app(self).test_client()
        self.assertEqual(client.get("/api/me").get_json(), {"enabled": False})
        self.assertEqual(client.get("/sso/login").status_code, 404)


class PortfolioLoginTests(unittest.TestCase):
    def setUp(self):
        self.client = make_app(self, portfolio=True).test_client()

    def test_tells_the_page_who_is_logged_in(self):
        before = self.client.get("/api/me")
        self.assertEqual(before.get_json(), {"enabled": True, "username": None, "portfolioUrl": "http://portfolio.test",
                                             "loginError": None})
        self.assertEqual(before.headers["Cache-Control"], "no-store")
        landed = log_in(self.client)
        self.assertEqual((landed.status_code, landed.location), (302, "/"))
        self.assertEqual(self.client.get("/api/me").get_json()["username"], "ronovo")

    def test_returns_to_the_page_that_asked_for_the_login(self):
        self.client.get("/sso/login?next=/%3Ftab%3Ddice")
        query = self.client.get("/sso/login?next=/dice").location.split("state=")[1].split("&")[0]
        landed = self.client.post("/sso/callback", data={"state": query, "token": issue()})
        self.assertEqual(landed.location, "/dice")

    def test_logout_needs_the_same_site_header_and_forgets_the_account(self):
        log_in(self.client)
        self.assertEqual(self.client.post("/api/logout").status_code, 403)
        self.assertEqual(self.client.get("/api/me").get_json()["username"], "ronovo")
        self.assertEqual(self.client.post("/api/logout", headers=SAME_SITE).status_code, 204)
        self.assertIsNone(self.client.get("/api/me").get_json()["username"])

    def test_a_refused_login_leaves_one_message_for_the_page(self):
        stale = self.client.post("/sso/callback", data={"state": "nope", "token": issue()})
        self.assertEqual((stale.status_code, stale.location), (302, "/"))
        self.assertEqual(self.client.get("/api/me").get_json()["loginError"], "Your portfolio login expired. Try again.")
        self.assertIsNone(self.client.get("/api/me").get_json()["loginError"])
        bad_token = log_in(self.client, token=issue(aud="casino"))
        self.assertEqual(bad_token.location, "/")
        self.assertEqual(self.client.get("/api/me").get_json()["loginError"],
                         "That portfolio login didn't check out. Try again.")
        self.assertIsNone(self.client.get("/api/me").get_json()["username"])
