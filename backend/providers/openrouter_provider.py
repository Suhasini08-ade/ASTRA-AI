"""OpenRouter provider using its OpenAI-compatible API."""

from backend.config import get_settings
from backend.providers.openai_compatible import OpenAICompatibleProvider

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterProvider(OpenAICompatibleProvider):
    provider_name = "OpenRouter"
    key_name = "OPENROUTER_API_KEY"
    model_name = "OPENROUTER_MODEL"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        super().__init__(
            api_key=api_key or settings.OPENROUTER_API_KEY,
            model=model or settings.OPENROUTER_MODEL,
            base_url=OPENROUTER_BASE_URL,
        )
