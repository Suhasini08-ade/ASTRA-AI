import React from 'react';

export default function RainAtmosphere({ isThunderstorm = false }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Deep Stormy Atmosphere Gradient */}
      <div 
        className={`absolute inset-0 transition-colors duration-700 ${
          isThunderstorm 
            ? 'bg-gradient-to-b from-indigo-950/40 via-slate-900/30 to-blue-950/40' 
            : 'bg-gradient-to-b from-cyan-950/30 via-slate-900/20 to-blue-900/20'
        }`} 
      />

      {/* Heavy Rain Mist Top Layer */}
      <div className="absolute -top-16 left-0 right-0 h-48 bg-gradient-to-b from-slate-800/40 via-cyan-900/20 to-transparent blur-2xl" />

      {/* Atmospheric Mist Clouds */}
      <div className="absolute top-10 left-10 w-96 h-36 bg-blue-500/10 rounded-full blur-3xl animate-cloud-drift" />
      <div className="absolute top-24 right-20 w-80 h-32 bg-cyan-500/10 rounded-full blur-3xl animate-cloud-drift" style={{ animationDelay: '-12s' }} />

      {/* Bottom Puddle Reflection Glow */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyan-500/10 via-blue-500/5 to-transparent blur-md" />

      {/* Thunderstorm Ambient Flash Light pulses */}
      {isThunderstorm && (
        <div 
          className="absolute inset-0 bg-blue-100/10 mix-blend-overlay pointer-events-none"
          style={{ animation: 'lightning-flash 6s infinite' }}
        />
      )}
    </div>
  );
}
