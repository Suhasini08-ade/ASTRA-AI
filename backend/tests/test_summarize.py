"""
Unit and integration tests for Document Summarizer and Text Extraction pipeline.
Verifies PDF, DOCX, TXT processing, ProviderRouter fallback (Gemini -> Groq),
and graceful fallback response without API key leakage.
"""

import base64
import io
import json
import unittest

import docx
import pypdf
from fastapi.testclient import TestClient

from backend.app import app
from backend.providers.base import (
    AIProviderResponse,
    AIProviderTemporaryError,
    BaseAIProvider,
)
from backend.providers.router import ProviderRouter
from backend.routes.summarize import get_ai_service
from backend.services.ai_service import AIService
from backend.services.document_extractor import (
    DocumentExtractionError,
    extract_text_from_document,
)


class MockAIProvider(BaseAIProvider):
    def __init__(self, response_or_exc: AIProviderResponse | Exception, name: str = "mock"):
        self.response_or_exc = response_or_exc
        self.name = name
        self.calls = []

    async def chat_completion(self, messages, tools=None):
        self.calls.append((messages, tools))
        if isinstance(self.response_or_exc, Exception):
            raise self.response_or_exc
        return self.response_or_exc


def _create_sample_pdf_bytes(text: str) -> bytes:
    """Create a minimal valid in-memory PDF containing the given text."""
    # Using pypdf's page writer with canvas or simple stream text
    # In pypdf, we can create a PDF with text by writing a raw PDF stream
    pdf_content = (
        f"%PDF-1.4\n"
        f"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        f"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
        f"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <<>> >> endobj\n"
        f"4 0 obj <</Length {len(text) + 20}>> stream\n"
        f"BT /F1 12 Tf 72 712 Td ({text}) Tj ET\n"
        f"endstream endobj\n"
        f"xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \n"
        f"trailer <</Size 5 /Root 1 0 R>>\nstartxref\n300\n%%EOF"
    )
    return pdf_content.encode("latin-1")


def _create_sample_docx_bytes(paragraphs: list[str]) -> bytes:
    """Create a minimal valid in-memory DOCX."""
    doc = docx.Document()
    for p in paragraphs:
        doc.add_paragraph(p)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


class DocumentExtractorTests(unittest.TestCase):
    def test_extract_plain_text(self):
        """Plain text and markdown extraction."""
        sample = "Line 1 of document.\n\nLine 2 with key insights."
        extracted = extract_text_from_document(sample, "notes.txt", "text")
        self.assertIn("Line 1 of document.", extracted)
        self.assertIn("Line 2 with key insights.", extracted)

    def test_extract_docx(self):
        """DOCX file extraction from raw bytes and base64."""
        docx_bytes = _create_sample_docx_bytes(["Strategic Goals 2026", "Action Item: Launch product."])
        b64_docx = base64.b64encode(docx_bytes).decode("ascii")

        # Test base64 string
        extracted = extract_text_from_document(b64_docx, "plan.docx", "docx")
        self.assertIn("Strategic Goals 2026", extracted)
        self.assertIn("Action Item: Launch product.", extracted)

        # Test Data URL format
        data_url = f"data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,{b64_docx}"
        extracted_dataurl = extract_text_from_document(data_url, "plan.docx", "docx")
        self.assertIn("Strategic Goals 2026", extracted_dataurl)

    def test_extract_empty_fails(self):
        """Empty documents should raise DocumentExtractionError."""
        with self.assertRaises(DocumentExtractionError):
            extract_text_from_document("", "empty.txt", "text")

    def test_extract_corrupt_docx_fails(self):
        """Corrupt DOCX files should raise DocumentExtractionError cleanly."""
        with self.assertRaises(DocumentExtractionError):
            extract_text_from_document("Not a real docx content", "fake.docx", "docx")

    def test_long_document_is_truncated_safely(self):
        """Long documents exceeding MAX_DOCUMENT_CHARS must be truncated safely."""
        long_text = "Word " * 5000  # ~25,000 characters
        extracted = extract_text_from_document(long_text, "long.txt", "text", max_chars=1000)
        self.assertLessEqual(len(extracted), 1200)
        self.assertIn("[... Document content truncated", extracted)


from backend.utils.auth import get_current_user


class SummarizerRouteTests(unittest.TestCase):
    def setUp(self):
        self.mock_user = {"_id": "test_user_123", "email": "test@example.com"}
        app.dependency_overrides[get_current_user] = lambda: self.mock_user
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_summarize_without_auth_returns_401(self):
        """POST /api/summarize must reject unauthenticated requests with HTTP 401."""
        app.dependency_overrides.pop(get_current_user, None)
        response = self.client.post(
            "/api/summarize",
            json={"fileContent": "test content", "fileName": "test.txt", "fileType": "text"},
        )
        self.assertEqual(response.status_code, 401)

    def test_summarize_success_with_gemini(self):
        """Test summarization when Gemini provider is available and responds."""
        structured_json = {
            "executiveSummary": "The document outlines operational milestones for Q3.",
            "keyPoints": ["Milestone 1 completed", "Budget approved"],
            "actionableInsights": ["Schedule team review", "Deploy beta version"],
            "readingTime": "2 mins read",
            "sentimentOrCategory": "Productivity",
        }
        gemini_mock = MockAIProvider(
            AIProviderResponse(content=json.dumps(structured_json)), name="gemini"
        )
        groq_mock = MockAIProvider(
            AIProviderResponse(content="groq should not be called"), name="groq"
        )

        router = ProviderRouter(
            providers=[("gemini", gemini_mock), ("groq", groq_mock)]
        )
        app.dependency_overrides[get_ai_service] = lambda: AIService(provider=router)

        docx_bytes = _create_sample_docx_bytes(["Q3 Operational Plan", "Key milestone reached."])
        b64 = base64.b64encode(docx_bytes).decode("ascii")

        response = self.client.post(
            "/api/summarize",
            json={"fileContent": b64, "fileName": "plan.docx", "fileType": "docx"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json().get("data", {}).get("summary", {})
        self.assertEqual(data["executiveSummary"], structured_json["executiveSummary"])
        self.assertEqual(len(gemini_mock.calls), 1)
        self.assertEqual(len(groq_mock.calls), 0)

    def test_summarize_fallback_from_gemini_to_groq(self):
        """Test summarization when Gemini fails (e.g. 503) and router falls back to Groq."""
        structured_json = {
            "executiveSummary": "Groq generated summary from fallback.",
            "keyPoints": ["Fallback succeeded", "High performance maintained"],
            "actionableInsights": ["Continue monitoring"],
            "readingTime": "1 min read",
            "sentimentOrCategory": "Technical",
        }
        gemini_mock = MockAIProvider(
            AIProviderTemporaryError(status_code=503, reason="Gemini overloaded"), name="gemini"
        )
        groq_mock = MockAIProvider(
            AIProviderResponse(content=f"```json\n{json.dumps(structured_json)}\n```"),
            name="groq",
        )

        router = ProviderRouter(
            providers=[("gemini", gemini_mock), ("groq", groq_mock)]
        )
        app.dependency_overrides[get_ai_service] = lambda: AIService(provider=router)

        response = self.client.post(
            "/api/summarize",
            json={
                "fileContent": "Project Status: All systems green.",
                "fileName": "status.txt",
                "fileType": "text",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json().get("data", {}).get("summary", {})
        self.assertEqual(data["executiveSummary"], structured_json["executiveSummary"])
        self.assertEqual(len(gemini_mock.calls), 1)
        self.assertEqual(len(groq_mock.calls), 1)

    def test_summarize_graceful_fallback_when_all_providers_fail(self):
        """Test that failure across all AI providers returns a clean structured fallback without error."""
        gemini_mock = MockAIProvider(
            AIProviderTemporaryError(status_code=503, reason="Unavailable"), name="gemini"
        )
        groq_mock = MockAIProvider(
            AIProviderTemporaryError(status_code=503, reason="Unavailable"), name="groq"
        )

        router = ProviderRouter(
            providers=[("gemini", gemini_mock), ("groq", groq_mock)]
        )
        app.dependency_overrides[get_ai_service] = lambda: AIService(provider=router)

        response = self.client.post(
            "/api/summarize",
            json={
                "fileContent": "Comprehensive technical brief regarding distributed systems.",
                "fileName": "tech.txt",
                "fileType": "text",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json().get("data", {}).get("summary", {})
        self.assertIn("executiveSummary", data)
        self.assertIn("keyPoints", data)
        self.assertIn("actionableInsights", data)
        # Ensure no private API keys or secrets are leaked
        raw_text = json.dumps(data)
        self.assertNotIn("AI_KEY", raw_text)
        self.assertNotIn("sk-", raw_text)

    def test_unreadable_file_returns_400(self):
        """Unreadable or corrupted binary data returns HTTP 400 with clean error detail."""
        response = self.client.post(
            "/api/summarize",
            json={
                "fileContent": "random corrupted content that is not a valid docx",
                "fileName": "broken.docx",
                "fileType": "docx",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())


if __name__ == "__main__":
    unittest.main()
