"""Groq provider using its OpenAI-compatible API."""

from backend.config import get_settings
from backend.providers.openai_compatible import OpenAICompatibleProvider

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class GroqProvider(OpenAICompatibleProvider):
    provider_name = "Groq"
    key_name = "GROQ_API_KEY"
    model_name = "GROQ_MODEL"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        super().__init__(
            api_key=api_key or settings.GROQ_API_KEY,
            model=model or settings.GROQ_MODEL,
            base_url=GROQ_BASE_URL,
        )
