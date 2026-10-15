import React from 'react';
import { Bell as LuBell, Clock as LuClock, Calendar as LuCalendar, CheckCircle2 as LuCheckCircle2, Circle as LuCircle, Trash2 as LuTrash2 } from 'lucide-react';

export default function ReminderCard({ reminder, onToggle, onDelete }) {
  return (
    <div className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
      reminder.completed
        ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70'
        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 shadow-sm hover:border-cyan-500/40'
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onToggle(reminder.id)}
          className="text-slate-400 hover:text-cyan-500 transition-colors"
        >
          {reminder.completed ? (
            <LuCheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <LuCircle className="w-5 h-5" />
          )}
        </button>

        <div className="min-w-0">
          <h4 className={`text-sm font-semibold truncate ${
            reminder.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'
          }`}>
            {reminder.title}
          </h4>
          {reminder.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {reminder.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">
            <span className="flex items-center gap-1">
              <LuCalendar className="w-3 h-3" />
              {reminder.date}
            </span>
            <span className="flex items-center gap-1">
              <LuClock className="w-3 h-3" />
              {reminder.time}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onDelete(reminder.id)}
        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
        title="Delete Reminder"
      >
        <LuTrash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
