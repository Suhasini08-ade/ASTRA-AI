import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Mic, 
  FileSearch, 
  StickyNote, 
  Bell, 
  CloudSun, 
  Newspaper, 
  Kanban,
  Sparkles,
  Zap,
  ArrowRight,
  Plus,
  Pin,
  Trash2,
  Maximize2,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  CheckCircle2,
  Clock,
  TrendingUp,
  Calendar as CalendarIcon,
  CheckSquare,
  FileText,
  DollarSign,
  Activity,
  Layers,
  X
} from 'lucide-react';
import { AiVisualization } from '../components/AiVisualization';
import { QuickActionCard } from '../components/QuickActionCard';
import { 
  UserProfile, 
  TabType, 
  TaskItem, 
  Note, 
  ReminderItem, 
  CalendarEventItem, 
  DashboardWidget,
  WidgetSize
} from '../types';
import { INITIAL_DASHBOARD_WIDGETS } from '../data/featureRegistry';

interface MainDashboardProps {
  userProfile?: UserProfile;
  tasks?: TaskItem[];
  notes?: Note[];
  reminders?: ReminderItem[];
  calendarEvents?: CalendarEventItem[];
  setActiveTab: (tab: TabType) => void;
  widgets?: DashboardWidget[];
  setWidgets?: React.Dispatch<React.SetStateAction<DashboardWidget[]>>;
}

const ALL_WIDGET_CATALOG = [
  { id: 'w-quick-actions', type: 'quick_actions', title: 'Quick Workspaces', size: 'full' as WidgetSize },
  { id: 'w-productivity-stats', type: 'productivity_stats', title: 'Productivity Analytics', size: 'large' as WidgetSize },
  { id: 'w-weather', type: 'weather', title: 'Live Weather', size: 'small' as WidgetSize },
  { id: 'w-tasks', type: 'tasks', title: 'High Priority Tasks', size: 'medium' as WidgetSize },
  { id: 'w-reminders', type: 'reminders', title: "Today's Focus Reminders", size: 'small' as WidgetSize },
  { id: 'w-calendar', type: 'calendar', title: 'Upcoming Agenda', size: 'medium' as WidgetSize },
  { id: 'w-notes', type: 'notes', title: 'Pinned Quick Notes', size: 'medium' as WidgetSize },
  { id: 'w-news', type: 'news', title: 'Top AI News Headlines', size: 'medium' as WidgetSize },
  { id: 'w-ai-chat', type: 'ai_chat', title: 'AI Quick Prompt', size: 'medium' as WidgetSize },
  { id: 'w-file-summary', type: 'file_summary', title: 'Recent Document Summaries', size: 'small' as WidgetSize },
  { id: 'w-recent-activity', type: 'recent_activity', title: 'Recent System Activity', size: 'medium' as WidgetSize },
  { id: 'w-micro-tools', type: 'micro_tools', title: 'Utility Toolbox', size: 'full' as WidgetSize },
];

export const MainDashboard: React.FC<MainDashboardProps> = ({
  userProfile,
  tasks = [],
  notes = [],
  reminders = [],
  calendarEvents = [],
  setActiveTab,
  widgets: externalWidgets,
  setWidgets: setExternalWidgets,
}) => {
  const [localWidgets, setLocalWidgets] = useState<DashboardWidget[]>(INITIAL_DASHBOARD_WIDGETS);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState('');

  const activeWidgets = externalWidgets || localWidgets;
  const updateWidgets = setExternalWidgets || setLocalWidgets;

  const handleTogglePin = (id: string) => {
    updateWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isPinned: !w.isPinned } : w))
    );
  };

  const handleRemoveWidget = (id: string) => {
    updateWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: false } : w)));
  };

  const handleResizeWidget = (id: string) => {
    const sizeOrder: WidgetSize[] = ['small', 'medium', 'large', 'full'];
    updateWidgets((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const nextIdx = (sizeOrder.indexOf(w.size) + 1) % sizeOrder.length;
          return { ...w, size: sizeOrder[nextIdx] };
        }
        return w;
      })
    );
  };

  const handleMoveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= activeWidgets.length) return;

    const newArr = [...activeWidgets];
    const temp = newArr[index];
    newArr[index] = newArr[targetIdx];
    newArr[targetIdx] = temp;
    updateWidgets(newArr);
  };

  const handleAddWidgetFromCatalog = (catalogItem: typeof ALL_WIDGET_CATALOG[0]) => {
    updateWidgets((prev) => {
      const exists = prev.find((w) => w.type === catalogItem.type);
      if (exists) {
        return prev.map((w) => (w.type === catalogItem.type ? { ...w, enabled: true } : w));
      }
      return [
        ...prev,
        {
          id: catalogItem.id,
          type: catalogItem.type as any,
          title: catalogItem.title,
          size: catalogItem.size,
          isPinned: false,
          position: prev.length,
          enabled: true,
        },
      ];
    });
    setShowAddWidgetModal(false);
  };

  const quickActions = [
    { title: 'Chat with AI', description: 'Engage Gemini 3.6 Flash for multi-turn reasoning.', icon: MessageSquare, gradient: 'from-blue-600 to-cyan-500', borderColor: 'border-cyan-500/30 hover:border-cyan-400', tab: 'chat' as TabType, badge: 'Gemini 3.6' },
    { title: 'Voice Command', description: 'Hands-free voice assistant with live speech synthesis.', icon: Mic, gradient: 'from-emerald-600 to-teal-400', borderColor: 'border-emerald-500/30 hover:border-emerald-400', tab: 'voice' as TabType, badge: 'Live Audio' },
    { title: 'Summarize PDF', description: 'Upload PDF/DOCX for AI key takeaways & insights.', icon: FileSearch, gradient: 'from-purple-600 to-pink-500', borderColor: 'border-purple-500/30 hover:border-purple-400', tab: 'summarizer' as TabType, badge: 'PDF / DOCX' },
    { title: 'Create Notes', description: 'Organize smart notes with color labels & tags.', icon: StickyNote, gradient: 'from-amber-500 to-orange-500', borderColor: 'border-amber-500/30 hover:border-amber-400', tab: 'notes' as TabType, badge: undefined },
    { title: 'Add Reminder', description: 'Set timeline reminders & meeting alerts.', icon: Bell, gradient: 'from-indigo-600 to-blue-500', borderColor: 'border-indigo-500/30 hover:border-indigo-400', tab: 'reminders' as TabType, badge: undefined },
    { title: 'Check Weather', description: 'View live forecasts & outdoor AI advice.', icon: CloudSun, gradient: 'from-sky-500 to-cyan-400', borderColor: 'border-sky-500/30 hover:border-sky-400', tab: 'weather' as TabType, badge: undefined },
    { title: 'Read News', description: 'Curated tech feed with AI article summaries.', icon: Newspaper, gradient: 'from-rose-600 to-pink-500', borderColor: 'border-rose-500/30 hover:border-rose-400', tab: 'news' as TabType, badge: 'Curated' },
    { title: 'Manage Tasks', description: 'Kanban board with priority badges & drag & drop.', icon: Kanban, gradient: 'from-violet-600 to-purple-500', borderColor: 'border-violet-500/30 hover:border-violet-400', tab: 'tasks' as TabType, badge: 'Kanban' },
  ];

  const getWidgetClass = (size: WidgetSize) => {
    switch (size) {
      case 'small': return 'col-span-1';
      case 'medium': return 'col-span-1 md:col-span-2';
      case 'large': return 'col-span-1 md:col-span-3';
      case 'full': return 'col-span-1 md:col-span-3 lg:col-span-4';
      default: return 'col-span-1';
    }
  };

  const enabledWidgetsList = activeWidgets.filter((w) => w.enabled);

  return (
    <div className="space-y-6 text-left pb-12">
      
      {/* Hero Welcome Banner */}
      <div className="relative rounded-3xl p-8 overflow-hidden bg-gradient-to-br from-[#161B30] via-[#0D1428] to-[#0B1020] border border-white/5 shadow-2xl">
        <div className="relative z-10 max-w-xl">
          <div className="flex items-center space-x-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-widest flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
              <span>Cybernetic AI Workspace</span>
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 text-white tracking-tight">
            Welcome Back, {userProfile?.name ? userProfile.name.split(' ')[0] : 'Alex'}!
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
            Your custom personal AI workspace is active. Manage widgets, launch tools, or command your voice assistant.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('chat')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-500/25 flex items-center space-x-2"
            >
              <span>Ask Astra</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/10 transition-all flex items-center space-x-2"
            >
              <Mic className="w-3.5 h-3.5 text-blue-400" />
              <span>Voice Command</span>
            </button>
            <button
              onClick={() => setShowAddWidgetModal(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-semibold text-xs border border-purple-500/30 transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Customize Widgets</span>
            </button>
          </div>
        </div>

        {/* Animated AI Orb Simulation */}
        <div className="absolute right-[-40px] top-[-40px] w-80 h-80 pointer-events-none hidden md:block">
          <div className="absolute inset-0 rounded-full bg-blue-600/20 blur-3xl animate-pulse"></div>
          <div className="absolute inset-10 rounded-full bg-purple-600/30 blur-2xl"></div>
          <div className="absolute inset-20 rounded-full border-4 border-blue-400/20 animate-[spin_10s_linear_infinite]"></div>
          <div className="absolute inset-24 rounded-full border-2 border-dashed border-purple-400/20 animate-[spin_15s_linear_infinite_reverse]"></div>
          <div className="absolute inset-[110px] rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 opacity-60 shadow-[0_0_50px_rgba(34,211,238,0.5)]"></div>
        </div>
      </div>

      {/* Center Animated AI Orb Component */}
      <div className="w-full">
        <AiVisualization
          statusText="Astra Core AI Active • Ready for Voice or Text"
          interactive={true}
          onClick={() => setActiveTab('chat')}
        />
      </div>

      {/* Customizable Dashboard Widgets Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <LayoutGrid className="w-4 h-4 text-blue-400" />
            <span>Active Dashboard Layout</span>
          </h2>
          <button
            onClick={() => setShowAddWidgetModal(true)}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Widget</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {enabledWidgetsList.map((widget, index) => (
            <div
              key={widget.id}
              className={`p-5 rounded-3xl bg-[#0D1428] border border-white/10 shadow-xl relative flex flex-col justify-between group transition-all ${getWidgetClass(
                widget.size
              )}`}
            >
              {/* Widget Header Controls */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white tracking-wide">{widget.title}</span>
                  {widget.isPinned && <Pin className="w-3 h-3 text-amber-400 fill-amber-400" />}
                </div>

                <div className="flex items-center space-x-1 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleTogglePin(widget.id)}
                    title={widget.isPinned ? 'Unpin Widget' : 'Pin Widget'}
                    className="p-1 hover:text-amber-400 text-slate-400"
                  >
                    <Pin className={`w-3.5 h-3.5 ${widget.isPinned ? 'text-amber-400' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleResizeWidget(widget.id)}
                    title="Cycle Widget Size"
                    className="p-1 hover:text-blue-400 text-slate-400"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveWidget(index, 'up')}
                    disabled={index === 0}
                    title="Move Up"
                    className="p-1 hover:text-cyan-400 text-slate-400 disabled:opacity-20"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveWidget(index, 'down')}
                    disabled={index === enabledWidgetsList.length - 1}
                    title="Move Down"
                    className="p-1 hover:text-cyan-400 text-slate-400 disabled:opacity-20"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemoveWidget(widget.id)}
                    title="Remove Widget"
                    className="p-1 hover:text-red-400 text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Widget Dynamic Contents */}
              <div className="flex-1">
                {/* 1. Quick Actions */}
                {widget.type === 'quick_actions' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {quickActions.map((action, i) => (
                      <QuickActionCard
                        key={i}
                        title={action.title}
                        description={action.description}
                        icon={action.icon}
                        gradient={action.gradient}
                        borderColor={action.borderColor}
                        badge={action.badge}
                        onClick={() => setActiveTab(action.tab)}
                      />
                    ))}
                  </div>
                )}

                {/* 2. Productivity Stats */}
                {widget.type === 'productivity_stats' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 bg-white/5 border border-white/5 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-white">Weekly Focus Velocity</span>
                        <span className="text-[10px] text-blue-400 font-mono">+18% vs last week</span>
                      </div>
                      <div className="flex items-end gap-2.5 h-20">
                        <div className="flex-1 bg-white/10 rounded-t h-[40%]"></div>
                        <div className="flex-1 bg-white/10 rounded-t h-[65%]"></div>
                        <div className="flex-1 bg-white/10 rounded-t h-[90%]"></div>
                        <div className="flex-1 bg-blue-500 rounded-t h-[80%] shadow-[0_0_10px_#3b82f6]"></div>
                        <div className="flex-1 bg-white/10 rounded-t h-[45%]"></div>
                        <div className="flex-1 bg-white/10 rounded-t h-[60%]"></div>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500 mt-2 font-mono">
                        <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/10 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="text-2xl font-black text-white font-mono">88.4%</div>
                        <div className="text-[11px] text-slate-400">AI Task Automation Rate</div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">
                        Saved 5.4 hours automating notes, reminders, and summaries this week.
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Weather Widget */}
                {widget.type === 'weather' && (
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center space-x-3">
                      <CloudSun className="w-8 h-8 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-lg font-bold text-white">72°F</div>
                        <div className="text-[10px] text-slate-400">San Francisco • Sunny</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('weather')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      View →
                    </button>
                  </div>
                )}

                {/* 4. High Priority Tasks */}
                {widget.type === 'tasks' && (
                  <div className="space-y-2">
                    {tasks.slice(0, 3).map((t) => (
                      <div key={t.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckSquare className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="text-xs text-slate-200 truncate max-w-[180px] font-medium">{t.title}</span>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {t.priority}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className="w-full text-center text-xs text-blue-400 hover:text-blue-300 pt-1 font-semibold"
                    >
                      Open Kanban Board →
                    </button>
                  </div>
                )}

                {/* 5. Reminders */}
                {widget.type === 'reminders' && (
                  <div className="space-y-2">
                    {reminders.slice(0, 2).map((r) => (
                      <div key={r.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <span className="text-xs text-slate-200 truncate font-medium">{r.title}</span>
                        <span className="text-[10px] text-amber-400 font-mono shrink-0">{r.time}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveTab('reminders')}
                      className="w-full text-center text-xs text-blue-400 hover:text-blue-300 pt-1 font-semibold"
                    >
                      Manage Reminders →
                    </button>
                  </div>
                )}

                {/* 6. Calendar Agenda */}
                {widget.type === 'calendar' && (
                  <div className="space-y-2">
                    {calendarEvents.slice(0, 2).map((evt) => (
                      <div key={evt.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-white">{evt.title}</div>
                          <div className="text-[10px] text-slate-400">{evt.time}</div>
                        </div>
                        <CalendarIcon className="w-4 h-4 text-purple-400 shrink-0" />
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveTab('calendar')}
                      className="w-full text-center text-xs text-purple-400 hover:text-purple-300 pt-1 font-semibold"
                    >
                      Open Calendar →
                    </button>
                  </div>
                )}

                {/* 7. Quick Notes */}
                {widget.type === 'notes' && (
                  <div className="space-y-2">
                    {notes.slice(0, 2).map((n) => (
                      <div key={n.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-xs font-bold text-white truncate">{n.title}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{n.content}</div>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveTab('notes')}
                      className="w-full text-center text-xs text-amber-400 hover:text-amber-300 pt-1 font-semibold"
                    >
                      Open Smart Notes →
                    </button>
                  </div>
                )}

                {/* 8. News Headlines */}
                {widget.type === 'news' && (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <div className="text-xs font-bold text-white line-clamp-1">Gemini 3.6 Flash Multi-Agent Architecture Released</div>
                      <div className="text-[10px] text-slate-400">TechCrunch • 10m ago</div>
                    </div>
                    <button
                      onClick={() => setActiveTab('news')}
                      className="w-full text-center text-xs text-rose-400 hover:text-rose-300 pt-1 font-semibold"
                    >
                      Read News Digest →
                    </button>
                  </div>
                )}

                {/* 9. AI Quick Prompt */}
                {widget.type === 'ai_chat' && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={aiPromptInput}
                        onChange={(e) => setAiPromptInput(e.target.value)}
                        placeholder="Ask Gemini anything..."
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                      <button
                        onClick={() => setActiveTab('chat')}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}

                {/* 10. File Summary */}
                {widget.type === 'file_summary' && (
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Q3_AI_Architecture.pdf</div>
                      <div className="text-[10px] text-slate-400">3 key takeaways ready</div>
                    </div>
                    <button
                      onClick={() => setActiveTab('summarizer')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      Open
                    </button>
                  </div>
                )}

                {/* 11. Recent Activity */}
                {widget.type === 'recent_activity' && (
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Profile photo updated securely</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      <span>Task "Gemini Server Proxy" moved to in-progress</span>
                    </div>
                  </div>
                )}

                {/* 12. Utility Toolbox */}
                {widget.type === 'micro_tools' && (
                  <div className="flex flex-wrap gap-2">
                    {['Translator', 'Calculator', 'Dictionary', 'Email AI', 'Expenses', 'Habits', 'Pomodoro', 'QR Generator', 'Converter', 'Password Vault'].map((tool) => (
                      <button
                        key={tool}
                        onClick={() => setActiveTab('tools')}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors"
                      >
                        {tool}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Widget Catalog Modal */}
      <AnimatePresence>
        {showAddWidgetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0D1428] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl space-y-6 text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <LayoutGrid className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white text-base">Dashboard Widget Catalog</h3>
                </div>
                <button
                  onClick={() => setShowAddWidgetModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {ALL_WIDGET_CATALOG.map((catItem) => {
                  const isActive = activeWidgets.some((w) => w.type === catItem.type && w.enabled);
                  return (
                    <div
                      key={catItem.id}
                      className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-blue-600/10 border-blue-500/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{catItem.title}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">{catItem.size} card</div>
                      </div>

                      <button
                        onClick={() => handleAddWidgetFromCatalog(catItem)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {isActive ? 'Active' : '+ Add'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setShowAddWidgetModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
