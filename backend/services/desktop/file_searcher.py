"""
services/desktop/file_searcher.py
=================================
Safe file searching inside explicitly selected, permitted user folders.
Enforces strict boundaries: never searches entire drives, limits search depth
and result counts, and never reads or exposes private file contents.
"""

from datetime import datetime, timezone
import fnmatch
import logging
import os
from pathlib import Path
from typing import Any

from backend.services.desktop.schemas import DesktopActionResult

logger = logging.getLogger(__name__)

# Standard permitted user folder aliases
PERMITTED_FOLDERS = {
    "desktop": lambda: Path.home() / "Desktop",
    "documents": lambda: Path.home() / "Documents",
    "my documents": lambda: Path.home() / "Documents",
    "downloads": lambda: Path.home() / "Downloads",
    "pictures": lambda: Path.home() / "Pictures",
    "photos": lambda: Path.home() / "Pictures",
    "videos": lambda: Path.home() / "Videos",
    "music": lambda: Path.home() / "Music",
}

PROHIBITED_DIRECTORIES = frozenset({
    "windows",
    "system32",
    "syswow64",
    "$recycle.bin",
    "system volume information",
    "recovery",
    "program files",
    "program files (x86)",
})

# Directories skipped during traversal to avoid performance overhead
SKIPPED_SUBDIRS = frozenset({
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    "env",
})

MAX_SEARCH_DEPTH = 4
MAX_SEARCH_RESULTS = 50


class FileSearcher:
    """Safe local file searcher bounded to permitted user directories."""

    def resolve_search_folder(self, folder_name: str | None) -> tuple[Path | None, str | None]:
        """
        Validate and resolve the permitted folder to search.
        Rejects whole-drive searches (e.g. C:\\) and sensitive system folders.

        :param folder_name: Folder alias ('Desktop', 'Documents') or user directory path.
        :return: (resolved_path, error_message).
        """
        if not folder_name or not str(folder_name).strip():
            return None, (
                "Search folder is required. Please specify an approved folder to search "
                "(e.g. 'Documents', 'Downloads', 'Desktop', 'Pictures')."
            )

        cleaned = str(folder_name).strip()
        lowered = cleaned.lower()

        # Reject explicit whole-drive search attempts
        if lowered in ("c:", "c:\\", "c:/", "d:", "d:\\", "d:/", "/", "\\", "root", "my computer"):
            return None, (
                "Searching the entire drive is prohibited for safety and performance. "
                "Please specify a specific folder such as 'Documents', 'Downloads', or 'Desktop'."
            )

        # 1. Check permitted standard folders
        if lowered in PERMITTED_FOLDERS:
            target_path = PERMITTED_FOLDERS[lowered]().resolve()
        else:
            # 2. Check custom user folder path
            try:
                expanded = os.path.expandvars(os.path.expanduser(cleaned))
                target_path = Path(expanded).resolve()
            except Exception as exc:
                return None, f"Invalid search folder path: {exc}"

        # 3. Check existence and directory type
        if not target_path.exists():
            return None, f"Folder does not exist: '{target_path}'."
        if not target_path.is_dir():
            return None, f"Path is a file, not a folder: '{target_path}'."

        # 4. Check for drive root
        if target_path == target_path.anchor or target_path.parent == target_path:
            return None, (
                f"Searching the root drive '{target_path}' is prohibited. "
                "Please choose a specific folder such as 'Documents' or 'Downloads'."
            )

        # 5. Check prohibited system directories
        parts_lower = [part.lower() for part in target_path.parts]
        for prohibited in PROHIBITED_DIRECTORIES:
            if prohibited in parts_lower:
                return None, f"Searching within system folder '{prohibited}' is prohibited for security."

        # Disallow searching user AppData root directly
        user_appdata = Path.home() / "AppData"
        if target_path == user_appdata.resolve() or target_path == (user_appdata / "Local").resolve() or target_path == (user_appdata / "Roaming").resolve():
            return None, "Searching the AppData configuration folder directly is prohibited for security."

        # 6. Check readability
        if not os.access(target_path, os.R_OK):
            return None, f"Permission denied: cannot read folder '{target_path}'."

        return target_path, None

    def search_files(
        self,
        query: str,
        folder: str | None = None,
        limit: int = 20,
    ) -> DesktopActionResult:
        """
        Search for files matching query inside a permitted folder.

        :param query: Filename, partial name, or glob pattern (e.g. 'budget', '*.pdf').
        :param folder: Permitted folder alias or directory (required).
        :param limit: Maximum results to return (capped at 50).
        :return: DesktopActionResult with list of matching file records.
        """
        if not query or not str(query).strip():
            return DesktopActionResult(
                success=False,
                action="search_files",
                target=str(folder or ""),
                message="Filename or search query is required. Please specify what file to search for.",
                error="Missing query.",
            )

        search_folder, err = self.resolve_search_folder(folder)
        if err or not search_folder:
            return DesktopActionResult(
                success=False,
                action="search_files",
                target=str(folder or ""),
                message=err or "Invalid search folder.",
                error=err,
                details={"needs_folder": True},
            )

        cleaned_query = str(query).strip()
        query_pattern = f"*{cleaned_query.lower()}*" if "*" not in cleaned_query and "?" not in cleaned_query else cleaned_query.lower()
        effective_limit = max(1, min(limit, MAX_SEARCH_RESULTS))

        matches: list[dict[str, Any]] = []
        base_depth = len(search_folder.parts)

        try:
            for root, dirs, files in os.walk(str(search_folder)):
                current_path = Path(root)
                current_depth = len(current_path.parts) - base_depth

                # Prune deep directories
                if current_depth >= MAX_SEARCH_DEPTH:
                    dirs.clear()
                    continue

                # Prune ignored/hidden directories in-place
                dirs[:] = [
                    d for d in dirs
                    if not d.startswith(".")
                    and d.lower() not in SKIPPED_SUBDIRS
                    and d.lower() not in PROHIBITED_DIRECTORIES
                ]

                for filename in files:
                    # Skip hidden or temporary files
                    if filename.startswith("~$") or filename.startswith("."):
                        continue

                    lower_name = filename.lower()
                    if fnmatch.fnmatch(lower_name, query_pattern) or cleaned_query.lower() in lower_name:
                        file_path = current_path / filename
                        try:
                            stat = file_path.stat()
                            mtime = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
                            matches.append({
                                "file_name": filename,
                                "path": str(file_path),
                                "size_bytes": stat.st_size,
                                "extension": file_path.suffix.lower(),
                                "modified_at": mtime,
                            })
                        except (OSError, PermissionError):
                            # Skip unreadable file metadata without failing the whole search
                            matches.append({
                                "file_name": filename,
                                "path": str(file_path),
                                "size_bytes": None,
                                "extension": file_path.suffix.lower(),
                                "modified_at": None,
                            })

                        if len(matches) >= effective_limit:
                            break

                if len(matches) >= effective_limit:
                    break

            match_count = len(matches)
            if match_count == 0:
                return DesktopActionResult(
                    success=True,
                    action="search_files",
                    target=cleaned_query,
                    resolved_path=str(search_folder),
                    message=f"No files matching '{cleaned_query}' were found in '{search_folder.name}'.",
                    details={"query": cleaned_query, "folder": str(search_folder), "count": 0, "files": []},
                )

            return DesktopActionResult(
                success=True,
                action="search_files",
                target=cleaned_query,
                resolved_path=str(search_folder),
                message=f"Found {match_count} file(s) matching '{cleaned_query}' in '{search_folder.name}'.",
                details={
                    "query": cleaned_query,
                    "folder": str(search_folder),
                    "count": match_count,
                    "files": matches,
                },
            )

        except PermissionError as p_err:
            return DesktopActionResult(
                success=False,
                action="search_files",
                target=cleaned_query,
                resolved_path=str(search_folder),
                message=f"Permission denied while searching '{search_folder.name}': {p_err}",
                error=str(p_err),
            )
        except Exception as exc:
            return DesktopActionResult(
                success=False,
                action="search_files",
                target=cleaned_query,
                resolved_path=str(search_folder),
                message=f"File search failed: {exc}",
                error=str(exc),
            )
