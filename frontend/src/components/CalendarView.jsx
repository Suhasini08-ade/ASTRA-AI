import React, { useState } from 'react';
import { ChevronLeft as LuChevronLeft, ChevronRight as LuChevronRight, Plus as LuPlus, Calendar as LuCalendar, Clock as LuClock, Trash2 as LuTrash2 } from 'lucide-react';

export default function CalendarView({ events = [], onAddEvent, onDeleteEvent }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 9, 1)); // October 2026
  const [selectedDate, setSelectedDate] = useState('2026-10-05');
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: '2026-10-05', startTime: '09:00', endTime: '10:00' });

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayIndex = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (newEvent.title) {
      onAddEvent(newEvent);
      setNewEvent({ title: '', description: '', date: selectedDate, startTime: '09:00', endTime: '10:00' });
      setShowModal(false);
    }
  };

  const formatDateStr = (dayNum) => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(dayNum).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const dayEvents = events.filter(e => e.date === selectedDate);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid Section */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <LuCalendar className="w-5 h-5 text-purple-500" />
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LuChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LuChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setNewEvent(prev => ({ ...prev, date: selectedDate }));
                setShowModal(true);
              }}
              className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-900/20"
            >
              <LuPlus className="w-4 h-4" />
              <span>Add Event</span>
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Month Grid Cells */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-20 rounded-xl bg-slate-50/30 dark:bg-slate-900/20 opacity-30" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = formatDateStr(dayNum);
            const isSelected = selectedDate === dateStr;
            const hasEvents = events.some(e => e.date === dateStr);

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDate(dateStr)}
                className={`h-20 p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-purple-600/10 dark:bg-purple-900/30 border-purple-500 shadow-sm'
                    : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                }`}
              >
                <span className={`text-xs font-bold ${
                  isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {dayNum}
                </span>

                {hasEvents && (
                  <div className="w-full">
                    <span className="block w-full text-[10px] font-medium bg-purple-500/20 text-purple-600 dark:text-purple-300 rounded px-1 truncate">
                      {events.find(e => e.date === dateStr)?.title}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side Panel: Selected Date Events */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl flex flex-col">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span>Events on {selectedDate}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-semibold">
            {dayEvents.length} events
          </span>
        </h3>

        <div className="flex-1 overflow-y-auto space-y-3">
          {dayEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No events scheduled for this day.
            </div>
          ) : (
            dayEvents.map(evt => (
              <div key={evt.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{evt.title}</h4>
                  <button
                    onClick={() => onDeleteEvent(evt.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <LuTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {evt.description && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{evt.description}</p>
                )}
                <div className="mt-2 text-[10px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                  <LuClock className="w-3 h-3" />
                  {evt.startTime} - {evt.endTime}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Schedule New Event</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g. AI Assistant Integration Review"
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Event details..."
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 mb-1">Start - End Time</label>
                  <div className="flex gap-1">
                    <input
                      type="time"
                      value={newEvent.startTime}
                      onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })}
                      className="w-1/2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="time"
                      value={newEvent.endTime}
                      onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })}
                      className="w-1/2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold shadow-md shadow-purple-900/20"
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
