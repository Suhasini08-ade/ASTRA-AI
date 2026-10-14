import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CommandCenter() {
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim()) {
      navigate(`/app/assistant?q=${encodeURIComponent(prompt)}`);
    }
  };

  const quickActions = [
    { label: 'Ask AI', icon: 'chat', action: () => navigate('/app/assistant') },
    { label: 'Start Voice', icon: 'graphic_eq', action: () => navigate('/app/voice') },
    { label: 'Create Task', icon: 'add_task', action: () => navigate('/app/tasks') },
    { label: 'Summarize Document', icon: 'summarize', action: () => navigate('/app/docs') },
    { label: 'Create Note', icon: 'note_add', action: () => navigate('/app/notes') },
  ];

  return (
    <section className="mb-12 max-w-4xl mx-auto lg:mx-0 w-full relative z-30">
      <div className="bg-surface dark:bg-slate-800 border border-outline-variant/50 dark:border-slate-700 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-3 transition-all hover:shadow-[0_16px_50px_rgba(0,0,0,0.1)]">
        <form onSubmit={handleSubmit} className="flex items-center px-2">
          <span className="material-symbols-outlined text-primary text-2xl mr-3 font-bold">
            auto_awesome
          </span>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask ASTRA anything..."
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none font-body text-lg text-on-surface dark:text-slate-100 placeholder-on-surface-variant/50 dark:placeholder-slate-400 py-3"
          />
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={() => navigate('/app/voice')}
              className="p-2 rounded-xl text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-700 hover:text-primary transition-colors"
              title="Voice Input"
            >
              <span className="material-symbols-outlined">mic</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/docs')}
              className="p-2 rounded-xl text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-700 hover:text-primary transition-colors"
              title="Attach File"
            >
              <span className="material-symbols-outlined">attach_file</span>
            </button>
            <button
              type="submit"
              className="p-2 px-4 rounded-xl bg-primary text-white hover:bg-blue-700 font-medium text-sm flex items-center gap-1 transition-all shadow-md active:scale-95"
            >
              <span>Ask</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </form>

        {/* Quick Action Pills */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-outline-variant/30 dark:border-slate-700/60 px-2">
          {quickActions.map((item, idx) => (
            <button
              key={idx}
              onClick={item.action}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-low dark:bg-slate-700/50 hover:bg-surface-container-high dark:hover:bg-slate-700 rounded-full font-label text-xs font-medium text-on-surface-variant dark:text-slate-300 transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-base text-primary dark:text-blue-400">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
