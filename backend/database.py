"""
database.py
===========
Async MongoDB connection using Motor.
Provides lifecycle functions for FastAPI and a dependency for route handlers.
"""

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from backend.config import get_settings

logger = logging.getLogger(__name__)

# Module-level references (populated on startup, cleaned on shutdown)
_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    """Connect to MongoDB and create indexes. Called during app startup."""
    global _client, _database
    settings = get_settings()

    if "<" in settings.MONGODB_URI or ">" in settings.MONGODB_URI:
        raise ValueError(
            "MONGODB_URI contains placeholder characters. Replace <db_username> and "
            "<password> with URL-encoded Atlas credentials."
        )

    if _client is None:
        client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
        )
        database = client[settings.MONGODB_DB_NAME]
    else:
        client = _client
        database = _database if _database is not None else client[settings.MONGODB_DB_NAME]

    try:
        # Motor connects lazily; ping makes startup verify DNS, TLS, Atlas IP
        # access, authentication, and the selected cluster before serving API calls.
        await client.admin.command("ping")
        logger.info("MongoDB ping succeeded for database '%s'.", settings.MONGODB_DB_NAME)

        # A database appears in Atlas only after its first write. This idempotent
        # marker is deliberately outside user collections and creates `jarvis`
        # (or the configured name) without changing application data.
        # Motor reserves attribute access for normal collection names; use
        # bracket notation because this internal collection begins with "_".
        await database["_jarvis_metadata"].update_one(
            {"_id": "database-initialized"},
            {"$setOnInsert": {"created_by": "Jarvis API"}},
            upsert=True,
        )

        # Create indexes for performance.
        await _create_indexes(database)
    except Exception as exc:
        logger.error("MongoDB connection/startup failed: %s", exc)
        client.close()
        _client = None
        _database = None
        raise

    _client = client
    _database = database
    logger.info("MongoDB connected successfully (database: %s).", settings.MONGODB_DB_NAME)


async def close_db() -> None:
    """Close the MongoDB connection. Called during app shutdown."""
    global _client, _database
    if _client is not None:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed.")


import asyncio


def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency that returns the database instance."""
    global _client, _database

    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _client is not None:
        try:
            client_loop = getattr(_client, "get_io_loop", lambda: None)()
            if client_loop is not None and (
                client_loop.is_closed()
                or (current_loop is not None and client_loop is not current_loop)
            ):
                _client = None
                _database = None
        except Exception:
            _client = None
            _database = None

    if _database is None:
        settings = get_settings()
        if "<" not in settings.MONGODB_URI and ">" not in settings.MONGODB_URI:
            _client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=10000,
                connectTimeoutMS=10000,
            )
            _database = _client[settings.MONGODB_DB_NAME]
    if _database is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _database


async def _create_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create MongoDB indexes for all collections concurrently."""
    index_tasks = [
        db.users.create_index("email", unique=True),
        db.profiles.create_index("user_id", unique=True),
        db.notes.create_index("user_id"),
        db.notes.create_index("created_at"),
        db.tasks.create_index("user_id"),
        db.tasks.create_index("status"),
        db.tasks.create_index("due_date"),
        db.focus_sessions.create_index([("user_id", 1), ("timestamp", -1)]),
        db.reminders.create_index("user_id"),
        db.reminders.create_index("due_time"),
        db.calendar_events.create_index("user_id"),
        db.calendar_events.create_index("start_time"),
        db.chat_messages.create_index("user_id"),
        db.chat_messages.create_index("created_at"),
        db.chat_messages.create_index([("user_id", 1), ("conversation_id", 1), ("created_at", 1)]),
        db.deep_dives.create_index([("user_id", 1), ("updated_at", -1)]),
        db.settings.create_index("user_id", unique=True),
        db.knowledge_items.create_index([("user_id", 1), ("content_hash", 1)]),
        db.knowledge_items.create_index([("user_id", 1), ("category", 1)]),
        db.knowledge_items.create_index([("user_id", 1), ("created_at", -1)]),
        db.documents.create_index([("user_id", 1), ("file_name", 1)]),
        db.documents.create_index([("user_id", 1), ("created_at", -1)]),
    ]
    await asyncio.gather(*index_tasks, return_exceptions=True)
    logger.info("MongoDB indexes created successfully.")
