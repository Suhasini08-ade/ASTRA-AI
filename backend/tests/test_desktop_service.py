"""
tests/test_desktop_service.py
=============================
Unit tests for ASTRA AI local Windows desktop automation service.
All system operations (processes, browser, folders) are mocked to ensure
no real applications, URLs, or filesystem windows are launched during test execution.
"""

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from backend.services.desktop.app_launcher import AppLauncher, AppSpec
from backend.services.desktop.browser_launcher import BrowserLauncher
from backend.services.desktop.folder_launcher import FolderLauncher
from backend.services.desktop.schemas import DesktopActionResult
from backend.services.desktop.service import DesktopService


# ============================================================================
# 1. SCHEMAS TESTS
# ============================================================================

def test_desktop_action_result_to_dict():
    result = DesktopActionResult(
        success=True,
        action="open_app",
        target="Notepad",
        message="Successfully launched Notepad.",
        resolved_path="C:\\Windows\\System32\\notepad.exe",
        error=None,
        details={"canonical_name": "notepad"},
    )
    data = result.to_dict()
    assert data["success"] is True
    assert data["action"] == "open_app"
    assert data["target"] == "Notepad"
    assert data["message"] == "Successfully launched Notepad."
    assert data["resolved_path"] == "C:\\Windows\\System32\\notepad.exe"
    assert data["error"] is None
    assert data["details"]["canonical_name"] == "notepad"


# ============================================================================
# 2. APP LAUNCHER TESTS
# ============================================================================

class TestAppLauncher:

    def test_get_allowed_apps_returns_list(self):
        launcher = AppLauncher()
        allowed = launcher.get_allowed_apps()
        assert len(allowed) > 0
        canonical_names = [a["canonical_name"] for a in allowed]
        assert "notepad" in canonical_names
        assert "chrome" in canonical_names
        assert "vscode" in canonical_names
        assert "calculator" in canonical_names

    def test_find_app_spec_by_canonical_and_alias(self):
        launcher = AppLauncher()
        # Direct canonical name
        spec = launcher.find_app_spec("notepad")
        assert spec is not None
        assert spec.canonical_name == "notepad"

        # Alias: 'google chrome' -> chrome
        spec_chrome = launcher.find_app_spec("google chrome")
        assert spec_chrome is not None
        assert spec_chrome.canonical_name == "chrome"

        # Alias with prefix: 'open vs code' -> vscode
        spec_vscode = launcher.find_app_spec("open vs code")
        assert spec_vscode is not None
        assert spec_vscode.canonical_name == "vscode"

        # Alias: 'calc' -> calculator
        spec_calc = launcher.find_app_spec("calc")
        assert spec_calc is not None
        assert spec_calc.canonical_name == "calculator"

        # With .exe suffix
        spec_paint = launcher.find_app_spec("mspaint.exe")
        assert spec_paint is not None
        assert spec_paint.canonical_name == "paint"

    def test_unapproved_app_is_strictly_rejected(self):
        mock_spawner = MagicMock()
        launcher = AppLauncher(process_spawner=mock_spawner)

        result = launcher.launch("arbitrary_malicious_script.bat")
        assert result.success is False
        assert "not in the approved allowlist" in result.message
        assert mock_spawner.call_count == 0

        # Another unapproved attempt
        result_cmd = launcher.launch("powershell -Command Remove-Item")
        assert result_cmd.success is False
        assert "not in the approved allowlist" in result_cmd.message
        assert mock_spawner.call_count == 0

    def test_empty_app_name_rejected(self):
        mock_spawner = MagicMock()
        launcher = AppLauncher(process_spawner=mock_spawner)

        assert launcher.launch("").success is False
        assert launcher.launch("   ").success is False
        assert launcher.launch(None).success is False  # type: ignore[arg-type]
        assert mock_spawner.call_count == 0

    def test_launch_approved_app_success_with_mock_spawner(self, monkeypatch, tmp_path):
        dummy_exe = tmp_path / "notepad.exe"
        dummy_exe.write_text("dummy binary")

        mock_spawner = MagicMock()
        launcher = AppLauncher(process_spawner=mock_spawner)

        # Force detect_executable_path to return our dummy executable
        monkeypatch.setattr(launcher, "detect_executable_path", lambda spec: dummy_exe)

        res = launcher.launch("notepad")
        assert res.success is True
        assert res.action == "open_app"
        assert res.target == "Notepad"
        assert res.resolved_path == str(dummy_exe)
        assert "Successfully launched Notepad" in res.message

        # Verify argument list was passed (never shell string)
        mock_spawner.assert_called_once_with([str(dummy_exe)])

    def test_approved_app_not_installed_on_system(self, monkeypatch):
        mock_spawner = MagicMock()
        launcher = AppLauncher(process_spawner=mock_spawner)

        # Simulate app not installed on system
        monkeypatch.setattr(launcher, "detect_executable_path", lambda spec: None)

        res = launcher.launch("vlc")
        assert res.success is False
        assert "was not found installed on this system" in res.message
        assert res.error == "Executable not found on system."
        assert mock_spawner.call_count == 0

    def test_launch_handles_permission_error(self, monkeypatch, tmp_path):
        dummy_exe = tmp_path / "calc.exe"
        dummy_exe.write_text("dummy binary")

        def mock_failing_spawner(args):
            raise PermissionError("Access is denied")

        launcher = AppLauncher(process_spawner=mock_failing_spawner)
        monkeypatch.setattr(launcher, "detect_executable_path", lambda spec: dummy_exe)

        res = launcher.launch("calc")
        assert res.success is False
        assert "Permission denied" in res.message
        assert "Access is denied" in (res.error or "")

    def test_launch_handles_os_error(self, monkeypatch, tmp_path):
        dummy_exe = tmp_path / "calc.exe"
        dummy_exe.write_text("dummy binary")

        def mock_failing_spawner(args):
            raise OSError("WinError 193: %1 is not a valid Win32 application")

        launcher = AppLauncher(process_spawner=mock_failing_spawner)
        monkeypatch.setattr(launcher, "detect_executable_path", lambda spec: dummy_exe)

        res = launcher.launch("calc")
        assert res.success is False
        assert "Failed to launch" in res.message


# ============================================================================
# 3. BROWSER LAUNCHER TESTS
# ============================================================================

class TestBrowserLauncher:

    def test_valid_https_url(self):
        mock_opener = MagicMock(return_value=True)
        launcher = BrowserLauncher(browser_opener=mock_opener)

        res = launcher.open_website("https://github.com/project")
        assert res.success is True
        assert res.action == "open_website"
        assert res.target == "https://github.com/project"
        mock_opener.assert_called_once_with("https://github.com/project")

    def test_valid_http_localhost(self):
        mock_opener = MagicMock(return_value=True)
        launcher = BrowserLauncher(browser_opener=mock_opener)

        res = launcher.open_website("http://localhost:3000")
        assert res.success is True
        mock_opener.assert_called_once_with("http://localhost:3000")

    def test_auto_prefix_https(self):
        mock_opener = MagicMock(return_value=True)
        launcher = BrowserLauncher(browser_opener=mock_opener)

        res = launcher.open_website("google.com")
        assert res.success is True
        assert res.target == "https://google.com"
        mock_opener.assert_called_once_with("https://google.com")

    def test_reject_dangerous_schemes(self):
        mock_opener = MagicMock()
        launcher = BrowserLauncher(browser_opener=mock_opener)

        prohibited = [
            "file:///C:/Windows/System32/cmd.exe",
            "javascript:alert(document.cookie)",
            "data:text/plain;base64,SGVsbG8=",
            "powershell:Start-Process",
            "ftp://example.com/file",
            "ssh://user@host",
        ]
        for url in prohibited:
            res = launcher.open_website(url)
            assert res.success is False
            assert "Prohibited URL scheme" in (res.error or "")

        assert mock_opener.call_count == 0

    def test_reject_dangerous_characters(self):
        mock_opener = MagicMock()
        launcher = BrowserLauncher(browser_opener=mock_opener)

        injections = [
            "https://google.com; rm -rf /",
            "https://google.com && calc.exe",
            "https://google.com | calc.exe",
            "https://google.com`calc`",
            "https://google.com<script>",
            "https://google.com\ncalc.exe",
        ]
        for bad_url in injections:
            res = launcher.open_website(bad_url)
            assert res.success is False
            assert "prohibited characters" in (res.error or "")

        assert mock_opener.call_count == 0

    def test_empty_or_invalid_url(self):
        launcher = BrowserLauncher()
        assert launcher.open_website("").success is False
        assert launcher.open_website("   ").success is False
        assert launcher.open_website(None).success is False  # type: ignore[arg-type]

    def test_invalid_port_number(self):
        mock_opener = MagicMock()
        launcher = BrowserLauncher(browser_opener=mock_opener)

        res = launcher.open_website("https://example.com:99999")
        assert res.success is False
        assert "Invalid port" in (res.error or "")

    def test_opener_exception_handled(self):
        def failing_opener(url):
            raise RuntimeError("Browser not found")

        launcher = BrowserLauncher(browser_opener=failing_opener)
        res = launcher.open_website("https://example.com")
        assert res.success is False
        assert "Failed to open website" in res.message


# ============================================================================
# 4. FOLDER LAUNCHER TESTS
# ============================================================================

class TestFolderLauncher:

    def test_get_standard_folders(self):
        launcher = FolderLauncher()
        folders = launcher.get_standard_folders()
        assert "desktop" in folders
        assert "documents" in folders
        assert "downloads" in folders

    def test_open_standard_folder_desktop(self, monkeypatch, tmp_path):
        mock_opener = MagicMock()
        launcher = FolderLauncher(folder_opener=mock_opener)

        # Mock Path.home to point to temporary directory
        fake_desktop = tmp_path / "Desktop"
        fake_desktop.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(Path, "home", lambda: tmp_path)

        res = launcher.open_folder("Desktop")
        assert res.success is True
        assert res.action == "open_folder"
        assert res.resolved_path == str(fake_desktop)
        mock_opener.assert_called_once_with(fake_desktop)

    def test_open_custom_folder(self, tmp_path):
        mock_opener = MagicMock()
        launcher = FolderLauncher(folder_opener=mock_opener)

        custom_dir = tmp_path / "MyProject"
        custom_dir.mkdir(parents=True, exist_ok=True)

        res = launcher.open_folder(str(custom_dir))
        assert res.success is True
        assert res.resolved_path == str(custom_dir)
        mock_opener.assert_called_once_with(custom_dir)

    def test_reject_prohibited_system_folder(self):
        mock_opener = MagicMock()
        launcher = FolderLauncher(folder_opener=mock_opener)

        prohibited_paths = [
            "C:\\Windows\\System32",
            "C:\\Windows\\SysWOW64",
            "C:\\$Recycle.Bin",
            "C:\\System Volume Information",
        ]
        for p in prohibited_paths:
            res = launcher.open_folder(p)
            assert res.success is False
            assert "prohibited" in (res.error or "").lower()

        assert mock_opener.call_count == 0

    def test_reject_nonexistent_folder(self, tmp_path):
        mock_opener = MagicMock()
        launcher = FolderLauncher(folder_opener=mock_opener)

        nonexistent = tmp_path / "definitely_not_existing_folder_12345"
        res = launcher.open_folder(str(nonexistent))
        assert res.success is False
        assert "does not exist" in (res.error or "")
        assert mock_opener.call_count == 0

    def test_reject_file_path_as_folder(self, tmp_path):
        mock_opener = MagicMock()
        launcher = FolderLauncher(folder_opener=mock_opener)

        some_file = tmp_path / "some_text.txt"
        some_file.write_text("Hello world")

        res = launcher.open_folder(str(some_file))
        assert res.success is False
        assert "is a file, not a folder" in (res.error or "")
        assert mock_opener.call_count == 0

    def test_empty_folder_input(self):
        launcher = FolderLauncher()
        assert launcher.open_folder("").success is False
        assert launcher.open_folder("   ").success is False
        assert launcher.open_folder(None).success is False  # type: ignore[arg-type]

    def test_folder_opener_handles_permission_error(self, tmp_path):
        def failing_opener(path):
            raise PermissionError("Access denied")

        launcher = FolderLauncher(folder_opener=failing_opener)
        valid_dir = tmp_path / "ValidDir"
        valid_dir.mkdir(parents=True, exist_ok=True)

        res = launcher.open_folder(str(valid_dir))
        assert res.success is False
        assert "Permission denied" in res.message


# ============================================================================
# 5. DESKTOP SERVICE INTEGRATION TESTS
# ============================================================================

class TestDesktopService:

    def test_service_facade_methods(self, monkeypatch, tmp_path):
        dummy_exe = tmp_path / "code.cmd"
        dummy_exe.write_text("dummy")

        mock_spawner = MagicMock()
        mock_browser = MagicMock(return_value=True)
        mock_folder = MagicMock()

        app_launcher = AppLauncher(process_spawner=mock_spawner)
        monkeypatch.setattr(app_launcher, "detect_executable_path", lambda s: dummy_exe)

        browser_launcher = BrowserLauncher(browser_opener=mock_browser)
        folder_launcher = FolderLauncher(folder_opener=mock_folder)

        service = DesktopService(
            app_launcher=app_launcher,
            browser_launcher=browser_launcher,
            folder_launcher=folder_launcher,
        )

        # 1. open_app
        app_res = service.open_app("vscode")
        assert isinstance(app_res, dict)
        assert app_res["success"] is True
        assert app_res["action"] == "open_app"
        assert app_res["target"] == "Visual Studio Code"
        mock_spawner.assert_called_once()

        # 2. open_website
        web_res = service.open_website("https://astra.ai")
        assert isinstance(web_res, dict)
        assert web_res["success"] is True
        assert web_res["action"] == "open_website"
        mock_browser.assert_called_once_with("https://astra.ai")

        # 3. open_folder
        folder_dir = tmp_path / "TestFolder"
        folder_dir.mkdir()
        folder_res = service.open_folder(str(folder_dir))
        assert isinstance(folder_res, dict)
        assert folder_res["success"] is True
        assert folder_res["action"] == "open_folder"
        mock_folder.assert_called_once_with(folder_dir)

        # 4. allowed apps & folders
        allowed_apps = service.get_allowed_applications()
        assert len(allowed_apps) > 0
        allowed_folders = service.get_approved_folders()
        assert len(allowed_folders) > 0
