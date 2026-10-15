"""Small local account store used when MongoDB is unavailable.

The application is designed to be runnable out of the box.  MongoDB remains
the primary store, but local development must not make registration and login
depend on an external service being installed.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


_STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "auth_users.json"


def _read_users() -> list[dict]:
    if not _STORE_PATH.exists():
        return []
    try:
        return json.loads(_STORE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []


def _write_users(users: list[dict]) -> None:
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _STORE_PATH.write_text(json.dumps(users, indent=2), encoding="utf-8")


def find_user_by_email(email: str) -> dict | None:
    normalized = email.strip().lower()
    return next((user for user in _read_users() if user["email"] == normalized), None)


def find_user_by_id(user_id: str) -> dict | None:
    return next((user for user in _read_users() if user["id"] == user_id), None)


def create_user(name: str, email: str, hashed_password: str) -> dict:
    users = _read_users()
    user = {
        "id": f"local-{uuid4()}",
        "name": name.strip(),
        "email": email.strip().lower(),
        "hashed_password": hashed_password,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    users.append(user)
    _write_users(users)
    return user
