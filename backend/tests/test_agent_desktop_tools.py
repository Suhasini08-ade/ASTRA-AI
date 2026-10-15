"""
tests/test_agent_desktop_tools.py
=================================
Comprehensive tests for Phase 3: Natural-language desktop command recognition.
Tests:
- Desktop tools registration in AGENT_TOOLS
- Tool dispatch handlers in execute_agent_tool
- Safe execution, error handling, input validation
- Sensitive action confirmation (cmd/powershell)
- End-to-end AIService agent turns with StubProvider
- Distinction between desktop commands and ordinary questions
- Preservation of existing productivity and knowledge tools
"""

from collections import deque
from typing import Any
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.providers.base import (
    AIProviderResponse,
    BaseAIProvider,
    ToolCallItem,
)
from backend.services.agent_tools import AGENT_TOOLS, execute_agent_tool
from backend.services.ai_service import AIService
from backend.services.voice_service import voice_service


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


class FakeCursor:
    def __init__(self, documents: list[dict[str, Any]]) -> None:
        self.documents = documents

    def sort(self, *_args: Any, **_kwargs: Any) -> "FakeCursor":
        return self

    def limit(self, *_args: Any, **_kwargs: Any) -> "FakeCursor":
        return self

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        return self.documents[:length] if length is not None else self.documents


class FakeCollection:
    def __init__(self) -> None:
        self.documents: dict[str, dict[str, Any]] = {}
        self.inserted: list[dict[str, Any]] = []

    def find(self, *_args: Any, **_kwargs: Any) -> FakeCursor:
        return FakeCursor(list(self.documents.values()))

    async def insert_one(self, document: dict[str, Any]) -> None:
        self.inserted.append(document)
        return None

    async def update_one(self, *_args: Any, **_kwargs: Any) -> None:
        return None

    async def delete_one(self, *_args: Any, **_kwargs: Any) -> Any:
        m = MagicMock()
        m.deleted_count = 0
        return m

    async def delete_many(self, *_args: Any, **_kwargs: Any) -> Any:
        m = MagicMock()
        m.deleted_count = 0
        return m


class FakeDatabase:
    def __init__(self) -> None:
        self.chat_messages = FakeCollection()
        self.ai_pending_actions = FakeCollection()
        self.tasks = FakeCollection()
        self.notes = FakeCollection()
        self.reminders = FakeCollection()
        self.calendar_events = FakeCollection()


# ============================================================================
# 1. TOOL SCHEMA REGISTRATION & EXISTING TOOLS PRESERVATION
# ============================================================================

class TestToolRegistration(unittest.TestCase):

    def test_desktop_tools_registered_in_agent_tools(self):
        tool_names = {
            tool["function"]["name"]
            for tool in AGENT_TOOLS
            if tool.get("type") == "function"
        }
        self.assertIn("open_desktop_app", tool_names)
        self.assertIn("open_website", tool_names)
        self.assertIn("search_web_browser", tool_names)
        self.assertIn("open_folder", tool_names)

    def test_existing_tools_remain_intact(self):
        tool_names = {
            tool["function"]["name"]
            for tool in AGENT_TOOLS
            if tool.get("type") == "function"
        }
        expected_existing = {
            "create_task", "view_tasks", "update_task", "delete_task",
            "create_note", "view_notes", "update_note", "delete_note",
            "create_reminder", "view_reminders", "update_reminder", "delete_reminder",
            "view_calendar_events", "create_calendar_event", "update_calendar_event", "delete_calendar_event",
            "get_weather", "get_news", "summarize_document", "search_knowledge", "save_knowledge",
        }
        for name in expected_existing:
            self.assertIn(name, tool_names, f"Missing existing tool: {name}")


# ============================================================================
# 2. DISPATCHER & HANDLER TESTS (execute_agent_tool)
# ============================================================================

class TestAgentToolDispatch(unittest.IsolatedAsyncioTestCase):

    def setUp(self) -> None:
        self.db = FakeDatabase()

    async def test_dispatch_open_desktop_app_success(self):
        mock_result = {
            "success": True,
            "action": "open_app",
            "target": "Google Chrome",
            "resolved_path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "message": "Successfully launched Google Chrome.",
        }
        with patch("backend.services.desktop.desktop_service.open_app", return_value=mock_result) as mock_open:
            res = await execute_agent_tool("open_desktop_app", {"app_name": "chrome"}, self.db, "user123")  # type: ignore[arg-type]
            self.assertEqual(res["status"], "success")
            self.assertEqual(res["target"], "Google Chrome")
            self.assertIn("chrome.exe", res["resolved_path"])
            mock_open.assert_called_once_with("chrome")

    async def test_dispatch_open_desktop_app_unknown_rejected(self):
        mock_result = {
            "success": False,
            "action": "open_app",
            "target": "malicious_script",
            "error": "Application 'malicious_script' is not in the approved allowlist.",
            "message": "Application 'malicious_script' is not in the approved allowlist.",
        }
        with patch("backend.services.desktop.desktop_service.open_app", return_value=mock_result):
            res = await execute_agent_tool("open_desktop_app", {"app_name": "malicious_script"}, self.db, "user123")  # type: ignore[arg-type]
            self.assertEqual(res["status"], "error")
            self.assertIn("allowlist", res["message"])

    async def test_dispatch_open_desktop_app_empty_name(self):
        res = await execute_agent_tool("open_desktop_app", {}, self.db, "user123")  # type: ignore[arg-type]
        self.assertEqual(res["status"], "error")
        self.assertIn("Application name is required", res["error"])

    async def test_dispatch_open_desktop_app_sensitive_requires_confirmation(self):
        # Requesting command prompt without confirmation must be gated
        res = await execute_agent_tool("open_desktop_app", {"app_name": "cmd"}, self.db, "user123")  # type: ignore[arg-type]
        self.assertEqual(res["status"], "requires_confirmation")
        self.assertIn("terminal access", res["message"].lower())

        # Requesting powershell without confirmation must be gated
        res_ps = await execute_agent_tool("open_desktop_app", {"app_name": "powershell"}, self.db, "user123")  # type: ignore[arg-type]
        self.assertEqual(res_ps["status"], "requires_confirmation")

    async def test_dispatch_open_desktop_app_sensitive_with_confirmation_proceeds(self):
        mock_result = {
            "success": True,
            "action": "open_app",
            "target": "Command Prompt",
            "resolved_path": "C:\\Windows\\System32\\cmd.exe",
            "message": "Successfully launched Command Prompt.",
        }
        with patch("backend.services.desktop.desktop_service.open_app", return_value=mock_result) as mock_open:
            res = await execute_agent_tool(
                "open_desktop_app",
                {"app_name": "cmd", "confirmed": True},
                self.db,  # type: ignore[arg-type]
                "user123",
            )
            self.assertEqual(res["status"], "success")
            mock_open.assert_called_once_with("cmd")

    async def test_dispatch_open_desktop_app_redirects_web_alias(self):
        mock_web_result = {
            "success": True,
            "action": "open_website",
            "target": "https://www.youtube.com",
            "message": "Successfully opened website 'https://www.youtube.com'.",
        }
        with patch("backend.services.desktop.desktop_service.open_website", return_value=mock_web_result):
            # Calling open_desktop_app with 'youtube' should seamlessly route to open_website
            res = await execute_agent_tool("open_desktop_app", {"app_name": "youtube"}, self.db, "user123")  # type: ignore[arg-type]
            self.assertEqual(res["status"], "success")
            self.assertEqual(res["action"], "open_website")
            self.assertIn("youtube.com", res["target"])

    async def test_dispatch_open_website_success(self):
        mock_web_result = {
            "success": True,
            "action": "open_website",
            "target": "https://github.com",
            "message": "Successfully opened website 'https://github.com'.",
        }
        with patch("backend.services.desktop.desktop_service.open_website", return_value=mock_web_result) as mock_web:
            res = await execute_agent_tool("open_website", {"url": "https://github.com"}, self.db, "user123")  # type: ignore[arg-type]
            self.assertEqual(res["status"], "success")
            self.assertEqual(res["target"], "https://github.com")
            mock_web.assert_called_once_with("https://github.com")

    async def test_dispatch_open_website_empty_url(self):
        res = await execute_agent_tool("open_website", {"url": ""}, self.db, "user123")  # type: ignore[arg-type]
        self.assertEqual(res["status"], "error")
        self.assertIn("Website URL is required", res["error"])

    async def test_dispatch_search_web_browser_success(self):
        mock_web_result = {
            "success": True,
            "action": "open_website",
            "target": "https://www.google.com/search?q=Python+tutorials",
            "message": "Successfully opened website.",
        }
        with patch("backend.services.desktop.desktop_service.open_website", return_value=mock_web_result) as mock_web:
            res = await execute_agent_tool("search_web_browser", {"query": "Python tutorials"}, self.db, "user123")  # type: ignore[arg-type]
            self.assertEqual(res["status"], "success")
            self.assertEqual(res["action"], "search_web_browser")
            self.assertIn("Python+tutorials", res["url"])
            mock_web.assert_called_once_with("https://www.google.com/search?q=Python+tutorials")

    async def test_dispatch_search_web_browser_empty_query(self):
        res = await execute_agent_tool("search_web_browser", {"query": "   "}, self.db, "user123")  # type: ignore[arg-type]
        self.assertEqual(res["status"], "error")
        self.assertIn("Search query is required", res["error"])

    async def test_dispatch_open_folder_success(self):
        mock_folder_result = {
            "success": True,
            "action": "open_folder",
            "target": "Downloads",
            "resolved_path": "C:\\Users\\User\\Downloads",
            "message": "Successfully opened folder 'Downloads'.",
        }
        with patch("backend.services.desktop.desktop_service.open_folder", return_value=mock_folder_result) as mock_folder:
            res = await execute_agent_tool("open_folder", {"folder_name": "Downloads"}, self.db, "user123")  # type: ignore[arg-type]
            self.assertEqual(res["status"], "success")
            self.assertEqual(res["target"], "Downloads")
            mock_folder.assert_called_once_with("Downloads")

    async def test_dispatch_open_folder_empty(self):
        res = await execute_agent_tool("open_folder", {"folder_name": ""}, self.db, "user123")  # type: ignore[arg-type]
        self.assertEqual(res["status"], "error")
        self.assertIn("Folder name or path is required", res["error"])


# ============================================================================
# 3. END-TO-END AISERVICE TURNS & QUESTION DISTINCTION
# ============================================================================

class TestAIServiceDesktopIntegration(unittest.IsolatedAsyncioTestCase):

    def setUp(self) -> None:
        self.db = FakeDatabase()

    async def test_ai_service_open_chrome_flow(self):
        mock_open_app = MagicMock(return_value={
            "success": True,
            "action": "open_app",
            "target": "Google Chrome",
            "resolved_path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "message": "Successfully launched Google Chrome.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_chrome_1",
                        name="open_desktop_app",
                        arguments={"app_name": "chrome"},
                    )
                ]
            ),
            AIProviderResponse(content="Done. Opened Google Chrome."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="user_test",
                message="Open Chrome.",
                persist_history=False,
                voice_mode=True,
            )
            self.assertIn("Chrome", reply)
            mock_open_app.assert_called_once_with("chrome")

    async def test_ai_service_launch_vscode_flow(self):
        mock_open_app = MagicMock(return_value={
            "success": True,
            "action": "open_app",
            "target": "Visual Studio Code",
            "resolved_path": "C:\\Users\\User\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
            "message": "Successfully launched Visual Studio Code.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_vscode_1",
                        name="open_desktop_app",
                        arguments={"app_name": "vscode"},
                    )
                ]
            ),
            AIProviderResponse(content="Done. Opened VS Code."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="user_test",
                message="Launch VS Code.",
                persist_history=False,
            )
            self.assertIn("VS Code", reply)
            mock_open_app.assert_called_once_with("vscode")

    async def test_ai_service_open_calculator_flow(self):
        mock_open_app = MagicMock(return_value={
            "success": True,
            "action": "open_app",
            "target": "Calculator",
            "resolved_path": "C:\\Windows\\System32\\calc.exe",
            "message": "Successfully launched Calculator.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_calc_1",
                        name="open_desktop_app",
                        arguments={"app_name": "calculator"},
                    )
                ]
            ),
            AIProviderResponse(content="Done. Calculator opened."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="user_test",
                message="Open Calculator.",
                persist_history=False,
            )
            self.assertIn("Calculator", reply)
            mock_open_app.assert_called_once_with("calculator")

    async def test_ai_service_open_youtube_website(self):
        mock_open_web = MagicMock(return_value={
            "success": True,
            "action": "open_website",
            "target": "https://www.youtube.com",
            "message": "Successfully opened website 'https://www.youtube.com'.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_yt_1",
                        name="open_website",
                        arguments={"url": "https://www.youtube.com"},
                    )
                ]
            ),
            AIProviderResponse(content="Opened YouTube in your browser."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_website", mock_open_web), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="user_test",
                message="Open YouTube.",
                persist_history=False,
            )
            self.assertIn("YouTube", reply)
            mock_open_web.assert_called_once_with("https://www.youtube.com")

    async def test_ai_service_search_web_tutorials(self):
        mock_open_web = MagicMock(return_value={
            "success": True,
            "action": "open_website",
            "target": "https://www.google.com/search?q=Python+tutorials",
            "message": "Successfully opened website.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_search_1",
                        name="search_web_browser",
                        arguments={"query": "Python tutorials"},
                    )
                ]
            ),
            AIProviderResponse(content="Searching the web for Python tutorials."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_website", mock_open_web), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="user_test",
                message="Search for Python tutorials.",
                persist_history=False,
            )
            self.assertIn("Python tutorials", reply)
            mock_open_web.assert_called_once_with("https://www.google.com/search?q=Python+tutorials")

    async def test_ai_service_open_downloads_folder(self):
        mock_open_folder = MagicMock(return_value={
            "success": True,
            "action": "open_folder",
            "target": "Downloads",
            "resolved_path": "C:\\Users\\User\\Downloads",
            "message": "Successfully opened folder 'Downloads'.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_folder_1",
                        name="open_folder",
                        arguments={"folder_name": "Downloads"},
                    )
                ]
            ),
            AIProviderResponse(content="Opened your Downloads folder."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_folder", mock_open_folder), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="user_test",
                message="Open my Downloads folder.",
                persist_history=False,
            )
            self.assertIn("Downloads", reply)
            mock_open_folder.assert_called_once_with("Downloads")

    async def test_ai_service_ordinary_question_does_not_invoke_tools(self):
        """
        Verify that ordinary questions ('What is the largest city by area?')
        receive a direct factual answer and do NOT launch tools.
        """
        mock_open_app = MagicMock()
        provider = StubProvider(
            AIProviderResponse(
                content="By total administrative area, Hulunbuir in Inner Mongolia, China is among the largest cities in the world."
            )
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="user_test",
                message="What is the largest city by area?",
                persist_history=False,
            )
            self.assertTrue("Hulunbuir" in reply or "China" in reply or "city" in reply)
            # No desktop tools were executed
            self.assertEqual(mock_open_app.call_count, 0)

    async def test_ai_service_execution_failure_reports_truthfully(self):
        """Verify that if an action fails on the system, the agent truthfully reports the error."""
        mock_open_app = MagicMock(return_value={
            "success": False,
            "action": "open_app",
            "target": "Spotify",
            "error": "Executable not found on system.",
            "message": "Application 'Spotify' is approved in the allowlist, but was not found installed on this system.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_spot_1",
                        name="open_desktop_app",
                        arguments={"app_name": "spotify"},
                    )
                ]
            ),
            AIProviderResponse(
                content="Spotify is in the approved list, but it does not appear to be installed on your computer."
            ),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="user_test",
                message="Open Spotify.",
                persist_history=False,
            )
            self.assertTrue("not" in reply.lower() or "installed" in reply.lower())
            mock_open_app.assert_called_once_with("spotify")


# ============================================================================
# 5. PHASE 4: VOICE AI & DESKTOP AUTOMATION INTEGRATION TESTS
# ============================================================================

class TestPhase4VoiceDesktopIntegration(unittest.IsolatedAsyncioTestCase):
    """
    Validates Phase 4:
    - Microphone → transcript → agent tool routing → validated desktop action → actual result → short spoken response
    - Exact user voice examples:
        * 'Open Chrome.' -> opens Chrome and responds 'Opening Chrome.'
        * 'Open YouTube.' -> opens YouTube and confirms success
        * 'Open my Downloads folder.' -> opens folder and confirms success
        * 'What is the largest city by area?' -> answers question without launching apps
    - Truthful error reporting: never announce success before the action succeeds
    - Generic placeholder removal: no blind 'Done.'
    - Voice/chat history isolation: voice mode never persists to chat_messages
    - Markdown stripping for spoken output (clean TTS speech)
    - VoiceService bridge integration
    """

    def setUp(self) -> None:
        self.db = FakeDatabase()

    async def test_voice_flow_open_chrome_spoken_confirmation(self):
        """User: 'Open Chrome.' -> launches Chrome and gives short spoken response."""
        mock_open_app = MagicMock(return_value={
            "success": True,
            "action": "open_app",
            "target": "Google Chrome",
            "resolved_path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "message": "Successfully launched Google Chrome.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_voice_chrome",
                        name="open_desktop_app",
                        arguments={"app_name": "chrome"},
                    )
                ]
            ),
            AIProviderResponse(content="Opening Chrome."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="voice_user",
                message="Open Chrome.",
                persist_history=False,
                voice_mode=True,
            )
            self.assertEqual(reply, "Opening Chrome.")
            mock_open_app.assert_called_once_with("chrome")
            # History not persisted for voice commands
            self.assertEqual(len(self.db.chat_messages.inserted), 0)

    async def test_voice_flow_open_youtube_spoken_confirmation(self):
        """User: 'Open YouTube.' -> launches YouTube in browser and confirms success."""
        mock_open_web = MagicMock(return_value={
            "success": True,
            "action": "open_website",
            "target": "https://www.youtube.com",
            "message": "Successfully opened https://www.youtube.com in the default browser.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_voice_yt",
                        name="open_website",
                        arguments={"url": "https://www.youtube.com"},
                    )
                ]
            ),
            AIProviderResponse(content="Opened YouTube."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_website", mock_open_web), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="voice_user",
                message="Open YouTube.",
                persist_history=False,
                voice_mode=True,
            )
            self.assertEqual(reply, "Opened YouTube.")
            mock_open_web.assert_called_once_with("https://www.youtube.com")
            self.assertEqual(len(self.db.chat_messages.inserted), 0)

    async def test_voice_flow_open_downloads_folder_spoken_confirmation(self):
        """User: 'Open my Downloads folder.' -> opens folder and confirms success."""
        mock_open_folder = MagicMock(return_value={
            "success": True,
            "action": "open_folder",
            "target": "Downloads",
            "resolved_path": "C:\\Users\\User\\Downloads",
            "message": "Successfully opened folder: Downloads.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_voice_down",
                        name="open_folder",
                        arguments={"folder_name": "Downloads"},
                    )
                ]
            ),
            AIProviderResponse(content="Opened Downloads."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_folder", mock_open_folder), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="voice_user",
                message="Open my Downloads folder.",
                persist_history=False,
                voice_mode=True,
            )
            self.assertEqual(reply, "Opened Downloads.")
            mock_open_folder.assert_called_once_with("Downloads")
            self.assertEqual(len(self.db.chat_messages.inserted), 0)

    async def test_voice_flow_general_question_answers_without_tools(self):
        """User: 'What is the largest city by area?' -> answers question without launching applications."""
        mock_open_app = MagicMock()
        mock_open_web = MagicMock()
        mock_open_folder = MagicMock()
        factual_answer = "Chongqing in southwestern China is the largest city in the world by administrative area, covering over 82,000 square kilometers."
        provider = StubProvider(
            AIProviderResponse(content=factual_answer)
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.desktop.desktop_service.open_website", mock_open_web), \
             patch("backend.services.desktop.desktop_service.open_folder", mock_open_folder), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="voice_user",
                message="What is the largest city by area?",
                persist_history=False,
                voice_mode=True,
            )
            self.assertEqual(reply, factual_answer)
            mock_open_app.assert_not_called()
            mock_open_web.assert_not_called()
            mock_open_folder.assert_not_called()
            self.assertEqual(len(self.db.chat_messages.inserted), 0)

    async def test_voice_flow_never_announces_success_when_tool_fails(self):
        """If desktop action fails, assistant truthfully reports error even if model attempts to claim success."""
        mock_open_app = MagicMock(return_value={
            "success": False,
            "action": "open_app",
            "target": "chrome",
            "error": "Google Chrome executable was not found on this system.",
            "message": "Failed to launch application: not installed.",
        })
        # Model incorrectly tries to say "Opened Chrome!" after failure
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_fail_chrome",
                        name="open_desktop_app",
                        arguments={"app_name": "chrome"},
                    )
                ]
            ),
            AIProviderResponse(content="Opened Chrome successfully!"),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="voice_user",
                message="Open Chrome.",
                persist_history=False,
                voice_mode=True,
            )
            # The system must enforce truthful failure reporting, never announcing success
            self.assertFalse(reply.lower().startswith("opened chrome"))
            self.assertIn("not found", reply.lower())

    async def test_voice_flow_replaces_generic_placeholder_with_actual_result(self):
        """When tool succeeds but model returns generic 'Done.', return actual tool outcome."""
        mock_open_app = MagicMock(return_value={
            "success": True,
            "action": "open_app",
            "target": "Google Chrome",
            "resolved_path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "message": "Successfully launched Google Chrome.",
        })
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_done_chrome",
                        name="open_desktop_app",
                        arguments={"app_name": "chrome"},
                    )
                ]
            ),
            AIProviderResponse(content="Done."),
        )
        service = AIService(provider=provider)

        with patch("backend.services.desktop.desktop_service.open_app", mock_open_app), \
             patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="voice_user",
                message="Open Chrome.",
                persist_history=False,
                voice_mode=True,
            )
            self.assertEqual(reply, "Successfully launched Google Chrome.")

    async def test_voice_flow_strips_markdown_formatting(self):
        """Spoken output in voice mode must strip markdown formatting before TTS."""
        provider = StubProvider(
            AIProviderResponse(
                content="**Opening Chrome.** Click [here](https://google.com) to view `chrome.exe`."
            )
        )
        service = AIService(provider=provider)

        with patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="voice_user",
                message="Open Chrome.",
                persist_history=False,
                voice_mode=True,
            )
            self.assertNotIn("**", reply)
            self.assertNotIn("[here]", reply)
            self.assertNotIn("`", reply)
            self.assertEqual(reply, "Opening Chrome. Click here to view chrome.exe.")

    async def test_voice_flow_unsupported_app_returns_clear_error(self):
        """Unsupported application request returns truthful refusal."""
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    ToolCallItem(
                        id="call_bad_app",
                        name="open_desktop_app",
                        arguments={"app_name": "malicious_script"},
                    )
                ]
            ),
            AIProviderResponse(content=""),
        )
        service = AIService(provider=provider)

        with patch("backend.services.knowledge_service.knowledge_service.search_knowledge", new=AsyncMock(return_value=[])):
            reply = await service.send_message(
                db=self.db,  # type: ignore[arg-type]
                user_id="voice_user",
                message="Open malicious script.",
                persist_history=False,
                voice_mode=True,
            )
            self.assertIn("not in the approved allowlist", reply)

    async def test_voice_service_bridge_routes_with_voice_mode_and_no_persistence(self):
        """VoiceService.process_voice_input routes correctly to AIService with voice_mode=True."""
        with patch.object(AIService, "send_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = "Opening Chrome."
            reply = await voice_service.process_voice_input(self.db, "voice_user", "Open Chrome.")  # type: ignore[arg-type]

            self.assertEqual(reply, "Opening Chrome.")
            mock_send.assert_awaited_once_with(
                self.db,
                "voice_user",
                "Open Chrome.",
                persist_history=False,
                voice_mode=True,
            )

    async def test_voice_service_empty_input_handled_gracefully(self):
        """Empty or whitespace speech transcript handled without calling AI service."""
        reply = await voice_service.process_voice_input(self.db, "voice_user", "   ")  # type: ignore[arg-type]
        self.assertEqual(reply, "I didn't catch that. Could you repeat?")
