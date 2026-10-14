import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  apiCreateFocusSession,
  apiGetFocusSessions,
  apiGetTasks,
  apiUpdateTask,
} from '../services/api';

const PRESETS = [15, 25, 45, 60];
const STATES = { IDLE: 'IDLE', FOCUSING: 'FOCUSING', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED', STOPPED: 'STOPPED' };

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

const displayDate = (date) => date ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date';

export default function FocusPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const { showError, showSuccess } = useToast();
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [minutes, setMinutes] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [focusState, setFocusState] = useState(STATES.IDLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingComplete, setMarkingComplete] = useState(false);

  const intervalRef = useRef(null);
  const deadlineRef = useRef(null);
  const runStartedAtRef = useRef(null);
  const activeSecondsRef = useRef(0);
  const initialSecondsRef = useRef(25 * 60);
  const savedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    deadlineRef.current = null;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [taskResult, sessionResult] = await Promise.all([apiGetTasks(), apiGetFocusSessions()]);
      const activeTasks = (taskResult?.data || []).filter((task) => task.status !== 'done');
      setTasks(activeTasks);
      setSessions(sessionResult?.data || []);
      setSelectedTask((previous) => {
        if (previous && activeTasks.some((task) => task.id === previous.id)) return previous;
        return activeTasks.find((task) => task.priority === 'high') || activeTasks[0] || null;
      });
    } catch (requestError) {
      setError(requestError.message || 'Unable to load your Focus Mode data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && currentUser) loadData();
    if (!authLoading && !currentUser) setLoading(false);
  }, [authLoading, currentUser, loadData]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const refreshSessions = useCallback(async () => {
    const result = await apiGetFocusSessions();
    setSessions(result?.data || []);
  }, []);

  const saveSession = useCallback(async (status, durationSeconds) => {
    if (!selectedTask || savedRef.current) return;
    savedRef.current = true;
    try {
      await apiCreateFocusSession({
        task_id: selectedTask.id,
        duration_seconds: Math.max(0, Math.floor(durationSeconds)),
        status,
      });
      await refreshSessions();
    } catch (requestError) {
      savedRef.current = false;
      showError?.(`Couldn't save this focus session: ${requestError.message}`);
    }
  }, [refreshSessions, selectedTask, showError]);

  const completeSession = useCallback(() => {
    clearTimer();
    setRemainingSeconds(0);
    activeSecondsRef.current = initialSecondsRef.current;
    setFocusState(STATES.COMPLETED);
    saveSession('completed', initialSecondsRef.current);
  }, [clearTimer, saveSession]);

  const beginTicking = useCallback(() => {
    clearTimer();
    deadlineRef.current = Date.now() + remainingSeconds * 1000;
    runStartedAtRef.current = Date.now();
    intervalRef.current = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) completeSession();
    }, 250);
  }, [clearTimer, completeSession, remainingSeconds]);

  const startFocus = () => {
    if (!selectedTask) return;
    savedRef.current = false;
    activeSecondsRef.current = 0;
    initialSecondsRef.current = minutes * 60;
    setRemainingSeconds(minutes * 60);
    setFocusState(STATES.FOCUSING);
    // Start against a known duration rather than state that may not have rendered yet.
    clearTimer();
    deadlineRef.current = Date.now() + minutes * 60 * 1000;
    runStartedAtRef.current = Date.now();
    intervalRef.current = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) completeSession();
    }, 250);
  };

  const pauseFocus = () => {
    activeSecondsRef.current += Math.max(0, (Date.now() - runStartedAtRef.current) / 1000);
    const exactRemaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
    clearTimer();
    runStartedAtRef.current = null;
    setRemainingSeconds(exactRemaining);
    setFocusState(STATES.PAUSED);
  };

  const resumeFocus = () => {
    setFocusState(STATES.FOCUSING);
    beginTicking();
  };

  const stopFocus = () => {
    const timeThisRun = focusState === STATES.FOCUSING
      ? Math.max(0, (Date.now() - runStartedAtRef.current) / 1000)
      : 0;
    const focusedSeconds = Math.max(0, activeSecondsRef.current + timeThisRun);
    clearTimer();
    runStartedAtRef.current = null;
    setFocusState(STATES.STOPPED);
    saveSession('stopped', focusedSeconds);
    setRemainingSeconds(minutes * 60);
    activeSecondsRef.current = 0;
  };

  const choosePreset = (preset) => {
    if (focusState === STATES.FOCUSING || focusState === STATES.PAUSED) return;
    setMinutes(preset);
    setRemainingSeconds(preset * 60);
    setFocusState(STATES.IDLE);
  };

  const markTaskCompleted = async () => {
    if (!selectedTask) return;
    setMarkingComplete(true);
    try {
      await apiUpdateTask(selectedTask.id, { status: 'done' });
      setTasks((previous) => previous.filter((task) => task.id !== selectedTask.id));
      setSelectedTask((previous) => tasks.find((task) => task.id !== previous?.id) || null);
      showSuccess?.('Task marked as completed.');
    } catch (requestError) {
      showError?.(`Couldn't complete task: ${requestError.message}`);
    } finally {
      setMarkingComplete(false);
    }
  };

  const highPriorityTasks = tasks.filter((task) => task.priority === 'high');
  const isActive = focusState === STATES.FOCUSING || focusState === STATES.PAUSED;
  const tip = focusState === STATES.PAUSED ? 'A short pause is fine. Return when you are ready.'
    : focusState === STATES.FOCUSING && remainingSeconds <= initialSecondsRef.current / 2 ? "You're halfway through. Keep going."
    : focusState === STATES.FOCUSING ? 'Stay with this task until the session ends.'
    : 'Choose one task and give it your full attention.';

  if (authLoading || loading) return <div className="py-16 text-center text-sm text-on-surface-variant">Loading your focus workspace…</div>;
  if (!currentUser) return <div className="py-16 text-center text-sm text-on-surface-variant">Please sign in to use Focus Mode.</div>;
  if (error) return <div className="py-16 text-center"><p className="text-sm text-error">{error}</p><button onClick={loadData} className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Try again</button></div>;

  return (
    <div className="mx-auto max-w-4xl pb-10 pt-2 text-on-surface dark:text-slate-100">
      <header className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">Focus Mode</p>
        <h1 className="mt-2 font-headline text-3xl font-extrabold">Make space for what matters.</h1>
      </header>

      {highPriorityTasks.length > 0 && selectedTask?.priority === 'high' && (
        <p className="mx-auto mb-6 max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          You have {highPriorityTasks.length} high-priority task{highPriorityTasks.length === 1 ? '' : 's'}. Start with <strong>{selectedTask.title}</strong>?
        </p>
      )}

      <section className="mx-auto max-w-2xl">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Active task</label>
        {tasks.length ? (
          <select value={selectedTask?.id || ''} disabled={isActive} onChange={(event) => setSelectedTask(tasks.find((task) => task.id === event.target.value) || null)} className="w-full rounded-xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm font-semibold text-on-surface outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.title} · {task.priority} · {displayDate(task.due_date)}</option>)}
          </select>
        ) : <p className="rounded-xl border border-dashed border-outline-variant/60 px-4 py-5 text-center text-sm text-on-surface-variant">No active tasks yet. Add one in Tasks to begin a focus session.</p>}
      </section>

      <section className="mx-auto mt-10 max-w-2xl text-center">
        <div className="text-7xl font-light tabular-nums tracking-tight text-emerald-800 dark:text-emerald-300 sm:text-8xl">{formatTime(remainingSeconds)}</div>
        <p className="mt-3 text-sm font-medium text-on-surface-variant">{focusState === STATES.FOCUSING ? 'Focus in progress' : focusState === STATES.PAUSED ? 'Focus paused' : focusState === STATES.COMPLETED ? 'Focus Session Complete' : focusState === STATES.STOPPED ? 'Session stopped — ready when you are.' : 'Ready to focus'}</p>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {PRESETS.map((preset) => <button key={preset} disabled={isActive} onClick={() => choosePreset(preset)} className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${minutes === preset ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/70'} disabled:cursor-not-allowed disabled:opacity-50`}>{preset} min</button>)}
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {(focusState === STATES.IDLE || focusState === STATES.STOPPED) && <button disabled={!selectedTask} onClick={startFocus} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Start Focus</button>}
          {focusState === STATES.FOCUSING && <><button onClick={pauseFocus} className="rounded-xl border border-emerald-600 px-6 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-400">Pause</button><button onClick={stopFocus} className="rounded-xl px-4 py-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low dark:hover:bg-slate-800">Stop</button></>}
          {focusState === STATES.PAUSED && <><button onClick={resumeFocus} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700">Resume</button><button onClick={stopFocus} className="rounded-xl px-4 py-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low dark:hover:bg-slate-800">Stop</button></>}
          {focusState === STATES.COMPLETED && <><button disabled={markingComplete} onClick={markTaskCompleted} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{markingComplete ? 'Completing…' : 'Mark task completed'}</button><button onClick={() => choosePreset(minutes)} className="rounded-xl border border-emerald-600 px-5 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-400">Start Another Session</button></>}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-2xl border-t border-outline-variant/30 pt-5 dark:border-slate-700">
        <div className="flex gap-3"><span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">auto_awesome</span><div><h2 className="text-sm font-bold">Astra Tip</h2><p className="mt-1 text-sm text-on-surface-variant">{tip}</p></div></div>
      </section>

      <section className="mx-auto mt-10 max-w-2xl border-t border-outline-variant/30 pt-5 dark:border-slate-700">
        <h2 className="text-sm font-bold">Recent Focus Sessions</h2>
        {sessions.length === 0 ? <p className="mt-3 text-sm text-on-surface-variant">Completed and stopped sessions will appear here.</p> : <div className="mt-3 divide-y divide-outline-variant/25 dark:divide-slate-700">{sessions.map((session) => <div key={session.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div className="min-w-0"><p className="truncate font-semibold">{session.task_title}</p><p className="mt-0.5 text-xs text-on-surface-variant">{new Date(session.timestamp).toLocaleString()}</p></div><div className="shrink-0 text-right"><p className="font-semibold text-emerald-700 dark:text-emerald-400">{Math.floor(session.duration_seconds / 60)} min</p><p className="text-xs capitalize text-on-surface-variant">{session.status}</p></div></div>)}</div>}
      </section>
    </div>
  );
}
