"""
routes/news.py
==============
News endpoints retrieving articles via news_service.
"""

from fastapi import APIRouter, Query
from backend.services.news_service import news_service

router = APIRouter(prefix="/api/news", tags=["News"])


@router.get("")
async def get_news(category: str = Query(default="All")):
    """Get top news headlines filtered by category."""
    cat_param = None if category.lower() in ["all", "general"] else category.lower()
    res = await news_service.get_headlines(category=cat_param)

    if "error" in res or not res.get("articles"):
        # Fallback articles if API key is not configured
        fallback_articles = [
            {
                "id": "news-1",
                "title": "Next-Generation Autonomous AI Agents Transform Software Engineering",
                "category": "AI & Tech",
                "source": "Tech AI Digest",
                "timeAgo": "25 mins ago",
                "readTime": "4 min read",
                "image": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
                "description": "Recent breakdowns show multi-agent orchestration systems reducing enterprise software release cycles by over 60 percent with automated linting and verification.",
                "url": "#",
                "featured": True
            },
            {
                "id": "news-2",
                "title": "FastAPI and React Architecture Best Practices for 2026",
                "category": "Productivity",
                "source": "FastAPI Weekly",
                "timeAgo": "1 hour ago",
                "readTime": "3 min read",
                "image": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
                "description": "Discover how structured API tokens, AsyncIOMotor, and React custom hooks boost developer velocity and runtime performance.",
                "url": "#",
                "featured": False
            }
        ]
        filtered = fallback_articles if category.lower() in ["all", "general"] else [a for a in fallback_articles if category.lower() in a["category"].lower()]
        return {"articles": filtered if filtered else fallback_articles}

    articles = []
    for idx, art in enumerate(res.get("articles", [])):
        articles.append({
            "id": f"news-{idx+1}",
            "title": art.get("title", "Untitled"),
            "category": category if category != "All" else "General",
            "source": art.get("source", "News"),
            "timeAgo": art.get("published_at", "Recently"),
            "readTime": "3 min read",
            "image": art.get("image_url") or "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
            "description": art.get("description", ""),
            "url": art.get("url", "#"),
            "featured": idx == 0
        })

    return {"articles": articles}
