"""
services/news_service.py
========================
News service using NewsAPI.org.
Refactored from core/news.py — now async (httpx) and returns structured JSON.
"""

import httpx

from backend.config import get_settings

_BASE_URL = "https://newsapi.org/v2/top-headlines"


class NewsService:
    """Retrieves the latest news headlines."""

    async def get_headlines(
        self,
        country: str = "us",
        category: str | None = None,
        max_results: int = 10,
    ) -> dict:
        """
        Fetch top headlines from NewsAPI.

        :param country: Two-letter country code (e.g. "us", "in").
        :param category: News category (business, technology, sports, etc.).
        :param max_results: Maximum number of articles to return.
        :return: Structured news data dictionary.
        """
        settings = get_settings()

        if not settings.NEWS_API_KEY:
            return {"error": "News API key not configured."}

        params: dict = {
            "country": country,
            "apiKey": settings.NEWS_API_KEY,
            "pageSize": max_results,
        }
        if category:
            params["category"] = category

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(_BASE_URL, params=params)

            if response.status_code != 200:
                return {"error": "Could not fetch news headlines."}

            data = response.json()
            articles = []
            for article in data.get("articles", []):
                articles.append({
                    "title": article.get("title", "Untitled"),
                    "description": article.get("description", ""),
                    "source": article.get("source", {}).get("name", "Unknown"),
                    "url": article.get("url", ""),
                    "image_url": article.get("urlToImage", ""),
                    "published_at": article.get("publishedAt", ""),
                })

            return {
                "total_results": data.get("totalResults", 0),
                "articles": articles,
            }


# Module-level singleton
news_service = NewsService()
