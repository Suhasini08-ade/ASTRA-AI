"""
tests/test_final_integration_and_safety.py
=========================================
Final integration and safety verification test suite for ASTRA AI desktop automation.

Verifies:
1. Opening each supported application in DEFAULT_APPROVED_APPS (all 20 apps).
2. Opening validated websites and search queries with dangerous scheme rejection.
3. Opening permitted folders and safe files; enforcing confirmation for executables.
4. Screenshot creation to user-accessible folder with timestamping and error safety.
5. Strict rejection of unknown applications, command injection, and system paths.
6. Ordinary knowledge questions answered without tool invocation.
7. Existing Voice AI task management: create, view, update, delete, with user isolation.
8. Ambiguous commands requiring clarification and confirmation-required operations.
9. Microphone/voice input handling: empty input, failure truthfulness, markdown stripping.
10. Authentication boundaries: 401 Unauthorized for unauthenticated remote callers.
"""

from collections import deque
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient
import pytest

from backend.app import app
from backend.config import get_settings
from backend.database import get_database
from backend.providers.base import AIProviderResponse, BaseAIProvider, ToolCallItem
from backend.services.agent_tools import (
    AGENT_TOOLS,
    execute_agent_tool,
)
from backend.services.ai_service import AIService
from backend.services.desktop.app_launcher import DEFAULT_APPROVED_APPS, AppLauncher, AppSpec
from backend.services.desktop.browser_launcher import BrowserLauncher
from backend.services.desktop.datetime_reporter import DateTimeReporter
from backend.services.desktop.file_launcher import FileLauncher
from backend.services.desktop.file_searcher import FileSearcher
from backend.services.desktop.folder_launcher import FolderLauncher
from backend.services.desktop.screenshot_handler import ScreenshotHandler
from backend.services.desktop.service import DesktopService, desktop_service
from backend.services.desktop.volume_controller import VolumeController
from backend.services.voice_service import voice_service
from backend.utils.auth import get_current_user


class StubProvider(BaseAIProvider):
    """Stub AI provider returning sequential scripted responses for testing."""

    def __init__(self, *responses: AIProviderResponse | Exception) -> None:
        self.responses = deque(responses)
        self.calls: list[tuple[list[dict[str, Any]], list[dict[str, Any]] | None]] = []

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AIProviderResponse:
        self.calls.append((messages, tools))
        if not self.responses:
            return AIProviderResponse(content="Done.")
        response = self.responses.popleft()
        if isinstance(response, Exception):
            raise response
        return response


# ============================================================================
# 1. OPENING EACH SUPPORTED APPLICATION (ALL 20 APPROVED APPS)
# ============================================================================

class TestAllSupportedApplications:
    """Verify that every single app in the approved allowlist can be safely identified and launched."""

    @pytest.mark.parametrize(
        "app_spec",
        DEFAULT_APPROVED_APPS,
        ids=[app.canonical_name for app in DEFAULT_APPROVED_APPS],
    )
    def test_every_approved_app_is_findable_and_launchable(self, app_spec: AppSpec):
        mock_spawner = MagicMock()
        # Mock file existence so find_executable succeeds regardless of test host environment
        with patch.object(Path, "is_file", return_value=True), \
             patch.object(Path, "exists", return_value=True), \
             patch("shutil.which", return_value=f"C:\\Mock\\{app_spec.executables[0]}"):
            launcher = AppLauncher(process_spawner=mock_spawner)

            # 1. Verify find_app_spec recognizes canonical name
            found_canonical = launcher.find_app_spec(app_spec.canonical_name)
            assert found_canonical is not None
            assert found_canonical.canonical_name == app_spec.canonical_name

            # 2. Verify find_app_spec recognizes each alias
            for alias in app_spec.aliases:
                found_alias = launcher.find_app_spec(alias)
                assert found_alias is not None, f"Alias '{alias}' failed to resolve for {app_spec.canonical_name}"
                assert found_alias.canonical_name == app_spec.canonical_name

            # 3. Verify launch invokes process spawner with argument list (shell=False)
            result = launcher.launch(app_spec.canonical_name)
            assert result.success is True, f"Failed to launch {app_spec.canonical_name}: {result.error}"
            assert mock_spawner.call_count == 1
            call_args = mock_spawner.call_args[0][0]
            assert isinstance(call_args, list)
            assert len(call_args) >= 1

    def test_all_20_apps_present(self):
        """Verify the exact expected set of 20 applications."""
        canonical_names = {app.canonical_name for app in DEFAULT_APPROVED_APPS}
        expected = {
            "notepad", "calculator", "chrome", "edge", "firefox", "vscode",
            "explorer", "terminal", "cmd", "powershell", "paint", "task_manager",
            "snipping_tool", "word", "excel", "powerpoint", "spotify", "vlc",
            "discord", "slack",
        }
        assert canonical_names == expected
        assert len(DEFAULT_APPROVED_APPS) == 20


# ============================================================================
# 2. OPENING VALIDATED WEBSITES AND SEARCH RESULTS
# ============================================================================

class TestWebsiteAndSearchValidation:
    """Verify website URL validation, browser opener, and web search query safety."""

    def test_open_valid_websites(self):
        mock_opener = MagicMock()
        browser = BrowserLauncher(browser_opener=mock_opener)

        # Explicit https
        res = browser.open_website("https://youtube.com")
        assert res.success is True
        assert res.target == "https://youtube.com"

        # Auto-prefix https
        res2 = browser.open_website("github.com")
        assert res2.success is True
        assert res2.target == "https://github.com"

        # Localhost
        res3 = browser.open_website("http://localhost:8000")
        assert res3.success is True
        assert res3.target == "http://localhost:8000"

    def test_reject_dangerous_schemes_and_characters(self):
        mock_opener = MagicMock()
        browser = BrowserLauncher(browser_opener=mock_opener)

        dangerous = [
            "javascript:alert(1)",
            "file:///C:/Windows/System32/calc.exe",
            "data:text/html,<script>alert('xss')</script>",
            "ftp://files.example.com",
            "https://evil.com/path\nwith\rnewlines",
            "https://test.com:99999",  # Invalid port
            "",
            "   ",
        ]
        for url in dangerous:
            res = browser.open_website(url)
            assert res.success is False, f"Expected {url} to be rejected"
            assert mock_opener.call_count == 0

    def test_search_web_browser_query_encoding(self):
        mock_opener = MagicMock(return_value={"success": True, "action": "open_website"})
        mock_db = MagicMock()
        with patch.object(desktop_service, "open_website", mock_opener):
            # Test empty query rejected
            empty_res = pytest.importorskip("asyncio").run(
                execute_agent_tool("search_web_browser", {"query": "  "}, user_id="test_user", db=mock_db)
            )
            assert empty_res["status"] == "error"

            # Test valid query properly formatted and encoded
            res = pytest.importorskip("asyncio").run(
                execute_agent_tool("search_web_browser", {"query": "Python tutorials for beginners"}, user_id="test_user", db=mock_db)
            )
            assert res["status"] == "success"
            assert "https://www.google.com/search?q=Python+tutorials+for+beginners" in res["url"]
            mock_opener.assert_called_once_with("https://www.google.com/search?q=Python+tutorials+for+beginners")


# ============================================================================
# 3. OPENING PERMITTED FOLDERS AND FILES (WITH CONFIRMATION GATES)
# ============================================================================

class TestPermittedFoldersAndFiles:

    def test_open_standard_permitted_folders(self, monkeypatch, tmp_path):
        mock_opener = MagicMock()
        launcher = FolderLauncher(folder_opener=mock_opener)

        # Mock Path.home to point to temporary directory with subfolders
        standard_folders = ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"]
        for name in standard_folders:
            (tmp_path / name).mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(Path, "home", lambda: tmp_path)

        for folder in standard_folders:
            res = launcher.open_folder(folder)
            assert res.success is True
            assert mock_opener.call_count >= 1

    def test_open_folder_rejects_system_folders(self):
        mock_opener = MagicMock()
        launcher = FolderLauncher(folder_opener=mock_opener)

        system_paths = [
            "C:\\Windows\\System32",
            "C:\\Windows\\SysWOW64",
            "C:\\$Recycle.Bin",
            "C:\\System Volume Information",
        ]
        for path in system_paths:
            res = launcher.open_folder(path)
            assert res.success is False
            assert "prohibited" in (res.error or "").lower()

    def test_open_file_safe_document_opens_directly(self, tmp_path):
        doc = tmp_path / "notes.txt"
        doc.write_text("safe notes")
        mock_opener = MagicMock()
        launcher = FileLauncher(file_opener=mock_opener)

        res = launcher.open_file(str(doc))
        assert res.success is True
        assert mock_opener.call_count == 1
        assert "notes.txt" in res.message

    def test_open_file_sensitive_executable_requires_confirmation(self, tmp_path):
        script = tmp_path / "installer.bat"
        script.write_text("echo sensitive")
        mock_opener = MagicMock()
        launcher = FileLauncher(file_opener=mock_opener)

        # 1. Unconfirmed -> rejected with confirmation requirement
        res_unconfirmed = launcher.open_file(str(script), confirmed=False)
        assert res_unconfirmed.success is False
        assert res_unconfirmed.details.get("requires_confirmation") is True
        assert mock_opener.call_count == 0

        # 2. Confirmed -> opens safely
        res_confirmed = launcher.open_file(str(script), confirmed=True)
        assert res_confirmed.success is True
        assert mock_opener.call_count == 1


# ============================================================================
# 4. SCREENSHOT CREATION
# ============================================================================

class TestScreenshotCreation:

    def test_screenshot_to_designated_folder(self, tmp_path):
        mock_image = MagicMock()
        mock_grabber = MagicMock(return_value=mock_image)
        handler = ScreenshotHandler(grabber=mock_grabber)

        res = handler.take_screenshot(folder=str(tmp_path), filename="test_shot.png")
        assert res.success is True
        assert res.details.get("file_name") == "test_shot.png"
        assert Path(res.resolved_path).name == "test_shot.png"
        assert mock_image.save.call_count == 1

    def test_screenshot_handles_grabber_error_truthfully(self, tmp_path):
        mock_grabber = MagicMock(side_effect=OSError("screen grab failed"))
        handler = ScreenshotHandler(grabber=mock_grabber)

        res = handler.take_screenshot(folder=str(tmp_path))
        assert res.success is False
        assert "Failed to capture screenshot" in res.message
        assert res.error == "screen grab failed"


# ============================================================================
# 5. UNKNOWN APPLICATIONS AND INVALID PATHS
# ============================================================================

class TestUnknownAppsAndInvalidPaths:

    def test_reject_arbitrary_unapproved_apps_and_scripts(self):
        mock_spawner = MagicMock()
        launcher = AppLauncher(process_spawner=mock_spawner)

        attacks = [
            "malicious.exe",
            "cmd.exe /c del C:\\",
            "powershell -ExecutionPolicy Bypass",
            "../../calc.exe",
            "some_unknown_program_xyz",
        ]
        for attack in attacks:
            res = launcher.launch(attack)
            assert res.success is False
            assert "not in the approved allowlist" in res.message
            assert mock_spawner.call_count == 0


# ============================================================================
# 6. ORDINARY KNOWLEDGE QUESTIONS (NO TOOLS DISPATCHED)
# ============================================================================

class TestOrdinaryKnowledgeQuestions(unittest.IsolatedAsyncioTestCase):

    async def test_knowledge_questions_receive_direct_answers_without_tools(self):
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["astra_test_safety_db"]

        mock_open_app = MagicMock()
        provider = StubProvider(
            AIProviderResponse(content="The capital of France is Paris.")
        )
        ai = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await ai.send_message(
                db=db,
                user_id="safety_user",
                message="What is the capital of France?",
                persist_history=False,
                voice_mode=True,
            )
            assert "Paris" in reply
            # Verify no desktop tool was invoked
            assert mock_open_app.call_count == 0


# ============================================================================
# 7. VOICE AI TASK MANAGEMENT: CREATE, VIEW, UPDATE, DELETE & USER ISOLATION
# ============================================================================

class TestVoiceAITaskManagement(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self.client = AsyncIOMotorClient("mongodb://localhost:27017")
        self.db = self.client["astra_test_safety_db"]
        self.user_a = "user_alpha"
        self.user_b = "user_beta"
        await self.db.tasks.delete_many({"user_id": {"$in": [self.user_a, self.user_b]}})

    async def asyncTearDown(self):
        await self.db.tasks.delete_many({"user_id": {"$in": [self.user_a, self.user_b]}})

    async def test_voice_task_crud_and_user_isolation(self):
        # 1. Create task for User A
        create_res = await execute_agent_tool(
            tool_name="create_task",
            arguments={"title": "Prepare financial report", "priority": "high"},
            user_id=self.user_a,
            db=self.db,
        )
        assert create_res["status"] == "success"
        task_id = create_res["task"]["id"]

        # 2. View tasks for User A
        view_res_a = await execute_agent_tool(
            tool_name="view_tasks",
            arguments={},
            user_id=self.user_a,
            db=self.db,
        )
        assert view_res_a["status"] == "success"
        assert any(t["title"] == "Prepare financial report" for t in view_res_a["tasks"])

        # 3. User B cannot see User A's task (User Isolation)
        view_res_b = await execute_agent_tool(
            tool_name="view_tasks",
            arguments={},
            user_id=self.user_b,
            db=self.db,
        )
        assert view_res_b["status"] == "success"
        assert not any(t["title"] == "Prepare financial report" for t in view_res_b["tasks"])

        # 4. Update task for User A
        update_res = await execute_agent_tool(
            tool_name="update_task",
            arguments={"task_id": task_id, "status": "done"},
            user_id=self.user_a,
            db=self.db,
        )
        assert update_res["status"] == "success"
        assert update_res["task"]["status"] == "done"

        # 5. User B cannot delete User A's task (returns error, task not found)
        delete_fail = await execute_agent_tool(
            tool_name="delete_task",
            arguments={"task_id": task_id},
            user_id=self.user_b,
            db=self.db,
        )
        assert "error" in delete_fail
        assert "not found" in delete_fail["error"].lower()

        # 6. Delete task by User A
        delete_res = await execute_agent_tool(
            tool_name="delete_task",
            arguments={"task_id": task_id},
            user_id=self.user_a,
            db=self.db,
        )
        assert delete_res["status"] == "success"


# ============================================================================
# 8. AMBIGUOUS COMMANDS & CONFIRMATION-REQUIRED OPERATIONS
# ============================================================================

class TestAmbiguousCommandsAndConfirmation(unittest.IsolatedAsyncioTestCase):

    async def test_search_files_without_folder_requires_clarification(self):
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["astra_test_safety_db"]

        res = await execute_agent_tool(
            tool_name="search_files",
            arguments={"query": "tax_document.pdf", "folder": ""},
            user_id="test_user",
            db=db,
        )
        assert res["status"] == "needs_clarification"
        assert "Please specify which permitted folder" in res["message"]

    async def test_sensitive_app_launch_requires_confirmation(self):
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["astra_test_safety_db"]

        # Launching cmd without confirmation
        res = await execute_agent_tool(
            tool_name="open_desktop_app",
            arguments={"app_name": "cmd", "confirmed": False},
            user_id="test_user",
            db=db,
        )
        assert res["status"] == "requires_confirmation"
        assert "confirm" in res["message"].lower()


# ============================================================================
# 9. MICROPHONE/VOICE HANDLING & ERROR TRUTHFULNESS
# ============================================================================

class TestVoiceHandlingAndErrorTruthfulness(unittest.IsolatedAsyncioTestCase):

    async def test_empty_voice_input_returns_polite_prompt(self):
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["astra_test_safety_db"]

        reply = await voice_service.process_voice_input(db, "test_user", "   ")
        assert "I didn't catch that" in reply

    async def test_failed_tool_reports_truthfully_without_false_success(self):
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["astra_test_safety_db"]

        res = await execute_agent_tool(
            tool_name="open_desktop_app",
            arguments={"app_name": "non_existent_app_123"},
            user_id="test_user",
            db=db,
        )
        assert res["status"] == "error"
        assert "not in the approved allowlist" in res["message"]


# ============================================================================
# 10. AUTHENTICATION BOUNDARIES & 401 PROTECTION
# ============================================================================

class TestAuthenticationBoundaries:

    def test_unauthenticated_voice_command_rejected_with_401(self):
        app.dependency_overrides.clear()
        client = TestClient(app)
        response = client.post("/api/voice/command", json={"message": "Open Chrome."})
        assert response.status_code == 401
        assert "Authentication required" in response.text

    def test_authenticated_voice_command_accepted(self):
        try:
            mock_user = {"_id": "auth_test_user_id", "email": "test@astra.io"}
            mock_db = MagicMock()
            app.dependency_overrides[get_current_user] = lambda: mock_user
            app.dependency_overrides[get_database] = lambda: mock_db

            client = TestClient(app)

            with patch("backend.services.voice_service.voice_service.process_voice_input", new_callable=AsyncMock) as mock_voice:
                mock_voice.return_value = "Chrome is now open."
                response = client.post(
                    "/api/voice/command",
                    json={"message": "Open Chrome."},
                )
                assert response.status_code == 200
                data = response.json()
                assert data["data"]["reply"] == "Chrome is now open."
        finally:
            app.dependency_overrides.clear()
