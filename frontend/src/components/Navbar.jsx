import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeSwitcher from './ThemeSwitcher';
import { 
  Menu as LuMenu, 
  Search as LuSearch, 
  Bell as LuBell, 
  Sparkles as LuSparkles, 
  Plus as LuPlus,
  Mic as LuMic,
  Brain as LuBrain,
  Timer as LuTimer
} from 'lucide-react';

export default function Navbar({ onMenuToggle }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [quickQuery, setQuickQuery] = useState('');

  const getPageTitle = () => {
    const path = location.pathname.substring(1);
    if (!path || path === 'dashboard') return 'Dashboard';
    return path.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    if (quickQuery.trim()) {
      navigate('/ai-assistant', { state: { initialQuery: quickQuery } });
      setQuickQuery('');
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#050816]/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 transition-colors">
      {/* Left side: Hamburger button + Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <LuMenu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>{getPageTitle()}</span>
          </h1>
        </div>
      </div>

      {/* Middle: Global Quick AI Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <form onSubmit={handleQuickSubmit} className="relative w-full">
          <input
            type="text"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="Ask ASTRA anything..."
            className="w-full bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/60 rounded-xl py-2 pl-9 pr-10 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
          <LuSearch className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <button 
            type="button" 
            onClick={() => navigate('/voice-assistant')}
            className="absolute right-2.5 top-2 p-0.5 text-purple-600 dark:text-purple-400 hover:scale-110 transition-transform"
            title="Voice Command"
          >
            <LuMic className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Right side: Quick Actions (Focus Mode & Deep Dive) + Theme Switcher + Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Focus Mode Button */}
        <button
          onClick={() => navigate('/focus-mode')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            location.pathname === '/focus-mode'
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-purple-900/40 ring-1 ring-purple-400/50'
              : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 hover:text-purple-600 dark:hover:text-purple-300'
          }`}
          title="Focus Mode"
        >
          <LuTimer className={`w-3.5 h-3.5 ${location.pathname === '/focus-mode' ? 'text-white' : 'text-purple-500 dark:text-purple-400'}`} />
          <span className="hidden sm:inline">Focus Mode</span>
        </button>

        {/* Deep Dive Button */}
        <button
          onClick={() => navigate('/deep-dive')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            location.pathname === '/deep-dive'
              ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-md shadow-purple-900/40 ring-1 ring-cyan-400/50'
              : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 hover:text-cyan-600 dark:hover:text-cyan-300'
          }`}
          title="Deep Dive"
        >
          <LuBrain className={`w-3.5 h-3.5 ${location.pathname === '/deep-dive' ? 'text-white' : 'text-cyan-500 dark:text-cyan-400'}`} />
          <span className="hidden sm:inline">Deep Dive</span>
        </button>

        <ThemeSwitcher />

        <div className="relative flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80'}
              alt={user?.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-500/40"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
