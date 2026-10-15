"""
services/desktop/volume_controller.py
=====================================
Safe volume-control actions for Windows using standard virtual-key multimedia events.
Supports volume step up, step down, and mute/unmute toggling with safety step limits
and mockable backend execution for testing.
"""

import ctypes
import logging
import sys
from typing import Any, Callable

from backend.services.desktop.schemas import DesktopActionResult

logger = logging.getLogger(__name__)

# Virtual key constants for Windows multimedia keys
VK_VOLUME_MUTE = 0xAD  # 173
VK_VOLUME_DOWN = 0xAE  # 174
VK_VOLUME_UP = 0xAF    # 175
KEYEVENTF_KEYUP = 0x0002

# Limit maximum steps in a single command to avoid sudden audio blasts
MAX_VOLUME_STEPS = 10
MIN_VOLUME_STEPS = 1


def _default_volume_sender(action: str, steps: int) -> None:
    """Send volume virtual key events via Windows user32.dll."""
    if sys.platform != "win32":
        raise OSError("Volume control is only supported on Windows platforms.")

    user32 = ctypes.windll.user32

    if action == "mute":
        # Toggle mute
        user32.keybd_event(VK_VOLUME_MUTE, 0, 0, 0)
        user32.keybd_event(VK_VOLUME_MUTE, 0, KEYEVENTF_KEYUP, 0)
    elif action == "up":
        for _ in range(steps):
            user32.keybd_event(VK_VOLUME_UP, 0, 0, 0)
            user32.keybd_event(VK_VOLUME_UP, 0, KEYEVENTF_KEYUP, 0)
    elif action == "down":
        for _ in range(steps):
            user32.keybd_event(VK_VOLUME_DOWN, 0, 0, 0)
            user32.keybd_event(VK_VOLUME_DOWN, 0, KEYEVENTF_KEYUP, 0)
    else:
        raise ValueError(f"Unsupported volume action: '{action}'. Must be 'up', 'down', or 'mute'.")


class VolumeController:
    """Safe Windows volume controller with step limiting and testability."""

    def __init__(self, key_sender: Callable[[str, int], None] | None = None) -> None:
        """
        Initialize with an optional key sender for unit testing.

        :param key_sender: Callable accepting (action: str, steps: int).
        """
        self._sender = key_sender or _default_volume_sender

    def control_volume(self, action: str, steps: int = 2) -> DesktopActionResult:
        """
        Adjust volume or toggle mute on the local Windows system.

        :param action: Action to perform ('up', 'down', 'mute', 'unmute').
        :param steps: Number of step increments (1 to 10, default 2).
        :return: DesktopActionResult indicating success or error.
        """
        if not action or not isinstance(action, str) or not action.strip():
            return DesktopActionResult(
                success=False,
                action="control_volume",
                target="system_audio",
                message="Volume action is required. Supported actions: 'up', 'down', 'mute'.",
                error="Missing action.",
            )

        norm_action = action.strip().lower()

        # Normalize synonyms
        if norm_action in ("increase", "louder", "raise", "higher", "vol_up", "up"):
            resolved_action = "up"
        elif norm_action in ("decrease", "lower", "quiet", "quieter", "softer", "vol_down", "down"):
            resolved_action = "down"
        elif norm_action in ("mute", "unmute", "silence", "toggle_mute"):
            resolved_action = "mute"
        else:
            return DesktopActionResult(
                success=False,
                action="control_volume",
                target=action,
                message=f"Unsupported volume action '{action}'. Supported actions: 'up', 'down', 'mute'.",
                error="Invalid action.",
            )

        # Enforce step limits
        safe_steps = max(MIN_VOLUME_STEPS, min(int(steps or 2), MAX_VOLUME_STEPS))

        try:
            self._sender(resolved_action, safe_steps)

            if resolved_action == "mute":
                msg = "Toggled system audio mute."
            elif resolved_action == "up":
                msg = f"Increased system volume by {safe_steps} step(s)."
            else:
                msg = f"Decreased system volume by {safe_steps} step(s)."

            logger.info("[VolumeController] %s", msg)
            return DesktopActionResult(
                success=True,
                action="control_volume",
                target=resolved_action,
                message=msg,
                details={"action": resolved_action, "steps": safe_steps},
            )
        except OSError as os_err:
            logger.error("[VolumeController] OS error adjusting volume: %s", os_err)
            return DesktopActionResult(
                success=False,
                action="control_volume",
                target=resolved_action,
                message=f"Volume control unavailable on this system: {os_err}",
                error=str(os_err),
            )
        except Exception as exc:
            logger.error("[VolumeController] Failed to adjust volume: %s", exc)
            return DesktopActionResult(
                success=False,
                action="control_volume",
                target=resolved_action,
                message=f"Failed to adjust volume: {exc}",
                error=str(exc),
            )
