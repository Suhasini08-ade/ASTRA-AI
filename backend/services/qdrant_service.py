
import os

from dotenv import load_dotenv
from qdrant_client import QdrantClient

load_dotenv()

from backend.config import get_settings

def get_qdrant_client() -> QdrantClient:
    settings = get_settings()
    url = settings.QDRANT_URL or os.getenv("QDRANT_URL")
    api_key = settings.QDRANT_API_KEY or os.getenv("QDRANT_API_KEY")

    if not url or not api_key:
        raise ValueError(
            "QDRANT_URL and QDRANT_API_KEY must be set in .env"
        )

    return QdrantClient(
        url=url,
        api_key=api_key,
        timeout=10,
    )


def test_qdrant_connection() -> None:
    client = get_qdrant_client()

    try:
        collections = client.get_collections()
        print("Qdrant connection successful!")
        print("Available collections:", [
            collection.name
            for collection in collections.collections
        ])
    finally:
        client.close()


if __name__ == "__main__":
    test_qdrant_connection()
