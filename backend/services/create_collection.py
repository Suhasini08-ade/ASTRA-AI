
from services.qdrant_service import get_qdrant_client

COLLECTION_NAME = "astra_knowledge"

# 384 dimensions for the embedding model we'll use next
VECTOR_SIZE = 384


def create_collection():
    client = get_qdrant_client()

    try:
        existing = [
            collection.name
            for collection in client.get_collections().collections
        ]

        if COLLECTION_NAME in existing:
            print(f"Collection '{COLLECTION_NAME}' already exists.")
            return

        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config={
                "size": VECTOR_SIZE,
                "distance": "Cosine",
            },
        )

        print(f"Collection '{COLLECTION_NAME}' created successfully!")

    finally:
        client.close()


if __name__ == "__main__":
    create_collection()
