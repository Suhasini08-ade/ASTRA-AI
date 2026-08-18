import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  CloudSun, 
  CheckCircle2, 
  Bell, 
  Activity, 
  Server, 
  Database, 
  Cpu, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { TaskItem, ReminderItem, WeatherData, SystemStatus, TabType } from '../types';

interface RightWidgetsSidebarProps {
  weatherData?: WeatherData;
  tasks: TaskItem[];
  reminders: ReminderItem[];
  systemStatus: SystemStatus;
  setActiveTab: (tab: TabType) => void;
}

export const RightWidgetsSidebar: React.FC<RightWidgetsSidebarProps> = ({
  weatherData,
  tasks,
  reminders,
  systemStatus,
  setActiveTab,
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const upcomingTasks = tasks.filter(t => t.status !== 'completed').slice(0, 3);
  const todayReminders = reminders.slice(0, 3);

  const activities = [
    { id: '1', title: 'File Summarizer processed Q3 Plan', time: '12 mins ago', icon: Sparkles },
    { id: '2', title: 'Kanban Task "Gemini Proxy" updated', time: '42 mins ago', icon: CheckCircle2 },
    { id: '3', title: 'Voice command logged: "Check Weather"', time: '1 hour ago', icon: Activity },
  ];

  return (
    <aside className="w-72 bg-[#0D1428] border-l border-white/5 p-6 flex flex-col gap-6 shrink-0">
      
      {/* Time Widget */}
      <div className="text-center py-4 bg-white/5 rounded-3xl border border-white/10 shadow-sm">
        <div className="text-3xl font-bold tracking-widest text-white font-mono">{formattedTime.slice(0, 5)}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-1 font-medium">{formattedDate}</div>
      </div>

      {/* Weather Widget */}
      <div 
        onClick={() => setActiveTab('weather')}
        className="p-4 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-3xl border border-blue-500/20 flex items-center justify-between cursor-pointer hover:border-blue-400/40 transition-all shadow-md group"
      >
        <div>
          <div className="text-2xl font-bold text-white">{weatherData?.current.temp || 24}°C</div>
          <div className="text-xs text-slate-300 mt-0.5">{weatherData?.location || 'San Francisco'}</div>
        </div>
        <div className="text-3xl">🌤</div>
      </div>

      {/* Upcoming Tasks */}
      <div className="flex-1 flex flex-col">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center justify-between">
          <span>Upcoming Tasks</span>
          <button onClick={() => setActiveTab('tasks')} className="text-blue-400 hover:underline normal-case text-[11px] font-medium">View all</button>
        </div>
        <div className="space-y-3">
          {upcomingTasks.length === 0 ? (
            <div className="p-3 bg-white/5 rounded-2xl text-xs text-slate-500">All tasks completed!</div>
          ) : (
            upcomingTasks.map((t, index) => (
              <div 
                key={t.id} 
                className={`p-3 bg-white/5 rounded-2xl border-l-4 ${
                  index % 3 === 0 ? 'border-blue-500' : index % 3 === 1 ? 'border-purple-500' : 'border-slate-500 opacity-80'
                }`}
              >
                <div className="text-sm font-medium truncate text-white">{t.title}</div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Due {t.dueDate}</span>
                  <span className="capitalize text-blue-400 font-mono">{t.priority}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Status & Pulse */}
      <div className="mt-auto space-y-3 pt-2 border-t border-white/5">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-tight">
            <span className="text-slate-500">Network Status</span>
            <span className="text-green-400 font-mono">Healthy</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full w-full bg-green-500/50"></div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-tight">
            <span className="text-slate-500">AI Core Pulse</span>
            <span className="text-blue-400 font-mono">Active</span>
          </div>
          <div className="flex gap-1 items-end h-6">
            <div className="h-3 w-1 bg-blue-500/40 rounded-full animate-pulse"></div>
            <div className="h-5 w-1 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="h-2.5 w-1 bg-blue-500/20 rounded-full"></div>
            <div className="h-4 w-1 bg-blue-500/60 rounded-full"></div>
            <div className="h-3 w-1 bg-blue-500/40 rounded-full"></div>
            <div className="h-6 w-1 bg-blue-500/80 rounded-full animate-pulse"></div>
            <div className="h-2.5 w-1 bg-blue-500/20 rounded-full"></div>
          </div>
        </div>
      </div>

    </aside>
  );
};
