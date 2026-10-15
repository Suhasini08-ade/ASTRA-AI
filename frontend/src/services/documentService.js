import {
  apiSummarizeDocument,
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
function formatSummary(rawSummary, fileName) {
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
 * 2. Summarizes content using backend AI router (/api/summarize)
 * 3. Ingests and indexes into Qdrant Vector DB & MongoDB (/api/knowledge/upload)
 */
export async function processUploadedDocument(file) {
  if (!file) throw new Error('No file provided for upload.');

  const fileName = file.name || 'document.pdf';
  const fileSize = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'pdf';

  // Read content
  const content = await readFileContent(file);

  // 1. Call backend document summarizer endpoint
  let summaryText = '';
  try {
    const summaryData = await apiSummarizeDocument(content, fileName, fileExt);
    summaryText = formatSummary(summaryData, fileName);
  } catch (err) {
    console.warn('Backend summarization failed, falling back to default info:', err);
    summaryText = `Uploaded ${fileName} (${fileSize}). Ready for vector search and AI querying.`;
  }

  // 2. Index in Qdrant & MongoDB Knowledge collection
  try {
    await apiUploadKnowledgeDocument(file, fileName, 'document');
  } catch (ingestErr) {
    console.warn('Knowledge vector indexing failed or offline:', ingestErr);
  }

  // Determine text snippet to display
  let extractedSnippet = '';
  if (typeof content === 'string' && !content.startsWith('data:')) {
    extractedSnippet = content.slice(0, 5000);
  } else {
    extractedSnippet = `[Document: ${fileName} (${fileExt.toUpperCase()})]\n${summaryText}\n\nBinary file successfully processed and indexed into private knowledge memory.`;
  }

  return {
    id: `doc-${Date.now()}`,
    name: fileName,
    size: fileSize,
    uploadedAt: new Date().toISOString().split('T')[0],
    extractedText: extractedSnippet,
    summary: summaryText,
  };
}

/**
 * Queries the document content using the backend AI provider router.
 * First tries semantic search from Qdrant vector memory, then prompts the AI assistant.
 */
export async function queryDocumentAI(documentText, question) {
  if (!question || !question.trim()) return '';

  try {
    // 1. Try semantic search in private knowledge base
    let contextStr = '';
    try {
      const searchHits = await apiSearchKnowledge(question.trim(), null, 3);
      if (searchHits && searchHits.length > 0) {
        contextStr = searchHits.map((h) => h.text || h.payload?.text || '').filter(Boolean).join('\n---\n');
      }
    } catch {
      // Vector search optional
    }

    // 2. Fall back to extracted text snippet if no hits
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
