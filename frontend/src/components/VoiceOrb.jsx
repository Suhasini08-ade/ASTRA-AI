import React from 'react';
import { Mic as LuMic, Sparkles as LuSparkles, Volume2 as LuVolume2, Loader2 as LuLoader2 } from 'lucide-react';

export default function VoiceOrb({ state = 'IDLE', onClick }) {
  const getStateInfo = () => {
    switch (state) {
      case 'LISTENING':
        return {
          label: 'Listening...',
          sub: 'ASTRA is listening to your voice input',
          badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          orbGlow: 'from-emerald-500 via-cyan-500 to-purple-600 shadow-[0_0_60px_rgba(16,185,129,0.5)] scale-105 animate-pulse'
        };
      case 'PROCESSING':
        return {
          label: 'ASTRA is thinking...',
          sub: 'Analyzing language and synthesizing response',
          badgeBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          orbGlow: 'from-purple-600 via-pink-500 to-blue-600 shadow-[0_0_60px_rgba(168,85,247,0.6)] animate-spin-slow'
        };
      case 'SPEAKING':
        return {
          label: 'ASTRA is responding...',
          sub: 'Voice synthesis streaming active',
          badgeBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
          orbGlow: 'from-cyan-500 via-blue-600 to-purple-600 shadow-[0_0_70px_rgba(6,182,212,0.6)] scale-110'
        };
      case 'IDLE':
      default:
        return {
          label: 'Tap to speak',
          sub: 'Press the orb to start voice conversation',
          badgeBg: 'bg-slate-700/40 text-slate-300 border-slate-700/60',
          orbGlow: 'from-purple-600 via-blue-600 to-cyan-500 shadow-[0_0_40px_rgba(124,58,237,0.35)] hover:scale-105'
        };
    }
  };

  const info = getStateInfo();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center select-none">
      {/* Outer Sound Wave Ripple Rings */}
      <div className="relative flex items-center justify-center mb-8">
        {(state === 'LISTENING' || state === 'SPEAKING') && (
          <>
            <div className="absolute w-72 h-72 rounded-full border border-cyan-500/20 animate-ping" />
            <div className="absolute w-80 h-80 rounded-full border border-purple-500/20 animate-pulse" />
          </>
        )}

        {state === 'PROCESSING' && (
          <div className="absolute w-72 h-72 rounded-full border-2 border-dashed border-cyan-400/40 animate-spin" />
        )}

        {/* Central Animated Orb */}
        <button
          onClick={onClick}
          className={`relative w-48 h-48 rounded-full bg-gradient-to-br ${info.orbGlow} p-1 transition-all duration-500 flex items-center justify-center cursor-pointer group focus:outline-none`}
        >
          <div className="w-full h-full rounded-full bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 border border-white/10 group-hover:bg-slate-950/60 transition-colors">
            {state === 'IDLE' && (
              <LuMic className="w-16 h-16 text-purple-400 group-hover:text-cyan-300 transition-colors" />
            )}
            {state === 'LISTENING' && (
              <div className="flex items-center gap-1.5 h-12">
                <div className="w-2 bg-emerald-400 h-6 animate-bounce" />
                <div className="w-2 bg-cyan-400 h-10 animate-bounce delay-100" />
                <div className="w-2 bg-purple-400 h-12 animate-bounce delay-200" />
                <div className="w-2 bg-blue-400 h-8 animate-bounce delay-150" />
                <div className="w-2 bg-emerald-400 h-5 animate-bounce" />
              </div>
            )}
            {state === 'PROCESSING' && (
              <LuLoader2 className="w-16 h-16 text-cyan-400 animate-spin" />
            )}
            {state === 'SPEAKING' && (
              <LuVolume2 className="w-16 h-16 text-cyan-300 animate-pulse" />
            )}

            <span className="mt-2 text-xs font-semibold text-slate-300 group-hover:text-white uppercase tracking-wider">
              {state}
            </span>
          </div>
        </button>
      </div>

      {/* State Badge and Description */}
      <div className={`px-4 py-1.5 rounded-full border text-xs font-bold tracking-wide uppercase mb-2 ${info.badgeBg}`}>
        {info.label}
      </div>
      <p className="text-xs text-slate-400 max-w-xs">{info.sub}</p>
    </div>
  );
}
