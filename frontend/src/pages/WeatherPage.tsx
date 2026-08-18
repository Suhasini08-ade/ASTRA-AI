import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  CloudSun, 
  Sun, 
  Cloud, 
  CloudRain, 
  Wind, 
  Droplets, 
  Gauge, 
  Sunrise, 
  Sunset, 
  Compass, 
  Sparkles,
  Search,
  LocateFixed,
  LoaderCircle
} from 'lucide-react';
import { WeatherData } from '../types';
import { fetchWeatherData } from '../services/api';

export const WeatherPage: React.FC = () => {
  const [location, setLocation] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const permissionRequestKey = 'astra_weather_location_permission_requested';

  const loadWeather = async (loc?: string) => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetchWeatherData(loc);
      if (activeRequest !== requestId.current) return;
      setData(res);
      setLocation(loc || res.location);
    } catch (err) {
      if (activeRequest !== requestId.current) return;
      const message = err instanceof Error ? err.message : 'Unable to load weather right now.';
      setError(message.toLowerCase().includes('not found') ? 'City not found.' : message);
    } finally {
      if (activeRequest === requestId.current) setLoading(false);
    }
  };

  const useCurrentLocation = async (fallbackToDefault = false) => {
    if (!navigator.geolocation) {
      if (fallbackToDefault) loadWeather();
      else setError('Location services are not available in this browser.');
      return;
    }

    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      position => {
        localStorage.setItem(permissionRequestKey, 'granted');
        const { latitude, longitude } = position.coords;
        loadWeather(`${latitude},${longitude}`);
      },
      positionError => {
        if (positionError.code === positionError.PERMISSION_DENIED) {
          localStorage.setItem(permissionRequestKey, 'denied');
        }
        if (fallbackToDefault) {
          loadWeather();
        } else {
          setLoading(false);
          setError('Location access is unavailable. Please search for a city instead.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    const loadInitialWeather = async () => {
      if (!navigator.geolocation) {
        loadWeather();
        return;
      }

      try {
        const permission = await navigator.permissions?.query({ name: 'geolocation' });
        if (permission?.state === 'granted') {
          useCurrentLocation(true);
          return;
        }
        if (permission?.state === 'denied' || localStorage.getItem(permissionRequestKey)) {
          loadWeather();
          return;
        }
      } catch {
        if (localStorage.getItem(permissionRequestKey) === 'granted') {
          useCurrentLocation(true);
          return;
        }
        if (localStorage.getItem(permissionRequestKey)) {
          loadWeather();
          return;
        }
      }

      localStorage.setItem(permissionRequestKey, 'true');
      useCurrentLocation(true);
    };

    loadInitialWeather();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setLocation(searchInput.trim());
      loadWeather(searchInput.trim());
      setSearchInput('');
    }
  };

  const presetLocations = ['San Francisco, CA', 'New York, NY', 'Tokyo, Japan', 'London, UK', 'Paris, France'];

  return (
    <div className="space-y-6 text-left">
      
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <CloudSun className="w-6 h-6 text-amber-400" />
            <span>Weather Intelligence</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time conditions, 5-day forecast, and AI activity suggestions
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search city (e.g. London)..."
              className="bg-slate-950 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => useCurrentLocation(false)}
            disabled={loading}
            className="px-4 py-2 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
            Use Current Location
          </button>
        </form>
      </div>

      {/* Preset Location Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        <span className="text-xs text-slate-400 font-medium mr-1">Locations:</span>
        {presetLocations.map(loc => (
          <button
            key={loc}
            onClick={() => {
              loadWeather(loc);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              location === loc
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {loc}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-white/10 text-cyan-300 animate-pulse">
          <LoaderCircle className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading weather metrics...
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-3xl bg-slate-900/40 border border-red-400/30 text-red-200">
          {error}
        </div>
      ) : !data ? (
        <div className="p-8 text-center rounded-3xl bg-slate-900/40 border border-white/10 text-slate-300">
          Weather data is unavailable right now.
        </div>
      ) : (
        <>
          {/* Main Weather Card */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-900 border border-white/10 shadow-2xl relative overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            <div className="space-y-2">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
                {data.location}
              </span>
              <div className="text-6xl font-black text-white tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                {data.current.temp}°F
              </div>
              <p className="text-base font-bold text-slate-200">{data.current.condition}</p>
              <p className="text-xs text-slate-400">Feels like {data.current.feelsLike}°F</p>
            </div>

            {/* Weather Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs md:col-span-2">
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  <span>Humidity</span>
                </div>
                <p className="text-base font-bold text-white font-mono">{data.current.humidity}%</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Wind className="w-4 h-4 text-purple-400" />
                  <span>Wind Speed</span>
                </div>
                <p className="text-base font-bold text-white font-mono">{data.current.windSpeed}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Gauge className="w-4 h-4 text-emerald-400" />
                  <span>Pressure</span>
                </div>
                <p className="text-base font-bold text-white font-mono">{data.current.pressure}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>UV Index</span>
                </div>
                <p className="text-base font-bold text-white font-mono">{data.current.uvIndex} (Moderate)</p>
              </div>
            </div>

          </div>

          {/* AI Weather Insights Banner */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-white/10 shadow-xl flex items-start space-x-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                AI Productivity Recommendation
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {data.aiSummary}
              </p>
            </div>
          </div>

          {/* 5-Day Forecast Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              5-Day Outlook
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {data.forecast.map((f, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 text-center space-y-2 hover:border-cyan-500/40 transition-colors"
                >
                  <p className="text-xs font-bold text-white">{f.day}</p>
                  <CloudSun className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-200">{f.condition}</p>
                  <div className="text-xs font-mono text-slate-400">
                    <span className="text-white font-bold">{f.tempHigh}°</span> / {f.tempLow}°
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  );
};
