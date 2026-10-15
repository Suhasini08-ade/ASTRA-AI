/**
 * api.js
 * ======
 * Centralized API client service for communicating with the Python FastAPI backend.
 * Uses Firebase ID tokens for authentication instead of self-signed JWTs.
 */

import { auth } from './firebase';

/**
 * Get the current Firebase user's ID token.
 * Returns null if no user is signed in.
 */
async function getFirebaseIdToken() {
  if (auth && typeof auth.authStateReady === 'function') {
    try {
      await auth.authStateReady();
    } catch {
      // Ignore initialization errors here
    }
  }
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    // forceRefresh=false uses cached token if still valid
    return await user.getIdToken(false);
  } catch (err) {
    console.warn('Failed to get Firebase ID token:', err);
    return null;
  }
}

// Token and session storage
const TOKEN_KEY = 'astra_access_token';
const USER_KEY = 'astra_cached_user';

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeAuthToken = () => localStorage.removeItem(TOKEN_KEY);

export const getCachedUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
export const setCachedUser = (user) => {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {}
};
export const removeCachedUser = () => localStorage.removeItem(USER_KEY);

/**
 * Common fetch wrapper with automatic Firebase ID token injection.
 * Falls back to legacy localStorage token if Firebase token is unavailable.
 */
export async function fetchAPI(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Prefer Firebase ID token over legacy localStorage token
  const firebaseToken = await getFirebaseIdToken();
  const token = firebaseToken || getAuthToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const response = await fetch(url, config);
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `API error (${response.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

// --- Authentication Endpoints ---
export async function apiLogin(email, password) {
  const res = await fetchAPI('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res;
}

export async function apiRegister(name, email, password) {
  const res = await fetchAPI('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  return res;
}

export async function apiGoogleAuth() {
  // The Firebase ID token is automatically injected by fetchAPI
  const res = await fetchAPI('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res;
}

export async function apiGetMe() {
  return await fetchAPI('/api/auth/me');
}

// --- Chat & Agent Endpoints ---
export async function apiSendAgentMessage(message, conversationId = null) {
  return await fetchAPI('/api/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });
}

export async function apiSendVoiceCommand(message) {
  return await fetchAPI('/api/voice/command', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function apiGetChatHistory(limit = 50, conversationId = null) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (conversationId) params.set('conversation_id', conversationId);
  return await fetchAPI(`/api/chat/history?${params.toString()}`);
}

export async function apiGetChatConversations() {
  return await fetchAPI('/api/chat/conversations');
}

export async function apiClearChatHistory() {
  return await fetchAPI('/api/chat/history', {
    method: 'DELETE',
  });
}

// --- Tasks Endpoints ---
export async function apiGetTasks(status = null) {
  const url = status ? `/api/tasks?status=${encodeURIComponent(status)}` : '/api/tasks';
  return await fetchAPI(url);
}

export async function apiCreateTask(taskData) {
  return await fetchAPI('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  });
}

export async function apiUpdateTask(taskId, taskData) {
  return await fetchAPI(`/api/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(taskData),
  });
}

export async function apiDeleteTask(taskId) {
  return await fetchAPI(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// --- Focus Session Endpoints ---
export async function apiGetFocusSessions(limit = 8) {
  return await fetchAPI(`/api/focus-sessions?limit=${limit}`);
}

export async function apiCreateFocusSession(sessionData) {
  return await fetchAPI('/api/focus-sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
}

// --- Calendar Endpoints ---
export async function apiGetEvents(start = null, end = null) {
  let url = '/api/calendar/events';
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  if (params.toString()) url += `?${params.toString()}`;
  return await fetchAPI(url);
}

export async function apiCreateEvent(eventData) {
  return await fetchAPI('/api/calendar/events', {
    method: 'POST',
    body: JSON.stringify(eventData),
  });
}

export async function apiGetReminders() {
  return await fetchAPI('/api/reminders');
}

export async function apiCreateReminder(reminderData) {
  return await fetchAPI('/api/reminders', {
    method: 'POST',
    body: JSON.stringify(reminderData),
  });
}

export async function apiUpdateReminder(reminderId, reminderData) {
  return await fetchAPI(`/api/reminders/${reminderId}`, {
    method: 'PUT',
    body: JSON.stringify(reminderData),
  });
}

export async function apiDeleteReminder(reminderId) {
  return await fetchAPI(`/api/reminders/${reminderId}`, {
    method: 'DELETE',
  });
}

export async function apiUpdateEvent(eventId, eventData) {
  return await fetchAPI(`/api/calendar/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(eventData),
  });
}

export async function apiDeleteEvent(eventId) {
  return await fetchAPI(`/api/calendar/events/${eventId}`, {
    method: 'DELETE',
  });
}

// --- Notes Endpoints ---
export async function apiGetNotes() {
  return await fetchAPI('/api/notes');
}

export async function apiCreateNote(noteData) {
  return await fetchAPI('/api/notes', {
    method: 'POST',
    body: JSON.stringify(noteData),
  });
}

export async function apiUpdateNote(noteId, noteData) {
  return await fetchAPI(`/api/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(noteData),
  });
}

export async function apiDeleteNote(noteId) {
  return await fetchAPI(`/api/notes/${noteId}`, {
    method: 'DELETE',
  });
}

// --- Deep Dive knowledge-map endpoints ---
export async function apiGetDeepDives() { return await fetchAPI('/api/deep-dives'); }
export async function apiGetDeepDive(sessionId) { return await fetchAPI(`/api/deep-dives/${sessionId}`); }
export async function apiCreateDeepDive(topic) { return await fetchAPI('/api/deep-dives', { method: 'POST', body: JSON.stringify({ topic }) }); }
export async function apiUpdateDeepDive(sessionId, data) { return await fetchAPI(`/api/deep-dives/${sessionId}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export async function apiDeepDiveAI(sessionId, data) { return await fetchAPI(`/api/deep-dives/${sessionId}/ai`, { method: 'POST', body: JSON.stringify(data) }); }

// --- Weather Endpoints ---
export async function apiGetWeather(location = 'Latur') {
  return await fetchAPI(`/api/weather?location=${encodeURIComponent(location)}`);
}

// --- News Endpoints ---
export async function apiGetNews(category = 'All') {
  return await fetchAPI(`/api/news?category=${encodeURIComponent(category)}`);
}

// --- Document Summarizer ---
export async function apiSummarizeDocument(fileContent, fileName = 'document', fileType = 'text') {
  return await fetchAPI('/api/summarize', {
    method: 'POST',
    body: JSON.stringify({ fileContent, fileName, fileType }),
  });
}

// --- Knowledge Base & Qdrant Vector Pipeline ---
export async function apiGetKnowledgeStatus() {
  return await fetchAPI('/api/knowledge/status');
}

export async function apiIngestDocument(fileContent, fileName = 'document', fileType = 'text', metadata = {}, reindex = false) {
  return await fetchAPI('/api/knowledge/ingest-document', {
    method: 'POST',
    body: JSON.stringify({ fileContent, fileName, fileType, metadata, reindex }),
  });
}

export async function apiSearchKnowledge(query, category = null, limit = 5) {
  let url = `/api/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;
  return await fetchAPI(url);
}

export async function apiGetKnowledgeList() {
  return await fetchAPI('/api/knowledge');
}

export async function apiDeleteKnowledgeDoc(docId) {
  return await fetchAPI(`/api/knowledge/documents/${docId}`, {
    method: 'DELETE',
  });
}
