import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { apiCreateFocusSession, apiGetFocusSessions } from '../services/api';
import { Play as LuPlay, Pause as LuPause, RotateCcw as LuRotateCcw, CheckCircle as LuCheckCircle, Volume2 as LuVolume2, VolumeX as LuVolumeX, Sparkles as LuSparkles, History as LuHistory } from 'lucide-react';

export default function FocusTimer() {
  const { tasks } = useData();
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [recentSessions, setRecentSessions] = useState([]);

  // Auto-select first task if not set
  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  const loadRecentSessions = async () => {
    try {
      const data = await apiGetFocusSessions(5);
      setRecentSessions(data || []);
    } catch (err) {
      console.warn('Could not load focus sessions:', err);
    }
  };

  useEffect(() => {
    loadRecentSessions();
  }, []);

  useEffect(() => {
    let timer = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleComplete();
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const handleComplete = async () => {
    setIsRunning(false);
    setSessionCompleted(true);
    if (selectedTaskId) {
      try {
        await apiCreateFocusSession({
          task_id: selectedTaskId,
          duration_seconds: durationMinutes * 60,
          status: 'completed',
        });
        loadRecentSessions();
      } catch (err) {
        console.warn('Failed to record focus session:', err);
      }
    }
  };

  const handlePresetChange = (mins) => {
    setIsRunning(false);
    setDurationMinutes(mins);
    setTimeLeft(mins * 60);
    setSessionCompleted(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(durationMinutes * 60);
    setSessionCompleted(false);
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // Progress percentage for circular ring
  const progress = ((durationMinutes * 60 - timeLeft) / (durationMinutes * 60)) * 100;

  return (
    <div className="max-w-3xl mx-auto flex flex-col items-center justify-center p-8 bg-slate-900/90 text-white rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      {/* Calm ambient background radial glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-slate-900/40 to-slate-950 pointer-events-none" />

      {/* Mute ambient sound toggle */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:text-white"
        title={isMuted ? 'Unmute Ambient Sound' : 'Mute Ambient Sound'}
      >
        {isMuted ? <LuVolumeX className="w-5 h-5 text-rose-400" /> : <LuVolume2 className="w-5 h-5 text-cyan-400 animate-pulse" />}
      </button>

      {/* Task Selector Dropdown */}
      <div className="w-full max-w-md mb-8 relative z-10 text-center">
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
          Select Task to Focus On
        </label>
        <select
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          {tasks.map(t => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.priority} Priority)
            </option>
          ))}
        </select>
      </div>

      {/* Timer Presets */}
      <div className="flex gap-3 mb-8 relative z-10">
        {[15, 25, 45, 60].map((mins) => (
          <button
            key={mins}
            onClick={() => handlePresetChange(mins)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              durationMinutes === mins
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-900/40'
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {mins} Mins
          </button>
        ))}
      </div>

      {/* Large Countdown Display */}
      <div className="relative w-72 h-72 flex items-center justify-center mb-8 relative z-10">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="144"
            cy="144"
            r="120"
            className="stroke-slate-800"
            strokeWidth="12"
            fill="transparent"
          />
          <circle
            cx="144"
            cy="144"
            r="120"
            className="stroke-purple-500 transition-all duration-1000"
            strokeWidth="12"
            strokeDasharray={753}
            strokeDashoffset={753 - (753 * progress) / 100}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-6xl font-black tracking-tight font-mono text-white drop-shadow-md">
            {formatTime(timeLeft)}
          </span>
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest mt-2 flex items-center gap-1">
            <LuSparkles className="w-3.5 h-3.5" />
            {isRunning ? 'Deep Work Mode' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Controls: Start / Pause / Reset */}
      <div className="flex items-center gap-4 relative z-10 mb-6">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
              : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-90 text-white'
          }`}
          title={isRunning ? 'Pause Session' : 'Start Session'}
        >
          {isRunning ? <LuPause className="w-7 h-7" /> : <LuPlay className="w-7 h-7 ml-1" />}
        </button>

        <button
          onClick={handleReset}
          className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800"
          title="Reset Timer"
        >
          <LuRotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Session Summary Card */}
      {sessionCompleted && (
        <div className="w-full max-w-md p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-center text-emerald-300 relative z-10 animate-bounce mb-4">
          <LuCheckCircle className="w-8 h-8 mx-auto mb-1 text-emerald-400" />
          <h4 className="font-bold text-sm">Focus Session Completed!</h4>
          <p className="text-xs text-emerald-200 mt-1">Great job! Session recorded to your productivity stats.</p>
        </div>
      )}

      {/* Recent Sessions Activity */}
      {recentSessions.length > 0 && (
        <div className="w-full max-w-md pt-4 border-t border-slate-800 text-center relative z-10">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-2 font-semibold">
            <LuHistory className="w-3.5 h-3.5 text-purple-400" />
            <span>Recent Completed Sprints ({recentSessions.length})</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {recentSessions.slice(0, 3).map((sess) => (
              <span
                key={sess.id}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[120px]">{sess.task_title || 'Sprint'}</span>
                <span className="text-slate-500">({Math.round((sess.duration_seconds || 1500) / 60)}m)</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
