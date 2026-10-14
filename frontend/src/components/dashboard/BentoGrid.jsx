import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiGetTasks,
  apiCreateTask,
  apiUpdateTask,
  apiGetEvents,
  apiGetWeather,
} from '../../services/api';

export default function BentoGrid() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [weather, setWeather] = useState(null);

  const [newTaskInput, setNewTaskInput] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);

  const loadDashboardData = async () => {
    try {
      const taskRes = await apiGetTasks();
      const rawTasks = taskRes?.data || [];
      setTasks(
        rawTasks.slice(0, 4).map((t) => ({
          id: t.id,
          text: t.title,
          time: t.due_date ? new Date(t.due_date).toLocaleDateString() : 'Pending',
          completed: t.status === 'done' || t.status === 'completed',
        }))
      );
    } catch (e) {
      // fallback
    }

    try {
      const calRes = await apiGetEvents();
      const rawEvents = calRes?.data || [];
      setEvents(
        rawEvents.slice(0, 3).map((e) => ({
          id: e.id,
          title: e.title,
          time: e.start_time
            ? new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Today',
          location: e.description || '',
        }))
      );
    } catch (e) {
      // fallback
    }

    try {
      const wData = await apiGetWeather('Latur');
      if (wData && wData.current) {
        setWeather(wData);
      }
    } catch (e) {
      // fallback
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const toggleTask = async (id, currentCompleted) => {
    const newStatus = currentCompleted ? 'todo' : 'done';
    try {
      await apiUpdateTask(id, { status: newStatus });
      setTasks(
        tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
      );
    } catch (e) {
      console.warn("Failed to toggle task:", e);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (newTaskInput.trim()) {
      try {
        await apiCreateTask({ title: newTaskInput.trim(), status: 'todo', priority: 'medium' });
        setNewTaskInput('');
        setShowAddTask(false);
        loadDashboardData();
      } catch (err) {
        console.warn("Failed to add task from Bento grid:", err);
      }
    }
  };

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-12">
      {/* 1. Tasks Card */}
      <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant/40 dark:border-slate-700 p-6 shadow-sm flex flex-col h-[340px] transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100">Tasks</h3>
          <button
            onClick={() => setShowAddTask(!showAddTask)}
            className="text-primary hover:bg-surface-container-high dark:hover:bg-slate-700 rounded-full p-1 transition-colors"
            title="Add Task"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>

        {showAddTask && (
          <form onSubmit={handleAddTask} className="mb-3">
            <input
              type="text"
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              placeholder="New task title..."
              className="w-full text-xs p-2 rounded-lg bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 focus:outline-none focus:border-primary text-on-surface dark:text-slate-200"
              autoFocus
            />
          </form>
        )}

        <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
          {tasks.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-8">No active tasks.</p>
          ) : (
            tasks.map((t) => (
              <div
                key={t.id}
                onClick={() => toggleTask(t.id, t.completed)}
                className="flex items-start gap-3 p-2.5 hover:bg-surface-container-low dark:hover:bg-slate-700/50 rounded-xl transition-colors cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={t.completed}
                  onChange={() => toggleTask(t.id, t.completed)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <div className="truncate">
                  <p
                    className={`font-label text-sm text-on-surface dark:text-slate-200 group-hover:text-primary transition-colors ${
                      t.completed ? 'line-through text-on-surface-variant/70 dark:text-slate-400' : ''
                    }`}
                  >
                    {t.text}
                  </p>
                  <p className="font-label text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">
                    {t.time}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Calendar Card */}
      <div 
        onClick={() => navigate('/app/calendar')}
        className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant/40 dark:border-slate-700 p-6 shadow-sm flex flex-col h-[340px] transition-colors cursor-pointer group hover:border-primary/50"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100 group-hover:text-primary transition-colors">Calendar</h3>
          <span className="font-label text-xs font-semibold text-primary dark:text-blue-400 bg-primary-fixed dark:bg-blue-950/60 px-2.5 py-1 rounded-full">
            Agenda
          </span>
        </div>
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
          {events.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-8">No scheduled events.</p>
          ) : (
            events.map((e) => (
              <div key={e.id} className="relative pl-4 border-l-2 border-primary py-1">
                <div className="absolute w-2.5 h-2.5 bg-primary rounded-full -left-[6px] top-2"></div>
                <p className="font-label text-sm text-on-surface dark:text-slate-200 font-semibold truncate">
                  {e.title}
                </p>
                <p className="font-label text-xs text-on-surface-variant dark:text-slate-400 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">schedule</span> {e.time}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Weather Card */}
      <div 
        onClick={() => navigate('/app/weather')}
        className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant/40 dark:border-slate-700 p-6 shadow-sm flex flex-col h-[340px] bg-gradient-to-br from-blue-50/40 to-indigo-50/30 dark:from-slate-800 dark:to-slate-900/80 relative overflow-hidden transition-colors cursor-pointer group"
      >
        <div className="absolute -right-4 -top-4 opacity-10 dark:opacity-20 group-hover:scale-110 transition-transform">
          <span className="material-symbols-outlined text-[130px]">partly_cloudy_day</span>
        </div>
        <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100 relative z-10 truncate">
          {weather?.location || 'Latur'}
        </h3>
        <p className="font-label text-xs text-on-surface-variant dark:text-slate-400 mb-4 relative z-10">
          {weather?.current?.condition || 'Clear'}
        </p>
        <div className="flex items-center gap-2 mb-6 relative z-10">
          <span className="material-symbols-outlined text-5xl text-primary dark:text-blue-400">
            partly_cloudy_day
          </span>
          <span className="font-display text-4xl font-extrabold text-on-surface dark:text-slate-100">
            {weather?.current?.temp ?? 25}°
          </span>
        </div>
        <div className="flex-1 flex justify-between items-end border-t border-outline-variant/30 dark:border-slate-700/60 pt-3 relative z-10">
          {(weather?.forecast || []).slice(0, 3).map((f, idx) => (
            <div key={idx} className="text-center">
              <p className="font-label text-xs text-on-surface-variant dark:text-slate-400">{f.day}</p>
              <span className="material-symbols-outlined text-amber-500 text-lg my-0.5">sunny</span>
              <p className="font-label text-xs font-semibold text-on-surface dark:text-slate-200">{f.tempHigh}°</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Recent Activity Card */}
      <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant/40 dark:border-slate-700 p-6 shadow-sm flex flex-col h-[340px] transition-colors">
        <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100 mb-4">
          System Overview
        </h3>
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center flex-shrink-0 text-primary dark:text-blue-400">
              <span className="material-symbols-outlined text-base">hub</span>
            </div>
            <div>
              <p className="font-label text-xs text-on-surface dark:text-slate-200">
                Connected to <strong className="font-semibold">FastAPI Backend</strong>
              </p>
              <p className="font-label text-[10px] text-on-surface-variant dark:text-slate-400 mt-0.5">
                Live MongoDB Atlas Integration
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center flex-shrink-0 text-purple-600 dark:text-purple-400">
              <span className="material-symbols-outlined text-base">smart_toy</span>
            </div>
            <div>
              <p className="font-label text-xs text-on-surface dark:text-slate-200">
                AI Provider: <strong className="font-semibold">Gemini / Router Active</strong>
              </p>
              <p className="font-label text-[10px] text-on-surface-variant dark:text-slate-400 mt-0.5">
                Multi-tool Agent Ready
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
