/**
 * Centralized API client for ASTRA AI.
 * Handles authentication token injection, request normalization, error handling,
 * and unified API methods matching the FastAPI backend routes.
 */

import { getCurrentUserToken } from './firebase';

const rawBase = import.meta.env.VITE_API_BASE_URL || '';
// Clean trailing slash
const BASE_URL = rawBase.replace(/\/+$/, '');

/**
 * Resolves a full request URL.
 * Automatically adds the /api prefix if missing.
 */
export function getApiUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const apiPath = cleanEndpoint.startsWith('/api') ? cleanEndpoint : `/api${cleanEndpoint}`;
  return `${BASE_URL}${apiPath}`;
}

/**
 * Base HTTP request wrapper.
 * Automatically injects the latest Firebase ID token (or fallback JWT) into the Authorization header.
 */
export async function apiRequest(endpoint, options = {}) {
  const url = getApiUrl(endpoint);
  const headers = { ...(options.headers || {}) };

  // Automatically attach Firebase ID token or fallback JWT
  const token = await getCurrentUserToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Do not set Content-Type if uploading FormData (let the browser calculate boundary)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    console.error(`Network error requesting ${url}:`, networkErr);
    throw new Error('Unable to connect to ASTRA backend server. Please verify the backend is running.');
  }

  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // If 401 and not already retried, attempt an immediate token refresh and retry
    if (response.status === 401 && !options._retried) {
      try {
        const freshToken = await getCurrentUserToken(true);
        if (freshToken && freshToken !== token) {
          const retryHeaders = { ...headers, Authorization: `Bearer ${freshToken}` };
          return await apiRequest(endpoint, {
            ...options,
            headers: retryHeaders,
            _retried: true,
          });
        }
      } catch (refreshErr) {
        console.warn('Failed to refresh token after 401:', refreshErr);
      }
      localStorage.removeItem('astra_token');
    }

    const errorMsg =
      (data && typeof data === 'object' && (data.detail || data.message)) ||
      `HTTP Error ${response.status}: ${response.statusText}`;

    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// -----------------------------------------------------------------------------
// Authentication Endpoints (/api/auth)
// -----------------------------------------------------------------------------

export async function apiRegister(userData) {
  return await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function apiLogin(credentials) {
  return await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function apiGoogleAuth() {
  return await apiRequest('/api/auth/google', {
    method: 'POST',
  });
}

export async function apiGetMe() {
  return await apiRequest('/api/auth/me', {
    method: 'GET',
  });
}

export async function apiUpdateProfile(profileData) {
  return await apiRequest('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
}

export async function apiGetSettings() {
  const res = await apiRequest('/api/auth/settings', { method: 'GET' });
  return res.data;
}

export async function apiUpdateSettings(settingsData) {
  return await apiRequest('/api/auth/settings', {
    method: 'PUT',
    body: JSON.stringify(settingsData),
  });
}

// -----------------------------------------------------------------------------
// Tasks Endpoints (/api/tasks)
// -----------------------------------------------------------------------------

export async function apiGetTasks(status = null) {
  const query = status && status !== 'All' ? `?status=${encodeURIComponent(status.toLowerCase())}` : '';
  const res = await apiRequest(`/api/tasks${query}`, { method: 'GET' });
  return res.data || [];
}

export async function apiCreateTask(taskData) {
  const res = await apiRequest('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  });
  return res.data;
}

export async function apiUpdateTask(taskId, updateData) {
  const res = await apiRequest(`/api/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
  return res.data;
}

export async function apiDeleteTask(taskId) {
  return await apiRequest(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// -----------------------------------------------------------------------------
// Notes Endpoints (/api/notes)
// -----------------------------------------------------------------------------

export async function apiGetNotes() {
  const res = await apiRequest('/api/notes', { method: 'GET' });
  return res.data || [];
}

export async function apiCreateNote(noteData) {
  const res = await apiRequest('/api/notes', {
    method: 'POST',
    body: JSON.stringify(noteData),
  });
  return res.data;
}

export async function apiUpdateNote(noteId, updateData) {
  const res = await apiRequest(`/api/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
  return res.data;
}

export async function apiDeleteNote(noteId) {
  return await apiRequest(`/api/notes/${noteId}`, {
    method: 'DELETE',
  });
}

// -----------------------------------------------------------------------------
// Reminders Endpoints (/api/reminders)
// -----------------------------------------------------------------------------

export async function apiGetReminders() {
  const res = await apiRequest('/api/reminders', { method: 'GET' });
  return res.data || [];
}

export async function apiCreateReminder(reminderData) {
  const res = await apiRequest('/api/reminders', {
    method: 'POST',
    body: JSON.stringify(reminderData),
  });
  return res.data;
}

export async function apiUpdateReminder(reminderId, updateData) {
  const res = await apiRequest(`/api/reminders/${reminderId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
  return res.data;
}

export async function apiDeleteReminder(reminderId) {
  return await apiRequest(`/api/reminders/${reminderId}`, {
    method: 'DELETE',
  });
}

// -----------------------------------------------------------------------------
// Calendar Endpoints (/api/calendar)
// -----------------------------------------------------------------------------

export async function apiGetCalendarEvents(start = null, end = null) {
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiRequest(`/api/calendar/events${qs}`, { method: 'GET' });
  return res.data || [];
}

export async function apiCreateCalendarEvent(eventData) {
  const res = await apiRequest('/api/calendar/events', {
    method: 'POST',
    body: JSON.stringify(eventData),
  });
  return res.data;
}

export async function apiUpdateCalendarEvent(eventId, updateData) {
  const res = await apiRequest(`/api/calendar/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
  return res.data;
}

export async function apiDeleteCalendarEvent(eventId) {
  return await apiRequest(`/api/calendar/events/${eventId}`, {
    method: 'DELETE',
  });
}

// -----------------------------------------------------------------------------
// Focus Sessions Endpoints (/api/focus-sessions)
// -----------------------------------------------------------------------------

export async function apiGetFocusSessions(limit = 8) {
  const res = await apiRequest(`/api/focus-sessions?limit=${limit}`, { method: 'GET' });
  return res.data || [];
}

export async function apiCreateFocusSession(sessionData) {
  const res = await apiRequest('/api/focus-sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
  return res.data;
}

// -----------------------------------------------------------------------------
// AI Chat & Agent Endpoints (/api/chat & /api/agent)
// -----------------------------------------------------------------------------

export async function apiSendChatMessage(message, conversationId = null, docMetadata = null) {
  const payload = { message, conversation_id: conversationId };
  if (docMetadata) {
    if (docMetadata.document_id) payload.document_id = docMetadata.document_id;
    if (docMetadata.document_hash) payload.document_hash = docMetadata.document_hash;
    if (docMetadata.file_name) payload.file_name = docMetadata.file_name;
  }
  const res = await apiRequest('/api/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data?.reply || '';
}

export async function apiGetChatHistory(limit = 50, conversationId = null) {
  const qs = conversationId
    ? `?limit=${limit}&conversation_id=${encodeURIComponent(conversationId)}`
    : `?limit=${limit}`;
  const res = await apiRequest(`/api/chat/history${qs}`, { method: 'GET' });
  return res.data?.messages || [];
}

export async function apiGetChatConversations() {
  const res = await apiRequest('/api/chat/conversations', { method: 'GET' });
  return res.data || [];
}

export async function apiClearChatHistory() {
  return await apiRequest('/api/chat/history', { method: 'DELETE' });
}

export async function apiSendAgentMessage(message, conversationId = null) {
  const res = await apiRequest('/api/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });
  return res.data?.reply || '';
}

// -----------------------------------------------------------------------------
// Voice AI Endpoint (/api/voice)
// -----------------------------------------------------------------------------

export async function apiSendVoiceCommand(message) {
  const res = await apiRequest('/api/voice/command', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  return res.data || { reply: '' };
}

// -----------------------------------------------------------------------------
// Document Summarizer & Knowledge Endpoints (/api/summarize & /api/knowledge)
// -----------------------------------------------------------------------------

export async function apiSummarizeDocument(fileContent, fileName = 'document', fileType = 'text') {
  const res = await apiRequest('/api/summarize', {
    method: 'POST',
    body: JSON.stringify({ fileContent, fileName, fileType }),
  });
  return res.data || null;
}

export async function apiAskDocumentQuestion(question, { documentId = null, documentHash = null, fileName = null, documentText = null } = {}) {
  const res = await apiRequest('/api/summarize/ask', {
    method: 'POST',
    body: JSON.stringify({ question, documentId, documentHash, fileName, documentText }),
  });
  return res.data || null;
}


export async function apiUploadKnowledgeDocument(file, title = '', category = 'document') {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (category) formData.append('category', category);

  const res = await apiRequest('/api/knowledge/upload', {
    method: 'POST',
    body: formData,
  });
  return res.data;
}

export async function apiGetKnowledge(category = null, limit = 20) {
  const params = new URLSearchParams({ limit });
  if (category) params.append('category', category);
  const res = await apiRequest(`/api/knowledge?${params.toString()}`, { method: 'GET' });
  return res.data || { knowledge_items: [], documents: [] };
}

export async function apiSearchKnowledge(query, category = null, limit = 5) {
  const params = new URLSearchParams({ q: query, limit });
  if (category) params.append('category', category);
  const res = await apiRequest(`/api/knowledge/search?${params.toString()}`, { method: 'GET' });
  return res.data?.results || [];
}

export async function apiDeleteDocument(docId) {
  return await apiRequest(`/api/knowledge/documents/${docId}`, {
    method: 'DELETE',
  });
}

// -----------------------------------------------------------------------------
// Weather & News Endpoints (/api/weather & /api/news)
// -----------------------------------------------------------------------------

export async function apiGetWeather(location = null, lat = null, lon = null) {
  let qs = '';
  if (lat !== null && lon !== null && lat !== undefined && lon !== undefined) {
    qs = `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  } else if (location && typeof location === 'object') {
    if (location.lat != null && location.lon != null) {
      qs = `lat=${encodeURIComponent(location.lat)}&lon=${encodeURIComponent(location.lon)}`;
    } else {
      qs = `location=${encodeURIComponent(location.location || 'Kolhapur')}`;
    }
  } else if (location && String(location).trim()) {
    qs = `location=${encodeURIComponent(String(location).trim())}`;
  } else {
    qs = 'location=Kolhapur';
  }
  return await apiRequest(`/api/weather?${qs}`, {
    method: 'GET',
  });
}

export async function apiGetNews(category = 'All') {
  return await apiRequest(`/api/news?category=${encodeURIComponent(category)}`, {
    method: 'GET',
  });
}

// -----------------------------------------------------------------------------
// Deep Dive Endpoints (/api/deep-dives)
// -----------------------------------------------------------------------------

export async function apiGetDeepDives() {
  const res = await apiRequest('/api/deep-dives', { method: 'GET' });
  return res.data || [];
}

export async function apiCreateDeepDive(topic) {
  const res = await apiRequest('/api/deep-dives', {
    method: 'POST',
    body: JSON.stringify({ topic }),
  });
  return res.data;
}

export async function apiGetDeepDive(sessionId) {
  const res = await apiRequest(`/api/deep-dives/${sessionId}`, { method: 'GET' });
  return res.data;
}

export async function apiUpdateDeepDive(sessionId, updateData) {
  const res = await apiRequest(`/api/deep-dives/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(updateData),
  });
  return res.data;
}

export async function apiDeepDiveAction(sessionId, concept, action, prompt = null, relatedConcepts = []) {
  const res = await apiRequest(`/api/deep-dives/${sessionId}/ai`, {
    method: 'POST',
    body: JSON.stringify({
      concept,
      action,
      prompt,
      related_concepts: relatedConcepts,
    }),
  });
  return res.data;
}
