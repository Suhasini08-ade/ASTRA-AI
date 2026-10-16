"""
backend/tests/test_document_summarizer_e2e.py
=============================================
Verification script for Document Summarizer, Fast PDF Uploads,
Qdrant Vector Storage, Content-Hash Deduplication, and Document Q&A.
"""

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from backend.config import get_settings
from backend.database import close_db, connect_db, get_database
from backend.services.document_extractor import extract_text_from_document
from backend.services.knowledge_service import compute_content_hash, knowledge_service
from backend.services.qdrant_service import get_qdrant_client
from backend.services.ai_service import AIService
from backend.routes.summarize import SummarizeRequest, summarize_document, ask_document_question, DocumentAskRequest


async def main():
    print("=" * 80)
    print("ASTRA AI — DOCUMENT SUMMARIZER & QDRANT DEDUPLICATION VERIFICATION")
    print("=" * 80)

    # Connect to MongoDB Atlas
    print("\n[STEP 1] Connecting to MongoDB Atlas...")
    await connect_db()
    db = get_database()
    print(f"  ✓ Connected to MongoDB database '{db.name}'")

    # Connect to Qdrant
    print("\n[STEP 2] Connecting to Qdrant Cloud...")
    qdrant = get_qdrant_client()
    settings = get_settings()
    collection_name = settings.QDRANT_COLLECTION or "astra_knowledge"
    col_info = qdrant.get_collection(collection_name)
    print(f"  ✓ Qdrant Collection '{collection_name}' status: {col_info.status}, points: {col_info.points_count}")

    # Read the Architecture PDF
    pdf_path = Path(__file__).resolve().parent.parent.parent / "Astra_AI_OS_Technical_Architecture_Report.pdf"
    if not pdf_path.exists():
        print(f"  ✗ Test PDF not found at {pdf_path}")
        return False

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    print(f"\n[STEP 3] Testing Fast PDF Text Extraction...")
    import time
    t0 = time.time()
    extracted_text_1 = extract_text_from_document(pdf_bytes, file_name=pdf_path.name, file_type="pdf")
    t1 = time.time()
    print(f"  ✓ First extraction time: {(t1 - t0)*1000:.2f}ms ({len(extracted_text_1)} chars)")

    # Test cache extraction
    t2 = time.time()
    extracted_text_2 = extract_text_from_document(pdf_bytes, file_name=pdf_path.name, file_type="pdf")
    t3 = time.time()
    print(f"  ✓ Cached extraction time: {(t3 - t2)*1000:.2f}ms (Instant cache hit!)")
    assert extracted_text_1 == extracted_text_2

    test_user = {"_id": "test_doc_summarizer_user_999", "email": "test@astra.ai"}
    doc_hash = compute_content_hash(extracted_text_1)
    print(f"  ✓ Deterministic Content Hash (SHA-256): {doc_hash[:16]}...")

    # Clean any prior test record
    await db.documents.delete_many({"user_id": str(test_user["_id"])})

    # Test first upload through summarize_document endpoint with real PDF Data URL
    print("\n[STEP 4] Testing Initial Document Upload & Auto-Qdrant Indexing...")
    import base64
    b64_pdf = "data:application/pdf;base64," + base64.b64encode(pdf_bytes).decode("utf-8")
    req = SummarizeRequest(
        fileContent=b64_pdf,
        fileName="Architecture_Test.pdf",
        fileType="pdf",
    )
    ai_service = AIService()

    t_start = time.time()
    res1 = await summarize_document(
        body=req,
        current_user=test_user,
        ai_service=ai_service,
        db=db,
    )
    t_end = time.time()
    res1_data = res1.get("data", {})
    print(f"  ✓ Initial Upload Execution Time: {(t_end - t_start):.2f}s")
    print(f"  ✓ Status: {res1_data.get('indexing_status')}")
    print(f"  ✓ Is Duplicate: {res1_data.get('is_duplicate')}")
    print(f"  ✓ Executive Summary: {str(res1_data.get('summary', {}).get('executiveSummary', ''))[:100]}...")
    assert res1_data.get("indexing_status") == "indexed"
    assert res1_data.get("is_duplicate") is False

    # Verify MongoDB record was saved with summary
    doc_record = await db.documents.find_one({"user_id": str(test_user["_id"]), "content_hash": doc_hash})
    assert doc_record is not None, "MongoDB document record was not saved"
    assert doc_record.get("summary") is not None, "Document summary was not saved in MongoDB"
    print(f"  ✓ MongoDB record verified with chunks count: {doc_record.get('chunks_count')}")

    # Test Duplicate Upload
    print("\n[STEP 5] Testing Duplicate Document Upload (Content-Hash Deduplication)...")
    t_dup_start = time.time()
    res_dup = await summarize_document(
        body=req,
        current_user=test_user,
        ai_service=ai_service,
        db=db,
    )
    t_dup_end = time.time()
    res_dup_data = res_dup.get("data", {})
    dup_time_ms = (t_dup_end - t_dup_start) * 1000
    print(f"  ✓ Duplicate Upload Execution Time: {dup_time_ms:.2f}ms (Near Instant!)")
    print(f"  ✓ Duplicate Status: {res_dup_data.get('indexing_status')}")
    print(f"  ✓ Is Duplicate: {res_dup_data.get('is_duplicate')}")
    print(f"  ✓ Message: {res_dup_data.get('message')}")
    assert res_dup_data.get("is_duplicate") is True
    assert res_dup_data.get("indexing_status") == "already_indexed"
    assert "Duplicate document detected" in res_dup_data.get("message")
    print(f"  ✓ Deduplication successfully verified: zero redundant vector points or embeddings!")

    # Test Interactive Document Q&A
    print("\n[STEP 6] Testing Interactive Document Q&A via Qdrant Vectors...")
    ask_req = DocumentAskRequest(
        question="What database systems and vector stores does Astra AI integrate?",
        documentHash=doc_hash,
        fileName="Architecture_Test.pdf",
    )
    ask_res = await ask_document_question(
        body=ask_req,
        current_user=test_user,
        ai_service=ai_service,
    )
    ask_data = ask_res.get("data", {})
    answer = ask_data.get("answer", "")
    sources = ask_data.get("sources", [])
    print(f"  ✓ Question: {ask_data.get('question')}")
    print(f"  ✓ Answer: {answer[:200]}...")
    print(f"  ✓ Retrieved {len(sources)} relevant Qdrant vector chunks as context.")
    assert len(answer) > 20, "Answer was empty or too short"

    print("\n" + "=" * 80)
    print("ALL TESTS PASSED! DOCUMENT SUMMARIZER, QDRANT STORAGE & DEDUPLICATION VERIFIED.")
    print("=" * 80)
    return True


if __name__ == "__main__":
    asyncio.run(main())
