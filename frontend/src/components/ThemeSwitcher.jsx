import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun as LuSun, Moon as LuMoon, Monitor as LuMonitor } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const options = [
    { id: 'light', label: 'Light', icon: LuSun },
    { id: 'dark', label: 'Dark', icon: LuMoon },
    { id: 'system', label: 'System', icon: LuMonitor },
  ];

  return (
    <div className="flex items-center p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl border border-slate-300/50 dark:border-slate-700/50 shadow-inner">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => setTheme(opt.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-white dark:bg-purple-600 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title={`Switch to ${opt.label} theme`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
