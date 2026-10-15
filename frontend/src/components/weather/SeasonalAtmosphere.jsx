import React from 'react';
import SunraysAtmosphere from './SunraysAtmosphere';
import RainAtmosphere from './RainAtmosphere';

export default function SeasonalAtmosphere({ season = 'sunny' }) {
  if (season === 'sunny') {
    return <SunraysAtmosphere />;
  }

  if (season === 'rain') {
    return <RainAtmosphere isThunderstorm={false} />;
  }

  if (season === 'thunderstorm') {
    return <RainAtmosphere isThunderstorm={true} />;
  }

  if (season === 'snow') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-slate-900/20 to-cyan-950/30" />
        {/* Frost vignette edges */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-blue-900/5 to-cyan-400/10 pointer-events-none" />
        <div className="absolute -top-20 left-1/4 w-96 h-48 bg-cyan-300/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyan-100/10 to-transparent blur-lg" />
      </div>
    );
  }

  if (season === 'autumn') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-950/30 via-slate-900/20 to-orange-950/25" />
        <div className="absolute top-1/4 -right-16 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-40 bg-orange-500/10 rounded-full blur-3xl" />
      </div>
    );
  }

  if (season === 'spring') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-pink-950/20 via-slate-900/20 to-rose-950/25" />
        <div className="absolute -top-10 right-1/3 w-80 h-72 bg-pink-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-48 bg-rose-400/10 rounded-full blur-3xl" />
      </div>
    );
  }

  if (season === 'cloudy') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-800/25 via-slate-900/20 to-slate-800/25" />
        <div className="absolute top-12 left-1/5 w-[500px] h-40 bg-slate-400/10 rounded-full blur-3xl animate-cloud-drift" />
        <div className="absolute top-36 right-10 w-[450px] h-36 bg-slate-300/10 rounded-full blur-3xl animate-cloud-drift" style={{ animationDelay: '-15s' }} />
      </div>
    );
  }

  return null;
}
