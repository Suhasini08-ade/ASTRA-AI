import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard as LuLayoutDashboard, 
  Bot as LuBot, 
  Mic as LuMic, 
  SquareCheck as LuCheckSquare, 
  FileText as LuFileText, 
  BellRing as LuBellRing, 
  Calendar as LuCalendar, 
  CloudSun as LuCloudSun, 
  Newspaper as LuNewspaper, 
  FolderOpen as LuFolderOpen, 
  Timer as LuTimer, 
  Brain as LuBrain, 
  User as LuUser, 
  Settings as LuSettings, 
  LogOut as LuLogOut,
  Sparkles as LuSparkles,
  X as LuX
} from 'lucide-react';

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LuLayoutDashboard },
    { name: 'AI Assistant', path: '/ai-assistant', icon: LuBot },
    { name: 'Voice Assistant', path: '/voice-assistant', icon: LuMic },
    { name: 'Tasks', path: '/tasks', icon: LuCheckSquare },
    { name: 'Notes', path: '/notes', icon: LuFileText },
    { name: 'Reminders', path: '/reminders', icon: LuBellRing },
    { name: 'Calendar', path: '/calendar', icon: LuCalendar },
    { name: 'Weather', path: '/weather', icon: LuCloudSun },
    { name: 'News', path: '/news', icon: LuNewspaper },
    { name: 'Documents', path: '/documents', icon: LuFolderOpen },
    { name: 'Focus Mode', path: '/focus-mode', icon: LuTimer },
    { name: 'Deep Dive', path: '/deep-dive', icon: LuBrain },
  ];

  const bottomItems = [
    { name: 'Profile', path: '/profile', icon: LuUser },
    { name: 'Settings', path: '/settings', icon: LuSettings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* FIXED STATIC SIDEBAR - Does NOT scroll away */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 w-64 bg-slate-900/95 dark:bg-[#080d1e]/95 border-r border-slate-800 text-slate-100 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <LuSparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-wider text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-purple-200">
                ASTRA <span className="text-cyan-400 font-extrabold text-sm">AI</span>
              </span>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase -mt-1">Productivity OS</p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsOpen(false)} 
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <LuX className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation links inside sidebar */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Core Modules
          </div>
          
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/90 to-blue-600/90 text-white shadow-md shadow-purple-900/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Bottom Menu Section */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 shrink-0 space-y-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-slate-800 text-cyan-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
          >
            <LuLogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>

          {/* User mini profile card */}
          <div className="pt-2 mt-2 border-t border-slate-800/60 flex items-center gap-3 px-2">
            <img 
              src={user?.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80'} 
              alt={user?.name} 
              className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-500/30"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Suhasini Ade'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || 'suhasini@astra.ai'}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
