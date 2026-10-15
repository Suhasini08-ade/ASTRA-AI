"""
backend/tests/test_live_qdrant_pipeline.py
===========================================
Live end-to-end verification script for Qdrant Cloud vector ingestion,
384-dimensional embeddings, payload storage, deduplication, semantic retrieval,
and AI assistant context injection.
"""

import asyncio
import os
import sys
from pathlib import Path

# Ensure backend package can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from backend.config import get_settings
from backend.database import close_db, connect_db, get_database
from backend.services.document_extractor import extract_text_from_document
from backend.services.embedding_service import EXPECTED_EMBEDDING_DIM, generate_embedding
from backend.services.knowledge_service import knowledge_service
from backend.services.qdrant_service import get_qdrant_client


async def run_live_pipeline_test():
    print("=" * 80)
    print("ASTRA AI — LIVE QDRANT CLOUD END-TO-END PIPELINE VERIFICATION")
    print("=" * 80)

    # 1. Connect to Qdrant & Inspect Collection Configuration
    print("\n[STEP 1] Connecting to Qdrant Cloud...")
    qdrant_client = get_qdrant_client()
    settings = get_settings()
    collection_name = settings.QDRANT_COLLECTION or "astra_knowledge"

    try:
        col_info = qdrant_client.get_collection(collection_name)
        initial_points_count = col_info.points_count
        vectors_config = col_info.config.params.vectors
        dim = getattr(vectors_config, "size", None)
        dist = str(getattr(vectors_config, "distance", ""))

        print(f"  ✓ Connected to Qdrant successfully at {settings.QDRANT_URL[:45]}...")
        print(f"  ✓ Target Collection: '{collection_name}'")
        print(f"  ✓ Status: {col_info.status}")
        print(f"  ✓ Vector Dimension: {dim} (Expected: {EXPECTED_EMBEDDING_DIM})")
        print(f"  ✓ Distance Metric: {dist}")
        print(f"  ✓ Initial Points Count: {initial_points_count}")
        assert dim == 384, f"Dimension mismatch: expected 384, got {dim}"
    except Exception as exc:
        print(f"  ✗ Failed to inspect collection: {exc}")
        return False

    # 2. Connect to MongoDB Atlas
    print("\n[STEP 2] Connecting to MongoDB Atlas...")
    try:
        await connect_db()
        db = get_database()
        print(f"  ✓ Connected to MongoDB database '{db.name}'")
    except Exception as exc:
        print(f"  ✗ MongoDB connection failed: {exc}")
        db = None

    # 3. Read and Extract PDF Document
    pdf_path = Path(__file__).resolve().parent.parent.parent / "Astra_AI_OS_Technical_Architecture_Report.pdf"
    print(f"\n[STEP 3] Reading PDF: {pdf_path.name}...")
    if not pdf_path.exists():
        print(f"  ✗ File not found: {pdf_path}")
        return False

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    print(f"  ✓ Read {len(pdf_bytes)} bytes from PDF")
    extracted_text = extract_text_from_document(
        content=pdf_bytes,
        file_name=pdf_path.name,
        file_type="pdf",
        max_chars=None,
    )
    print(f"  ✓ Extracted plain text: {len(extracted_text)} characters, ~{len(extracted_text.split())} words")
    print(f"  ✓ Preview: {extracted_text[:120].strip()}...")

    # 4. Ingest and Vectorize Document into Qdrant Cloud
    test_user_id = "test_user_astra_os_live"
    print(f"\n[STEP 4] Ingesting document into Qdrant Cloud for user '{test_user_id}'...")
    ingest_result = await knowledge_service.ingest_document(
        db=db,
        user_id=test_user_id,
        text_content=extracted_text,
        file_name=pdf_path.name,
        file_type="pdf",
        metadata={
            "title": "Astra AI Technical Architecture Report",
            "category": "document",
            "department": "Engineering",
        },
        reindex=True,
    )

    print(f"  ✓ Ingestion Status: {ingest_result.get('status')}")
    print(f"  ✓ Chunks Processed & Stored: {ingest_result.get('chunks_count')}")
    print(f"  ✓ Vector Points Upserted: {ingest_result.get('points_count')}")
    chunks_stored = ingest_result.get("chunks_count", 0)

    # 5. Verify Collection Point Count Reflection in Qdrant
    print("\n[STEP 5] Verifying Qdrant Cloud Collection Point Count...")
    updated_col_info = qdrant_client.get_collection(collection_name)
    current_points_count = updated_col_info.points_count
    print(f"  ✓ Previous Points Count: {initial_points_count}")
    print(f"  ✓ Current Points Count:  {current_points_count}")
    assert current_points_count >= chunks_stored, (
        f"Expected collection point count >= {chunks_stored}, but got {current_points_count}"
    )
    print(f"  ✓ Collection points count successfully verified!")

    # 6. Verify Deduplication
    print("\n[STEP 6] Testing Deduplication Logic (Duplicate Ingestion Attempt)...")
    dup_result = await knowledge_service.ingest_document(
        db=db,
        user_id=test_user_id,
        text_content=extracted_text,
        file_name=pdf_path.name,
        file_type="pdf",
        reindex=False,
    )
    print(f"  ✓ Duplicate Status: {dup_result.get('status')} (Expected: 'already_indexed')")
    assert dup_result.get("status") == "already_indexed", "Deduplication failed to return 'already_indexed'"
    print("  ✓ Deduplication successfully prevented redundant vector upserts!")

    # 7. Semantic Vector Search & Retrieval
    queries = [
        "What is the technology stack and backend framework of Astra AI?",
        "How does Astra handle vector storage and Qdrant integration?",
        "What are the multi-agent AI providers supported by the system?",
    ]

    print("\n[STEP 7] Performing Semantic Similarity Searches in Qdrant Cloud...")
    for idx, q in enumerate(queries, 1):
        print(f"\n  Query {idx}: '{q}'")
        search_hits = await knowledge_service.search_knowledge(
            user_id=test_user_id,
            query=q,
            limit=3,
            score_threshold=0.30,
        )
        print(f"  Found {len(search_hits)} relevant snippets:")
        for h_idx, hit in enumerate(search_hits, 1):
            score = hit["score"]
            title = hit["title"]
            source = hit["source"]
            preview = hit["text"][:140].replace("\n", " ")
            print(f"    [{h_idx}] Score: {score:.4f} | Source: {source} | Title: {title}")
            print(f"        Snippet: \"{preview}...\"")
        assert len(search_hits) > 0, f"No relevant vectors retrieved for query '{q}'"

    # 8. User Isolation Check
    print("\n[STEP 8] Testing User Isolation in Qdrant Vector Retrieval...")
    isolated_hits = await knowledge_service.search_knowledge(
        user_id="completely_different_user_999",
        query="What is the technology stack and backend framework of Astra AI?",
        limit=3,
    )
    print(f"  Results for unauthenticated/other user: {len(isolated_hits)} (Expected: 0)")
    assert len(isolated_hits) == 0, "User isolation breach: another user accessed indexed vectors!"
    print("  ✓ Strict user data isolation confirmed!")

    # 9. Verify Knowledge Assistant Context Augmentation
    print("\n[STEP 9] Verifying AI Assistant Prompt Augmentation...")
    top_knowledge = await knowledge_service.search_knowledge(
        user_id=test_user_id,
        query="Astra technical architecture report overview",
        limit=2,
    )
    assert len(top_knowledge) > 0, "Failed to retrieve top knowledge for assistant context"
    context_str = "\n".join(f"- [{k['title']}]: {k['text'][:100]}..." for k in top_knowledge)
    print("  ✓ Formatted Context for AI Assistant Prompt:")
    for line in context_str.split("\n"):
        print(f"    {line}")

    # Clean up DB connection
    if db is not None:
        await close_db()

    print("\n" + "=" * 80)
    print("ALL TESTS PASSED! QDRANT DOCUMENT INGESTION & RETRIEVAL PIPELINE VERIFIED.")
    print("=" * 80)
    return True


if __name__ == "__main__":
    success = asyncio.run(run_live_pipeline_test())
    sys.exit(0 if success else 1)
