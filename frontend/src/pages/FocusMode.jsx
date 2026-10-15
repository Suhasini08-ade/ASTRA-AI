import React from 'react';
import FocusTimer from '../components/FocusTimer';

export default function FocusMode() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Distraction-Free Focus Space</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Lock into deep work with Pomodoro intervals and ambient acoustics</p>
      </div>

      <FocusTimer />
    </div>
  );
}
