"""One bounded request per process; never print session cookies or raw API errors."""
import asyncio
import contextlib
from datetime import date
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys


class BridgeError(Exception):
    pass


def validate_request(request):
    if not isinstance(request, dict) or request.get("operation") not in ("check", "publish", "verify"):
        raise BridgeError("INVALID_REQUEST")
    if request["operation"] == "verify":
        if not re.fullmatch(r"[0-9]+", str(request.get("id", ""))):
            raise BridgeError("INVALID_POST_ID")
    if request["operation"] != "publish":
        return
    post = request.get("post", {})
    try:
        if date.fromisoformat(post["date"]).isoformat() != post["date"]:
            raise ValueError()
        if not isinstance(post["text"], str) or not post["text"].strip():
            raise ValueError()
        if len(post["text"]) > 280:
            raise ValueError()
        if "poll" in post:
            poll = post["poll"]
            options = poll["options"]
            if not isinstance(options, list) or not 2 <= len(options) <= 4:
                raise ValueError()
            if any(not isinstance(o, str) or not o.strip() or len(o) > 25 for o in options):
                raise ValueError()
            if len(set(options)) != len(options):
                raise ValueError()
            if type(poll["durationMinutes"]) is not int or not 5 <= poll["durationMinutes"] <= 10080:
                raise ValueError()
    except (KeyError, TypeError, ValueError):
        raise BridgeError("INVALID_POST") from None


class Journal:
    def __init__(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, timeout=10)
        self.db.execute("""CREATE TABLE IF NOT EXISTS publications (
            account TEXT NOT NULL, day TEXT NOT NULL, digest TEXT NOT NULL,
            status TEXT NOT NULL, tweet_id TEXT,
            PRIMARY KEY(account, day))""")
        self.db.commit()

    def reserve(self, account, post):
        digest = hashlib.sha256(json.dumps(post, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        try:
            self.db.execute("INSERT INTO publications VALUES (?, ?, ?, 'pending', NULL)",
                            (account, post["date"], digest))
            self.db.commit()
        except sqlite3.IntegrityError:
            self.db.rollback()
            raise BridgeError("PUBLICATION_ALREADY_ATTEMPTED") from None

    def confirm(self, account, post, tweet_id):
        self.db.execute("UPDATE publications SET status='published', tweet_id=? WHERE account=? AND day=?",
                        (tweet_id, account, post["date"]))
        self.db.commit()

    def close(self):
        self.db.close()


async def execute(request, client, expected_username, journal_path):
    validate_request(request)
    user = await client.user()
    if not user or user.screen_name.casefold() != expected_username.lstrip("@").casefold():
        raise BridgeError("ACCOUNT_MISMATCH")
    if request["operation"] == "check":
        return {"ok": True, "username": user.screen_name, "userId": str(user.id)}
    if request["operation"] == "verify":
        tweet = await client.get_tweet_by_id(request["id"])
        if not tweet or not tweet.user or str(tweet.user.id) != str(user.id):
            raise BridgeError("PUBLICATION_NOT_CONFIRMED")
        return {"ok": True, "id": str(tweet.id), "username": user.screen_name, "text": tweet.text}

    post = request["post"]
    journal = Journal(journal_path)
    try:
        # Persist before the first write. An interrupted or ambiguous attempt
        # remains pending for manual reconciliation, never an automatic retry.
        journal.reserve(str(user.id), post)
        kwargs = {"text": post["text"]}
        if "poll" in post:
            poll = post["poll"]
            uri = await client.create_poll(poll["options"], poll["durationMinutes"])
            if not isinstance(uri, str) or not uri:
                raise BridgeError("POLL_NOT_CONFIRMED")
            kwargs["poll_uri"] = uri
        tweet = await client.create_tweet(**kwargs)
        tweet_id = str(getattr(tweet, "id", ""))
        if not re.fullmatch(r"[0-9]+", tweet_id):
            raise BridgeError("PUBLICATION_NOT_CONFIRMED")
        journal.confirm(str(user.id), post, tweet_id)
        return {"ok": True, "id": tweet_id, "username": user.screen_name}
    finally:
        journal.close()


async def run(request):
    validate_request(request)
    cookies = {"auth_token": os.environ.get("X_AUTH_TOKEN", "").strip(),
               "ct0": os.environ.get("X_CT0", "").strip()}
    if not all(cookies.values()):
        raise BridgeError("SESSION_REQUIRED")
    from twikit import Client
    client = Client("pt-BR", impersonate="chrome124", timeout=30)
    client.set_cookies(cookies)
    try:
        return await execute(request, client, os.environ.get("X_EXPECTED_USERNAME", "contadoruerj"),
                             os.environ["TWIFORK_JOURNAL_PATH"])
    finally:
        # twifork 2.4.0 exposes no combined close method.
        await client.http.aclose()
        if client._curl_session is not None:
            await client._curl_session.close()


def error_code(error):
    if isinstance(error, BridgeError):
        return str(error)
    name = type(error).__name__
    return {
        "Unauthorized": "SESSION_EXPIRED", "InvalidSession": "SESSION_EXPIRED",
        "AccountLocked": "ACCOUNT_LOCKED", "AccountSuspended": "ACCOUNT_SUSPENDED",
        "TooManyRequests": "RATE_LIMITED", "Forbidden": "ACCESS_DENIED",
        "CouldNotTweet": "POST_REJECTED", "DuplicateTweet": "DUPLICATE_POST",
        "NotFound": "ENDPOINT_UNAVAILABLE", "ModuleNotFoundError": "DEPENDENCY_MISSING",
        "ClientTransactionError": "HANDSHAKE_FAILED", "TimeoutError": "TIMEOUT",
        "RequestTimeout": "TIMEOUT", "ReadTimeout": "TIMEOUT",
    }.get(name, "REQUEST_FAILED")


def main():
    os.umask(0o077)
    try:
        raw = sys.stdin.read(16385)
        if len(raw) > 16384:
            raise BridgeError("INVALID_REQUEST")
        request = json.loads(raw)
        # A dependency must never contaminate the protocol with logs or secrets.
        with open(os.devnull, "w") as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            result = asyncio.run(asyncio.wait_for(run(request), timeout=90))
    except Exception as error:
        result = {"ok": False, "error": error_code(error)}
    print(json.dumps(result, ensure_ascii=True))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
