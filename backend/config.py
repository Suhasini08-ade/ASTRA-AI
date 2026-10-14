"""
config.py
=========
Central configuration using Pydantic BaseSettings.
Loads all secrets and settings from the .env file.
"""

from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- MongoDB ---
    MONGODB_URI: str = "mongodb://localhost:27017"
    # Support the existing DATABASE_NAME variable while standardizing new
    # deployments on MONGODB_DB_NAME.
    MONGODB_DB_NAME: str = Field(
        default="jarvis",
        validation_alias=AliasChoices("MONGODB_DB_NAME", "DATABASE_NAME"),
    )

    # --- JWT Authentication ---
    JWT_SECRET_KEY: str = "change-this-to-a-secure-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    # --- AI Provider Settings ---
    AI_PROVIDER: str = Field(
        default="gemini",
        validation_alias=AliasChoices("AI_PROVIDER", "LLM_PROVIDER"),
    )
    # AI_PROVIDER is retained for backwards compatibility. New deployments
    # should configure an explicit primary and (optionally) fallback provider.
    AI_PROVIDER_PRIMARY: str = ""
    AI_PROVIDER_FALLBACKS: str = Field(
        default="",
        validation_alias=AliasChoices("AI_PROVIDER_FALLBACKS", "AI_PROVIDER_FALLBACK"),
    )

    @property
    def AI_PROVIDER_FALLBACK(self) -> str:
        return self.AI_PROVIDER_FALLBACKS

    # --- Gemini ---
    GEMINI_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    )
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # --- Groq (OpenAI-compatible API) ---
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = ""

    # --- OpenRouter (OpenAI-compatible API) ---
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = ""

    # --- OpenAI ---
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # --- OpenWeatherMap ---
    OPENWEATHER_API_KEY: str = ""
    DEFAULT_CITY: str = "Latur"

    # --- NewsAPI ---
    NEWS_API_KEY: str = ""

    # --- Firebase Admin SDK ---
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "firebase-service-account.json"
    DEV_SKIP_AUTH: bool = False  # Set to True for local dev without Firebase credentials

    # --- CORS ---
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {
        # Resolve relative to this module so `uvicorn backend.app:app` works
        # whether it is launched from the repository root or backend folder.
        "env_file": Path(__file__).resolve().parent / ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Return a cached Settings instance (singleton pattern)."""
    return Settings()
