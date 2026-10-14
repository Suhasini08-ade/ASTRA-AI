"""
utils/firebase_init.py
======================
Firebase Admin SDK initialization and token verification.
Initializes the SDK once at module import using a service account JSON file.
"""

import logging
from pathlib import Path

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from backend.config import get_settings

logger = logging.getLogger(__name__)

_firebase_app = None
_initialized = False


def _initialize_firebase() -> bool:
    """Initialize the Firebase Admin SDK using the service account file.

    Returns True if initialization succeeded, False otherwise.
    """
    global _firebase_app, _initialized

    if _initialized:
        return _firebase_app is not None

    _initialized = True
    settings = get_settings()
    sa_path = Path(settings.FIREBASE_SERVICE_ACCOUNT_PATH)

    # Resolve relative paths against the backend directory
    if not sa_path.is_absolute():
        sa_path = Path(__file__).resolve().parents[1] / sa_path

    if not sa_path.exists():
        logger.warning(
            "Firebase service account file not found at '%s'. "
            "Firebase token verification will fail. "
            "Download it from Firebase Console → Project Settings → Service Accounts.",
            sa_path,
        )
        return False

    try:
        cred = credentials.Certificate(str(sa_path))
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized successfully.")
        return True
    except Exception as exc:
        logger.error("Failed to initialize Firebase Admin SDK: %s", exc)
        return False


def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims.

    Returns a dict containing at minimum: uid, email, name (if available).
    Raises ValueError if the token is invalid or Firebase is not initialized.
    """
    if not _initialized:
        _initialize_firebase()

    if _firebase_app is None:
        raise ValueError("Firebase Admin SDK is not initialized. Cannot verify token.")

    try:
        decoded = firebase_auth.verify_id_token(id_token, app=_firebase_app)
        return {
            "uid": decoded["uid"],
            "email": decoded.get("email", ""),
            "name": decoded.get("name", ""),
            "picture": decoded.get("picture", ""),
            "email_verified": decoded.get("email_verified", False),
            "firebase": decoded.get("firebase", {}),
        }
    except firebase_auth.ExpiredIdTokenError:
        raise ValueError("Firebase ID token has expired. Please sign in again.")
    except firebase_auth.RevokedIdTokenError:
        raise ValueError("Firebase ID token has been revoked. Please sign in again.")
    except firebase_auth.InvalidIdTokenError as exc:
        raise ValueError(f"Invalid Firebase ID token: {exc}")
    except Exception as exc:
        raise ValueError(f"Firebase token verification failed: {exc}")


# Eagerly initialize on import so errors surface at startup
_initialize_firebase()
