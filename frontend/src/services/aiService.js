import {
  apiSendChatMessage,
  apiGetChatHistory,
  apiGetChatConversations,
  apiClearChatHistory,
  apiCreateDeepDive,
  apiGetDeepDives,
  apiGetDeepDive,
  apiDeepDiveAction,
} from './api';

/**
 * Generate a response from the ASTRA AI assistant.
 * Communicates with the FastAPI backend (/api/chat), routing through
 * Gemini / Groq / OpenRouter with agent tool execution.
 */
export async function generateAIResponse(prompt, conversationId = null) {
  if (!prompt || !prompt.trim()) return '';
  try {
    const reply = await apiSendChatMessage(prompt.trim(), conversationId);
    return reply;
  } catch (err) {
    console.error('Error in generateAIResponse:', err);
    throw err;
  }
}

/**
 * Fetch persisted chat message history for the authenticated user.
 */
export async function fetchChatHistory(limit = 50, conversationId = null) {
  try {
    return await apiGetChatHistory(limit, conversationId);
  } catch (err) {
    console.error('Failed to fetch chat history:', err);
    return [];
  }
}

/**
 * Fetch conversations list for the authenticated user.
 */
export async function fetchConversations() {
  try {
    return await apiGetChatConversations();
  } catch (err) {
    console.error('Failed to fetch conversations:', err);
    return [];
  }
}

/**
 * Clear chat history in MongoDB Atlas.
 */
export async function deleteChatHistory() {
  try {
    return await apiClearChatHistory();
  } catch (err) {
    console.error('Failed to clear chat history:', err);
    throw err;
  }
}

/**
 * Generate interactive Deep Dive mind map using backend /api/deep-dives.
 */
export async function generateDeepDiveMap(topic) {
  const cleanTopic = topic ? topic.trim() : 'Artificial Intelligence';
  try {
    const session = await apiCreateDeepDive(cleanTopic);
    const nodes = session?.knowledge_map?.nodes || [];
    return {
      id: session.id,
      topic: session.topic || cleanTopic,
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.label,
        type: n.parent ? 'concept' : 'root',
        description: n.summary || `Explore ${n.label}.`,
        difficulty: n.difficulty || 'Beginner',
      })),
      challenges: [
        {
          id: 'q1',
          question: `What is the core focus when learning ${cleanTopic}?`,
          options: [
            'A) Theoretical comprehension',
            'B) Practical application',
            'C) Both theory & application',
            'D) Memorization',
          ],
          answer: 2,
        },
      ],
      progress: 60,
    };
  } catch (err) {
    console.error('Failed to create deep dive map:', err);
    throw err;
  }
}

/**
 * Request concept-specific AI explanation or challenge quiz.
 */
export async function requestDeepDiveAction(sessionId, concept, action, prompt = null) {
  return await apiDeepDiveAction(sessionId, concept, action, prompt);
}
