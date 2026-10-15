"""
services/desktop/schemas.py
===========================
Data structures and result representations for local Windows desktop automation.
"""

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class DesktopActionResult:
    """Standardized response schema for desktop automation operations."""

    success: bool
    action: str
    target: str
    message: str
    resolved_path: str | None = None
    error: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert result to a JSON-serializable dictionary."""
        return {
            "success": self.success,
            "action": self.action,
            "target": self.target,
            "message": self.message,
            "resolved_path": self.resolved_path,
            "error": self.error,
            "details": self.details,
        }
