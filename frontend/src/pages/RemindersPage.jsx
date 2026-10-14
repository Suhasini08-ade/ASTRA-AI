import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import {
  apiGetReminders,
  apiCreateReminder,
  apiUpdateReminder,
  apiDeleteReminder,
} from '../services/api';

const EMPTY_FORM = {
  id: null,
  message: '',
  due_date: '',
  due_time_local: '09:00',
  repeat: '',
  is_active: true,
};

function formatDueTime(isoStr) {
  if (!isoStr) return 'No time set';
  try {
    return new Date(isoStr).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

function isPast(isoStr) {
  if (!isoStr) return false;
  return new Date(isoStr) < new Date();
}

export default function RemindersPage() {
  const { showError, showSuccess } = useToast();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('All');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const res = await apiGetReminders();
      setReminders(res?.data || []);
    } catch (e) {
      if (showError) showError('Failed to load reminders: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const openCreateModal = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    setForm({ ...EMPTY_FORM, due_date: dateStr, due_time_local: `${h}:${m}` });
    setShowModal(true);
  };

  const openEditModal = (r) => {
    const dt = r.due_time ? new Date(r.due_time) : new Date();
    const dateStr = dt.toISOString().split('T')[0];
    const h = String(dt.getHours()).padStart(2, '0');
    const m = String(dt.getMinutes()).padStart(2, '0');
    setForm({
      id: r.id,
      message: r.message || '',
      due_date: dateStr,
      due_time_local: `${h}:${m}`,
      repeat: r.repeat || '',
      is_active: r.is_active !== false,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.message.trim() || !form.due_date) {
      if (showError) showError('Message and due date are required.');
      return;
    }
    setSaving(true);
    try {
      const isoTime = new Date(`${form.due_date}T${form.due_time_local || '09:00'}:00`).toISOString();
      const payload = {
        message: form.message.trim(),
        due_time: isoTime,
        repeat: form.repeat || null,
        is_active: form.is_active,
      };

      if (form.id) {
        await apiUpdateReminder(form.id, payload);
        if (showSuccess) showSuccess('Reminder updated!');
      } else {
        await apiCreateReminder(payload);
        if (showSuccess) showSuccess('Reminder created!');
      }
      closeModal();
      fetchReminders();
    } catch (e) {
      if (showError) showError('Failed to save reminder: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (r) => {
    try {
      await apiUpdateReminder(r.id, { is_active: !r.is_active });
      setReminders((prev) =>
        prev.map((item) => (item.id === r.id ? { ...item, is_active: !item.is_active } : item))
      );
      if (showSuccess) showSuccess(r.is_active ? 'Reminder paused.' : 'Reminder activated.');
    } catch (e) {
      if (showError) showError('Failed to toggle reminder: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiDeleteReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirmId(null);
      if (showSuccess) showSuccess('Reminder deleted.');
    } catch (e) {
      if (showError) showError('Failed to delete reminder: ' + e.message);
    }
  };

  const filteredReminders = reminders.filter((r) => {
    if (filter === 'Active') return r.is_active !== false;
    if (filter === 'Inactive') return r.is_active === false;
    if (filter === 'Upcoming') return r.is_active !== false && !isPast(r.due_time);
    if (filter === 'Past') return isPast(r.due_time);
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto pt-2 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100">
            Reminders
          </h2>
          <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
            Schedule and manage your alerts and recurring reminders
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-sm">add_alarm</span>
          <span>Add Reminder</span>
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        {['All', 'Active', 'Inactive', 'Upcoming', 'Past'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-container-low dark:bg-slate-800 text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-700 border border-outline-variant/30 dark:border-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-xs text-on-surface-variant flex items-center justify-center gap-2">
          <span className="material-symbols-outlined animate-spin text-base">sync</span>
          <span>Loading reminders...</span>
        </div>
      ) : filteredReminders.length === 0 ? (
        <div className="text-center py-16 bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant/30 dark:border-slate-700">
          <span className="material-symbols-outlined text-5xl text-slate-400 mb-3 block">alarm_off</span>
          <p className="text-sm font-semibold text-on-surface-variant dark:text-slate-400">No reminders found</p>
          <p className="text-xs text-on-surface-variant/70 dark:text-slate-500 mt-1">Click "Add Reminder" to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReminders.map((r) => {
            const past = isPast(r.due_time);
            const inactive = r.is_active === false;
            return (
              <div
                key={r.id}
                className={`bg-surface dark:bg-slate-800 border rounded-xl p-4 flex items-start justify-between shadow-sm hover:shadow-md transition-all group ${
                  inactive
                    ? 'border-outline-variant/20 dark:border-slate-700/50 opacity-60'
                    : past
                    ? 'border-amber-300/50 dark:border-amber-700/40'
                    : 'border-outline-variant/40 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleActive(r)}
                    title={inactive ? 'Activate reminder' : 'Pause reminder'}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      inactive
                        ? 'border-slate-400 dark:border-slate-600 bg-transparent'
                        : 'border-primary bg-primary'
                    }`}
                  >
                    {!inactive && (
                      <span className="material-symbols-outlined text-white" style={{ fontSize: '12px' }}>check</span>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`font-label text-sm font-medium text-on-surface dark:text-slate-200 ${inactive ? 'line-through text-on-surface-variant/60' : ''}`}>
                      {r.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-on-surface-variant dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>
                        {formatDueTime(r.due_time)}
                      </span>
                      {r.repeat && (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>repeat</span>
                          {r.repeat}
                        </span>
                      )}
                      {past && !inactive && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">Past due</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  <button
                    onClick={() => openEditModal(r)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-on-surface-variant hover:text-primary transition-all rounded-lg hover:bg-surface-container-low dark:hover:bg-slate-700"
                    title="Edit reminder"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  {deleteConfirmId === r.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="px-2 py-1 text-[11px] bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
                      >Confirm</button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-[11px] bg-surface-container-low dark:bg-slate-700 text-on-surface-variant rounded-lg transition-colors"
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(r.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-on-surface-variant hover:text-error transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Delete reminder"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-surface dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-outline-variant/30 dark:border-slate-700">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-outline-variant/30 dark:border-slate-700">
              <h3 className="font-headline text-base font-bold text-on-surface dark:text-slate-100">
                {form.id ? 'Edit Reminder' : 'New Reminder'}
              </h3>
              <button onClick={closeModal} className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant dark:text-slate-400 mb-1.5">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="What do you want to be reminded about?"
                  rows={3}
                  className="w-full bg-surface-container-low dark:bg-slate-900 border border-outline-variant/50 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant dark:text-slate-400 mb-1.5">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full bg-surface-container-low dark:bg-slate-900 border border-outline-variant/50 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant dark:text-slate-400 mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={form.due_time_local}
                    onChange={(e) => setForm({ ...form, due_time_local: e.target.value })}
                    className="w-full bg-surface-container-low dark:bg-slate-900 border border-outline-variant/50 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant dark:text-slate-400 mb-1.5">Repeat</label>
                <select
                  value={form.repeat}
                  onChange={(e) => setForm({ ...form, repeat: e.target.value })}
                  className="w-full bg-surface-container-low dark:bg-slate-900 border border-outline-variant/50 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                >
                  <option value="">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekdays">Weekdays</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold text-on-surface-variant dark:text-slate-400">Active</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-on-surface-variant dark:text-slate-300 bg-surface-container-low dark:bg-slate-700 rounded-xl hover:bg-surface-container-high dark:hover:bg-slate-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  {saving ? 'Saving...' : form.id ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
