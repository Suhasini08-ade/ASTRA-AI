import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  apiGetTasks,
  apiCreateTask,
  apiUpdateTask,
  apiDeleteTask,
  apiGetNotes,
  apiCreateNote,
  apiUpdateNote,
  apiDeleteNote,
  apiGetReminders,
  apiCreateReminder,
  apiUpdateReminder,
  apiDeleteReminder,
  apiGetCalendarEvents,
  apiCreateCalendarEvent,
  apiUpdateCalendarEvent,
  apiDeleteCalendarEvent,
  apiGetKnowledge,
  apiDeleteDocument as apiDeleteDoc,
} from '../services/api';

const DataContext = createContext();

// Helper: Normalize Task
function backendToFrontendTask(doc) {
  const priorityMap = { low: 'Low', medium: 'Medium', high: 'High' };
  const statusMap = { todo: 'Pending', in_progress: 'In Progress', done: 'Completed' };
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description || '',
    dueDate: doc.due_date ? String(doc.due_date).split('T')[0] : '',
    priority: priorityMap[doc.priority] || 'Medium',
    status: statusMap[doc.status] || 'Pending',
    createdAt: doc.created_at,
  };
}

function frontendToBackendTask(t) {
  const priorityMap = { Low: 'low', Medium: 'medium', High: 'high' };
  const statusMap = { Pending: 'todo', 'In Progress': 'in_progress', Completed: 'done' };
  return {
    title: t.title,
    description: t.description || '',
    due_date: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    priority: priorityMap[t.priority] || (t.priority || 'medium').toLowerCase(),
    status: statusMap[t.status] || (t.status || 'todo').toLowerCase(),
  };
}

// Helper: Normalize Note
function backendToFrontendNote(doc) {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content || '',
    category: doc.tags && doc.tags.length > 0 ? doc.tags[0] : 'General',
    tags: doc.tags || [],
    updatedAt: doc.updated_at ? String(doc.updated_at).split('T')[0] : '',
  };
}

function frontendToBackendNote(n) {
  return {
    title: n.title,
    content: n.content,
    tags: n.category ? [n.category] : n.tags || [],
  };
}

// Helper: Normalize Reminder
function backendToFrontendReminder(doc) {
  let title = doc.message || 'Reminder';
  let description = '';
  if (doc.message && doc.message.includes(': ')) {
    const parts = doc.message.split(': ');
    title = parts[0];
    description = parts.slice(1).join(': ');
  }
  const d = doc.due_time ? new Date(doc.due_time) : new Date();
  return {
    id: doc.id,
    title,
    description,
    date: doc.due_time ? String(doc.due_time).split('T')[0] : '',
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    completed: doc.is_active === false,
    repeat: doc.repeat || null,
  };
}

function frontendToBackendReminder(r) {
  let due_time = new Date().toISOString();
  if (r.date) {
    try {
      const combined = r.time ? `${r.date} ${r.time}` : r.date;
      const parsed = new Date(combined);
      if (!isNaN(parsed.getTime())) {
        due_time = parsed.toISOString();
      } else {
        due_time = new Date(r.date).toISOString();
      }
    } catch {
      due_time = new Date().toISOString();
    }
  }

  const message = r.description ? `${r.title}: ${r.description}` : r.title;
  return {
    message,
    due_time,
    repeat: r.repeat || null,
    is_active: !r.completed,
  };
}

// Helper: Normalize Calendar Event
function backendToFrontendEvent(doc) {
  const start = doc.start_time ? new Date(doc.start_time) : new Date();
  const end = doc.end_time ? new Date(doc.end_time) : new Date(start.getTime() + 3600000);
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description || '',
    date: doc.start_time ? String(doc.start_time).split('T')[0] : '',
    startTime: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    endTime: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    color: doc.color || '#4f46e5',
  };
}

function frontendToBackendEvent(e) {
  const dateStr = e.date || new Date().toISOString().split('T')[0];
  const startStr = e.startTime ? `${dateStr}T${e.startTime}:00` : `${dateStr}T09:00:00`;
  const endStr = e.endTime ? `${dateStr}T${e.endTime}:00` : `${dateStr}T10:00:00`;

  return {
    title: e.title,
    description: e.description || '',
    start_time: new Date(startStr).toISOString(),
    end_time: new Date(endStr).toISOString(),
    color: e.color || '#4f46e5',
  };
}

export function DataProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all user data from backend
  const refreshData = useCallback(async () => {
    if (!isAuthenticated) {
      setTasks([]);
      setNotes([]);
      setReminders([]);
      setEvents([]);
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [tasksRes, notesRes, remsRes, eventsRes, knowRes] = await Promise.allSettled([
        apiGetTasks(),
        apiGetNotes(),
        apiGetReminders(),
        apiGetCalendarEvents(),
        apiGetKnowledge(),
      ]);

      if (tasksRes.status === 'fulfilled') {
        setTasks((tasksRes.value || []).map(backendToFrontendTask));
      }
      if (notesRes.status === 'fulfilled') {
        setNotes((notesRes.value || []).map(backendToFrontendNote));
      }
      if (remsRes.status === 'fulfilled') {
        setReminders((remsRes.value || []).map(backendToFrontendReminder));
      }
      if (eventsRes.status === 'fulfilled') {
        setEvents((eventsRes.value || []).map(backendToFrontendEvent));
      }
      if (knowRes.status === 'fulfilled') {
        const rawDocs = knowRes.value?.documents || [];
        setDocuments(
          rawDocs.map((d) => {
            let summaryText = `Indexed document containing ${d.chunks_count || 0} vector knowledge chunks.`;
            if (d.summary) {
              if (typeof d.summary === 'string') {
                summaryText = d.summary;
              } else if (d.summary.executiveSummary) {
                summaryText = d.summary.executiveSummary;
              }
            }
            return {
              id: d.id,
              name: d.file_name || 'document',
              size: `${Math.max(1, Math.round((d.character_count || 1000) / 1000))} KB`,
              uploadedAt: d.created_at ? String(d.created_at).split('T')[0] : '',
              summary: summaryText,
              extractedText: d.text_preview || '',
              chunksCount: d.chunks_count || 1,
              indexingStatus: d.status || 'indexed',
              contentHash: d.content_hash || '',
            };
          })
        );
      }
    } catch (err) {
      console.error('Failed to refresh workspace data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshData();
  }, [refreshData, user?.id]);

  // Tasks CRUD
  const addTask = async (taskData) => {
    try {
      const payload = frontendToBackendTask(taskData);
      const created = await apiCreateTask(payload);
      const normalized = backendToFrontendTask(created);
      setTasks((prev) => [normalized, ...prev]);
      return normalized;
    } catch (err) {
      console.error('Failed to create task:', err);
      throw err;
    }
  };

  const updateTask = async (id, updatedFields) => {
    try {
      const current = tasks.find((t) => t.id === id) || {};
      const merged = { ...current, ...updatedFields };
      const payload = frontendToBackendTask(merged);
      const updated = await apiUpdateTask(id, payload);
      const normalized = backendToFrontendTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === id ? normalized : t)));
      return normalized;
    } catch (err) {
      console.error('Failed to update task:', err);
      throw err;
    }
  };

  const deleteTask = async (id) => {
    try {
      await apiDeleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
      throw err;
    }
  };

  // Notes CRUD
  const addNote = async (noteData) => {
    try {
      const payload = frontendToBackendNote(noteData);
      const created = await apiCreateNote(payload);
      const normalized = backendToFrontendNote(created);
      setNotes((prev) => [normalized, ...prev]);
      return normalized;
    } catch (err) {
      console.error('Failed to create note:', err);
      throw err;
    }
  };

  const updateNote = async (id, updatedFields) => {
    try {
      const current = notes.find((n) => n.id === id) || {};
      const merged = { ...current, ...updatedFields };
      const payload = frontendToBackendNote(merged);
      const updated = await apiUpdateNote(id, payload);
      const normalized = backendToFrontendNote(updated);
      setNotes((prev) => prev.map((n) => (n.id === id ? normalized : n)));
      return normalized;
    } catch (err) {
      console.error('Failed to update note:', err);
      throw err;
    }
  };

  const deleteNote = async (id) => {
    try {
      await apiDeleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
      throw err;
    }
  };

  // Reminders CRUD
  const addReminder = async (remData) => {
    try {
      const payload = frontendToBackendReminder(remData);
      const created = await apiCreateReminder(payload);
      const normalized = backendToFrontendReminder(created);
      setReminders((prev) => [normalized, ...prev]);
      return normalized;
    } catch (err) {
      console.error('Failed to create reminder:', err);
      throw err;
    }
  };

  const updateReminder = async (id, updatedFields) => {
    try {
      const current = reminders.find((r) => r.id === id) || {};
      const merged = { ...current, ...updatedFields };
      const payload = frontendToBackendReminder(merged);
      const updated = await apiUpdateReminder(id, payload);
      const normalized = backendToFrontendReminder(updated);
      setReminders((prev) => prev.map((r) => (r.id === id ? normalized : r)));
      return normalized;
    } catch (err) {
      console.error('Failed to update reminder:', err);
      throw err;
    }
  };

  const deleteReminder = async (id) => {
    try {
      await apiDeleteReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete reminder:', err);
      throw err;
    }
  };

  // Calendar CRUD
  const addEvent = async (eventData) => {
    try {
      const payload = frontendToBackendEvent(eventData);
      const created = await apiCreateCalendarEvent(payload);
      const normalized = backendToFrontendEvent(created);
      setEvents((prev) => [normalized, ...prev]);
      return normalized;
    } catch (err) {
      console.error('Failed to create calendar event:', err);
      throw err;
    }
  };

  const updateEvent = async (id, updatedFields) => {
    try {
      const current = events.find((e) => e.id === id) || {};
      const merged = { ...current, ...updatedFields };
      const payload = frontendToBackendEvent(merged);
      const updated = await apiUpdateCalendarEvent(id, payload);
      const normalized = backendToFrontendEvent(updated);
      setEvents((prev) => prev.map((e) => (e.id === id ? normalized : e)));
      return normalized;
    } catch (err) {
      console.error('Failed to update calendar event:', err);
      throw err;
    }
  };

  const deleteEvent = async (id) => {
    try {
      await apiDeleteCalendarEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Failed to delete calendar event:', err);
      throw err;
    }
  };

  // Documents
  const addDocument = (doc) => {
    setDocuments((prev) => {
      const filtered = prev.filter(
        (d) => d.id !== doc.id && d.name !== doc.name && (!d.contentHash || d.contentHash !== doc.contentHash)
      );
      return [doc, ...filtered];
    });
  };

  const deleteDocument = async (id) => {
    try {
      await apiDeleteDoc(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error('Failed to delete document:', err);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  };

  return (
    <DataContext.Provider
      value={{
        tasks,
        addTask,
        updateTask,
        deleteTask,
        notes,
        addNote,
        updateNote,
        deleteNote,
        reminders,
        addReminder,
        updateReminder,
        deleteReminder,
        events,
        addEvent,
        updateEvent,
        deleteEvent,
        documents,
        addDocument,
        deleteDocument,
        refreshData,
        loading,
        error,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
