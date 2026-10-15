"""
services/desktop/browser_launcher.py
====================================
Safe website launcher for Windows default browser.
Validates HTTP/HTTPS schemes, sanitizes netloc/domains, rejects arbitrary schemes/scripts,
and launches via Python's standard webbrowser interface without shell execution.
"""

import logging
import re
from typing import Callable
import urllib.parse
import webbrowser

from backend.services.desktop.schemas import DesktopActionResult

logger = logging.getLogger(__name__)

# Valid domain / host pattern (standard domain, localhost, or IPv4)
_HOST_PATTERN = re.compile(
    r"^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}|localhost|\d{1,3}(?:\.\d{1,3}){3})$"
)

# Reject any forbidden control or shell characters in URLs
_DANGEROUS_CHAR_PATTERN = re.compile(r"[\s\r\n\t\"\'`<>|^&;${}]")


class BrowserLauncher:
    """Safe website opener that validates URLs and launches default browser."""

    def __init__(self, browser_opener: Callable[[str], bool] | None = None) -> None:
        # Dependency-injected opener allows clean, headless unit testing
        self._opener = browser_opener or self._default_open

    @staticmethod
    def _default_open(url: str) -> bool:
        """Open URL in the user's default browser."""
        return webbrowser.open(url, new=2, autoraise=True)

    def validate_url(self, raw_url: str) -> tuple[str | None, str | None]:
        """
        Validate and sanitize a website URL.

        :param raw_url: User-provided URL or domain (e.g. 'google.com', 'https://github.com').
        :return: (normalized_url, error_message). If valid, error_message is None.
        """
        if not raw_url or not isinstance(raw_url, str) or not raw_url.strip():
            return None, "Invalid input: website URL is empty."

        cleaned = raw_url.strip()

        # 1. Scheme check: detect if an explicit scheme is provided
        scheme_match = re.match(r"^([a-zA-Z][a-zA-Z0-9+.-]*):", cleaned)
        if scheme_match:
            explicit_scheme = scheme_match.group(1).lower()
            if explicit_scheme not in ("http", "https"):
                return None, f"Prohibited URL scheme '{explicit_scheme}'. Only HTTP and HTTPS websites are permitted."
            candidate = cleaned
        else:
            # If a single word like 'youtube' is supplied without dots or slashes, expand to www.<word>.com
            if "." not in cleaned and "/" not in cleaned and cleaned.lower() != "localhost":
                candidate = f"https://www.{cleaned}.com"
            else:
                candidate = f"https://{cleaned}"

        # 2. Check for dangerous shell or control characters
        if _DANGEROUS_CHAR_PATTERN.search(candidate):
            return None, "Invalid URL: contains prohibited characters or command separators."

        try:
            parsed = urllib.parse.urlsplit(candidate)
        except Exception as exc:
            return None, f"Malformed URL: {exc}"

        # 1. Scheme check: strictly http and https
        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https"):
            return None, f"Prohibited URL scheme '{scheme}'. Only HTTP and HTTPS websites are permitted."

        # 2. Hostname check
        try:
            hostname = parsed.hostname
        except ValueError as v_err:
            return None, f"Invalid URL host: {v_err}"

        if not hostname:
            return None, "Invalid URL: no host or domain could be identified."

        # Check hostname against standard host pattern or localhost/IP
        if not _HOST_PATTERN.match(hostname):
            # Allow common internationalized or internal names if alphanumeric + hyphens
            if not re.match(r"^[a-zA-Z0-9.-]+$", hostname):
                return None, f"Invalid domain name '{hostname}'."

        # 3. Port check if present
        try:
            port = parsed.port
            if port is not None and not (1 <= port <= 65535):
                return None, f"Invalid port number '{port}'."
        except ValueError as v_err:
            return None, f"Invalid port or URL structure: {v_err}"

        # Reconstruct clean normalized URL
        normalized_url = urllib.parse.urlunsplit((
            scheme,
            parsed.netloc,
            parsed.path,
            parsed.query,
            parsed.fragment,
        ))

        return normalized_url, None

    def open_website(self, raw_url: str) -> DesktopActionResult:
        """
        Validate and open a website in the system's default browser.

        :param raw_url: The URL or domain name to open.
        :return: DesktopActionResult with status and details.
        """
        validated_url, error = self.validate_url(raw_url)
        if error or not validated_url:
            logger.warning("[BrowserLauncher] Rejected invalid URL '%s': %s", raw_url, error)
            return DesktopActionResult(
                success=False,
                action="open_website",
                target=str(raw_url or ""),
                message=error or "Invalid URL.",
                error=error,
            )

        try:
            logger.info("[BrowserLauncher] Opening validated URL: '%s'", validated_url)
            self._opener(validated_url)
            return DesktopActionResult(
                success=True,
                action="open_website",
                target=validated_url,
                message=f"Successfully opened website '{validated_url}'.",
                details={"url": validated_url},
            )
        except Exception as exc:
            logger.error("[BrowserLauncher] Error opening website '%s': %s", validated_url, exc)
            return DesktopActionResult(
                success=False,
                action="open_website",
                target=validated_url,
                message=f"Failed to open website '{validated_url}': {exc}",
                error=str(exc),
            )
