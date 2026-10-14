import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function TopHeader({ onToggleSidebar }) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/app/assistant?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    setShowProfileMenu(false);
    navigate('/login');
  };

  return (
    <header className="bg-surface/80 dark:bg-slate-900/80 backdrop-blur-md fixed top-0 right-0 left-0 md:left-64 h-16 border-b border-outline-variant/30 dark:border-slate-800 flex justify-between items-center px-4 md:px-8 z-40 transition-colors">
      {/* Navigation & Mobile Hamburger */}
      <div className="flex items-center gap-3 md:gap-8">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors"
          title="Toggle Navigation Menu"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>

        <nav className="hidden md:flex gap-6">
          {['Focus', 'Deep Dive', 'Explore'].map((tab) => (
            <button
              key={tab}
              onClick={() => tab === 'Focus' ? navigate('/app/focus') : tab === 'Deep Dive' ? navigate('/app/deep-dive') : null}
              className={`font-label text-sm transition-all duration-200 ${
                ((tab === 'Focus' && location.pathname === '/app/focus') || (tab === 'Deep Dive' && location.pathname === '/app/deep-dive'))
                  ? 'text-primary dark:text-blue-400 font-semibold border-b-2 border-primary pb-1'
                  : 'text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-blue-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Action Controls & Search */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Search Bar */}
        <div className="relative hidden lg:block w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-slate-400 text-xl pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Search Astra..."
            className="w-full pl-10 pr-4 py-1.5 bg-surface-container-low dark:bg-slate-800 border-b border-outline-variant dark:border-slate-700 focus:border-primary focus:ring-0 focus:outline-none rounded-t-sm font-label text-sm text-on-surface dark:text-slate-200 transition-colors"
          />
        </div>

        {/* Notifications Button & Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="p-2 rounded-full hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors text-on-surface-variant dark:text-slate-300 relative"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full ring-2 ring-surface dark:ring-slate-900"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-surface dark:bg-slate-800 border border-outline-variant/30 dark:border-slate-700 rounded-xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-headline text-sm font-bold text-on-surface dark:text-slate-200">Notifications</h4>
                <span className="text-xs text-primary font-semibold cursor-pointer">Mark all read</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-2 hover:bg-surface-container-low dark:hover:bg-slate-700/50 rounded-lg">
                  <span className="material-symbols-outlined text-primary text-lg">smart_toy</span>
                  <div>
                    <p className="text-xs text-on-surface dark:text-slate-200">Astra generated your Q3 Summary report.</p>
                    <span className="text-[10px] text-on-surface-variant">10m ago</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2 hover:bg-surface-container-low dark:hover:bg-slate-700/50 rounded-lg">
                  <span className="material-symbols-outlined text-emerald-500 text-lg">event_available</span>
                  <div>
                    <p className="text-xs text-on-surface dark:text-slate-200">Product Strategy Sync starts in 30 mins.</p>
                    <span className="text-[10px] text-on-surface-variant">30m ago</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <button
          onClick={() => navigate('/app/assistant')}
          className="p-2 rounded-full hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors text-on-surface-variant dark:text-slate-300"
          title="Recent Conversations"
        >
          <span className="material-symbols-outlined text-xl">history</span>
        </button>

        {/* User Profile Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="p-1 rounded-full hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors border border-outline-variant/40 dark:border-slate-700 flex items-center gap-2"
            title="User Profile Menu"
          >
            <img
              src={currentUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
              alt={currentUser?.displayName || 'User'}
              className="w-7 h-7 rounded-full object-cover"
            />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-surface dark:bg-slate-800 border border-outline-variant/30 dark:border-slate-700 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3 p-2 border-b border-outline-variant/30 dark:border-slate-700 pb-3 mb-2">
                <img
                  src={currentUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
                  alt={currentUser?.displayName || 'User'}
                  className="w-10 h-10 rounded-full object-cover border border-primary"
                />
                <div className="truncate">
                  <p className="font-label text-sm font-semibold text-on-surface dark:text-slate-100 truncate">
                    {currentUser?.displayName || 'Alex Morgan'}
                  </p>
                  <p className="font-label text-xs text-on-surface-variant dark:text-slate-400 truncate">
                    {currentUser?.email || 'alex@astra-ai.io'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/app/profile');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-on-surface dark:text-slate-200 hover:bg-surface-container-low dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-base">person</span>
                  <span>View Account Profile</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/app/settings');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-on-surface dark:text-slate-200 hover:bg-surface-container-low dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-base">settings</span>
                  <span>Preferences & Settings</span>
                </button>
              </div>

              <div className="border-t border-outline-variant/30 dark:border-slate-700 pt-2 mt-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
