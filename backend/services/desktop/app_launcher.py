"""
services/desktop/app_launcher.py
================================
Safe local Windows application launcher with strict allowlist enforcement,
dynamic path detection (PATH, Registry App Paths, standard Windows dirs),
and argument-list execution without shell interpretation.
"""

from dataclasses import dataclass, field
import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Callable

from backend.services.desktop.schemas import DesktopActionResult

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AppSpec:
    """Specification of an approved application in the allowlist."""

    canonical_name: str
    display_name: str
    aliases: tuple[str, ...]
    executables: tuple[str, ...]
    known_subpaths: tuple[str, ...] = field(default_factory=tuple)


# Curated allowlist of approved desktop applications.
# Only applications explicitly declared here can ever be launched.
DEFAULT_APPROVED_APPS: tuple[AppSpec, ...] = (
    AppSpec(
        canonical_name="notepad",
        display_name="Notepad",
        aliases=("notepad", "note pad", "text editor"),
        executables=("notepad.exe", "notepad"),
        known_subpaths=("System32/notepad.exe",),
    ),
    AppSpec(
        canonical_name="calculator",
        display_name="Calculator",
        aliases=("calculator", "calc"),
        executables=("calc.exe", "calc"),
        known_subpaths=("System32/calc.exe",),
    ),
    AppSpec(
        canonical_name="chrome",
        display_name="Google Chrome",
        aliases=("chrome", "google chrome", "google-chrome"),
        executables=("chrome.exe",),
        known_subpaths=(
            "Google/Chrome/Application/chrome.exe",
            "Google/Chrome/Application/chrome.exe",
        ),
    ),
    AppSpec(
        canonical_name="edge",
        display_name="Microsoft Edge",
        aliases=("edge", "microsoft edge", "msedge"),
        executables=("msedge.exe",),
        known_subpaths=("Microsoft/Edge/Application/msedge.exe",),
    ),
    AppSpec(
        canonical_name="firefox",
        display_name="Mozilla Firefox",
        aliases=("firefox", "mozilla firefox"),
        executables=("firefox.exe",),
        known_subpaths=("Mozilla Firefox/firefox.exe",),
    ),
    AppSpec(
        canonical_name="vscode",
        display_name="Visual Studio Code",
        aliases=("vscode", "code", "visual studio code", "vs code"),
        executables=("code.cmd", "code.exe", "Code.exe"),
        known_subpaths=(
            "Programs/Microsoft VS Code/bin/code.cmd",
            "Programs/Microsoft VS Code/Code.exe",
            "Microsoft VS Code/Code.exe",
        ),
    ),
    AppSpec(
        canonical_name="explorer",
        display_name="File Explorer",
        aliases=("explorer", "file explorer", "windows explorer", "my computer"),
        executables=("explorer.exe",),
        known_subpaths=("explorer.exe",),
    ),
    AppSpec(
        canonical_name="terminal",
        display_name="Windows Terminal",
        aliases=("terminal", "windows terminal", "wt"),
        executables=("wt.exe",),
        known_subpaths=(),
    ),
    AppSpec(
        canonical_name="cmd",
        display_name="Command Prompt",
        aliases=("cmd", "command prompt", "command line"),
        executables=("cmd.exe",),
        known_subpaths=("System32/cmd.exe",),
    ),
    AppSpec(
        canonical_name="powershell",
        display_name="PowerShell",
        aliases=("powershell", "windows powershell"),
        executables=("powershell.exe",),
        known_subpaths=("System32/WindowsPowerShell/v1.0/powershell.exe",),
    ),
    AppSpec(
        canonical_name="paint",
        display_name="Paint",
        aliases=("paint", "mspaint", "ms paint"),
        executables=("mspaint.exe",),
        known_subpaths=("System32/mspaint.exe",),
    ),
    AppSpec(
        canonical_name="task_manager",
        display_name="Task Manager",
        aliases=("task manager", "taskmgr", "task-manager"),
        executables=("taskmgr.exe",),
        known_subpaths=("System32/taskmgr.exe",),
    ),
    AppSpec(
        canonical_name="snipping_tool",
        display_name="Snipping Tool",
        aliases=("snipping tool", "snippingtool", "snip"),
        executables=("snippingtool.exe", "SnippingTool.exe"),
        known_subpaths=("System32/SnippingTool.exe",),
    ),
    AppSpec(
        canonical_name="word",
        display_name="Microsoft Word",
        aliases=("word", "ms word", "microsoft word", "winword"),
        executables=("winword.exe", "WINWORD.EXE"),
        known_subpaths=("Microsoft Office/root/Office16/WINWORD.EXE",),
    ),
    AppSpec(
        canonical_name="excel",
        display_name="Microsoft Excel",
        aliases=("excel", "ms excel", "microsoft excel"),
        executables=("excel.exe", "EXCEL.EXE"),
        known_subpaths=("Microsoft Office/root/Office16/EXCEL.EXE",),
    ),
    AppSpec(
        canonical_name="powerpoint",
        display_name="Microsoft PowerPoint",
        aliases=("powerpoint", "ms powerpoint", "microsoft powerpoint", "ppt"),
        executables=("powerpnt.exe", "POWERPNT.EXE"),
        known_subpaths=("Microsoft Office/root/Office16/POWERPNT.EXE",),
    ),
    AppSpec(
        canonical_name="spotify",
        display_name="Spotify",
        aliases=("spotify", "spotify music"),
        executables=("spotify.exe", "Spotify.exe"),
        known_subpaths=("Spotify/Spotify.exe",),
    ),
    AppSpec(
        canonical_name="vlc",
        display_name="VLC Media Player",
        aliases=("vlc", "vlc media player"),
        executables=("vlc.exe",),
        known_subpaths=("VideoLAN/VLC/vlc.exe",),
    ),
    AppSpec(
        canonical_name="discord",
        display_name="Discord",
        aliases=("discord",),
        executables=("Discord.exe", "discord.exe"),
        known_subpaths=("Discord/Update.exe",),
    ),
    AppSpec(
        canonical_name="slack",
        display_name="Slack",
        aliases=("slack",),
        executables=("slack.exe", "Slack.exe"),
        known_subpaths=("slack/slack.exe",),
    ),
)


class AppLauncher:
    """Safe, allowlisted application detector and launcher for Windows."""

    def __init__(
        self,
        approved_apps: tuple[AppSpec, ...] = DEFAULT_APPROVED_APPS,
        process_spawner: Callable[[list[str]], subprocess.Popen] | None = None,
    ) -> None:
        self._approved_apps = approved_apps
        self._alias_map: dict[str, AppSpec] = {}
        for app in approved_apps:
            self._alias_map[app.canonical_name.lower()] = app
            for alias in app.aliases:
                self._alias_map[alias.lower()] = app

        # Allow dependency injection of spawner for safe isolated unit testing
        self._spawner = process_spawner or self._default_spawn

    @staticmethod
    def _default_spawn(command_args: list[str]) -> subprocess.Popen:
        """Launch process safely with an argument list without shell interpretation."""
        return subprocess.Popen(
            command_args,
            shell=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=(sys.platform != "win32"),
        )

    def get_allowed_apps(self) -> list[dict[str, str]]:
        """Return a list of all approved applications in the allowlist."""
        return [
            {
                "canonical_name": app.canonical_name,
                "display_name": app.display_name,
                "aliases": list(app.aliases),
            }
            for app in self._approved_apps
        ]

    def find_app_spec(self, app_name: str) -> AppSpec | None:
        """Look up an AppSpec by canonical name or alias."""
        if not app_name or not isinstance(app_name, str):
            return None
        cleaned = app_name.strip().lower()
        # Remove common prefixes/suffixes like 'open ', 'launch ', '.exe'
        if cleaned.startswith("open "):
            cleaned = cleaned[5:].strip()
        elif cleaned.startswith("launch "):
            cleaned = cleaned[7:].strip()
        if cleaned.endswith(".exe"):
            cleaned = cleaned[:-4].strip()

        return self._alias_map.get(cleaned)

    def detect_executable_path(self, app_spec: AppSpec) -> Path | None:
        """
        Safely locate the executable for an approved application without assuming paths.
        Checks:
        1. PATH environment via shutil.which
        2. Windows Registry App Paths (HKCU & HKLM)
        3. Standard Windows environment root directories
        """
        # 1. Check system PATH
        for exe_name in app_spec.executables:
            found = shutil.which(exe_name)
            if found:
                candidate = Path(found)
                if candidate.is_file():
                    return candidate

        # 2. Check Windows Registry App Paths
        if sys.platform == "win32":
            registry_path = self._query_registry_app_paths(app_spec.executables)
            if registry_path and registry_path.is_file():
                return registry_path

        # 3. Check standard Windows root directories with known relative subpaths
        root_dirs = self._get_windows_environment_roots()
        for root in root_dirs:
            for subpath in app_spec.known_subpaths:
                candidate = root / subpath
                if candidate.is_file():
                    return candidate
            for exe_name in app_spec.executables:
                candidate = root / exe_name
                if candidate.is_file():
                    return candidate

        return None

    @staticmethod
    def _query_registry_app_paths(executables: tuple[str, ...]) -> Path | None:
        """Inspect Windows Registry 'App Paths' keys for installed application paths."""
        try:
            import winreg  # type: ignore[import-not-found]
        except ImportError:
            return None

        key_locations = (
            (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths"),
        )

        for root_key, subkey_base in key_locations:
            for exe_name in executables:
                subkey_path = f"{subkey_base}\\{exe_name}"
                try:
                    with winreg.OpenKey(root_key, subkey_path) as key:
                        val, _ = winreg.QueryValueEx(key, "")
                        if val:
                            path_str = str(val).strip('"').strip()
                            candidate = Path(path_str)
                            if candidate.is_file():
                                return candidate
                except (OSError, FileNotFoundError):
                    continue

        return None

    @staticmethod
    def _get_windows_environment_roots() -> list[Path]:
        """Collect standard Windows environment folders safely."""
        roots: list[Path] = []
        env_keys = (
            "ProgramFiles",
            "ProgramFiles(x86)",
            "LocalAppData",
            "AppData",
            "SystemRoot",
        )
        for key in env_keys:
            val = os.environ.get(key)
            if val:
                p = Path(val)
                if p.is_dir():
                    roots.append(p)
                    # Also include standard Programs subdirectory in LocalAppData
                    if key == "LocalAppData":
                        programs = p / "Programs"
                        if programs.is_dir():
                            roots.append(programs)

        return roots

    def launch(self, app_name: str) -> DesktopActionResult:
        """
        Validate and launch an approved application from the allowlist.

        :param app_name: Spoken or typed name of the application.
        :return: DesktopActionResult indicating success or specific failure reason.
        """
        if not app_name or not isinstance(app_name, str) or not app_name.strip():
            return DesktopActionResult(
                success=False,
                action="open_app",
                target=str(app_name or ""),
                message="No application name provided.",
                error="Invalid input: application name is empty.",
            )

        raw_name = app_name.strip()
        app_spec = self.find_app_spec(raw_name)

        if not app_spec:
            logger.warning("[AppLauncher] Rejected unapproved app request: '%s'", raw_name)
            return DesktopActionResult(
                success=False,
                action="open_app",
                target=raw_name,
                message=f"Application '{raw_name}' is not in the approved allowlist.",
                error=f"Application '{raw_name}' is not in the approved allowlist.",
            )

        exe_path = self.detect_executable_path(app_spec)
        if not exe_path:
            logger.warning(
                "[AppLauncher] Approved app '%s' not found installed on system",
                app_spec.display_name,
            )
            return DesktopActionResult(
                success=False,
                action="open_app",
                target=app_spec.display_name,
                message=(
                    f"Application '{app_spec.display_name}' is approved in the allowlist, "
                    "but was not found installed on this system."
                ),
                error="Executable not found on system.",
                details={"canonical_name": app_spec.canonical_name},
            )

        # Launch safely using argument list (never shell=True)
        try:
            logger.info(
                "[AppLauncher] Launching '%s' from path: '%s'",
                app_spec.display_name,
                exe_path,
            )
            self._spawner([str(exe_path)])
            return DesktopActionResult(
                success=True,
                action="open_app",
                target=app_spec.display_name,
                resolved_path=str(exe_path),
                message=f"Successfully launched {app_spec.display_name}.",
                details={"canonical_name": app_spec.canonical_name},
            )
        except PermissionError as p_err:
            logger.error("[AppLauncher] Permission denied launching '%s': %s", exe_path, p_err)
            return DesktopActionResult(
                success=False,
                action="open_app",
                target=app_spec.display_name,
                resolved_path=str(exe_path),
                message=f"Permission denied while launching {app_spec.display_name}.",
                error=str(p_err),
            )
        except (OSError, Exception) as exc:
            logger.error("[AppLauncher] Error launching '%s': %s", exe_path, exc)
            return DesktopActionResult(
                success=False,
                action="open_app",
                target=app_spec.display_name,
                resolved_path=str(exe_path),
                message=f"Failed to launch {app_spec.display_name}: {exc}",
                error=str(exc),
            )
