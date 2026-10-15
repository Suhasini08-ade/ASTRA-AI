"""
services/desktop/service.py
===========================
Unified facade for Windows desktop automation in ASTRA AI.
Coordinates application launching, website opening, folder navigation,
screenshots, bounded file search, file opening, local time reporting,
and volume control through modular, isolated handlers with strict security guardrails.
"""

from typing import Any

from backend.services.desktop.app_launcher import AppLauncher
from backend.services.desktop.browser_launcher import BrowserLauncher
from backend.services.desktop.datetime_reporter import DateTimeReporter
from backend.services.desktop.file_launcher import FileLauncher
from backend.services.desktop.file_searcher import FileSearcher
from backend.services.desktop.folder_launcher import FolderLauncher
from backend.services.desktop.schemas import DesktopActionResult
from backend.services.desktop.screenshot_handler import ScreenshotHandler
from backend.services.desktop.volume_controller import VolumeController


class DesktopService:
    """Central service coordinator for local Windows desktop automation."""

    def __init__(
        self,
        app_launcher: AppLauncher | None = None,
        browser_launcher: BrowserLauncher | None = None,
        folder_launcher: FolderLauncher | None = None,
        screenshot_handler: ScreenshotHandler | None = None,
        file_searcher: FileSearcher | None = None,
        file_launcher: FileLauncher | None = None,
        datetime_reporter: DateTimeReporter | None = None,
        volume_controller: VolumeController | None = None,
    ) -> None:
        self.apps = app_launcher or AppLauncher()
        self.browser = browser_launcher or BrowserLauncher()
        self.folders = folder_launcher or FolderLauncher()
        self.screenshot = screenshot_handler or ScreenshotHandler()
        self.searcher = file_searcher or FileSearcher()
        self.file_launcher = file_launcher or FileLauncher()
        self.datetime_reporter = datetime_reporter or DateTimeReporter()
        self.volume = volume_controller or VolumeController()

    def open_app(self, app_name: str) -> dict[str, Any]:
        """
        Open an approved application from the allowlist.

        :param app_name: Name of the application (e.g. 'Notepad', 'Chrome', 'VS Code').
        :return: Standardized dictionary result with success status and details.
        """
        result = self.apps.launch(app_name)
        return result.to_dict()

    def open_website(self, url: str) -> dict[str, Any]:
        """
        Open a validated HTTP/HTTPS website in the default browser.

        :param url: Web address (e.g. 'google.com', 'https://github.com').
        :return: Standardized dictionary result with success status and details.
        """
        result = self.browser.open_website(url)
        return result.to_dict()

    def open_folder(self, folder_name_or_path: str) -> dict[str, Any]:
        """
        Open an approved or custom folder in Windows File Explorer.

        :param folder_name_or_path: Folder alias ('Desktop', 'Downloads') or valid directory path.
        :return: Standardized dictionary result with success status and details.
        """
        result = self.folders.open_folder(folder_name_or_path)
        return result.to_dict()

    def take_screenshot(self, folder: str | None = None, filename: str | None = None) -> dict[str, Any]:
        """
        Capture desktop screenshot and save to a designated user-accessible folder.

        :param folder: Optional folder alias or path (defaults to Pictures/Screenshots).
        :param filename: Optional custom filename.
        :return: Standardized dictionary result with file path.
        """
        result = self.screenshot.take_screenshot(folder=folder, filename=filename)
        return result.to_dict()

    def search_files(self, query: str, folder: str | None = None, limit: int = 20) -> dict[str, Any]:
        """
        Search for files by name inside an explicitly selected, permitted user folder.

        :param query: File name or pattern to search for.
        :param folder: Permitted folder alias (e.g. 'Documents', 'Downloads', 'Desktop').
        :param limit: Maximum number of matches to return (max 50).
        :return: Standardized dictionary result with matching files.
        """
        result = self.searcher.search_files(query=query, folder=folder, limit=limit)
        return result.to_dict()

    def open_file(self, file_path: str, confirmed: bool = False) -> dict[str, Any]:
        """
        Open a selected file using its default application after validating the path.

        :param file_path: Path to the target file.
        :param confirmed: True if user explicitly confirmed launching a sensitive executable.
        :return: Standardized dictionary result.
        """
        result = self.file_launcher.open_file(file_path=file_path, confirmed=confirmed)
        return result.to_dict()

    def get_local_datetime(self) -> dict[str, Any]:
        """
        Report current local date, time, and timezone information.

        :return: Standardized dictionary result with formatted strings.
        """
        result = self.datetime_reporter.get_current_datetime()
        return result.to_dict()

    def control_volume(self, action: str, steps: int = 2) -> dict[str, Any]:
        """
        Adjust Windows volume ('up', 'down', 'mute').

        :param action: Volume action ('up', 'down', 'mute').
        :param steps: Step increments (1 to 10).
        :return: Standardized dictionary result.
        """
        result = self.volume.control_volume(action=action, steps=steps)
        return result.to_dict()

    def get_allowed_applications(self) -> list[dict[str, Any]]:
        """Return all applications available in the predefined allowlist."""
        return self.apps.get_allowed_apps()

    def get_approved_folders(self) -> list[str]:
        """Return standard folder aliases available for quick access."""
        return self.folders.get_standard_folders()


# Module-level default singleton instance
desktop_service = DesktopService()
