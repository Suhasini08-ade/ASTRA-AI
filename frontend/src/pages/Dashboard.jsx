import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import TaskCard from '../components/TaskCard';
import ReminderCard from '../components/ReminderCard';
import { 
  Sparkles as LuSparkles, 
  Send as LuSend, 
  Mic as LuMic, 
  SquareCheck as LuCheckSquare, 
  CheckCircle2 as LuCheckCircle2, 
  BellRing as LuBellRing, 
  Timer as LuTimer, 
  Plus as LuPlus, 
  FileText as LuFileText, 
  FolderOpen as LuFolderOpen, 
  Brain as LuBrain,
  Calendar as LuCalendar,
  Clock as LuClock
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { tasks, updateTask, deleteTask, reminders, updateReminder, deleteReminder, events } = useData();
  const navigate = useNavigate();
  const [quickQuery, setQuickQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (quickQuery.trim()) {
      navigate('/ai-assistant', { state: { initialQuery: quickQuery } });
    }
  };

  const todayTasks = tasks.filter(t => t.status !== 'Completed');
  const completedTasksCount = tasks.filter(t => t.status === 'Completed').length;
  const activeReminders = reminders.filter(r => !r.completed);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/90 via-slate-900 to-blue-950 p-8 border border-purple-500/20 shadow-2xl text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold tracking-wider uppercase mb-3">
            <LuSparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>ASTRA OS ACTIVE</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
            Good morning, {user?.name || 'Suhasini'}!
          </h1>
          <p className="text-sm text-slate-300">
            What would you like to accomplish today?
          </p>

          {/* AI Quick-Action Search Area */}
          <form onSubmit={handleSearchSubmit} className="mt-6 flex items-center gap-2 max-w-2xl bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2 shadow-inner focus-within:ring-2 focus-within:ring-cyan-500/50">
            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Ask ASTRA anything... (e.g. Plan my day or create focus timer)"
              className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => navigate('/voice-assistant')}
              className="p-2.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition-colors"
              title="Voice Commands"
            >
              <LuMic className="w-5 h-5" />
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-900/40 hover:opacity-95"
            >
              <LuSend className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* 4 Productivity Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Tasks</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{todayTasks.length}</h3>
            <span className="text-[11px] text-purple-500 font-semibold">{todayTasks.filter(t => t.priority === 'High').length} High Priority</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <LuCheckSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed Tasks</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{completedTasksCount}</h3>
            <span className="text-[11px] text-emerald-500 font-semibold">100% Efficiency</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <LuCheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Reminders</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{activeReminders.length}</h3>
            <span className="text-[11px] text-cyan-500 font-semibold">Next: {activeReminders[0]?.time || 'None'}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
            <LuBellRing className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Focus Time Today</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">1h 40m</h3>
            <span className="text-[11px] text-amber-500 font-semibold">2 Sessions Done</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <LuTimer className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Actions Shortcuts */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => navigate('/tasks')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-purple-500/40 hover:scale-105 transition-all flex flex-col items-center gap-2 text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <LuPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Create Task</span>
          </button>

          <button
            onClick={() => navigate('/notes')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/40 hover:scale-105 transition-all flex flex-col items-center gap-2 text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <LuFileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Add Note</span>
          </button>

          <button
            onClick={() => navigate('/reminders')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-cyan-500/40 hover:scale-105 transition-all flex flex-col items-center gap-2 text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition-colors">
              <LuBellRing className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Set Reminder</span>
          </button>

          <button
            onClick={() => navigate('/focus-mode')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/40 hover:scale-105 transition-all flex flex-col items-center gap-2 text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <LuTimer className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Start Focus</span>
          </button>

          <button
            onClick={() => navigate('/documents')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 hover:scale-105 transition-all flex flex-col items-center gap-2 text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <LuFolderOpen className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Upload Doc</span>
          </button>
        </div>
      </div>

      {/* Main Content Columns: Schedule & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tasks Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <LuCheckSquare className="w-5 h-5 text-purple-500" />
              <span>Priority Tasks</span>
            </h3>
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs text-purple-600 dark:text-purple-400 font-semibold hover:underline"
            >
              View All Tasks →
            </button>
          </div>

          <div className="space-y-3">
            {todayTasks.slice(0, 3).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleStatus={(id) => updateTask(id, { status: task.status === 'Completed' ? 'Pending' : 'Completed' })}
                onDelete={deleteTask}
              />
            ))}
          </div>
        </div>

        {/* Schedule & Reminders Column */}
        <div className="space-y-6">
          {/* Today's Schedule Card */}
          <div className="bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <LuCalendar className="w-4 h-4 text-purple-500" />
              Today's Schedule
            </h3>
            <div className="space-y-2">
              {events.map((evt) => (
                <div key={evt.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{evt.title}</h4>
                    <p className="text-[10px] text-purple-500 font-medium">{evt.startTime} - {evt.endTime}</p>
                  </div>
                  <LuClock className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Active Reminders Card */}
          <div className="bg-white dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <LuBellRing className="w-4 h-4 text-cyan-400" />
              Active Reminders
            </h3>
            <div className="space-y-2">
              {activeReminders.slice(0, 2).map((rem) => (
                <ReminderCard
                  key={rem.id}
                  reminder={rem}
                  onToggle={(id) => updateReminder(id, { completed: !rem.completed })}
                  onDelete={deleteReminder}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
