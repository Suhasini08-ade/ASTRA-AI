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

    # Keep an unavailable local MongoDB from delaying the whole API startup.
    client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
    )
    database = client[settings.MONGODB_DB_NAME]

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


def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency that returns the database instance."""
    if _database is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _database


async def _create_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create MongoDB indexes for all collections."""

    # Users
    await db.users.create_index("email", unique=True)

    # Profiles
    await db.profiles.create_index("user_id", unique=True)

    # Notes
    await db.notes.create_index("user_id")
    await db.notes.create_index("created_at")

    # Tasks
    await db.tasks.create_index("user_id")
    await db.tasks.create_index("status")
    await db.tasks.create_index("due_date")

    # Reminders
    await db.reminders.create_index("user_id")
    await db.reminders.create_index("due_time")

    # Calendar Events
    await db.calendar_events.create_index("user_id")
    await db.calendar_events.create_index("start_time")

    # Chat Messages
    await db.chat_messages.create_index("user_id")
    await db.chat_messages.create_index("created_at")

    # Settings
    await db.settings.create_index("user_id", unique=True)

    # Activity Log
    await db.activity_log.create_index("user_id")
    await db.activity_log.create_index("timestamp")
    logger.info("MongoDB indexes created successfully.")
