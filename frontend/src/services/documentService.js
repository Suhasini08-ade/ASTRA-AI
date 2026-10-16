import {
  apiSummarizeDocument,
  apiAskDocumentQuestion,
  apiUploadKnowledgeDocument,
  apiSearchKnowledge,
  apiSendChatMessage,
} from './api';

/**
 * Reads a File object as either text or base64 DataURL depending on its MIME type.
 */
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isText =
      file.type.startsWith('text/') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.csv');

    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);

    if (isText) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Formats structured backend summary JSON into a readable string for the UI.
 */
export function formatSummary(rawSummary, fileName) {
  if (!rawSummary) return `Summary generated for ${fileName}.`;

  if (typeof rawSummary === 'string') return rawSummary;

  const parts = [];
  if (rawSummary.executiveSummary) {
    parts.push(rawSummary.executiveSummary);
  }

  if (Array.isArray(rawSummary.keyPoints) && rawSummary.keyPoints.length > 0) {
    parts.push('\nKey Points:\n' + rawSummary.keyPoints.map((k) => `• ${k}`).join('\n'));
  }

  if (Array.isArray(rawSummary.actionableInsights) && rawSummary.actionableInsights.length > 0) {
    parts.push('\nActionable Insights:\n' + rawSummary.actionableInsights.map((a) => `• ${a}`).join('\n'));
  }

  if (rawSummary.readingTime) {
    parts.push(`\nReading Time: ${rawSummary.readingTime}`);
  }

  return parts.join('\n');
}

/**
 * Processes an uploaded document through the FastAPI backend:
 * 1. Reads file payload
 * 2. Coordinates fast extraction, content-hash deduplication, and automatic Qdrant indexing
 * 3. Returns structured document metadata, summary, and live indexing status
 */
export async function processUploadedDocument(file, onStatusUpdate = null) {
  if (!file) throw new Error('No file provided for upload.');

  const fileName = file.name || 'document.pdf';
  const fileSize = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'pdf';

  onStatusUpdate?.({ step: 'reading', message: `Reading ${fileName} (${fileSize})...` });

  // Read content
  const content = await readFileContent(file);

  onStatusUpdate?.({ step: 'indexing', message: 'Extracting text & checking Qdrant vector index...' });

  let summaryText = '';
  let docId = `doc-${Date.now()}`;
  let indexingStatus = 'indexed';
  let isDuplicate = false;
  let chunksCount = 1;
  let contentHash = '';

  try {
    const res = await apiSummarizeDocument(content, fileName, fileExt);
    const summaryData = res?.summary || res;
    summaryText = formatSummary(summaryData, fileName);

    if (res?.document) {
      docId = res.document.id || docId;
      chunksCount = res.document.chunks_count || chunksCount;
      contentHash = res.document.content_hash || '';
    }
    indexingStatus = res?.indexing_status || 'indexed';
    isDuplicate = Boolean(res?.is_duplicate);

    if (isDuplicate) {
      onStatusUpdate?.({
        step: 'duplicate',
        message: 'Duplicate detected! Reused existing Qdrant vector embeddings & summary.',
        indexingStatus,
        isDuplicate: true,
      });
    } else {
      onStatusUpdate?.({
        step: 'ready',
        message: `Indexed into Qdrant Cloud (${chunksCount} vector chunks).`,
        indexingStatus,
        isDuplicate: false,
      });
    }
  } catch (err) {
    console.warn('Backend summarizer/indexing error, falling back:', err);
    summaryText = `Uploaded ${fileName} (${fileSize}). Ready for vector search and AI querying.`;
    onStatusUpdate?.({ step: 'error', message: 'Upload completed with offline fallback.' });
  }

  // Determine text snippet to display
  let extractedSnippet = '';
  if (typeof content === 'string' && !content.startsWith('data:')) {
    extractedSnippet = content.slice(0, 5000);
  } else {
    extractedSnippet = `[Document: ${fileName} (${fileExt.toUpperCase()})]\n${summaryText}\n\nBinary file successfully processed and indexed into Qdrant Cloud vector memory.`;
  }

  return {
    id: docId,
    name: fileName,
    size: fileSize,
    uploadedAt: new Date().toISOString().split('T')[0],
    extractedText: extractedSnippet,
    summary: summaryText,
    indexingStatus,
    isDuplicate,
    chunksCount,
    contentHash,
  };
}

/**
 * Queries the document content using the backend AI provider router.
 * First tries semantic search from Qdrant vector memory, then prompts the AI assistant.
 */
export async function queryDocumentAI(documentText, question, { documentId = null, documentHash = null, fileName = null } = {}) {
  if (!question || !question.trim()) return '';

  try {
    // 1. Try dedicated document Q&A endpoint grounded in Qdrant vectors
    try {
      const askRes = await apiAskDocumentQuestion(question.trim(), {
        documentId,
        documentHash,
        fileName,
        documentText: documentText ? documentText.slice(0, 4000) : null,
      });
      if (askRes && askRes.answer) {
        return askRes.answer;
      }
    } catch {
      // Fall through to semantic search + chat
    }

    // 2. Try semantic search in private knowledge base
    let contextStr = '';
    try {
      const searchHits = await apiSearchKnowledge(question.trim(), null, 3);
      if (searchHits && searchHits.length > 0) {
        contextStr = searchHits.map((h) => h.text || h.payload?.text || '').filter(Boolean).join('\n---\n');
      }
    } catch {
      // Vector search optional
    }

    // 3. Fall back to extracted text snippet if no hits
    if (!contextStr && documentText) {
      contextStr = documentText.slice(0, 3500);
    }

    const aiPrompt = contextStr
      ? `Based on the following document context:\n${contextStr}\n\nPlease answer this question concisely and accurately:\n${question}`
      : `Question regarding uploaded document:\n${question}`;

    const answer = await apiSendChatMessage(aiPrompt);
    return answer || 'No response generated from AI engine.';
  } catch (err) {
    console.error('Failed to query document AI:', err);
    return `Unable to process query: ${err.message || 'AI engine is currently unavailable.'}`;
  }
}

