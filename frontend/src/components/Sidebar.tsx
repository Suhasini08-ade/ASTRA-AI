import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Mic, 
  StickyNote, 
  Kanban, 
  Clock, 
  Calendar, 
  CloudSun, 
  Newspaper, 
  FileSearch, 
  Settings,
  ChevronRight,
  Store,
  Wrench,
  Zap
} from 'lucide-react';
import { TabType, UserProfile, FeatureModule } from '../types';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  userProfile?: UserProfile;
  features?: FeatureModule[];
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  features = [],
}) => {
  // Check feature availability
  const isFeatureActive = (id: string) => {
    const f = features.find((m) => m.id === id);
    return f ? f.isEnabled : true;
  };

  const navItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard, badge: undefined, show: true },
    { id: 'chat' as TabType, label: 'AI Assistant', icon: MessageSquare, badge: 'Gemini', show: isFeatureActive('chat') },
    { id: 'voice' as TabType, label: 'Voice Assistant', icon: Mic, badge: 'Live', show: isFeatureActive('voice') },
    { id: 'notes' as TabType, label: 'Notes', icon: StickyNote, badge: undefined, show: isFeatureActive('notes') },
    { id: 'tasks' as TabType, label: 'Tasks', icon: Kanban, badge: 'Kanban', show: isFeatureActive('tasks') },
    { id: 'reminders' as TabType, label: 'Reminders', icon: Clock, badge: undefined, show: isFeatureActive('reminders') },
    { id: 'calendar' as TabType, label: 'Calendar', icon: Calendar, badge: undefined, show: isFeatureActive('calendar') },
    { id: 'weather' as TabType, label: 'Weather', icon: CloudSun, badge: undefined, show: isFeatureActive('weather') },
    { id: 'news' as TabType, label: 'News', icon: Newspaper, badge: undefined, show: isFeatureActive('news') },
    { id: 'summarizer' as TabType, label: 'File Summarizer', icon: FileSearch, badge: 'AI', show: isFeatureActive('summarizer') },
    { id: 'tools' as TabType, label: 'Utility Toolbox', icon: Wrench, badge: '10 Tools', show: true },
    { id: 'marketplace' as TabType, label: 'Marketplace', icon: Store, badge: 'Extensible', show: true },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings, badge: undefined, show: true },
  ].filter((item) => item.show);

  return (
    <aside 
      className={`fixed top-0 left-0 bottom-0 z-30 w-60 h-screen bg-[#0D1428] border-r border-white/5 flex flex-col py-4 px-3 overflow-hidden select-none no-scrollbar transition-transform duration-300 ${
        isMobileOpen ? 'translate-x-0 shadow-2xl shadow-black/80' : '-translate-x-full md:translate-x-0'
      }`}
    >
      
      {/* Top Branding & Core Navigation Header */}
      <div className="flex flex-col overflow-hidden shrink-0 space-y-2">
        {/* Brand Logo Header */}
        <div 
          onClick={() => {
            setActiveTab('dashboard');
            if (setIsMobileOpen) setIsMobileOpen(false);
          }} 
          className="flex items-center space-x-3 px-2 pt-1 pb-2 cursor-pointer group shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col truncate">
            <span className="font-extrabold tracking-wider text-base text-white leading-none">
              ASTRA AI
            </span>
            <span className="text-[10px] text-blue-400 font-medium tracking-wide">
              AI Productivity Suite
            </span>
          </div>
        </div>

        <div className="px-2 pt-1 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Workspace Nav
          </p>
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            Core Apps
          </span>
        </div>

        {/* Static Navigation Items focused only on core application features */}
        <nav className="space-y-1 overflow-hidden no-scrollbar py-1">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (setIsMobileOpen) setIsMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group relative ${
                  isActive
                    ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {/* Active Glowing Bar Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <div className="flex items-center space-x-3 truncate">
                  <IconComponent
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-blue-400 scale-105' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {item.badge && (
                    <span
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                        item.badge === 'Live'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-400" />}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

    </aside>
  );
};



