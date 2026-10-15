"""
services/desktop
================
Modular local Windows desktop automation subsystem for ASTRA AI.
"""

from backend.services.desktop.app_launcher import AppLauncher, AppSpec
from backend.services.desktop.browser_launcher import BrowserLauncher
from backend.services.desktop.datetime_reporter import DateTimeReporter
from backend.services.desktop.file_launcher import FileLauncher
from backend.services.desktop.file_searcher import FileSearcher
from backend.services.desktop.folder_launcher import FolderLauncher
from backend.services.desktop.schemas import DesktopActionResult
from backend.services.desktop.screenshot_handler import ScreenshotHandler
from backend.services.desktop.service import DesktopService, desktop_service
from backend.services.desktop.volume_controller import VolumeController

__all__ = [
    "AppLauncher",
    "AppSpec",
    "BrowserLauncher",
    "DateTimeReporter",
    "DesktopActionResult",
    "DesktopService",
    "FileLauncher",
    "FileSearcher",
    "FolderLauncher",
    "ScreenshotHandler",
    "VolumeController",
    "desktop_service",
]
