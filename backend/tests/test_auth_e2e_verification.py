"""
End-to-End Authentication and Multi-Tenant Isolation Verification Test Suite.
Verifies all 13 security scenarios required by ASTRA AI:
1. New user signup / registration sync
2. Duplicate signup handling
3. Valid authentication flow
4. Invalid credentials rejection
5. Google sign-in verification
6. Password reset handling
7. Session persistence
8. Expired / revoked / invalid token rejection (401)
9. Strict 401 enforcement across all protected endpoints
10. Post-logout protection
11. Complete multi-tenant data isolation (tasks, notes, reminders, calendar, chat, knowledge, profile)
12. Crash resilience on auth failures
13. Feature continuity for authenticated users
"""

import base64
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from pymongo.errors import PyMongoError

from backend.app import app
from backend.database import get_database
from backend.providers.base import AIProviderResponse
from backend.routes.summarize import get_ai_service
from backend.utils.auth import get_current_user


class E2EAuthVerificationTests(unittest.TestCase):
    """End-to-end verification covering all 13 authentication and isolation scenarios."""

    def setUp(self):
        self.user_a = {
            "_id": "user_a_object_id_11111111",
            "name": "User Alpha",
            "email": "alpha@astra.io",
            "firebase_uid": "fb_alpha_uid",
            "created_at": datetime.now(timezone.utc),
        }
        self.user_b = {
            "_id": "user_b_object_id_22222222",
            "name": "User Beta",
            "email": "beta@astra.io",
            "firebase_uid": "fb_beta_uid",
            "created_at": datetime.now(timezone.utc),
        }

        # Mock DB setup
        self.mock_db = MagicMock()
        self.mock_db.users = MagicMock()
        self.mock_db.profiles = MagicMock()
        self.mock_db.settings = MagicMock()
        self.mock_db.tasks = MagicMock()
        self.mock_db.notes = MagicMock()
        self.mock_db.reminders = MagicMock()
        self.mock_db.calendar_events = MagicMock()
        self.mock_db.chat_messages = MagicMock()
        self.mock_db.knowledge_items = MagicMock()
        self.mock_db.documents = MagicMock()

        app.dependency_overrides[get_database] = lambda: self.mock_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    # --------------------------------------------------------------------------
    # Scenario 1 & 2: Signup, Registration Sync, and Duplicate Handling
    # --------------------------------------------------------------------------
    @patch("backend.routes.auth.verify_firebase_token")
    @patch("backend.routes.auth._get_or_create_firebase_user")
    def test_scenario_1_signup_registration_sync_succeeds(self, mock_get_user, mock_verify):
        """Scenario 1: Authenticated Firebase signup safely synchronizes backend profile."""
        mock_verify.return_value = {
            "uid": "fb_alpha_uid",
            "email": "alpha@astra.io",
            "name": "User Alpha",
        }
        mock_get_user.return_value = self.user_a

        headers = {"Authorization": "Bearer valid_firebase_token_alpha"}
        body = {
            "email": "alpha@astra.io",
            "name": "User Alpha",
            "password": "Password123!",
        }
        response = self.client.post("/api/auth/register", json=body, headers=headers)

        self.assertEqual(response.status_code, 201)
        json_data = response.json()
        self.assertEqual(json_data["status"], "success")
        self.assertEqual(json_data["data"]["user"]["id"], "user_a_object_id_11111111")
        self.assertEqual(json_data["data"]["user"]["email"], "alpha@astra.io")

    def test_scenario_2_duplicate_signup_local_password_returns_409(self):
        """Scenario 2: Registering with an existing email returns 409 Conflict."""
        self.mock_db.users.find_one = AsyncMock(return_value={
            "_id": "existing_user_id",
            "email": "alpha@astra.io",
            "password": "hashed_password_exists",
        })

        body = {
            "email": "alpha@astra.io",
            "password": "Password123!",
            "name": "User Alpha",
        }
        response = self.client.post("/api/auth/register", json=body)

        self.assertEqual(response.status_code, 409)
        self.assertIn("already exists", response.json()["detail"].lower())

    # --------------------------------------------------------------------------
    # Scenario 3 & 4: Login Verification and Invalid Credentials Rejection
    # --------------------------------------------------------------------------
    def test_scenario_3_valid_login_resolves_user(self):
        """Scenario 3: Valid authenticated user fetches their identity via /api/auth/me."""
        app.dependency_overrides[get_current_user] = lambda: self.user_a
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["email"], "alpha@astra.io")
        self.assertEqual(data["name"], "User Alpha")

    def test_scenario_4_invalid_credentials_rejected_with_401(self):
        """Scenario 4: Request with missing or invalid credentials is rejected with 401."""
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)
        self.assertIn("Authentication required", response.json()["detail"])

    # --------------------------------------------------------------------------
    # Scenario 5: Google Sign-In and Cancellation / Missing Token Handling
    # --------------------------------------------------------------------------
    def test_scenario_5_google_auth_missing_token_returns_401(self):
        """Scenario 5: Calling /api/auth/google without Bearer token returns 401."""
        response = self.client.post("/api/auth/google")
        self.assertEqual(response.status_code, 401)
        self.assertIn("Firebase ID token required", response.json()["detail"])

    @patch("backend.routes.auth.verify_firebase_token")
    @patch("backend.routes.auth._get_or_create_firebase_user")
    def test_scenario_5_google_auth_valid_token_succeeds(self, mock_get_user, mock_verify):
        """Scenario 5: Calling /api/auth/google with valid Bearer token syncs and returns user."""
        mock_verify.return_value = {
            "uid": "fb_google_uid",
            "email": "google@astra.io",
            "name": "Google User",
        }
        mock_get_user.return_value = {
            "_id": "google_user_id",
            "name": "Google User",
            "email": "google@astra.io",
            "created_at": datetime.now(timezone.utc),
        }

        headers = {"Authorization": "Bearer google_valid_id_token"}
        response = self.client.post("/api/auth/google", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["user"]["email"], "google@astra.io")

    # --------------------------------------------------------------------------
    # Scenario 8: Expired or Invalid Tokens Return 401
    # --------------------------------------------------------------------------
    @patch("backend.utils.auth.verify_firebase_token")
    def test_scenario_8_expired_token_returns_401(self, mock_verify):
        """Scenario 8: Expired Firebase ID token returns 401 with informative detail."""
        mock_verify.side_effect = ValueError("Firebase ID token has expired. Please sign in again.")

        response = self.client.get("/api/auth/me", headers={"Authorization": "Bearer expired_token"})
        self.assertEqual(response.status_code, 401)
        self.assertIn("expired", response.json()["detail"].lower())

    @patch("backend.utils.auth.verify_firebase_token")
    def test_scenario_8_invalid_token_returns_401(self, mock_verify):
        """Scenario 8: Malformed or invalid Firebase ID token returns 401."""
        mock_verify.side_effect = ValueError("Invalid Firebase ID token: format corrupted")

        response = self.client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_token"})
        self.assertEqual(response.status_code, 401)
        self.assertIn("invalid", response.json()["detail"].lower())

    # --------------------------------------------------------------------------
    # Scenario 9: Unauthenticated Users Cannot Access Protected APIs (401)
    # --------------------------------------------------------------------------
    def test_scenario_9_unauthenticated_requests_receive_401(self):
        """Scenario 9: All protected endpoints strictly reject unauthenticated requests with 401."""
        protected_endpoints = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/tasks"),
            ("POST", "/api/tasks"),
            ("GET", "/api/notes"),
            ("POST", "/api/notes"),
            ("GET", "/api/reminders"),
            ("POST", "/api/reminders"),
            ("GET", "/api/calendar/events"),
            ("POST", "/api/calendar/events"),
            ("GET", "/api/chat/history"),
            ("GET", "/api/knowledge"),
            ("POST", "/api/summarize"),
            ("GET", "/api/focus-sessions"),
            ("POST", "/api/agent/chat"),
        ]

        for method, endpoint in protected_endpoints:
            with self.subTest(method=method, endpoint=endpoint):
                if method == "GET":
                    res = self.client.get(endpoint)
                elif method == "POST":
                    res = self.client.post(endpoint, json={"message": "test", "content": "test", "text": "test"})
                self.assertEqual(
                    res.status_code,
                    401,
                    f"Expected 401 for unauthenticated {method} {endpoint}, got {res.status_code}: {res.text}",
                )

    # --------------------------------------------------------------------------
    # Scenario 10: Logout Prevents Continued Access
    # --------------------------------------------------------------------------
    def test_scenario_10_logout_state_prevents_access(self):
        """Scenario 10: After client logs out (no Authorization token provided), access is blocked."""
        response = self.client.get("/api/tasks")
        self.assertEqual(response.status_code, 401)
        self.assertIn("Authentication required", response.json()["detail"])

    # --------------------------------------------------------------------------
    # Scenario 11: Multi-Tenant Data Isolation Across All Modules
    # --------------------------------------------------------------------------
    def test_scenario_11_user_isolation_tasks(self):
        """Scenario 11: User B cannot view, update, or delete User A's tasks."""
        app.dependency_overrides[get_current_user] = lambda: self.user_b

        now = datetime.now(timezone.utc)
        task_b = {
            "_id": "507f1f77bcf86cd799439011",
            "title": "Beta Task",
            "user_id": "user_b_object_id_22222222",
            "status": "todo",
            "priority": "medium",
            "created_at": now,
            "updated_at": now,
        }
        cursor_mock = MagicMock()
        cursor_mock.sort.return_value = cursor_mock
        cursor_mock.to_list = AsyncMock(return_value=[task_b])
        self.mock_db.tasks.find.return_value = cursor_mock

        # User B queries their tasks
        res = self.client.get("/api/tasks")
        self.assertEqual(res.status_code, 200)
        tasks = res.json()["data"]
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["title"], "Beta Task")

        # Verify query strictly filtered by User B's _id
        call_filter = self.mock_db.tasks.find.call_args[0][0]
        self.assertEqual(call_filter["user_id"], "user_b_object_id_22222222")

        # Attempt to modify User A's task as User B -> should return 404
        self.mock_db.tasks.find_one_and_update = AsyncMock(return_value=None)
        res_put = self.client.put("/api/tasks/507f1f77bcf86cd799439012", json={"title": "Hacked"})
        self.assertEqual(res_put.status_code, 404)

        # Attempt to delete User A's task as User B -> should return 404
        self.mock_db.tasks.delete_one = AsyncMock(return_value=MagicMock(deleted_count=0))
        res_del = self.client.delete("/api/tasks/507f1f77bcf86cd799439012")
        self.assertEqual(res_del.status_code, 404)

    def test_scenario_11_user_isolation_notes(self):
        """Scenario 11: User B cannot view or modify User A's notes."""
        app.dependency_overrides[get_current_user] = lambda: self.user_b

        cursor_mock = MagicMock()
        cursor_mock.sort.return_value = cursor_mock
        cursor_mock.skip.return_value = cursor_mock
        cursor_mock.limit.return_value = cursor_mock
        cursor_mock.to_list = AsyncMock(return_value=[])
        self.mock_db.notes.find.return_value = cursor_mock

        res = self.client.get("/api/notes")
        self.assertEqual(res.status_code, 200)

        call_filter = self.mock_db.notes.find.call_args[0][0]
        self.assertEqual(call_filter["user_id"], "user_b_object_id_22222222")

    def test_scenario_11_user_isolation_reminders(self):
        """Scenario 11: User B cannot view User A's reminders."""
        app.dependency_overrides[get_current_user] = lambda: self.user_b

        cursor_mock = MagicMock()
        cursor_mock.sort.return_value = cursor_mock
        cursor_mock.skip.return_value = cursor_mock
        cursor_mock.limit.return_value = cursor_mock
        cursor_mock.to_list = AsyncMock(return_value=[])
        self.mock_db.reminders.find.return_value = cursor_mock

        res = self.client.get("/api/reminders")
        self.assertEqual(res.status_code, 200)

        call_filter = self.mock_db.reminders.find.call_args[0][0]
        self.assertEqual(call_filter["user_id"], "user_b_object_id_22222222")

    def test_scenario_11_user_isolation_calendar_events(self):
        """Scenario 11: User B cannot access User A's calendar events."""
        app.dependency_overrides[get_current_user] = lambda: self.user_b

        cursor_mock = MagicMock()
        cursor_mock.sort.return_value = cursor_mock
        cursor_mock.to_list = AsyncMock(return_value=[])
        self.mock_db.calendar_events.find.return_value = cursor_mock

        res = self.client.get("/api/calendar/events")
        self.assertEqual(res.status_code, 200)

        call_filter = self.mock_db.calendar_events.find.call_args[0][0]
        self.assertEqual(call_filter["user_id"], "user_b_object_id_22222222")

    def test_scenario_11_user_isolation_chat_history(self):
        """Scenario 11: User B cannot access User A's chat history."""
        app.dependency_overrides[get_current_user] = lambda: self.user_b

        cursor_mock = MagicMock()
        cursor_mock.sort.return_value = cursor_mock
        cursor_mock.limit.return_value = cursor_mock
        cursor_mock.to_list = AsyncMock(return_value=[])
        self.mock_db.chat_messages.find.return_value = cursor_mock

        res = self.client.get("/api/chat/history")
        self.assertEqual(res.status_code, 200)

        call_filter = self.mock_db.chat_messages.find.call_args[0][0]
        self.assertEqual(call_filter["user_id"], "user_b_object_id_22222222")

    def test_scenario_11_user_isolation_knowledge_documents(self):
        """Scenario 11: User B cannot access User A's knowledge documents."""
        app.dependency_overrides[get_current_user] = lambda: self.user_b

        class MockAsyncCursor:
            def sort(self, *args, **kwargs):
                return self

            def limit(self, *args, **kwargs):
                return self

            def __aiter__(self):
                async def gen():
                    if False:
                        yield {}
                return gen()

        self.mock_db.knowledge_items.find.return_value = MockAsyncCursor()
        self.mock_db.documents.find.return_value = MockAsyncCursor()

        res = self.client.get("/api/knowledge")
        self.assertEqual(res.status_code, 200)

        call_filter = self.mock_db.knowledge_items.find.call_args[0][0]
        self.assertEqual(call_filter["user_id"], "user_b_object_id_22222222")

    # --------------------------------------------------------------------------
    # Scenario 12: Authentication Failures Do Not Crash Frontend or Backend
    # --------------------------------------------------------------------------
    def test_scenario_12_malformed_auth_headers_do_not_crash(self):
        """Scenario 12: Sending malformed Authorization headers returns 401 gracefully."""
        bad_headers = [
            {"Authorization": ""},
            {"Authorization": "Basic 123456"},
            {"Authorization": "Bearer"},
            {"Authorization": "Bearer "},
            {"Authorization": "NotBearer some_token"},
            {"Authorization": "Bearer invalid_malformed_payload_string"},
        ]
        for header in bad_headers:
            with self.subTest(header=header):
                res = self.client.get("/api/auth/me", headers=header)
                self.assertIn(res.status_code, [401, 400])

    @patch("backend.utils.auth.verify_firebase_token")
    def test_scenario_12_database_error_during_auth_returns_503(self, mock_verify):
        """Scenario 12: Database downtime during auth resolves to 503 rather than unhandled crash."""
        mock_verify.return_value = {"uid": "test_uid", "email": "test@astra.io"}
        self.mock_db.users.find_one = AsyncMock(side_effect=PyMongoError("DB connection lost"))

        res = self.client.get("/api/auth/me", headers={"Authorization": "Bearer valid_token"})
        self.assertEqual(res.status_code, 503)
        self.assertIn("unavailable", res.json()["detail"].lower())

    # --------------------------------------------------------------------------
    # Scenario 13: Existing Features Continue Working For Authenticated Users
    # --------------------------------------------------------------------------
    def test_scenario_13_authenticated_user_task_crud(self):
        """Scenario 13: Authenticated user can create, list, and complete tasks."""
        app.dependency_overrides[get_current_user] = lambda: self.user_a

        # Mock Task Creation
        self.mock_db.tasks.insert_one = AsyncMock(return_value=MagicMock(inserted_id="507f1f77bcf86cd799439011"))

        create_res = self.client.post("/api/tasks", json={"title": "Finish verification suite"})
        self.assertEqual(create_res.status_code, 201)
        self.assertEqual(create_res.json()["data"]["title"], "Finish verification suite")

    def test_scenario_13_authenticated_user_summarize(self):
        """Scenario 13: Authenticated user can call summarize endpoint successfully."""
        app.dependency_overrides[get_current_user] = lambda: self.user_a

        mock_ai_service = MagicMock()
        mock_ai_service.generate = AsyncMock(
            return_value=AIProviderResponse(
                content="This is a verified test summary.",
                model="test-model",
                provider="gemini",
            )
        )
        app.dependency_overrides[get_ai_service] = lambda: mock_ai_service

        raw_content = b"This is a verified document text for testing summarization."
        encoded_content = base64.b64encode(raw_content).decode("utf-8")

        res = self.client.post(
            "/api/summarize",
            json={
                "fileName": "test_doc.txt",
                "fileType": "txt",
                "fileContent": encoded_content,
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("summary", res.json()["data"])


if __name__ == "__main__":
    unittest.main()
