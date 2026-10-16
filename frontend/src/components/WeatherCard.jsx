import React, { useState, useEffect } from 'react';
import { fetchWeather, POPULAR_CITIES, SEASON_PRESETS } from '../services/weatherService';
import { weatherAudio } from '../services/weatherAudio';
import WeatherEffectsCanvas from './weather/WeatherEffectsCanvas';
import SeasonalAtmosphere from './weather/SeasonalAtmosphere';
import { 
  CloudSun as LuCloudSun, 
  Sun as LuSun, 
  CloudRain as LuCloudRain, 
  CloudLightning as LuCloudLightning,
  Snowflake as LuSnowflake,
  Leaf as LuLeaf,
  Flower2 as LuFlower2,
  Wind as LuWind, 
  Droplets as LuDroplets, 
  Eye as LuEye, 
  Search as LuSearch,
  Volume2 as LuVolume2,
  VolumeX as LuVolumeX,
  Compass as LuCompass,
  Sunrise as LuSunrise,
  Sunset as LuSunset,
  Sparkles as LuSparkles,
  Sliders as LuSliders,
  MapPin as LuMapPin,
  AlertCircle as LuAlertCircle,
  X as LuX,
  RefreshCw as LuRefreshCw
} from 'lucide-react';

export default function WeatherCard({ 
  onSeasonChange, 
  activeSeasonPreset = 'auto', 
  onSeasonPresetChange,
  fullTabEffect = true,
  onToggleFullTabEffect
}) {
  const [cityInput, setCityInput] = useState('Kolhapur');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [selectedForecastIndex, setSelectedForecastIndex] = useState(0);
  const [intensity, setIntensity] = useState('normal');
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  const loadWeather = async (locationOrCoords, lat = null, lon = null) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchWeather(locationOrCoords, lat, lon);
      setWeather(data);
      setSelectedForecastIndex(0);

      if (data.location) {
        setCityInput(data.location.split(',')[0].trim());
      }

      // Automatically sync preset to auto and set season to city's natural climate
      if (onSeasonPresetChange) {
        onSeasonPresetChange('auto');
      }
      if (onSeasonChange) {
        onSeasonChange(data.season);
      }
    } catch (e) {
      console.error('Weather retrieval error:', e);
      setErrorMessage(e.message || 'Failed to fetch weather data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather('Kolhapur');
  }, []);

  // Compute the current effective season (either chosen manually or from current day/city weather)
  const effectiveSeason = (() => {
    if (activeSeasonPreset !== 'auto') {
      return activeSeasonPreset;
    }
    if (weather && weather.forecast && weather.forecast[selectedForecastIndex]) {
      return weather.forecast[selectedForecastIndex].season || weather.season;
    }
    return weather?.season || 'sunny';
  })();

  // Notify parent of effective season updates
  useEffect(() => {
    if (onSeasonChange) {
      onSeasonChange(effectiveSeason);
    }
    if (isAudioPlaying) {
      weatherAudio.play(effectiveSeason);
    }
  }, [effectiveSeason, isAudioPlaying, onSeasonChange]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (cityInput.trim()) {
      loadWeather(cityInput.trim());
    }
  };

  // Browser Geolocation API: Automatic Location Detection
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingLocation(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsDetectingLocation(false);
        const { latitude, longitude } = position.coords;
        await loadWeather(null, latitude, longitude);
      },
      (geoError) => {
        setIsDetectingLocation(false);
        let msg = 'Failed to retrieve your location.';
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow location access in your browser settings or search for a city manually.';
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable. Please search for a city manually.';
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = 'Location request timed out. Please try again or search manually.';
        }
        setErrorMessage(msg);
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  };

  const toggleSound = () => {
    if (isAudioPlaying) {
      weatherAudio.stop();
      setIsAudioPlaying(false);
    } else {
      weatherAudio.play(effectiveSeason);
      setIsAudioPlaying(true);
    }
  };

  // Weather icon mapping helper
  const getWeatherIcon = (iconName, className = "w-6 h-6") => {
    switch (iconName) {
      case 'sunny':
      case '01d':
      case '01n':
        return <LuSun className={`${className} text-amber-400 animate-spin-slow`} />;
      case 'rain':
      case '09d':
      case '09n':
      case '10d':
      case '10n':
        return <LuCloudRain className={`${className} text-cyan-400`} />;
      case 'thunderstorm':
      case '11d':
      case '11n':
        return <LuCloudLightning className={`${className} text-indigo-400 animate-pulse`} />;
      case 'snow':
      case '13d':
      case '13n':
        return <LuSnowflake className={`${className} text-blue-300 animate-pulse`} />;
      case 'wind':
      case 'autumn':
        return <LuLeaf className={`${className} text-amber-500`} />;
      case 'spring':
        return <LuFlower2 className={`${className} text-pink-400`} />;
      case 'partly-cloudy':
      case 'cloudy':
      case '02d':
      case '02n':
      case '03d':
      case '03n':
      case '04d':
      case '04n':
      case '50d':
      case '50n':
      default:
        return <LuCloudSun className={`${className} text-purple-400`} />;
    }
  };

  // Theme styling based on active season
  const getSeasonThemeClasses = () => {
    switch (effectiveSeason) {
      case 'sunny':
        return {
          cardBg: 'from-slate-900/90 via-amber-950/30 to-slate-900/95',
          border: 'border-amber-500/40',
          shadow: 'shadow-amber-500/15',
          accentText: 'text-amber-400',
          badgeBg: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
          badgeText: '☀️ Summer / Sunny Season',
          glow: 'from-amber-400/15 to-yellow-500/5'
        };
      case 'rain':
        return {
          cardBg: 'from-slate-900/90 via-cyan-950/40 to-slate-900/95',
          border: 'border-cyan-500/40',
          shadow: 'shadow-cyan-500/15',
          accentText: 'text-cyan-400',
          badgeBg: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300',
          badgeText: '🌧️ Monsoon / Rainy Season',
          glow: 'from-cyan-400/15 to-blue-500/5'
        };
      case 'thunderstorm':
        return {
          cardBg: 'from-slate-900/90 via-indigo-950/50 to-slate-900/95',
          border: 'border-indigo-500/40',
          shadow: 'shadow-indigo-500/20',
          accentText: 'text-indigo-400',
          badgeBg: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
          badgeText: '⚡ Thunderstorm & Downpour',
          glow: 'from-indigo-500/20 to-purple-600/10'
        };
      case 'snow':
        return {
          cardBg: 'from-slate-900/90 via-blue-950/40 to-slate-900/95',
          border: 'border-blue-400/40',
          shadow: 'shadow-blue-500/15',
          accentText: 'text-blue-300',
          badgeBg: 'bg-blue-500/20 border-blue-400/30 text-blue-200',
          badgeText: '❄️ Winter / Snow Season',
          glow: 'from-blue-400/15 to-cyan-400/5'
        };
      case 'autumn':
        return {
          cardBg: 'from-slate-900/90 via-amber-950/40 to-slate-900/95',
          border: 'border-amber-600/40',
          shadow: 'shadow-amber-600/15',
          accentText: 'text-amber-500',
          badgeBg: 'bg-amber-600/20 border-amber-600/30 text-amber-300',
          badgeText: '🍂 Autumn / Falling Foliage',
          glow: 'from-amber-500/15 to-orange-500/5'
        };
      case 'spring':
        return {
          cardBg: 'from-slate-900/90 via-pink-950/30 to-slate-900/95',
          border: 'border-pink-500/40',
          shadow: 'shadow-pink-500/15',
          accentText: 'text-pink-400',
          badgeBg: 'bg-pink-500/20 border-pink-500/30 text-pink-300',
          badgeText: '🌸 Spring / Sakura Blossom',
          glow: 'from-pink-400/15 to-rose-400/5'
        };
      case 'cloudy':
      default:
        return {
          cardBg: 'from-slate-900/90 via-slate-800/50 to-slate-900/95',
          border: 'border-purple-500/30',
          shadow: 'shadow-purple-500/10',
          accentText: 'text-purple-400',
          badgeBg: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
          badgeText: '☁️ Overcast / Misty Clouds',
          glow: 'from-purple-500/10 to-cyan-500/5'
        };
    }
  };

  const theme = getSeasonThemeClasses();

  return (
    <div className={`relative rounded-3xl p-6 sm:p-8 bg-gradient-to-br ${theme.cardBg} border ${theme.border} shadow-2xl ${theme.shadow} text-white transition-all duration-700 overflow-hidden backdrop-blur-xl`}>
      {/* Background seasonal atmosphere inside the card */}
      <SeasonalAtmosphere season={effectiveSeason} />

      {/* Internal Weather Animation Canvas */}
      <WeatherEffectsCanvas season={effectiveSeason} intensity={intensity} className="opacity-90" />

      {/* Card Content container with higher z-index */}
      <div className="relative z-20 space-y-6">
        
        {/* Top Header: Title, Active Season Pill, and Search Form */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
                <LuCloudSun className={`w-7 h-7 ${theme.accentText}`} />
                <span>Weather & Seasonal Dynamics</span>
              </h2>

              {/* Dynamic Season Badge */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${theme.badgeBg} backdrop-blur-md shadow-sm transition-all duration-500`}>
                <LuSparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>{theme.badgeText}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time atmospheric rendering with active rain, sunrays, and seasonal physics
            </p>
          </div>

          {/* Quick Actions: Geolocation, Sound, Settings, and Search */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Automatic Location Detection Button */}
            <button
              id="weather-use-my-location-btn"
              type="button"
              onClick={handleUseMyLocation}
              disabled={isDetectingLocation || loading}
              className={`px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 ${
                isDetectingLocation
                  ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 animate-pulse'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/80 hover:border-cyan-400/50 text-cyan-300 hover:text-white shadow-sm'
              }`}
              title="Use browser Geolocation to fetch weather at your current coordinates"
            >
              {isDetectingLocation ? (
                <LuRefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              ) : (
                <LuMapPin className="w-4 h-4 text-cyan-400" />
              )}
              <span>{isDetectingLocation ? 'Locating...' : 'Use My Location'}</span>
            </button>

            {/* Ambient Sound Toggle */}
            <button
              id="weather-sound-toggle-btn"
              type="button"
              onClick={toggleSound}
              className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                isAudioPlaying 
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-md shadow-cyan-500/20 animate-pulse' 
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700/80'
              }`}
              title={isAudioPlaying ? 'Mute weather ambient audio' : 'Play weather ambient soundscape'}
            >
              {isAudioPlaying ? <LuVolume2 className="w-4 h-4 text-cyan-400" /> : <LuVolumeX className="w-4 h-4 text-slate-400" />}
              <span className="hidden sm:inline">{isAudioPlaying ? 'Sound On' : 'Sound Off'}</span>
            </button>

            {/* Advanced Controls Toggle */}
            <button
              id="weather-settings-toggle-btn"
              type="button"
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              className={`p-2.5 rounded-xl border transition-all text-xs ${
                showAdvancedControls
                  ? 'bg-purple-600/30 border-purple-400/50 text-purple-300'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700/80'
              }`}
              title="Animation Settings"
            >
              <LuSliders className="w-4 h-4" />
            </button>

            {/* City Search Form */}
            <form onSubmit={handleSearch} className="relative flex-1 sm:w-56">
              <input
                id="weather-city-search-input"
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Search city (e.g. Dubai, London)..."
                disabled={loading}
                className="w-full bg-slate-800/80 border border-slate-700/90 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              />
              <LuSearch className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </form>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2">
              <LuAlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="p-1 rounded-lg hover:bg-rose-500/30 text-rose-300 hover:text-white transition-colors"
              title="Dismiss error message"
            >
              <LuX className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Season Selector Toolbar: Easily test/switch between seasons */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Season & Weather Animation Modes</span>
              <span className="text-slate-500 font-normal">(Click any season to see animation)</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-slate-900/70 border border-slate-800/90 backdrop-blur-md">
            {SEASON_PRESETS.map((preset) => {
              const isActive = activeSeasonPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  id={`season-preset-${preset.id}`}
                  onClick={() => onSeasonPresetChange && onSeasonPresetChange(preset.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-md shadow-purple-900/40 scale-102 ring-1 ring-white/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={preset.description}
                >
                  <span className="text-sm">{preset.icon}</span>
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Controls Accordion (Full Tab vs Card effect, Intensity) */}
        {showAdvancedControls && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50">
              <span className="text-slate-300 font-medium">Full Screen Tab Animation:</span>
              <button
                onClick={onToggleFullTabEffect}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  fullTabEffect ? 'bg-cyan-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {fullTabEffect ? 'Active on Entire Tab' : 'Card Only'}
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50">
              <span className="text-slate-300 font-medium">Particle Intensity:</span>
              <div className="flex gap-1">
                {['gentle', 'normal', 'high'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setIntensity(lvl)}
                    className={`px-2.5 py-1 rounded-md capitalize font-semibold transition-colors ${
                      intensity === lvl ? 'bg-purple-600 text-white' : 'bg-slate-700/60 text-slate-400'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Popular Cities Quick Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-slate-500 text-[11px] font-semibold shrink-0">Popular Cities:</span>
          {POPULAR_CITIES.map((c) => (
            <button
              key={c.name}
              id={`city-btn-${c.name.toLowerCase()}`}
              onClick={() => {
                setCityInput(c.name);
                loadWeather(c.name);
              }}
              disabled={loading}
              className={`px-3 py-1 rounded-xl shrink-0 font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                weather?.location.toLowerCase().includes(c.name.toLowerCase())
                  ? 'bg-slate-700 border border-slate-600 text-white shadow-sm'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        {/* Content Area: Loading / Error / Weather Display */}
        {loading && !weather ? (
          <div className="py-20 text-center text-slate-400 text-xs animate-pulse flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span>
              {isDetectingLocation 
                ? 'Detecting your coordinates via browser geolocation...' 
                : `Harmonizing atmospheric conditions for ${cityInput || 'selected location'}...`}
            </span>
          </div>
        ) : !weather ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3 bg-slate-900/40 rounded-2xl border border-white/10 p-6">
            <LuAlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-sm font-bold text-slate-200">Unable to display weather data</p>
            <p className="text-xs text-slate-400 max-w-md">{errorMessage || 'Please try searching for another city or use automatic location detection.'}</p>
            <button
              onClick={() => loadWeather('Kolhapur')}
              className="mt-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-xs"
            >
              Reset to Default City
            </button>
          </div>
        ) : (
          <div className="space-y-6 relative">
            {/* Subtle floating spinner if refreshing weather in background */}
            {loading && (
              <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-cyan-400/40 text-[10px] text-cyan-300 shadow-md">
                <LuRefreshCw className="w-3 h-3 animate-spin" />
                <span>Updating...</span>
              </div>
            )}

            {/* Primary Hero Weather Display */}
            <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
              
              {/* Left Info: Location, Temperature, High/Low, Condition description */}
              <div className="space-y-2 max-w-md">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black uppercase tracking-widest ${theme.accentText}`}>
                    {weather.location}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">Live</span>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-5xl sm:text-6xl font-black tracking-tight text-white drop-shadow-lg">
                    {weather.temperature}°C
                  </span>
                  <span className="text-sm font-semibold text-slate-300">
                    RealFeel {weather.feelsLike}°C
                  </span>
                </div>

                <p className="text-base font-bold text-slate-200 flex items-center gap-2">
                  <span>{weather.condition}</span>
                </p>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {weather.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="text-rose-400">↑</span> High: <strong className="text-white">{weather.high}°C</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-cyan-400">↓</span> Low: <strong className="text-white">{weather.low}°C</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <LuCompass className="w-3.5 h-3.5 text-purple-400" /> Wind: <strong className="text-white">{weather.windSpeed} m/s</strong>
                  </span>
                </div>
              </div>

              {/* Right: Big Thematic Weather Badge with Animation Glow */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-800/60 border border-white/10 relative group shrink-0 min-w-[140px] text-center">
                <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-r ${theme.glow} blur-lg opacity-80 group-hover:opacity-100 transition-opacity`} />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="p-3">
                    {getWeatherIcon(activeSeasonPreset !== 'auto' ? effectiveSeason : (weather.forecast[selectedForecastIndex]?.icon || weather.icon), "w-16 h-16")}
                  </div>
                  <span className={`text-xs font-extrabold mt-1 uppercase tracking-wider ${theme.accentText}`}>
                    {effectiveSeason}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Active Season</span>
                </div>
              </div>
            </div>

            {/* 4 Stats Grid: Humidity, Wind, UV, Sunrise/Sunset */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                  <LuDroplets className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Humidity</p>
                  <p className="text-sm font-extrabold text-white">{weather.humidity}%</p>
                  <span className="text-[10px] text-cyan-400 font-medium">
                    {weather.humidity > 70 ? 'Moist / Rain' : 'Comfortable'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                  <LuWind className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Wind Speed</p>
                  <p className="text-sm font-extrabold text-white">{weather.windSpeed} m/s</p>
                  <span className="text-[10px] text-purple-400 font-medium">Gentle Breeze</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <LuEye className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">UV Index</p>
                  <p className="text-sm font-extrabold text-white">{weather.uvIndex} of 10</p>
                  <span className="text-[10px] text-amber-400 font-medium">
                    {weather.uvIndex >= 8 ? 'Very High' : weather.uvIndex >= 5 ? 'Moderate' : 'Low Risk'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                  {effectiveSeason === 'sunny' ? <LuSunset className="w-5 h-5" /> : <LuSunrise className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Solar Cycle</p>
                  <p className="text-sm font-extrabold text-white">{weather.sunrise} - {weather.sunset}</p>
                  <span className="text-[10px] text-rose-400 font-medium">Daylight Cycle</span>
                </div>
              </div>
            </div>

            {/* Interactive 5-Day Forecast: Click any day to preview & switch animation */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span>5-Day Forecast & Seasonal Transition</span>
                  <span className="text-cyan-400 font-normal lowercase">(click any day to see animation)</span>
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">Click to preview</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {weather.forecast.map((fc, i) => {
                  const isSelected = selectedForecastIndex === i;
                  return (
                    <button
                      key={i}
                      id={`forecast-day-${i}`}
                      type="button"
                      onClick={() => {
                        setSelectedForecastIndex(i);
                        if (onSeasonPresetChange) {
                          onSeasonPresetChange('auto');
                        }
                        if (onSeasonChange) {
                          onSeasonChange(fc.season || weather.season);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border text-center flex flex-col items-center justify-between transition-all cursor-pointer group ${
                        isSelected
                          ? `bg-slate-800/90 ${theme.border} ring-2 ring-white/20 shadow-lg scale-102`
                          : 'bg-slate-900/50 border-white/5 hover:bg-slate-800/60 hover:border-white/20'
                      }`}
                    >
                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                        {fc.day}
                      </span>
                      
                      <div className="my-2.5 transform group-hover:scale-110 transition-transform">
                        {getWeatherIcon(fc.icon, "w-8 h-8")}
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-white">{fc.temp}°C</span>
                        <p className="text-[10px] text-slate-400 truncate max-w-[80px]">{fc.condition}</p>
                      </div>

                      {isSelected && (
                        <span className={`mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${theme.badgeBg}`}>
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
