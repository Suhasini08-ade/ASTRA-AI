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

// Legacy token storage — kept for backward-compatible email/password flow
const TOKEN_KEY = 'astra_access_token';
export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeAuthToken = () => localStorage.removeItem(TOKEN_KEY);

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

  const response = await fetch(endpoint, config);
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
