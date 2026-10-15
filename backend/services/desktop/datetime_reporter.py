"""
services/desktop/datetime_reporter.py
=====================================
Reports current local date, time, and timezone information.
Modular and fully testable with optional clock provider dependency injection.
"""

from datetime import datetime
import logging
from typing import Callable

from backend.services.desktop.schemas import DesktopActionResult

logger = logging.getLogger(__name__)


class DateTimeReporter:
    """Provides current local date and time reporting for ASTRA AI."""

    def __init__(self, time_provider: Callable[[], datetime] | None = None) -> None:
        """
        Initialize with an optional clock provider for deterministic testing.

        :param time_provider: Zero-argument callable returning a datetime object.
        """
        self._time_provider = time_provider or self._default_now

    @staticmethod
    def _default_now() -> datetime:
        """Return the current local system datetime with local timezone attached."""
        return datetime.now().astimezone()

    def get_current_datetime(self) -> DesktopActionResult:
        """
        Report the current local date, time, and timezone.

        :return: DesktopActionResult containing formatted date/time strings.
        """
        try:
            now = self._time_provider()

            # Format user-friendly strings
            formatted_time = now.strftime("%I:%M %p").lstrip("0")
            formatted_date = now.strftime("%A, %B %d, %Y")
            day_of_week = now.strftime("%A")
            tz_name = now.tzname() or "Local Time"
            iso_str = now.isoformat()

            message = f"The current local time is {formatted_time} on {formatted_date} ({tz_name})."

            return DesktopActionResult(
                success=True,
                action="get_current_datetime",
                target="local_clock",
                message=message,
                details={
                    "time": formatted_time,
                    "date": formatted_date,
                    "day_of_week": day_of_week,
                    "timezone": tz_name,
                    "iso_timestamp": iso_str,
                    "year": now.year,
                    "month": now.month,
                    "day": now.day,
                    "hour": now.hour,
                    "minute": now.minute,
                },
            )
        except Exception as exc:
            logger.error("[DateTimeReporter] Failed to read local time: %s", exc)
            return DesktopActionResult(
                success=False,
                action="get_current_datetime",
                target="local_clock",
                message=f"Failed to retrieve local date and time: {exc}",
                error=str(exc),
            )
