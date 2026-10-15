"""
Unit and integration tests for ASTRA AI Authentication system.
Verifies token verification, /register, /google, /me endpoints,
unauthenticated 401 enforcement, user isolation across collections,
and concurrent creation safety.
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

from backend.app import app
from backend.database import get_database
from backend.routes.auth import _bearer_scheme
from backend.utils.auth import (
    _get_or_create_firebase_user,
    get_current_user,
    hash_password,
    verify_password,
)
from backend.utils.firebase_init import verify_firebase_token


class AuthSecurityUnitTests(unittest.TestCase):
    """Test password hashing, verification, and basic security helpers."""

    def test_password_hash_and_verify(self):
        password = "SecurePassword123!"
        hashed = hash_password(password)
        self.assertNotEqual(password, hashed)
        self.assertTrue(verify_password(password, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))


class AuthEndpointIntegrationTests(unittest.TestCase):
    """Integration tests for auth endpoints and protected routes."""

    def setUp(self):
        self.mock_user = {
            "_id": "6a71fb74e822a199f1b77ea4",
            "name": "Test User",
            "email": "test@astra.io",
            "firebase_uid": "fb_uid_test_123",
            "created_at": datetime.now(timezone.utc),
        }
        self.mock_db = MagicMock()
        self.mock_users = MagicMock()
        self.mock_profiles = MagicMock()
        self.mock_settings = MagicMock()
        self.mock_tasks = MagicMock()
        self.mock_notes = MagicMock()

        self.mock_db.users = self.mock_users
        self.mock_db.profiles = self.mock_profiles
        self.mock_settings = self.mock_settings
        self.mock_db.tasks = self.mock_tasks
        self.mock_db.notes = self.mock_notes

        app.dependency_overrides[get_database] = lambda: self.mock_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_get_me_without_token_returns_401(self):
        """GET /api/auth/me without an Authorization header must return HTTP 401."""
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)
        self.assertIn("Authentication required", response.json().get("detail", ""))

    def test_get_me_with_authenticated_user(self):
        """GET /api/auth/me with valid auth dependency must return user information."""
        app.dependency_overrides[get_current_user] = lambda: self.mock_user
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 200)
        data = response.json().get("data", {})
        self.assertEqual(data.get("email"), "test@astra.io")
        self.assertEqual(data.get("name"), "Test User")
        self.assertEqual(data.get("id"), "6a71fb74e822a199f1b77ea4")

    def test_google_auth_without_token_returns_401(self):
        """POST /api/auth/google without Bearer token must return HTTP 401."""
        response = self.client.post("/api/auth/google")
        self.assertEqual(response.status_code, 401)
        self.assertIn("Firebase ID token required", response.json().get("detail", ""))

    @patch("backend.routes.auth.verify_firebase_token")
    @patch("backend.routes.auth._get_or_create_firebase_user")
    def test_google_auth_with_valid_token_succeeds(self, mock_resolve_user, mock_verify_token):
        """POST /api/auth/google with valid token must verify and return user."""
        mock_verify_token.return_value = {
            "uid": "google_uid_123",
            "email": "googleuser@example.com",
            "name": "Google User",
            "picture": "https://example.com/avatar.jpg",
        }
        mock_resolve_user.return_value = {
            "_id": "6a71fa89e822a199f1b77ea1",
            "name": "Google User",
            "email": "googleuser@example.com",
            "created_at": datetime.now(timezone.utc),
        }

        response = self.client.post(
            "/api/auth/google",
            headers={"Authorization": "Bearer valid_test_token"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json().get("data", {}).get("user", {})
        self.assertEqual(data.get("email"), "googleuser@example.com")
        self.assertEqual(data.get("id"), "6a71fa89e822a199f1b77ea1")

    def test_register_duplicate_email_returns_409(self):
        """POST /api/auth/register with already existing email returns HTTP 409."""
        self.mock_users.find_one = AsyncMock(return_value={"_id": "existing_id", "email": "duplicate@astra.io"})
        response = self.client.post(
            "/api/auth/register",
            json={"name": "Alex", "email": "duplicate@astra.io", "password": "Password123!"},
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("already exists", response.json().get("detail", ""))

    def test_protected_routes_reject_unauthenticated_requests(self):
        """Private routes (tasks, notes, reminders, calendar, summarize) must return 401 without auth."""
        for endpoint, method in [
            ("/api/tasks", "GET"),
            ("/api/notes", "GET"),
            ("/api/reminders", "GET"),
            ("/api/calendar/events", "GET"),
            ("/api/summarize", "POST"),
        ]:
            if method == "GET":
                resp = self.client.get(endpoint)
            else:
                resp = self.client.post(endpoint, json={"fileContent": "data"})
            self.assertEqual(resp.status_code, 401, f"Endpoint {endpoint} was not protected (got {resp.status_code})")

    def test_user_data_isolation(self):
        """User A querying /api/tasks must only query tasks with user_id == User A's ID."""
        app.dependency_overrides[get_current_user] = lambda: self.mock_user
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        self.mock_tasks.find = MagicMock(return_value=mock_cursor)

        response = self.client.get("/api/tasks")
        self.assertEqual(response.status_code, 200)
        # Verify query was strictly scoped to mock_user["_id"]
        self.mock_tasks.find.assert_called_once()
        query_arg = self.mock_tasks.find.call_args[0][0]
        self.assertEqual(query_arg["user_id"], self.mock_user["_id"])


class UserResolutionConcurrencyTests(unittest.IsolatedAsyncioTestCase):
    """Test race-condition handling during simultaneous user resolution."""

    async def test_get_or_create_handles_duplicate_key_race(self):
        """If a concurrent insert raises DuplicateKeyError, cleanly falls back to query existing user."""
        mock_db = MagicMock()
        mock_users = MagicMock()
        mock_profiles = MagicMock()
        mock_settings = MagicMock()
        mock_db.users = mock_users
        mock_db.profiles = mock_profiles
        mock_db.settings = mock_settings

        # First find_one returns None (both threads see nothing initially)
        # insert_one raises DuplicateKeyError (the other thread beat us to the insert)
        # Subsequent find_one returns the record created by the other thread
        existing_doc = {
            "_id": "6a71fb74e822a199f1b77ea4",
            "name": "Alex",
            "email": "alex@astra.io",
            "firebase_uid": "uid_concurrent_123",
            "created_at": datetime.now(timezone.utc),
        }
        mock_users.find_one = AsyncMock(side_effect=[None, None, existing_doc])
        mock_users.insert_one = AsyncMock(side_effect=DuplicateKeyError("E11000 duplicate key"))
        mock_profiles.update_one = AsyncMock()
        mock_settings.update_one = AsyncMock()

        claims = {
            "uid": "uid_concurrent_123",
            "email": "alex@astra.io",
            "name": "Alex",
        }
        user = await _get_or_create_firebase_user(claims, mock_db)
        self.assertEqual(user["_id"], "6a71fb74e822a199f1b77ea4")
        self.assertEqual(user["email"], "alex@astra.io")
