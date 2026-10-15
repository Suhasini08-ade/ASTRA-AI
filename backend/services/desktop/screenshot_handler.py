"""
services/desktop/screenshot_handler.py
======================================
Captures desktop screenshots and saves them to designated user-accessible folders.
Supports standard locations (Pictures/Screenshots, Desktop) with path validation
and mockable capture backend for safe unit testing.
"""

from datetime import datetime
import logging
import os
from pathlib import Path
import re
from typing import Any, Callable

from backend.services.desktop.schemas import DesktopActionResult

logger = logging.getLogger(__name__)

# Default directory for saving screenshots
DEFAULT_SCREENSHOTS_DIR = Path.home() / "Pictures" / "Screenshots"

# Prohibited folder keywords for security
PROHIBITED_TARGET_NAMES = frozenset({
    "system32",
    "syswow64",
    "$recycle.bin",
    "system volume information",
    "recovery",
    "windows",
    "program files",
    "program files (x86)",
})


def _default_grabber() -> Any:
    """Capture screen using Pillow ImageGrab."""
    try:
        from PIL import ImageGrab
        img = ImageGrab.grab(all_screens=True)
        if img is None:
            raise RuntimeError("Screen grab returned empty image.")
        return img
    except Exception as exc:
        logger.error("[ScreenshotHandler] Screen grab failed: %s", exc)
        raise RuntimeError(
            f"Screen capture failed (desktop may be locked or running in a headless session): {exc}"
        ) from exc


class ScreenshotHandler:
    """Handles taking and saving desktop screenshots safely."""

    def __init__(self, grabber: Callable[[], Any] | None = None) -> None:
        """
        Initialize with an optional grabber function for unit testing.

        :param grabber: A zero-argument callable returning a PIL.Image or compatible object
                        that has a ``save(path)`` method.
        """
        self._grabber = grabber or _default_grabber

    def resolve_destination(self, folder: str | None = None, filename: str | None = None) -> tuple[Path | None, str | None]:
        """
        Validate and resolve destination directory and file path.

        :param folder: Target folder alias or path (defaults to Pictures/Screenshots).
        :param filename: Optional custom filename (defaults to timestamped name).
        :return: (resolved_file_path, error_message).
        """
        # 1. Resolve folder
        if not folder or not str(folder).strip():
            dest_dir = DEFAULT_SCREENSHOTS_DIR
        else:
            cleaned_folder = str(folder).strip().lower()
            if cleaned_folder in ("screenshots", "pictures/screenshots", "pictures"):
                dest_dir = DEFAULT_SCREENSHOTS_DIR
            elif cleaned_folder == "desktop":
                dest_dir = Path.home() / "Desktop"
            elif cleaned_folder == "documents":
                dest_dir = Path.home() / "Documents"
            elif cleaned_folder == "downloads":
                dest_dir = Path.home() / "Downloads"
            else:
                try:
                    expanded = os.path.expandvars(os.path.expanduser(str(folder).strip()))
                    dest_dir = Path(expanded).resolve()
                except Exception as exc:
                    return None, f"Invalid destination folder path: {exc}"

        # 2. Security validation: prohibit writing into Windows system directories
        parts_lower = [part.lower() for part in dest_dir.parts]
        for prohibited in PROHIBITED_TARGET_NAMES:
            if prohibited in parts_lower:
                return None, f"Saving screenshots into system folder '{prohibited}' is prohibited for security."

        # 3. Resolve filename
        if filename and str(filename).strip():
            safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', str(filename).strip())
            if not safe_name.lower().endswith((".png", ".jpg", ".jpeg")):
                safe_name += ".png"
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = f"screenshot_{timestamp}.png"

        try:
            dest_dir.mkdir(parents=True, exist_ok=True)
        except PermissionError as p_err:
            return None, f"Permission denied creating destination folder '{dest_dir}': {p_err}"
        except OSError as o_err:
            return None, f"Failed to access destination directory '{dest_dir}': {o_err}"

        return dest_dir / safe_name, None

    def take_screenshot(self, folder: str | None = None, filename: str | None = None) -> DesktopActionResult:
        """
        Take a screenshot of the user's desktop and save it to a designated folder.

        :param folder: Optional folder alias or path (default: Pictures/Screenshots).
        :param filename: Optional custom filename.
        :return: DesktopActionResult with status and resolved file path.
        """
        target_path, err = self.resolve_destination(folder, filename)
        if err or not target_path:
            logger.warning("[ScreenshotHandler] Destination resolution failed: %s", err)
            return DesktopActionResult(
                success=False,
                action="take_screenshot",
                target=str(folder or "Pictures/Screenshots"),
                message=err or "Invalid screenshot destination.",
                error=err,
            )

        try:
            image = self._grabber()
            image.save(target_path)
            file_size = target_path.stat().st_size if target_path.exists() else 0

            logger.info("[ScreenshotHandler] Screenshot successfully saved to '%s'", target_path)
            return DesktopActionResult(
                success=True,
                action="take_screenshot",
                target=str(target_path),
                resolved_path=str(target_path),
                message=f"Screenshot successfully saved to '{target_path.name}' in {target_path.parent.name}.",
                details={
                    "file_name": target_path.name,
                    "folder": str(target_path.parent),
                    "full_path": str(target_path),
                    "size_bytes": file_size,
                },
            )
        except PermissionError as p_err:
            logger.error("[ScreenshotHandler] Permission denied saving screenshot: %s", p_err)
            return DesktopActionResult(
                success=False,
                action="take_screenshot",
                target=str(target_path),
                resolved_path=str(target_path),
                message=f"Permission denied while saving screenshot to '{target_path}'.",
                error=str(p_err),
            )
        except Exception as exc:
            logger.error("[ScreenshotHandler] Failed to capture or save screenshot: %s", exc)
            return DesktopActionResult(
                success=False,
                action="take_screenshot",
                target=str(target_path),
                message=f"Failed to capture screenshot: {exc}",
                error=str(exc),
            )
