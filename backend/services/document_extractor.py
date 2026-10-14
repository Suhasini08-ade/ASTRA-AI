"""
services/document_extractor.py
================================
Service for converting PDF, DOCX, and TXT documents into clean, readable text.
Ensures raw binary data is never forwarded to AI models and handles long documents safely.
"""

import base64
import io
import logging
import re
from typing import Union

import docx
import pypdf

logger = logging.getLogger(__name__)

# Max characters of extracted text passed to AI for token context safety (~3,500-4,000 tokens)
MAX_DOCUMENT_CHARS = 15_000


class DocumentExtractionError(Exception):
    """Raised when text extraction from a document fails."""

    def __init__(self, message: str, file_name: str = ""):
        super().__init__(message)
        self.message = message
        self.file_name = file_name


def _clean_text(text: str) -> str:
    """Normalize whitespace and remove null/control characters."""
    if not text:
        return ""
    # Strip null bytes and non-printable control characters (except newline, tab, carriage return)
    cleaned = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)
    # Normalize multiple consecutive empty lines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _decode_to_bytes(raw_content: Union[str, bytes]) -> tuple[bytes, bool]:
    """
    Decodes input content into raw bytes.
    Returns (bytes_data, was_base64_or_binary).
    """
    if isinstance(raw_content, bytes):
        return raw_content, True

    if not isinstance(raw_content, str):
        raise DocumentExtractionError("File content must be a string or bytes.")

    content = raw_content.strip()

    # Handle Data URL format: data:<mime>;base64,<payload>
    if content.startswith("data:") and ";base64," in content:
        try:
            payload = content.split(";base64,", 1)[1]
            return base64.b64decode(payload), True
        except Exception as exc:
            raise DocumentExtractionError(f"Failed to decode base64 Data URL: {exc}")

    # Check if content is a plain base64 string
    # PDF base64 typically starts with 'JVBERi', DOCX (ZIP) with 'UEsDB'
    if content.startswith("JVBERi") or content.startswith("UEsDB"):
        try:
            return base64.b64decode(content), True
        except Exception:
            pass

    # Check for direct magic byte signatures in string (if read via latin-1/binary string)
    if content.startswith("%PDF") or content.startswith("PK\x03\x04"):
        return content.encode("latin-1", errors="ignore"), True

    # Otherwise treated as standard text
    return content.encode("utf-8", errors="ignore"), False


def _extract_pdf(data_bytes: bytes, file_name: str) -> str:
    """Extract readable text from a PDF byte stream."""
    try:
        reader = pypdf.PdfReader(io.BytesIO(data_bytes))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                raise DocumentExtractionError(
                    "The PDF file is password-protected and cannot be read.", file_name
                )

        pages_text = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages_text.append(page_text.strip())

        full_text = "\n\n".join(pages_text).strip()
        if not full_text:
            raise DocumentExtractionError(
                "No readable text could be extracted from this PDF. "
                "The document may contain only scanned images without OCR.",
                file_name,
            )
        return full_text
    except DocumentExtractionError:
        raise
    except Exception as exc:
        logger.warning("PDF extraction failed for '%s': %s", file_name, exc)
        raise DocumentExtractionError(f"Failed to parse PDF document: {exc}", file_name)


def _extract_docx(data_bytes: bytes, file_name: str) -> str:
    """Extract readable text from a DOCX byte stream."""
    try:
        doc = docx.Document(io.BytesIO(data_bytes))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

        # Also extract table text
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)

        full_text = "\n\n".join(paragraphs).strip()
        if not full_text:
            raise DocumentExtractionError(
                "No readable text found in this Word document (.docx).", file_name
            )
        return full_text
    except DocumentExtractionError:
        raise
    except Exception as exc:
        logger.warning("DOCX extraction failed for '%s': %s", file_name, exc)
        raise DocumentExtractionError(f"Failed to parse DOCX document: {exc}", file_name)


def extract_text_from_document(
    content: Union[str, bytes],
    file_name: str = "document",
    file_type: str = "text",
    max_chars: int = MAX_DOCUMENT_CHARS,
) -> str:
    """
    Safely extract plain text from an uploaded document (PDF, DOCX, TXT, MD).

    :param content: String (plain text, base64, or data URI) or raw bytes.
    :param file_name: Original file name.
    :param file_type: Declared file type or extension (e.g. 'pdf', 'docx', 'txt').
    :param max_chars: Maximum character limit for AI safety.
    :return: Sanitized plain text ready for summarization.
    """
    if not content:
        raise DocumentExtractionError("Document content is empty.", file_name)

    name_lower = (file_name or "").lower()
    type_lower = (file_type or "").lower().replace(".", "")

    data_bytes, is_binary = _decode_to_bytes(content)

    is_pdf = (
        type_lower == "pdf"
        or name_lower.endswith(".pdf")
        or data_bytes.startswith(b"%PDF")
    )

    is_docx = (
        type_lower in ("docx", "doc")
        or name_lower.endswith(".docx")
        or data_bytes.startswith(b"PK\x03\x04")
    )

    if is_pdf:
        extracted = _extract_pdf(data_bytes, file_name)
    elif is_docx:
        extracted = _extract_docx(data_bytes, file_name)
    else:
        # Plain text / Markdown
        try:
            extracted = data_bytes.decode("utf-8")
        except UnicodeDecodeError:
            extracted = data_bytes.decode("latin-1", errors="replace")

    cleaned = _clean_text(extracted)
    if not cleaned:
        raise DocumentExtractionError(
            "Document does not contain any readable text.", file_name
        )

    # Check for binary gibberish if it wasn't recognized as PDF or DOCX
    if not is_pdf and not is_docx:
        # Check percentage of null/unprintable characters
        non_printable = sum(1 for c in cleaned if ord(c) < 32 and c not in "\n\r\t")
        if len(cleaned) > 0 and (non_printable / len(cleaned)) > 0.05:
            raise DocumentExtractionError(
                "Document appears to contain binary data that could not be parsed as text.",
                file_name,
            )

    # Apply length cap for AI token and context safety
    if len(cleaned) > max_chars:
        logger.info(
            "Document '%s' length (%d chars) exceeds max limit (%d). Truncating safely.",
            file_name,
            len(cleaned),
            max_chars,
        )
        cleaned = (
            cleaned[:max_chars].rstrip()
            + "\n\n[... Document content truncated for summarization context window limit ...]"
        )

    return cleaned
