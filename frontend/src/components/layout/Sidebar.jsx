import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Home', path: '/app', icon: 'home' },
    { name: 'AI Assistant', path: '/app/assistant', icon: 'smart_toy' },
    { name: 'Voice AI', path: '/app/voice', icon: 'mic' },
    { name: 'Tasks', path: '/app/tasks', icon: 'check_circle' },
    { name: 'Calendar', path: '/app/calendar', icon: 'calendar_today' },
    { name: 'Reminders', path: '/app/reminders', icon: 'alarm' },
    { name: 'Notes', path: '/app/notes', icon: 'note_alt' },
    { name: 'Doc Summarizer', path: '/app/docs', icon: 'summarize' },
    { name: 'Weather', path: '/app/weather', icon: 'cloud' },
    { name: 'News Feed', path: '/app/news', icon: 'article' },
  ];


  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      <aside
        className={`bg-surface dark:bg-slate-900 h-screen w-64 fixed left-0 top-0 border-r border-outline-variant/30 dark:border-slate-800 shadow-xl md:shadow-sm flex flex-col py-4 px-3 z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Logo */}
        <div className="px-3 pb-6 flex items-center justify-between">
          <div>
            <h1 className="font-headline text-2xl font-extrabold text-primary dark:text-blue-400 tracking-tight">
              Astra AI
            </h1>

          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors"
              title="Toggle Light/Dark/System Theme"
            >
              <span className="material-symbols-outlined text-xl">
                {theme === 'dark' ? 'light_mode' : theme === 'system' ? 'brightness_auto' : 'dark_mode'}
              </span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors"
                title="Close Navigation"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Navigation Links */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/app'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-xl transition-all duration-150 font-medium text-sm ${
                  isActive
                    ? 'bg-surface-container-low dark:bg-slate-800 text-primary dark:text-blue-400 font-semibold border-r-4 border-primary'
                    : 'text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high dark:hover:bg-slate-800/60'
                }`
              }
            >
              <span className="material-symbols-outlined mr-3 text-xl">
                {item.icon}
              </span>
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer Navigation & Profile */}
        <div className="mt-auto pt-4 border-t border-outline-variant/30 dark:border-slate-800 space-y-1">
          <NavLink
            to="/app/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center px-3 py-2 rounded-xl text-sm transition-colors ${
                isActive
                  ? 'text-primary font-semibold bg-surface-container-low dark:bg-slate-800'
                  : 'text-on-surface-variant dark:text-slate-400 hover:bg-surface-container-high dark:hover:bg-slate-800'
              }`
            }
          >
            <span className="material-symbols-outlined mr-3 text-xl">settings</span>
            <span>Settings</span>
          </NavLink>

          <a
            href="/pricing"
            onClick={onClose}
            className="flex items-center px-3 py-2 rounded-xl text-sm text-on-surface-variant dark:text-slate-400 hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined mr-3 text-xl">workspace_premium</span>
            <span>Upgrade Pro</span>
          </a>

          {/* User Card */}
          <div className="flex items-center justify-between px-3 py-3 mt-2 rounded-xl bg-surface-container-low dark:bg-slate-800/50">
            <div 
              onClick={() => {
                navigate('/app/profile');
                if (onClose) onClose();
              }}
              className="flex items-center space-x-3 cursor-pointer overflow-hidden"
            >
              <img
                src={currentUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
                alt={currentUser?.displayName || 'User'}
                className="w-9 h-9 rounded-full object-cover border border-outline-variant/50"
              />
              <div className="truncate">
                <p className="font-label text-sm font-semibold text-on-surface dark:text-slate-200 truncate">
                  {currentUser?.displayName || 'Alex Morgan'}
                </p>
                <p className="font-label text-xs text-on-surface-variant dark:text-slate-400 truncate">
                  {currentUser?.email || 'alex@astra-ai.io'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                if (onClose) onClose();
              }}
              className="p-1.5 text-on-surface-variant hover:text-error hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
              title="Log Out"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
