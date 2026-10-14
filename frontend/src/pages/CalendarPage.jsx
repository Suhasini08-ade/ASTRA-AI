import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import {
  apiGetEvents,
  apiCreateEvent,
  apiDeleteEvent,
} from '../services/api';

export default function CalendarPage() {
  const { showError, showSuccess } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('Month');
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const [events, setEvents] = useState([]);

  const [newEvent, setNewEvent] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    category: 'Work',
    location: '',
    description: '',
  });

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      const res = await apiGetEvents();
      const rawEvents = res?.data || [];
      const formatted = rawEvents.map((e) => {
        const startDate = e.start_time ? e.start_time.split('T')[0] : selectedDate;
        const startTimeStr = e.start_time ? new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM';
        const endTimeStr = e.end_time ? new Date(e.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '11:00 AM';
        return {
          id: e.id,
          title: e.title,
          date: startDate,
          time: `${startTimeStr} - ${endTimeStr}`,
          category: 'Work',
          location: e.location || '',
          description: e.description || '',
        };
      });
      setEvents(formatted);
    } catch (err) {
      if (showError) showError('Failed to load events: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
  }, []);

  const handleAddEventSubmit = async (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    try {
      const startIso = new Date(`${newEvent.date}T${newEvent.time || '10:00'}:00`).toISOString();
      const endIso = new Date(new Date(startIso).getTime() + 3600000).toISOString();

      await apiCreateEvent({
        title: newEvent.title.trim(),
        description: newEvent.description ? `${newEvent.description} (Loc: ${newEvent.location})` : newEvent.location || '',
        start_time: startIso,
        end_time: endIso,
        color: '#4f46e5',
      });

      if (showSuccess) showSuccess('Calendar event created!');
      setNewEvent({
        title: '',
        date: selectedDate,
        time: '10:00',
        category: 'Work',
        location: '',
        description: '',
      });
      setShowAddEvent(false);
      fetchCalendarEvents();
    } catch (err) {
      if (showError) showError('Failed to create event: ' + err.message);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await apiDeleteEvent(eventId);
      setEvents(events.filter((e) => e.id !== eventId));
      if (showSuccess) showSuccess('Event deleted');
    } catch (err) {
      if (showError) showError('Failed to delete event: ' + err.message);
    }
  };

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const filteredEvents = events.filter((ev) => {
    if (categoryFilter !== 'All' && ev.category !== categoryFilter) return false;
    return true;
  });

  const dayEvents = filteredEvents.filter((ev) => ev.date === selectedDate);

  return (
    <div className="max-w-6xl mx-auto pt-2 pb-12 space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">calendar_today</span>
            Calendar & Schedule
          </h2>
          <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
            Connected to FastAPI MongoDB Calendar Service
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Pills */}
          <div className="flex bg-surface-container-low dark:bg-slate-800 p-1 rounded-xl border border-outline-variant/30 dark:border-slate-700">
            {['Month', 'Week', 'Schedule'].map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === v
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddEvent(true)}
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center gap-1.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Main Grid View Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Calendar Grid */}
        <div className="lg:col-span-2 bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="font-headline text-xl font-bold text-on-surface dark:text-slate-100">
                Current Month
              </h3>
              <span className="font-label text-xs font-semibold text-primary bg-primary-fixed dark:bg-blue-950/60 px-2.5 py-1 rounded-full">
                Active Agenda
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-primary bg-surface-container-low dark:bg-slate-700 hover:bg-surface-container-high"
              >
                Today
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 text-center font-label text-xs font-bold text-on-surface-variant dark:text-slate-400 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-14 rounded-xl bg-transparent" />
            ))}

            {daysInMonth.map((d) => {
              const currentYearMonth = new Date().toISOString().slice(0, 7);
              const dayStr = `${currentYearMonth}-${d < 10 ? '0' + d : d}`;
              const isSelected = dayStr === selectedDate;
              const hasEvents = events.some((e) => e.date === dayStr);

              return (
                <div
                  key={d}
                  onClick={() => setSelectedDate(dayStr)}
                  className={`h-14 rounded-xl p-2 border flex flex-col justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 font-bold text-primary shadow-sm'
                      : 'border-outline-variant/30 dark:border-slate-700/60 hover:bg-surface-container-low dark:hover:bg-slate-700/40 text-on-surface dark:text-slate-200'
                  }`}
                >
                  <span className="text-xs">{d}</span>
                  {hasEvents && (
                    <div className="flex gap-1 justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Selected Date Events & Category Filter */}
        <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30 dark:border-slate-700 mb-4">
              <div>
                <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100">
                  Agenda
                </h3>
                <p className="text-xs text-on-surface-variant dark:text-slate-400">
                  {selectedDate}
                </p>
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-2.5 py-1 text-xs text-on-surface dark:text-slate-200"
              >
                <option value="All">All Categories</option>
                <option value="Work">Work</option>
                <option value="Personal">Personal</option>
              </select>
            </div>

            {/* Event Cards List */}
            {loading ? (
              <div className="text-center py-10 text-xs text-on-surface-variant flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base animate-spin">sync</span>
                <span>Loading events...</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {dayEvents.length === 0 ? (
                  <div className="text-center py-10 text-on-surface-variant dark:text-slate-400">
                    <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">
                      event_busy
                    </span>
                    <p className="text-xs">No events scheduled for this day.</p>
                  </div>
                ) : (
                  dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3.5 rounded-xl border border-outline-variant/30 dark:border-slate-700 bg-surface-container-low/50 dark:bg-slate-700/40 space-y-1.5 hover:shadow-sm transition-shadow group relative"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="font-headline text-sm font-bold text-on-surface dark:text-slate-100">
                          {ev.title}
                        </h4>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-red-500 transition-opacity"
                          title="Delete Event"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                      <p className="text-xs text-on-surface-variant dark:text-slate-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">schedule</span> {ev.time}
                      </p>
                      {ev.description && (
                        <p className="text-xs text-on-surface-variant dark:text-slate-300 pt-1 border-t border-outline-variant/20 dark:border-slate-600/50">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-outline-variant/30 dark:border-slate-700">
              <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100">
                Create Calendar Event
              </h3>
              <button
                onClick={() => setShowAddEvent(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddEventSubmit} className="space-y-4">
              <div>
                <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g. Q3 Design Review"
                  className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-3.5 py-2 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
                  Description / Notes
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Meeting notes..."
                  className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-3.5 py-2 text-xs text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
                  rows={2}
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddEvent(false)}
                  className="px-4 py-2 bg-surface-container-high dark:bg-slate-700 text-xs font-semibold rounded-xl text-on-surface-variant hover:bg-surface-container-highest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-blue-700 shadow-md"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
