"""
main.py
=======
FastAPI application entry point module wrapper.
Exposes `app` from `backend.app` for `uvicorn backend.main:app` compatibility.
"""

from backend.app import app

__all__ = ["app"]
