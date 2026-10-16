"""
main.py
=======
FastAPI application entry point module wrapper.
Exposes `app` from `backend.app` for `uvicorn backend.main:app` compatibility.
Also allows running directly via `python backend/main.py` with fast reload settings.
"""

from pathlib import Path
import sys

# Ensure project root is in sys.path whether executed from root or inside backend/
_backend_dir = Path(__file__).resolve().parent
_project_root = _backend_dir.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from backend.app import app

__all__ = ["app"]

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(_backend_dir)],
        reload_excludes=["venv", ".pytest_cache", "__pycache__", "*.pyc"],
    )

