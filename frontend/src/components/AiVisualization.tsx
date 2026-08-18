import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Cpu, Zap, Activity, Radio } from 'lucide-react';

interface AiVisualizationProps {
  statusText?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export const AiVisualization: React.FC<AiVisualizationProps> = ({
  statusText = 'ASTRA AI Active & Ready',
  isListening = false,
  isSpeaking = false,
  isThinking = false,
  interactive = true,
  onClick,
}) => {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((prev) => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Determine color theme based on state
  let primaryGlow = 'from-blue-600 via-indigo-500 to-purple-600';
  let orbBorder = 'border-blue-400/50';
  let particleColor = 'bg-cyan-400';

  if (isListening) {
    primaryGlow = 'from-emerald-500 via-teal-400 to-cyan-500';
    orbBorder = 'border-emerald-400/80';
    particleColor = 'bg-emerald-300';
  } else if (isSpeaking) {
    primaryGlow = 'from-purple-600 via-pink-500 to-amber-500';
    orbBorder = 'border-purple-400/80';
    particleColor = 'bg-pink-300';
  } else if (isThinking) {
    primaryGlow = 'from-cyan-500 via-blue-600 to-violet-600';
    orbBorder = 'border-cyan-400/80';
    particleColor = 'bg-blue-300';
  }

  return (
    <div 
      className={`relative flex flex-col items-center justify-center py-6 px-4 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden group transition-all duration-500 ${interactive ? 'cursor-pointer hover:border-cyan-500/40 hover:shadow-cyan-500/10' : ''}`}
      onClick={onClick}
    >
      {/* Radial Gradient Background Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.12),transparent_70%)] pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cyber Grid Pattern Lines overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Center Animated Orb Assembly */}
      <div className="relative flex items-center justify-center my-4 w-48 h-48 sm:w-56 sm:h-56">
        
        {/* Outer Ring 1 - Spinning Slow Dashed Orbit */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border border-dashed border-cyan-500/20"
        />

        {/* Outer Ring 2 - Pulse Wave Effect */}
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: isListening || isSpeaking ? 1.5 : 3.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`absolute inset-2 rounded-full border ${orbBorder} blur-[1px]`}
        />

        {/* Outer Ring 3 - Reverse Spin Accent */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-6 rounded-full border-2 border-t-cyan-400/60 border-r-transparent border-b-purple-500/60 border-l-transparent"
        />

        {/* Inner Glowing Orb Core */}
        <motion.div
          animate={{
            scale: isListening ? [1, 1.15, 0.95, 1.1, 1] : isSpeaking ? [1, 1.2, 1, 1.15, 1] : [1, 1.06, 1],
          }}
          transition={{
            duration: isListening || isSpeaking ? 1.2 : 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr ${primaryGlow} shadow-[0_0_50px_rgba(139,92,246,0.6)] flex items-center justify-center relative overflow-hidden`}
        >
          {/* Inner liquid shimmer wave */}
          <div className="absolute inset-0 bg-white/20 blur-md animate-pulse transform -rotate-12" />
          
          {/* Core Icon */}
          <div className="relative z-10 text-white flex flex-col items-center justify-center space-y-1">
            {isListening ? (
              <Radio className="w-8 h-8 text-white animate-bounce" />
            ) : isSpeaking ? (
              <Zap className="w-8 h-8 text-amber-200 animate-pulse" />
            ) : isThinking ? (
              <Activity className="w-8 h-8 text-cyan-200 animate-spin" />
            ) : (
              <Cpu className="w-9 h-9 text-cyan-100 group-hover:scale-110 transition-transform duration-300" />
            )}
          </div>
        </motion.div>

        {/* Floating Particle Aura */}
        {[0, 60, 120, 180, 240, 300].map((angle, idx) => {
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * 90;
          const y = Math.sin(rad) * 90;

          return (
            <motion.div
              key={idx}
              animate={{
                x: [x, x * 1.12, x],
                y: [y, y * 1.12, y],
                opacity: [0.4, 0.9, 0.4],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 2 + idx * 0.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className={`absolute w-2 h-2 rounded-full ${particleColor} shadow-[0_0_8px_currentColor]`}
              style={{ left: `calc(50% + ${x}px - 4px)`, top: `calc(50% + ${y}px - 4px)` }}
            />
          );
        })}
      </div>

      {/* Dynamic Equalizer Waves when speaking or listening */}
      {(isListening || isSpeaking || isThinking) && (
        <div className="flex items-center space-x-1.5 h-6 my-2">
          {[0.6, 1, 0.4, 0.8, 0.5, 0.9, 0.3, 0.7].map((heightMultiplier, i) => (
            <motion.span
              key={i}
              animate={{
                height: [6, 24 * heightMultiplier, 6],
              }}
              transition={{
                duration: 0.5 + (i % 3) * 0.2,
                repeat: Infinity,
                repeatType: 'mirror',
                ease: 'easeInOut',
              }}
              className={`w-1 rounded-full ${
                isListening ? 'bg-emerald-400' : isSpeaking ? 'bg-purple-400' : 'bg-cyan-400'
              } shadow-[0_0_6px_currentColor]`}
            />
          ))}
        </div>
      )}

      {/* AI Status Text Banner */}
      <div className="flex items-center space-x-2 bg-slate-950/70 border border-white/10 px-4 py-1.5 rounded-full mt-2 shadow-inner">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isListening ? 'bg-emerald-400' : isSpeaking ? 'bg-pink-400' : 'bg-cyan-400'} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isListening ? 'bg-emerald-500' : isSpeaking ? 'bg-pink-500' : 'bg-cyan-500'}`} />
        </span>
        <span className="text-xs font-semibold tracking-wide text-slate-200">
          {statusText}
        </span>
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
      </div>

      {interactive && (
        <p className="text-[11px] text-slate-400 mt-2 font-medium group-hover:text-cyan-300 transition-colors">
          Click to activate AI Neural Command
        </p>
      )}
    </div>
  );
};
