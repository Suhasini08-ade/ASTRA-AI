"""
utils/response.py
=================
Consistent JSON response helpers for all route handlers.
"""

from typing import Any


def success_response(
    data: Any = None,
    message: str = "Success",
) -> dict[str, Any]:
    """Build a standardized success response."""
    response: dict[str, Any] = {"status": "success", "message": message}
    if data is not None:
        response["data"] = data
    return response


def error_response(
    message: str = "An error occurred",
    details: Any = None,
) -> dict[str, Any]:
    """Build a standardized error response."""
    response: dict[str, Any] = {"status": "error", "message": message}
    if details is not None:
        response["details"] = details
    return response
