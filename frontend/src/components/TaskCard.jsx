import React from 'react';
import { CheckCircle2 as LuCheckCircle2, Circle as LuCircle, Trash2 as LuTrash2, Calendar as LuCalendar, Flag as LuFlag, Edit3 as LuEdit3 } from 'lucide-react';

export default function TaskCard({ task, onToggleStatus, onDelete, onEdit }) {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Low':
      default:
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
  };

  const isCompleted = task.status === 'Completed';

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isCompleted 
        ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75' 
        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 shadow-sm hover:border-purple-500/40'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => onToggleStatus(task.id)}
          className="mt-0.5 text-slate-400 hover:text-purple-500 transition-colors"
        >
          {isCompleted ? (
            <LuCheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <LuCircle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${
            isCompleted 
              ? 'line-through text-slate-400 dark:text-slate-500' 
              : 'text-slate-800 dark:text-slate-100'
          }`}>
            {task.title}
          </h3>
          {task.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3 text-[11px]">
            {task.dueDate && (
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <LuCalendar className="w-3.5 h-3.5 text-slate-400" />
                {task.dueDate}
              </span>
            )}

            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${getPriorityColor(task.priority)}`}>
              {task.priority} Priority
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(task)}
              className="p-1.5 text-slate-400 hover:text-purple-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Edit Task"
            >
              <LuEdit3 className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(task.id)}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Delete Task"
            >
              <LuTrash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
