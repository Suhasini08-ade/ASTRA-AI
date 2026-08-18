import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Trash2, 
  X,
  Sparkles
} from 'lucide-react';
import { ReminderItem, Priority } from '../types';
import { createReminderApi } from '../services/api';

interface RemindersPageProps {
  reminders: ReminderItem[];
  setReminders: React.Dispatch<React.SetStateAction<ReminderItem[]>>;
}

export const RemindersPage: React.FC<RemindersPageProps> = ({
  reminders,
  setReminders,
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [showModal, setShowModal] = useState(false);

  // New Reminder State
  const [remTitle, setRemTitle] = useState('');
  const [remTime, setRemTime] = useState('09:00 AM');
  const [remDate, setRemDate] = useState('Today');
  const [remCategory, setRemCategory] = useState<ReminderItem['category']>('Meeting');
  const [remPriority, setRemPriority] = useState<Priority>('High');

  const handleToggleComplete = (id: string) => {
    setReminders(prev =>
      prev.map(r => (r.id === id ? { ...r, isCompleted: !r.isCompleted } : r))
    );
  };

  const handleDeleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  const handleAddReminder = async () => {
    if (!remTitle.trim()) return;

    const isoDueTime = new Date().toISOString();
    const createdReminder = await createReminderApi(remTitle, isoDueTime);
    if (createdReminder) {
      setReminders(prev => [createdReminder, ...prev]);
    } else {
      const newReminder: ReminderItem = {
        id: `rem-${Date.now()}`,
        title: remTitle,
        time: remTime,
        date: remDate,
        category: remCategory,
        isCompleted: false,
        priority: remPriority,
      };
      setReminders(prev => [newReminder, ...prev]);
    }

    setShowModal(false);
    setRemTitle('');
  };

  const filteredReminders = reminders.filter(r =>
    activeTab === 'upcoming' ? !r.isCompleted : r.isCompleted
  );

  return (
    <div className="space-y-6 text-left">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <Bell className="w-6 h-6 text-purple-400" />
            <span>Timeline Reminders</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Chronological task schedule and meeting alerts
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Reminder</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'upcoming'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          Upcoming ({reminders.filter(r => !r.isCompleted).length})
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'completed'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          Completed ({reminders.filter(r => r.isCompleted).length})
        </button>
      </div>

      {/* Timeline Layout Container */}
      <div className="relative pl-6 sm:pl-8 border-l-2 border-purple-500/30 space-y-6">
        {filteredReminders.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-white/5 text-xs text-slate-500">
            No {activeTab} reminders scheduled.
          </div>
        ) : (
          filteredReminders.map(rem => (
            <motion.div
              key={rem.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative p-5 rounded-3xl bg-slate-900/80 border border-white/10 hover:border-purple-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              {/* Timeline Dot Indicator */}
              <div
                onClick={() => handleToggleComplete(rem.id)}
                className={`absolute -left-[31px] sm:-left-[39px] top-6 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                  rem.isCompleted
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_#10b981]'
                    : 'bg-purple-600 text-white shadow-[0_0_10px_#a855f7]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 border border-purple-500/30">
                    {rem.category}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    rem.priority === 'High' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {rem.priority}
                  </span>
                </div>

                <h3 className={`text-sm font-bold ${rem.isCompleted ? 'line-through text-slate-500' : 'text-white'}`}>
                  {rem.title}
                </h3>

                <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{rem.time}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>{rem.date}</span>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => handleToggleComplete(rem.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    rem.isCompleted
                      ? 'bg-slate-800 text-slate-400 hover:text-white'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                  }`}
                >
                  {rem.isCompleted ? 'Mark Pending' : 'Mark Done'}
                </button>

                <button
                  onClick={() => handleDeleteReminder(rem.id)}
                  className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Reminder Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/15 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">Create Timeline Reminder</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Reminder Title</label>
                  <input
                    type="text"
                    value={remTitle}
                    onChange={e => setRemTitle(e.target.value)}
                    placeholder="E.g. Strategy Sync with Executive Board"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Time</label>
                    <input
                      type="text"
                      value={remTime}
                      onChange={e => setRemTime(e.target.value)}
                      placeholder="11:30 AM"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Date Tag</label>
                    <select
                      value={remDate}
                      onChange={e => setRemDate(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="Today">Today</option>
                      <option value="Tomorrow">Tomorrow</option>
                      <option value="Jul 28">Jul 28</option>
                      <option value="Jul 30">Jul 30</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Category</label>
                    <select
                      value={remCategory}
                      onChange={e => setRemCategory(e.target.value as ReminderItem['category'])}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="Meeting">Meeting</option>
                      <option value="Work">Work</option>
                      <option value="Health">Health</option>
                      <option value="Personal">Personal</option>
                      <option value="Focus">Focus Session</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Priority</label>
                    <select
                      value={remPriority}
                      onChange={e => setRemPriority(e.target.value as Priority)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Low">Low Priority</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddReminder}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-500/20"
                >
                  Save Reminder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
