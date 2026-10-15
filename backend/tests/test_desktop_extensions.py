"""
tests/test_desktop_extensions.py
================================
Unit tests for extended desktop automation capabilities in ASTRA AI:
1. Desktop Screenshot capture & saving
2. Safe File Searching bounded to permitted user folders
3. Safe File Opening with validation & executable confirmation
4. Local Date and Time reporting
5. Safe Volume Control
"""

from datetime import datetime, timezone
import os
from pathlib import Path
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from backend.services.desktop.datetime_reporter import DateTimeReporter
from backend.services.desktop.file_launcher import FileLauncher
from backend.services.desktop.file_searcher import FileSearcher
from backend.services.desktop.screenshot_handler import ScreenshotHandler
from backend.services.desktop.service import DesktopService
from backend.services.desktop.volume_controller import VolumeController
from backend.services.agent_tools import execute_agent_tool, AGENT_TOOLS


# ============================================================================
# 1. SCREENSHOT HANDLER TESTS
# ============================================================================

class TestScreenshotHandler:

    def test_screenshot_success_with_mock_grabber(self, tmp_path):
        mock_image = MagicMock()
        mock_grabber = MagicMock(return_value=mock_image)

        handler = ScreenshotHandler(grabber=mock_grabber)
        result = handler.take_screenshot(folder=str(tmp_path), filename="test_shot.png")

        assert result.success is True
        assert result.action == "take_screenshot"
        assert result.resolved_path == str(tmp_path / "test_shot.png")
        assert "test_shot.png" in result.message
        mock_grabber.assert_called_once()
        mock_image.save.assert_called_once_with(tmp_path / "test_shot.png")

    def test_screenshot_default_destination_is_screenshots_dir(self):
        handler = ScreenshotHandler()
        dest, err = handler.resolve_destination(folder=None)
        assert err is None
        assert dest is not None
        assert "screenshots" in str(dest).lower()
        assert dest.suffix == ".png"

    def test_screenshot_rejects_system_directory(self):
        handler = ScreenshotHandler()
        dest, err = handler.resolve_destination(folder="C:\\Windows\\System32")
        assert dest is None
        assert err is not None
        assert "prohibited for security" in err.lower()

    def test_screenshot_handles_grabber_failure(self, tmp_path):
        mock_grabber = MagicMock(side_effect=RuntimeError("Screen capture failed: handle invalid"))
        handler = ScreenshotHandler(grabber=mock_grabber)

        result = handler.take_screenshot(folder=str(tmp_path))
        assert result.success is False
        assert "failed to capture screenshot" in result.message.lower()
        assert "handle invalid" in str(result.error)


# ============================================================================
# 2. FILE SEARCHER TESTS
# ============================================================================

class TestFileSearcher:

    @pytest.fixture
    def test_search_tree(self, tmp_path):
        """Create a mock directory tree for testing bounded searches."""
        docs = tmp_path / "Documents"
        docs.mkdir()
        (docs / "annual_report.docx").write_text("dummy")
        (docs / "budget_2026.xlsx").write_text("dummy")
        (docs / "notes.txt").write_text("dummy")

        sub = docs / "Projects"
        sub.mkdir()
        (sub / "report_q1.pdf").write_text("dummy")
        (sub / "invoice_101.pdf").write_text("dummy")

        # Hidden/ignored subdirectories that should be skipped
        ignored = docs / "node_modules"
        ignored.mkdir()
        (ignored / "report_internal.js").write_text("dummy")

        return docs

    def test_search_files_requires_query(self, test_search_tree):
        searcher = FileSearcher()
        result = searcher.search_files(query="", folder=str(test_search_tree))
        assert result.success is False
        assert "query is required" in result.message.lower()

    def test_search_files_requires_folder(self):
        searcher = FileSearcher()
        result = searcher.search_files(query="report", folder="")
        assert result.success is False
        assert result.details.get("needs_folder") is True
        assert "search folder is required" in result.message.lower()

    def test_search_files_prohibits_whole_drive_search(self):
        searcher = FileSearcher()
        for drive in ("C:\\", "D:\\", "/", "c:"):
            result = searcher.search_files(query="report", folder=drive)
            assert result.success is False
            assert "entire drive is prohibited" in result.message.lower()

    def test_search_files_prohibits_system_directories(self):
        searcher = FileSearcher()
        result = searcher.search_files(query="cmd.exe", folder="C:\\Windows\\System32")
        assert result.success is False
        assert "system folder" in result.message.lower()

    def test_search_files_finds_matches_and_skips_node_modules(self, test_search_tree):
        searcher = FileSearcher()
        result = searcher.search_files(query="report", folder=str(test_search_tree))
        assert result.success is True
        assert result.details["count"] == 2  # annual_report.docx and report_q1.pdf (node_modules skipped)
        names = [f["file_name"] for f in result.details["files"]]
        assert "annual_report.docx" in names
        assert "report_q1.pdf" in names
        assert "report_internal.js" not in names

    def test_search_files_does_not_read_or_return_file_contents(self, test_search_tree):
        searcher = FileSearcher()
        result = searcher.search_files(query="notes.txt", folder=str(test_search_tree))
        assert result.success is True
        file_entry = result.details["files"][0]
        assert "content" not in file_entry
        assert "text" not in file_entry
        assert "file_name" in file_entry
        assert "path" in file_entry
        assert "size_bytes" in file_entry
        assert "modified_at" in file_entry

    def test_search_files_handles_no_matches(self, test_search_tree):
        searcher = FileSearcher()
        result = searcher.search_files(query="nonexistent_xyz", folder=str(test_search_tree))
        assert result.success is True
        assert result.details["count"] == 0
        assert "no files matching" in result.message.lower()


# ============================================================================
# 3. FILE LAUNCHER TESTS
# ============================================================================

class TestFileLauncher:

    def test_open_file_requires_path(self):
        launcher = FileLauncher()
        result = launcher.open_file("")
        assert result.success is False
        assert "file path is required" in result.message.lower()

    def test_open_file_nonexistent_returns_error(self, tmp_path):
        launcher = FileLauncher()
        nonexistent = tmp_path / "does_not_exist.txt"
        result = launcher.open_file(str(nonexistent))
        assert result.success is False
        assert "does not exist" in result.message.lower()

    def test_open_file_directory_rejected(self, tmp_path):
        launcher = FileLauncher()
        result = launcher.open_file(str(tmp_path))
        assert result.success is False
        assert "is a directory" in result.message.lower()

    def test_open_file_prohibits_system_directories(self):
        launcher = FileLauncher()
        result = launcher.open_file("C:\\Windows\\System32\\config.sys")
        assert result.success is False
        assert "system folder" in result.message.lower()

    def test_open_file_sensitive_executable_requires_confirmation(self, tmp_path):
        mock_opener = MagicMock()
        launcher = FileLauncher(file_opener=mock_opener)

        exe_file = tmp_path / "setup.exe"
        exe_file.write_text("fake binary")

        # Without confirmation
        result = launcher.open_file(str(exe_file), confirmed=False)
        assert result.success is False
        assert result.details.get("requires_confirmation") is True
        assert "please confirm" in result.message.lower()
        mock_opener.assert_not_called()

        # With confirmation
        confirmed_result = launcher.open_file(str(exe_file), confirmed=True)
        assert confirmed_result.success is True
        assert "successfully opened" in confirmed_result.message.lower()
        mock_opener.assert_called_once_with(exe_file.resolve())

    def test_open_file_safe_document_opens_without_confirmation(self, tmp_path):
        mock_opener = MagicMock()
        launcher = FileLauncher(file_opener=mock_opener)

        doc_file = tmp_path / "presentation.pdf"
        doc_file.write_text("fake pdf")

        result = launcher.open_file(str(doc_file), confirmed=False)
        assert result.success is True
        assert "successfully opened" in result.message.lower()
        mock_opener.assert_called_once_with(doc_file.resolve())


# ============================================================================
# 4. DATE AND TIME REPORTER TESTS
# ============================================================================

class TestDateTimeReporter:

    def test_get_current_datetime_returns_formatted_time(self):
        fixed_dt = datetime(2026, 10, 15, 14, 30, 0, tzinfo=timezone.utc)
        reporter = DateTimeReporter(time_provider=lambda: fixed_dt)

        result = reporter.get_current_datetime()
        assert result.success is True
        assert result.action == "get_current_datetime"
        details = result.details
        assert details["year"] == 2026
        assert details["month"] == 10
        assert details["day"] == 15
        assert details["hour"] == 14
        assert details["minute"] == 30
        assert "2:30 PM" in result.message or "14:30" in result.message

    def test_get_current_datetime_live_returns_valid_structure(self):
        reporter = DateTimeReporter()
        result = reporter.get_current_datetime()
        assert result.success is True
        assert "details" in result.to_dict()
        assert "time" in result.details
        assert "date" in result.details
        assert "timezone" in result.details


# ============================================================================
# 5. VOLUME CONTROLLER TESTS
# ============================================================================

class TestVolumeController:

    def test_control_volume_requires_action(self):
        controller = VolumeController()
        result = controller.control_volume("")
        assert result.success is False
        assert "action is required" in result.message.lower()

    def test_control_volume_rejects_invalid_action(self):
        controller = VolumeController()
        result = controller.control_volume("turn_to_11")
        assert result.success is False
        assert "unsupported volume action" in result.message.lower()

    def test_control_volume_up_invokes_sender(self):
        mock_sender = MagicMock()
        controller = VolumeController(key_sender=mock_sender)

        result = controller.control_volume("up", steps=3)
        assert result.success is True
        assert result.action == "control_volume"
        assert result.details["action"] == "up"
        assert result.details["steps"] == 3
        mock_sender.assert_called_once_with("up", 3)

    def test_control_volume_down_clamps_steps(self):
        mock_sender = MagicMock()
        controller = VolumeController(key_sender=mock_sender)

        result = controller.control_volume("down", steps=99)
        assert result.success is True
        assert result.details["steps"] == 10  # Clamped to MAX_VOLUME_STEPS (10)
        mock_sender.assert_called_once_with("down", 10)

    def test_control_volume_mute_invokes_sender(self):
        mock_sender = MagicMock()
        controller = VolumeController(key_sender=mock_sender)

        result = controller.control_volume("mute")
        assert result.success is True
        assert result.details["action"] == "mute"
        mock_sender.assert_called_once_with("mute", 2)


# ============================================================================
# 6. DESKTOP SERVICE FACADE INTEGRATION TESTS
# ============================================================================

class TestDesktopServiceFacade:

    def test_desktop_service_coordinates_all_actions(self, tmp_path):
        mock_grabber = MagicMock()
        mock_opener = MagicMock()
        mock_volume_sender = MagicMock()

        test_file = tmp_path / "notes.txt"
        test_file.write_text("sample notes")

        service = DesktopService(
            screenshot_handler=ScreenshotHandler(grabber=mock_grabber),
            file_launcher=FileLauncher(file_opener=mock_opener),
            volume_controller=VolumeController(key_sender=mock_volume_sender),
        )

        # 1. Screenshot
        shot_res = service.take_screenshot(folder=str(tmp_path), filename="shot.png")
        assert shot_res["success"] is True

        # 2. Search
        search_res = service.search_files(query="notes", folder=str(tmp_path))
        assert search_res["success"] is True
        assert search_res["details"]["count"] == 1

        # 3. Open File
        open_res = service.open_file(str(test_file))
        assert open_res["success"] is True

        # 4. Date Time
        dt_res = service.get_local_datetime()
        assert dt_res["success"] is True

        # 5. Volume
        vol_res = service.control_volume("up", steps=2)
        assert vol_res["success"] is True


# ============================================================================
# 7. AGENT TOOLS EXECUTION & SCHEMAS TESTS
# ============================================================================

import unittest

class TestAgentToolsDesktopExtensions(unittest.IsolatedAsyncioTestCase):

    def test_new_desktop_tools_registered_in_agent_tools(self):
        tool_names = {t["function"]["name"] for t in AGENT_TOOLS}
        assert "take_screenshot" in tool_names
        assert "search_files" in tool_names
        assert "open_file" in tool_names
        assert "get_current_datetime" in tool_names
        assert "control_volume" in tool_names

    async def test_execute_agent_tool_take_screenshot(self):
        mock_db = MagicMock()
        with patch("backend.services.agent_tools.desktop_service.take_screenshot") as mock_shot:
            mock_shot.return_value = {
                "success": True,
                "action": "take_screenshot",
                "resolved_path": "C:\\Users\\test\\Pictures\\screen.png",
                "message": "Screenshot saved.",
                "details": {"file_name": "screen.png", "folder": "C:\\Users\\test\\Pictures"},
            }
            res = await execute_agent_tool(
                "take_screenshot",
                {"folder": "Pictures", "filename": "screen.png"},
                mock_db,
                "user_123",
            )
            assert res["status"] == "success"
            assert res["action"] == "take_screenshot"
            assert res["file_name"] == "screen.png"

    async def test_execute_agent_tool_search_files(self):
        mock_db = MagicMock()
        with patch("backend.services.agent_tools.desktop_service.search_files") as mock_search:
            mock_search.return_value = {
                "success": True,
                "action": "search_files",
                "resolved_path": "C:\\Users\\test\\Documents",
                "message": "Found 1 file.",
                "details": {"count": 1, "files": [{"file_name": "report.pdf"}]},
            }
            res = await execute_agent_tool(
                "search_files",
                {"query": "report", "folder": "Documents"},
                mock_db,
                "user_123",
            )
            assert res["status"] == "success"
            assert res["count"] == 1

    async def test_execute_agent_tool_search_files_requires_folder_clarification(self):
        mock_db = MagicMock()
        res = await execute_agent_tool(
            "search_files",
            {"query": "report", "folder": ""},
            mock_db,
            "user_123",
        )
        assert res["status"] == "needs_clarification"
        assert "please specify which permitted folder" in res["message"].lower()

    async def test_execute_agent_tool_open_file_sensitive_confirmation(self):
        mock_db = MagicMock()
        with patch("backend.services.agent_tools.desktop_service.open_file") as mock_open:
            mock_open.return_value = {
                "success": False,
                "action": "open_file",
                "message": "Opening executable file 'setup.exe' requires confirmation.",
                "details": {
                    "requires_confirmation": True,
                    "file_name": "setup.exe",
                    "path": "C:\\Users\\test\\setup.exe",
                },
            }
            res = await execute_agent_tool(
                "open_file",
                {"file_path": "C:\\Users\\test\\setup.exe", "confirmed": False},
                mock_db,
                "user_123",
            )
            assert res["status"] == "requires_confirmation"
            assert "requires confirmation" in res["message"].lower()

    async def test_execute_agent_tool_get_current_datetime(self):
        mock_db = MagicMock()
        with patch("backend.services.agent_tools.desktop_service.get_local_datetime") as mock_dt:
            mock_dt.return_value = {
                "success": True,
                "action": "get_current_datetime",
                "message": "The current local time is 10:45 PM on Thursday, October 15, 2026.",
                "details": {
                    "time": "10:45 PM",
                    "date": "Thursday, October 15, 2026",
                    "day_of_week": "Thursday",
                    "timezone": "UTC+05:30",
                    "iso_timestamp": "2026-10-15T22:45:00+05:30",
                },
            }
            res = await execute_agent_tool(
                "get_current_datetime",
                {},
                mock_db,
                "user_123",
            )
            assert res["status"] == "success"
            assert res["time"] == "10:45 PM"

    async def test_execute_agent_tool_control_volume(self):
        mock_db = MagicMock()
        with patch("backend.services.agent_tools.desktop_service.control_volume") as mock_vol:
            mock_vol.return_value = {
                "success": True,
                "action": "control_volume",
                "target": "up",
                "message": "Increased system volume by 2 step(s).",
                "details": {"action": "up", "steps": 2},
            }
            res = await execute_agent_tool(
                "control_volume",
                {"action": "up", "steps": 2},
                mock_db,
                "user_123",
            )
            assert res["status"] == "success"
            assert res["target"] == "up"
            assert res["steps"] == 2
