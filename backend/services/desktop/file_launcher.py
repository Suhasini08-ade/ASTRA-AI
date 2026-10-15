"""
services/desktop/file_launcher.py
=================================
Safe file launcher that opens files using their default Windows application.
Enforces strict path validation, blocks system directories, and requires explicit
user confirmation before launching executable or script files.
"""

import logging
import os
from pathlib import Path
import subprocess
import sys
from typing import Callable

from backend.services.desktop.schemas import DesktopActionResult

logger = logging.getLogger(__name__)

# Potentially sensitive or executable extensions that require explicit user confirmation
SENSITIVE_EXTENSIONS = frozenset({
    ".exe",
    ".bat",
    ".cmd",
    ".ps1",
    ".vbs",
    ".msi",
    ".reg",
    ".scr",
    ".com",
    ".pif",
    ".hta",
    ".jar",
})

# Forbidden system folder keywords
PROHIBITED_SYSTEM_DIRS = frozenset({
    "windows",
    "system32",
    "syswow64",
    "$recycle.bin",
    "system volume information",
    "recovery",
})


class FileLauncher:
    """Safe Windows file launcher with path validation and confirmation gates."""

    def __init__(self, file_opener: Callable[[Path], None] | None = None) -> None:
        """
        Initialize with an optional opener for unit testing without spawning real applications.

        :param file_opener: Callable accepting a Path to open.
        """
        self._opener = file_opener or self._default_open

    @staticmethod
    def _default_open(file_path: Path) -> None:
        """Open the target file with its default Windows application using safe argument lists."""
        if sys.platform == "win32" and hasattr(os, "startfile"):
            os.startfile(str(file_path))  # type: ignore[attr-defined]
        else:
            subprocess.Popen(
                ["explorer.exe", str(file_path)],
                shell=False,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

    def validate_file_path(self, raw_path: str) -> tuple[Path | None, str | None, bool]:
        """
        Validate and resolve a file path.

        :param raw_path: File path or filename string.
        :return: (resolved_path, error_message, is_sensitive).
        """
        if not raw_path or not isinstance(raw_path, str) or not raw_path.strip():
            return None, "File path is required.", False

        cleaned = raw_path.strip()

        # Remove common command wrappers if accidentally present
        lowered = cleaned.lower()
        if lowered.startswith("open file "):
            cleaned = cleaned[10:].strip()
        elif lowered.startswith("open "):
            cleaned = cleaned[5:].strip()

        try:
            expanded = os.path.expandvars(os.path.expanduser(cleaned))
            resolved = Path(expanded).resolve()
        except Exception as exc:
            return None, f"Invalid file path format: {exc}", False

        # 1. Check for forbidden system directories
        parts_lower = [part.lower() for part in resolved.parts]
        for prohibited in PROHIBITED_SYSTEM_DIRS:
            if prohibited in parts_lower:
                return None, f"Opening files inside system folder '{prohibited}' is prohibited for security.", False

        # 2. Existence check
        if not resolved.exists():
            return None, f"File does not exist: '{resolved}'.", False

        # 3. Must be a file, not a directory
        if not resolved.is_file():
            return None, f"Path is a directory, not a file: '{resolved}'. Use open_folder to open folders.", False

        # 4. Check readability
        if not os.access(resolved, os.R_OK):
            return None, f"Permission denied: cannot read file '{resolved}'.", False

        # 5. Check sensitive extension
        is_sensitive = resolved.suffix.lower() in SENSITIVE_EXTENSIONS

        return resolved, None, is_sensitive

    def open_file(self, file_path: str, confirmed: bool = False) -> DesktopActionResult:
        """
        Safely open a file with its default application after validation.
        Executable or script files require explicit confirmation.

        :param file_path: Path to the file.
        :param confirmed: True if user explicitly confirmed launching a sensitive file.
        :return: DesktopActionResult indicating success or error.
        """
        resolved, err, is_sensitive = self.validate_file_path(file_path)
        if err or not resolved:
            logger.warning("[FileLauncher] File validation failed for '%s': %s", file_path, err)
            return DesktopActionResult(
                success=False,
                action="open_file",
                target=str(file_path or ""),
                message=err or "Invalid file path.",
                error=err,
            )

        # Gate sensitive executables behind user confirmation
        if is_sensitive and not confirmed:
            logger.info("[FileLauncher] Sensitive file requires confirmation: '%s'", resolved)
            return DesktopActionResult(
                success=False,
                action="open_file",
                target=str(file_path),
                resolved_path=str(resolved),
                message=(
                    f"Opening executable file '{resolved.name}' can run code on your computer. "
                    "Please confirm if you want to open it."
                ),
                error="Confirmation required.",
                details={
                    "requires_confirmation": True,
                    "file_name": resolved.name,
                    "path": str(resolved),
                    "extension": resolved.suffix.lower(),
                },
            )

        try:
            logger.info("[FileLauncher] Opening validated file: '%s'", resolved)
            self._opener(resolved)
            return DesktopActionResult(
                success=True,
                action="open_file",
                target=str(file_path),
                resolved_path=str(resolved),
                message=f"Successfully opened '{resolved.name}' with its default application.",
                details={
                    "file_name": resolved.name,
                    "path": str(resolved),
                    "extension": resolved.suffix.lower(),
                    "size_bytes": resolved.stat().st_size,
                },
            )
        except PermissionError as p_err:
            logger.error("[FileLauncher] Permission denied opening '%s': %s", resolved, p_err)
            return DesktopActionResult(
                success=False,
                action="open_file",
                target=str(file_path),
                resolved_path=str(resolved),
                message=f"Permission denied while opening '{resolved.name}'.",
                error=str(p_err),
            )
        except Exception as exc:
            logger.error("[FileLauncher] Failed to open file '%s': %s", resolved, exc)
            return DesktopActionResult(
                success=False,
                action="open_file",
                target=str(file_path),
                resolved_path=str(resolved),
                message=f"Failed to open '{resolved.name}': {exc}",
                error=str(exc),
            )
