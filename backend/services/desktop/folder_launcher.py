"""
services/desktop/folder_launcher.py
===================================
Safe folder launcher for Windows.
Supports standard user folders (Desktop, Documents, Downloads, etc.) and
user-selected directories with strict path-traversal safeguards and
prohibited system directory protection.
"""

import logging
import os
from pathlib import Path
import subprocess
import sys
from typing import Callable

from backend.services.desktop.schemas import DesktopActionResult

logger = logging.getLogger(__name__)

# Standard user directories
STANDARD_FOLDER_MAP: dict[str, Callable[[], Path]] = {
    "desktop": lambda: Path.home() / "Desktop",
    "documents": lambda: Path.home() / "Documents",
    "my documents": lambda: Path.home() / "Documents",
    "downloads": lambda: Path.home() / "Downloads",
    "pictures": lambda: Path.home() / "Pictures",
    "photos": lambda: Path.home() / "Pictures",
    "videos": lambda: Path.home() / "Videos",
    "movies": lambda: Path.home() / "Videos",
    "music": lambda: Path.home() / "Music",
    "home": lambda: Path.home(),
    "user": lambda: Path.home(),
    "profile": lambda: Path.home(),
}

# Substrings or path components forbidden from being opened directly for security
PROHIBITED_FOLDER_NAMES = frozenset({
    "system32",
    "syswow64",
    "$recycle.bin",
    "system volume information",
    "recovery",
    "boot",
})


class FolderLauncher:
    """Safe Windows folder launcher with directory resolution and security checks."""

    def __init__(self, folder_opener: Callable[[Path], None] | None = None) -> None:
        # Dependency-injected opener for safe unit testing without popping UI windows
        self._opener = folder_opener or self._default_open

    @staticmethod
    def _default_open(folder_path: Path) -> None:
        """Open the target folder in Windows File Explorer using argument list."""
        if sys.platform == "win32" and hasattr(os, "startfile"):
            os.startfile(str(folder_path))  # type: ignore[attr-defined]
        else:
            subprocess.Popen(
                ["explorer.exe", str(folder_path)],
                shell=False,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

    @staticmethod
    def get_standard_folders() -> list[str]:
        """Return list of supported standard folder aliases."""
        return sorted(list(set(STANDARD_FOLDER_MAP.keys())))

    def validate_folder(self, raw_input: str) -> tuple[Path | None, str | None]:
        """
        Validate and resolve a folder name or filesystem path.

        :param raw_input: Standard folder name ('Desktop', 'Downloads') or custom path.
        :return: (resolved_path, error_message). If valid, error_message is None.
        """
        if not raw_input or not isinstance(raw_input, str) or not raw_input.strip():
            return None, "Invalid input: folder name or path is empty."

        cleaned = raw_input.strip()
        lowered = cleaned.lower()

        # Remove common prefixes like 'open folder ', 'open '
        if lowered.startswith("open folder "):
            cleaned = cleaned[12:].strip()
            lowered = cleaned.lower()
        elif lowered.startswith("open "):
            cleaned = cleaned[5:].strip()
            lowered = cleaned.lower()

        # 1. Check standard folder alias
        if lowered in STANDARD_FOLDER_MAP:
            target_path = STANDARD_FOLDER_MAP[lowered]().resolve()
        else:
            # 2. Custom path resolution
            try:
                expanded = os.path.expandvars(os.path.expanduser(cleaned))
                target_path = Path(expanded).resolve()
            except Exception as exc:
                return None, f"Invalid folder path format: {exc}"

        # 3. Check existence
        if not target_path.exists():
            return None, f"Folder does not exist: '{target_path}'."

        # 4. Check that it is a directory (not a file)
        if not target_path.is_dir():
            return None, f"Specified path is a file, not a folder: '{target_path}'."

        # 5. Security check: prohibit sensitive system directories
        path_parts_lowered = [part.lower() for part in target_path.parts]
        for prohibited in PROHIBITED_FOLDER_NAMES:
            if prohibited in path_parts_lowered:
                return None, f"Access to system folder '{prohibited}' is prohibited for security."

        # Prohibit opening Windows root System directory directly (e.g. C:\Windows\System32)
        system_root = os.environ.get("SystemRoot")
        if system_root:
            sys_root_path = Path(system_root).resolve()
            if target_path == sys_root_path / "System32" or target_path == sys_root_path / "SysWOW64":
                return None, "Access to Windows core system directory is prohibited."

        # 6. Check readability
        if not os.access(target_path, os.R_OK):
            return None, f"Permission denied: cannot read directory '{target_path}'."

        return target_path, None

    def open_folder(self, folder_name_or_path: str) -> DesktopActionResult:
        """
        Validate and open an approved or custom folder in Windows File Explorer.

        :param folder_name_or_path: Name of standard folder or directory path.
        :return: DesktopActionResult indicating success or error details.
        """
        resolved_path, error = self.validate_folder(folder_name_or_path)
        if error or not resolved_path:
            logger.warning("[FolderLauncher] Folder validation failed for '%s': %s", folder_name_or_path, error)
            return DesktopActionResult(
                success=False,
                action="open_folder",
                target=str(folder_name_or_path or ""),
                message=error or "Failed to open folder.",
                error=error,
            )

        try:
            logger.info("[FolderLauncher] Opening validated folder: '%s'", resolved_path)
            self._opener(resolved_path)
            return DesktopActionResult(
                success=True,
                action="open_folder",
                target=str(folder_name_or_path),
                resolved_path=str(resolved_path),
                message=f"Successfully opened folder '{resolved_path.name or str(resolved_path)}'.",
                details={"folder_name": resolved_path.name, "path": str(resolved_path)},
            )
        except PermissionError as p_err:
            logger.error("[FolderLauncher] Permission error opening '%s': %s", resolved_path, p_err)
            return DesktopActionResult(
                success=False,
                action="open_folder",
                target=str(folder_name_or_path),
                resolved_path=str(resolved_path),
                message=f"Permission denied while opening folder '{resolved_path}'.",
                error=str(p_err),
            )
        except (OSError, Exception) as exc:
            logger.error("[FolderLauncher] Failed to open folder '%s': %s", resolved_path, exc)
            return DesktopActionResult(
                success=False,
                action="open_folder",
                target=str(folder_name_or_path),
                resolved_path=str(resolved_path),
                message=f"Failed to open folder '{resolved_path}': {exc}",
                error=str(exc),
            )
