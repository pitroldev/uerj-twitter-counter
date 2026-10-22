import asyncio
import copy
from contextlib import closing
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location("bridge", Path(__file__).parents[1] / "scripts/twifork_bridge.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class RecordingClient:
    def __init__(self):
        self.calls = []
        self.username = "contadoruerj"
        self.failure = None
        self.poll_uri = "card://123"
        self.tweet_id = "456"

    async def user(self):
        return SimpleNamespace(id="789", screen_name=self.username)

    async def create_poll(self, options, minutes):
        self.calls.append(("poll", options, minutes))
        await asyncio.sleep(0)
        return self.poll_uri

    async def create_tweet(self, **kwargs):
        self.calls.append(("tweet", kwargs))
        if self.failure:
            raise self.failure
        return SimpleNamespace(id=self.tweet_id)


class TwiforkTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.journal = Path(self.temp.name) / "posts.sqlite"
        self.client = RecordingClient()
        self.request = {"operation": "publish", "post": {
            "date": "2026-10-30", "text": "o período termina amanhã. 💙",
            "poll": {"options": ["sobrevivi", "quase"], "durationMinutes": 1440}}}

    async def run_request(self, request=None):
        return await bridge.execute(request or self.request, self.client, "contadoruerj", self.journal)

    async def test_poll_is_created_before_tweet_and_attached(self):
        result = await self.run_request()
        self.assertEqual(result["id"], "456")
        self.assertEqual(self.client.calls, [
            ("poll", ["sobrevivi", "quase"], 1440),
            ("tweet", {"text": self.request["post"]["text"], "poll_uri": "card://123"})])
        with closing(sqlite3.connect(self.journal)) as db:
            self.assertEqual(db.execute("SELECT status,tweet_id FROM publications").fetchone(), ("published", "456"))

    async def test_open_question_has_no_poll(self):
        del self.request["post"]["poll"]
        await self.run_request()
        self.assertEqual(self.client.calls, [("tweet", {"text": self.request["post"]["text"]})])

    async def test_account_mismatch_never_writes(self):
        self.client.username = "another_account"
        with self.assertRaisesRegex(bridge.BridgeError, "ACCOUNT_MISMATCH"):
            await self.run_request()
        self.assertEqual(self.client.calls, [])
        self.assertFalse(self.journal.exists())

    async def test_check_is_read_only(self):
        result = await self.run_request({"operation": "check"})
        self.assertEqual(result["username"], "contadoruerj")
        self.assertEqual(self.client.calls, [])
        self.assertFalse(self.journal.exists())

    async def test_restart_cannot_repeat_day_even_with_changed_text(self):
        await self.run_request()
        self.request["post"]["text"] = "alterado"
        with self.assertRaisesRegex(bridge.BridgeError, "ALREADY_ATTEMPTED"):
            await self.run_request()
        self.assertEqual(len(self.client.calls), 2)

    async def test_timeout_preserves_pending_and_does_not_retry(self):
        self.client.failure = TimeoutError("private provider response")
        with self.assertRaises(TimeoutError):
            await self.run_request()
        with self.assertRaisesRegex(bridge.BridgeError, "ALREADY_ATTEMPTED"):
            await self.run_request()
        with closing(sqlite3.connect(self.journal)) as db:
            self.assertEqual(db.execute("SELECT status FROM publications").fetchone()[0], "pending")
        self.assertEqual(len(self.client.calls), 2)

    async def test_concurrent_attempts_publish_only_once(self):
        results = await asyncio.gather(self.run_request(), self.run_request(), return_exceptions=True)
        self.assertEqual(sum(isinstance(r, dict) for r in results), 1)
        self.assertEqual(len(self.client.calls), 2)

    async def test_missing_poll_confirmation_never_publishes_plain_text(self):
        self.client.poll_uri = None
        with self.assertRaisesRegex(bridge.BridgeError, "POLL_NOT_CONFIRMED"):
            await self.run_request()
        self.assertEqual(len(self.client.calls), 1)

    async def test_missing_tweet_id_never_reports_success(self):
        self.client.tweet_id = None
        with self.assertRaisesRegex(bridge.BridgeError, "PUBLICATION_NOT_CONFIRMED"):
            await self.run_request()

    async def test_invalid_poll_and_date_are_rejected_before_network(self):
        for change in [
            {"date": "2026-02-30"}, {"text": ""},
            {"poll": {"options": ["only"], "durationMinutes": 1440}},
            {"poll": {"options": ["a", "a"], "durationMinutes": 1440}},
            {"poll": {"options": ["a", "b"], "durationMinutes": True}},
        ]:
            request = copy.deepcopy(self.request)
            request["post"].update(change)
            with self.assertRaisesRegex(bridge.BridgeError, "INVALID_POST"):
                await self.run_request(request)
        self.assertEqual(self.client.calls, [])

    async def test_expired_session_is_sanitized(self):
        Unauthorized = type("Unauthorized", (Exception,), {})
        self.assertEqual(bridge.error_code(Unauthorized("cookie=secret")), "SESSION_EXPIRED")
        self.assertEqual(bridge.error_code(RuntimeError("cookie=secret")), "REQUEST_FAILED")


if __name__ == "__main__":
    unittest.main()
