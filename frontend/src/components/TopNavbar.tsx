import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Bell, 
  Sparkles, 
  User, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  FileText, 
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  LogOut,
  UserPlus,
  Menu
} from 'lucide-react';
import { UserProfile, TabType } from '../types';

interface TopNavbarProps {
  userProfile: UserProfile;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onSearchQuery?: (query: string) => void;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean | ((prev: boolean) => boolean)) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  userProfile,
  activeTab,
  setActiveTab,
  onSearchQuery,
  onLogout,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const [search, setSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const notifications = [
    {
      id: '1',
      title: 'Gemini AI Model Updated',
      desc: 'Gemini 3.6 Flash reasoning engine active with zero latency.',
      time: '5 mins ago',
      type: 'system',
      icon: Sparkles,
      color: 'text-cyan-400 bg-cyan-500/10',
    },
    {
      id: '2',
      title: 'Upcoming Meeting in 45m',
      desc: 'Product Sprint Planning in Conference Room A.',
      time: '45 mins ago',
      type: 'calendar',
      icon: Calendar,
      color: 'text-purple-400 bg-purple-500/10',
    },
    {
      id: '3',
      title: 'Task Milestone Completed',
      desc: 'SaaS Cyber Dark Dashboard UI approved by lead engineer.',
      time: '2 hours ago',
      type: 'task',
      icon: CheckCircle,
      color: 'text-emerald-400 bg-emerald-500/10',
    },
  ];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearch(q);
    if (onSearchQuery) onSearchQuery(q);
  };

  return (
    <header className="sticky top-0 z-20 shrink-0 w-full bg-[#0B1020]/90 backdrop-blur-2xl border-b border-white/5 px-4 sm:px-8 py-3 transition-all">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        
        {/* Left Branding & Mobile Toggle */}
        <div className="flex items-center space-x-3 shrink-0">
          {setIsMobileOpen && (
            <button
              onClick={() => setIsMobileOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white transition-colors"
              aria-label="Toggle Navigation Sidebar"
            >
              {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          )}
          
          <div 
            onClick={() => setActiveTab('dashboard')} 
            className="flex items-center space-x-3 cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold tracking-wider text-lg text-white">
                ASTRA AI
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
                Workspace
              </span>
            </div>
          </div>
        </div>

        {/* Center Search Bar */}
        <div className="flex-1 max-w-md hidden sm:block relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 opacity-60 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search tasks, notes, or files..."
              className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50 transition-all"
            />
            {search && (
              <button 
                onClick={() => { setSearch(''); if (onSearchQuery) onSearchQuery(''); }}
                className="absolute right-3 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center space-x-3 shrink-0">
          
          {/* Quick AI Trigger */}
          <button
            onClick={() => setActiveTab('chat')}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>AI Chat</span>
          </button>

          {/* Notification Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileModal(false);
              }}
              className="relative p-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            </button>

            {/* Notifications Popover */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-4 z-50 text-left"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-sm font-bold text-white">Notifications</h4>
                    </div>
                    <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-medium">
                      3 New
                    </span>
                  </div>

                  <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {notifications.map((n) => {
                      const IconComponent = n.icon;
                      return (
                        <div
                          key={n.id}
                          className="p-3 rounded-xl bg-slate-950/60 border border-white/5 hover:border-white/10 transition-colors flex items-start space-x-3"
                        >
                          <div className={`p-2 rounded-lg ${n.color} shrink-0`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                              <span className="text-[10px] text-slate-500">{n.time}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/10 text-center">
                    <button 
                      onClick={() => setShowNotifications(false)} 
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      Mark all as read
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile Avatar */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileModal(!showProfileModal);
                setShowNotifications(false);
              }}
              className="flex items-center space-x-2 p-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-cyan-500/40 transition-all group"
            >
              <img
                src={userProfile?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'}
                alt={userProfile?.name || 'User'}
                className="w-7 h-7 rounded-lg object-cover ring-2 ring-cyan-500/30 group-hover:ring-cyan-400"
              />
              <span className="text-xs font-semibold text-slate-200 hidden lg:inline-block">
                {userProfile?.name || 'User'}
              </span>
            </button>

            {/* Profile Menu Popover */}
            <AnimatePresence>
              {showProfileModal && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-4 z-50 text-left"
                >
                  <div className="flex items-center space-x-3 pb-3 border-b border-white/10">
                    <img
                      src={userProfile.avatar}
                      alt={userProfile.name}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-cyan-500/40"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white">{userProfile.name}</h4>
                      <p className="text-[11px] text-slate-400">{userProfile.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        {userProfile.plan}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <button
                      onClick={() => {
                        setActiveTab('profile');
                        setShowProfileModal(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs text-blue-400 hover:text-blue-300 hover:bg-white/5 transition-colors font-medium"
                    >
                      <User className="w-4 h-4 text-blue-400" />
                      <span>View & Edit Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('auth');
                        setShowProfileModal(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
                    >
                      <UserPlus className="w-4 h-4 text-purple-400" />
                      <span>Sign In / Switch Account</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('settings');
                        setShowProfileModal(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-cyan-400" />
                      <span>Personalization Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('tasks');
                        setShowProfileModal(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4 text-purple-400" />
                      <span>My Kanban Workflows</span>
                    </button>

                    {onLogout && (
                      <button
                        onClick={() => {
                          setShowProfileModal(false);
                          onLogout();
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors font-semibold"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" />
                        <span>Sign Out / Log Out</span>
                      </button>
                    )}

                    <div className="pt-2 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between px-1">
                      <span className="flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Security Status</span>
                      </span>
                      <span className="text-emerald-400 font-medium">Protected</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </header>
  );
};
