import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { apiGetWeather } from '../services/api';

// Geolocation states
const GEO_STATE = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  DETECTING: 'detecting',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  SUCCESS: 'success',
  ERROR: 'error',
};

async function reverseGeocode(lat, lon) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { 'Accept-Language': 'en' } }
  );
  if (!res.ok) throw new Error('Reverse geocoding failed');
  const data = await res.json();
  // Try city > town > village > county as fallback
  const city =
    data.address?.city ||
    data.address?.town ||
    data.address?.village ||
    data.address?.county ||
    data.address?.state ||
    null;
  if (!city) throw new Error('Could not determine city from coordinates');
  return city;
}

const DEFAULT_WEATHER = {
  temp: 25,
  condition: 'Clear',
  high: 28,
  low: 20,
  humidity: '50%',
  wind: '5 m/s',
  uvIndex: '5 (Moderate)',
  airQuality: 'Good',
  aiSummary: 'Live weather service connected via FastAPI backend.',
  forecast: [
    { day: 'Today', temp: '28° / 20°', condition: 'sunny', text: 'Clear' },
    { day: 'Wed', temp: '29° / 21°', condition: 'sunny', text: 'Sunny' },
    { day: 'Thu', temp: '27° / 19°', condition: 'cloud', text: 'Cloudy' },
    { day: 'Fri', temp: '26° / 18°', condition: 'rainy', text: 'Light Rain' },
    { day: 'Sat', temp: '28° / 20°', condition: 'partly_cloudy_day', text: 'Partly Cloudy' },
  ],
};

const cityPresets = ['Mumbai', 'Delhi', 'Bengaluru', 'San Francisco', 'London', 'Tokyo'];

export default function WeatherPage() {
  const { showError, showSuccess } = useToast();

  const [geoState, setGeoState] = useState(GEO_STATE.IDLE);
  const [geoError, setGeoError] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [activeCity, setActiveCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(DEFAULT_WEATHER);

  // Track if we've already asked once this session (don't re-ask on re-mount)
  const hasRequestedRef = useRef(false);

  // ─── Fetch weather from existing backend ────────────────────────────────────
  const fetchWeather = useCallback(
    async (targetCity) => {
      setLoading(true);
      setActiveCity(targetCity);
      try {
        const data = await apiGetWeather(targetCity);
        if (data && data.current) {
          const cur = data.current;
          setWeatherData({
            temp: cur.temp ?? 25,
            condition: cur.condition || 'Clear',
            high: cur.high ?? 28,
            low: cur.low ?? 20,
            humidity: cur.humidity ? `${cur.humidity}%` : '50%',
            wind: cur.windSpeed || '5 m/s',
            uvIndex: cur.uvIndex ? `${cur.uvIndex} (UV)` : '5 (Moderate)',
            airQuality: cur.airQuality || 'Good',
            aiSummary: data.aiSummary || `Current weather in ${data.location || targetCity}`,
            forecast: (data.forecast || []).map((f) => ({
              day: f.day || 'Upcoming',
              temp: `${f.tempHigh}° / ${f.tempLow}°`,
              condition:
                f.icon && (f.icon.includes('rain') || f.icon === 'rain')
                  ? 'rainy'
                  : f.icon && f.icon.includes('cloud')
                  ? 'cloud'
                  : 'sunny',
              text: f.condition || 'Clear',
            })),
          });
          if (showSuccess) showSuccess(`Weather updated for ${data.location || targetCity}`);
        }
      } catch (e) {
        if (showError) showError(`Weather error for ${targetCity}: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [showError, showSuccess]
  );

  // ─── Geolocation → reverse geocode → fetch weather ──────────────────────────
  const detectAndFetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState(GEO_STATE.UNAVAILABLE);
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoState(GEO_STATE.REQUESTING);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setGeoState(GEO_STATE.DETECTING);
        const { latitude, longitude } = position.coords;
        try {
          const city = await reverseGeocode(latitude, longitude);
          setGeoState(GEO_STATE.SUCCESS);
          setCityInput(city);
          fetchWeather(city);
        } catch (e) {
          setGeoState(GEO_STATE.ERROR);
          setGeoError('Could not determine your city. Try searching manually.');
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoState(GEO_STATE.DENIED);
          setGeoError('Location access was denied. Search for a city to view its weather.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoState(GEO_STATE.UNAVAILABLE);
          setGeoError('Your location is currently unavailable. Search for a city instead.');
        } else if (err.code === err.TIMEOUT) {
          setGeoState(GEO_STATE.ERROR);
          setGeoError('Location request timed out. Search for a city instead.');
        } else {
          setGeoState(GEO_STATE.ERROR);
          setGeoError('Location error. Search for a city instead.');
        }
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, [fetchWeather]);

  // ─── On mount: ask once ─────────────────────────────────────────────────────
  useEffect(() => {
    if (hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    // Check if permission was already granted/denied via Permissions API
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          detectAndFetchLocation();
        } else if (result.state === 'denied') {
          setGeoState(GEO_STATE.DENIED);
          setGeoError('Location access was denied. Search for a city to view its weather.');
        } else {
          // 'prompt' — show the permission request UI
          setGeoState(GEO_STATE.IDLE);
        }
      });
    } else {
      // Permissions API not available — show request UI
      setGeoState(GEO_STATE.IDLE);
    }
  }, [detectAndFetchLocation]);

  // ─── Manual city search ──────────────────────────────────────────────────────
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (cityInput.trim()) {
      setGeoState(GEO_STATE.SUCCESS); // hide permission/error UI after manual search
      fetchWeather(cityInput.trim());
    }
  };

  // ─── UI States ───────────────────────────────────────────────────────────────
  const isPermissionPending = geoState === GEO_STATE.IDLE;
  const isRequesting = geoState === GEO_STATE.REQUESTING;
  const isDetecting = geoState === GEO_STATE.DETECTING;
  const isDenied = geoState === GEO_STATE.DENIED || geoState === GEO_STATE.UNAVAILABLE || geoState === GEO_STATE.ERROR;
  const showWeather = geoState === GEO_STATE.SUCCESS && !loading && activeCity;

  return (
    <div className="max-w-5xl mx-auto pt-2 pb-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">cloud</span>
            Astra Weather Intelligence
          </h2>
          <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
            Connected to Python FastAPI microservice engine
          </p>
        </div>

        {/* City Search Form — always visible */}
        <form onSubmit={handleSearchSubmit} className="relative w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="Search city (e.g. Mumbai)..."
            className="w-full pl-9 pr-16 py-2 bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-xl text-sm text-on-surface dark:text-slate-200 focus:outline-none focus:border-primary shadow-sm"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Quick City Pills + Use Current Location */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-on-surface-variant dark:text-slate-400 mr-1">
          Quick Select:
        </span>
        {cityPresets.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setCityInput(preset);
              setGeoState(GEO_STATE.SUCCESS);
              fetchWeather(preset);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              activeCity === preset
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface dark:bg-slate-800 text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high'
            }`}
          >
            {preset}
          </button>
        ))}
        {/* Use Current Location button */}
        <button
          onClick={detectAndFetchLocation}
          disabled={isRequesting || isDetecting}
          className="ml-1 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-primary/40 text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">my_location</span>
          Use Current Location
        </button>
      </div>

      {/* ── LOCATION PERMISSION REQUEST UI ─────────────────────────────────────── */}
      {isPermissionPending && (
        <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-4xl">location_on</span>
          </div>
          <h3 className="font-headline text-xl font-bold text-on-surface dark:text-slate-100 mb-2">
            Allow Location Access
          </h3>
          <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 max-w-sm mx-auto mb-7 leading-relaxed">
            Allow location access to show weather for your current location.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={detectAndFetchLocation}
              className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">near_me</span>
              Allow &amp; Detect Location
            </button>
            <button
              onClick={() => {
                setGeoState(GEO_STATE.DENIED);
                setGeoError('Location access was denied. Search for a city to view its weather.');
              }}
              className="px-5 py-2.5 bg-surface-container-high dark:bg-slate-700 text-on-surface-variant dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-surface-container-highest transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* ── REQUESTING / DETECTING SPINNERS ────────────────────────────────────── */}
      {(isRequesting || isDetecting) && (
        <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-4xl animate-spin">sync</span>
          </div>
          <h3 className="font-headline text-xl font-bold text-on-surface dark:text-slate-100 mb-2">
            {isRequesting ? 'Requesting Location…' : 'Detecting Location…'}
          </h3>
          <p className="font-body text-sm text-on-surface-variant dark:text-slate-400">
            {isRequesting
              ? 'Waiting for your browser permission…'
              : 'Converting coordinates to city name…'}
          </p>
        </div>
      )}

      {/* ── DENIED / UNAVAILABLE / ERROR MESSAGE ──────────────────────────────── */}
      {isDenied && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">location_off</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {geoError || 'Location unavailable.'}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              You can still search for any city using the search bar above, or click{' '}
              <button
                onClick={detectAndFetchLocation}
                className="underline font-semibold hover:text-amber-800"
              >
                Use Current Location
              </button>{' '}
              to try again.
            </p>
          </div>
        </div>
      )}

      {/* ── LOADING WEATHER ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl flex items-center justify-center gap-3 min-h-[220px]">
          <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
          <div>
            <p className="font-headline text-lg font-bold">Loading Weather…</p>
            <p className="text-blue-200 text-sm mt-1">Fetching live data for {activeCity || 'your location'}</p>
          </div>
        </div>
      )}

      {/* ── MAIN WEATHER CARD ─────────────────────────────────────────────────── */}
      {!loading && activeCity && (
        <>
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-6 -bottom-6 opacity-20 pointer-events-none">
              <span className="material-symbols-outlined text-[240px]">partly_cloudy_day</span>
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="font-label text-xs uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full font-semibold">
                  Live FastAPI Weather Service
                </span>
                {geoState === GEO_STATE.SUCCESS && (
                  <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">near_me</span>
                    Auto-detected location
                  </span>
                )}
              </div>

              <h3 className="font-headline text-4xl font-extrabold mt-4">{activeCity}</h3>
              <p className="font-body text-blue-100 mt-1">{weatherData.condition}</p>

              <div className="flex items-center gap-6 my-6">
                <span className="font-display text-7xl font-extrabold">{weatherData.temp}°</span>
                <div>
                  <p className="text-sm font-semibold">
                    High: {weatherData.high}° / Low: {weatherData.low}°
                  </p>
                  <p className="text-xs text-blue-100 mt-1">{weatherData.aiSummary}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/20">
                <div>
                  <p className="text-xs text-blue-200">Humidity</p>
                  <p className="text-lg font-bold">{weatherData.humidity}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-200">Wind Speed</p>
                  <p className="text-lg font-bold">{weatherData.wind}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-200">UV Index</p>
                  <p className="text-lg font-bold">{weatherData.uvIndex}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-200">Air Quality</p>
                  <p className="text-lg font-bold">{weatherData.airQuality}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast */}
          <h4 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100">
            Forecast Outlook
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {weatherData.forecast.map((f, idx) => (
              <div
                key={idx}
                className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="font-label text-xs font-semibold text-on-surface-variant dark:text-slate-400">
                  {f.day}
                </p>
                <span className="material-symbols-outlined text-3xl text-primary dark:text-blue-400 my-2">
                  {f.condition}
                </span>
                <p className="font-label text-sm font-bold text-on-surface dark:text-slate-100">
                  {f.temp}
                </p>
                <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-1">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
