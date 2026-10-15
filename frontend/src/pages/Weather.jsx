import React, { useState } from 'react';
import WeatherCard from '../components/WeatherCard';
import WeatherEffectsCanvas from '../components/weather/WeatherEffectsCanvas';
import SeasonalAtmosphere from '../components/weather/SeasonalAtmosphere';

export default function Weather() {
  const [activeSeason, setActiveSeason] = useState('rain'); // Default to rain or synced with city
  const [activeSeasonPreset, setActiveSeasonPreset] = useState('auto');
  const [fullTabEffect, setFullTabEffect] = useState(true);

  return (
    <div className="relative -m-4 lg:-m-8 p-4 lg:p-8 min-h-[calc(100vh-4rem)] overflow-hidden transition-colors duration-700 flex flex-col justify-start">
      {/* Full Tab Screen Seasonal Atmosphere & Animations */}
      {fullTabEffect && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <SeasonalAtmosphere season={activeSeason} />
          <WeatherEffectsCanvas season={activeSeason} intensity="normal" className="opacity-95" />
        </div>
      )}

      {/* Main Weather Content Container */}
      <div className="relative z-10 max-w-5xl mx-auto w-full py-4 px-2">
        <WeatherCard 
          onSeasonChange={setActiveSeason}
          activeSeasonPreset={activeSeasonPreset}
          onSeasonPresetChange={setActiveSeasonPreset}
          fullTabEffect={fullTabEffect}
          onToggleFullTabEffect={() => setFullTabEffect(!fullTabEffect)}
        />
      </div>
    </div>
  );
}
