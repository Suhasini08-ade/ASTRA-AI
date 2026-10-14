"""
app.py
======
Main FastAPI application entry point.
"""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import connect_db, close_db
from backend.config import get_settings
from backend.routes import agent, auth, calendar, chat, deep_dive, focus_sessions, news, notes, reminders, summarize, tasks, voice, weather

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan manager for database initialization and cleanup."""
    try:
        await connect_db()
    except Exception as e:
        logger.critical("MongoDB connection failed during application startup: %s", e)
    yield
    await close_db()


app = FastAPI(title="Jarvis API", version="1.0.0", lifespan=lifespan)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=list({
        *get_settings().CORS_ORIGINS,
        "http://localhost:3000", "http://localhost:5173",
        "http://127.0.0.1:3000", "http://127.0.0.1:5173",
    }),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(agent.router)
app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(tasks.router)
app.include_router(focus_sessions.router)
app.include_router(calendar.router)
app.include_router(chat.router)
app.include_router(reminders.router)
app.include_router(weather.router)
app.include_router(news.router)
app.include_router(summarize.router)
app.include_router(deep_dive.router)
app.include_router(voice.router)


@app.get("/")
async def root():
    return {"status": "online", "message": "Jarvis API is running"}
