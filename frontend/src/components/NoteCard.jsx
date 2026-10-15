import React from 'react';
import { FileText as LuFileText, Tag as LuTag, Trash2 as LuTrash2, Edit3 as LuEdit3, Clock as LuClock } from 'lucide-react';

export default function NoteCard({ note, onEdit, onDelete }) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:border-purple-500/40 transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <LuFileText className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 line-clamp-1">
              {note.title}
            </h3>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(note)}
              className="p-1 text-slate-400 hover:text-purple-500 rounded-md"
              title="Edit Note"
            >
              <LuEdit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="p-1 text-slate-400 hover:text-rose-500 rounded-md"
              title="Delete Note"
            >
              <LuTrash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4 whitespace-pre-wrap">
          {note.content}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between text-[11px] text-slate-400">
        {note.category && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 font-medium text-slate-600 dark:text-slate-300">
            <LuTag className="w-3 h-3 text-cyan-500" />
            {note.category}
          </span>
        )}

        <span className="flex items-center gap-1">
          <LuClock className="w-3 h-3" />
          {note.updatedAt || 'Recent'}
        </span>
      </div>
    </div>
  );
}
