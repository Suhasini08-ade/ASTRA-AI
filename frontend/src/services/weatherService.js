// Comprehensive Weather Service connecting to live FastAPI & OpenWeatherMap backend
import { apiGetWeather } from './api';

export function classifySeason(condition = '', temp = 25) {
  const c = (condition || '').toLowerCase();
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) {
    return { season: 'rain', label: 'Monsoon / Rainy Season' };
  }
  if (c.includes('thunder') || c.includes('lightning') || c.includes('storm')) {
    return { season: 'thunderstorm', label: 'Thunderstorm Season' };
  }
  if (c.includes('snow') || c.includes('blizzard') || c.includes('ice') || c.includes('freeze') || temp <= 2) {
    return { season: 'snow', label: 'Winter / Snow Season' };
  }
  if (c.includes('cloud') || c.includes('overcast') || c.includes('fog') || c.includes('mist') || c.includes('haze')) {
    return { season: 'cloudy', label: 'Overcast / Cloudy Season' };
  }
  if (c.includes('sakura') || c.includes('blossom') || (temp >= 18 && temp <= 22 && c.includes('clear'))) {
    return { season: 'spring', label: 'Spring / Blossom Season' };
  }
  if (c.includes('wind') || c.includes('autumn') || c.includes('foliage') || (temp >= 14 && temp <= 18)) {
    return { season: 'autumn', label: 'Autumn / Fall Season' };
  }
  return { season: 'sunny', label: 'Summer / Sunny Season' };
}

/**
 * Fetch live weather and forecast from backend /api/weather.
 * Supports both:
 * 1. City search string (e.g. 'London', 'Tokyo, Japan', 'New York')
 * 2. Geolocation coordinates (lat, lon)
 */
export async function fetchWeather(locationOrCoords = 'Kolhapur', lat = null, lon = null) {
  let location = null;
  let targetLat = lat;
  let targetLon = lon;

  if (typeof locationOrCoords === 'object' && locationOrCoords !== null) {
    targetLat = locationOrCoords.lat ?? locationOrCoords.latitude;
    targetLon = locationOrCoords.lon ?? locationOrCoords.longitude;
    location = locationOrCoords.location || null;
  } else if (typeof locationOrCoords === 'string') {
    // Check if string is a "lat,lon" coordinate pair
    const coordMatch = locationOrCoords.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      targetLat = parseFloat(coordMatch[1]);
      targetLon = parseFloat(coordMatch[2]);
    } else {
      location = locationOrCoords.trim();
    }
  }

  try {
    const data = await apiGetWeather(location, targetLat, targetLon);

    if (!data || !data.current) {
      throw new Error(`Weather data is currently unavailable for ${location || 'the specified coordinates'}.`);
    }

    const current = data.current;
    const { season, label } = classifySeason(current.condition, current.temp);

    const forecastList = (data.forecast || []).map((f) => {
      const fSeason = classifySeason(f.condition, f.tempHigh || f.temp).season;
      return {
        day: f.day || 'Day',
        date: f.date || '',
        temp: f.tempHigh ?? f.temp ?? current.temp ?? 25,
        tempHigh: f.tempHigh ?? ((current.temp ?? 25) + 3),
        tempLow: f.tempLow ?? ((current.temp ?? 25) - 3),
        condition: f.condition || 'Clear',
        icon: f.icon || 'sunny',
        season: fSeason,
        pop: f.pop || '10%',
      };
    });

    return {
      location: data.location || location || 'Detected Location',
      temperature: current.temp ?? 25,
      condition: current.condition || 'Clear',
      season,
      seasonLabel: label,
      high: current.high ?? ((current.temp ?? 25) + 3),
      low: current.low ?? ((current.temp ?? 25) - 3),
      humidity: current.humidity ?? 60,
      windSpeed: typeof current.windSpeed === 'string' ? parseFloat(current.windSpeed) || 12 : current.windSpeed || 12,
      pressure: current.pressure || '1013 hPa',
      uvIndex: current.uvIndex ?? 5,
      airQuality: current.airQuality || 'Good',
      sunrise: current.sunrise || '06:00 AM',
      sunset: current.sunset || '06:30 PM',
      feelsLike: current.feelsLike ?? current.temp ?? 25,
      icon: current.icon || 'sunny',
      description: data.aiSummary || `Live conditions for ${data.location || location || 'your area'}: ${current.condition || 'clear skies'}.`,
      forecast: forecastList.length > 0 ? forecastList : [
        { day: 'Today', temp: current.temp || 25, condition: current.condition || 'Clear', icon: current.icon || 'sunny', season },
      ],
    };
  } catch (err) {
    // Transform backend/network error into clean user-facing message
    const rawMsg = err?.data?.detail || err?.message || '';
    if (rawMsg.includes('not found') || err?.status === 404) {
      const targetName = location || (targetLat && targetLon ? `${targetLat}, ${targetLon}` : 'Location');
      throw new Error(`Location "${targetName}" was not found. Please verify the city name or spelling.`);
    }
    if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError') || rawMsg.includes('connect')) {
      throw new Error('Unable to connect to weather service. Please check your internet connection.');
    }
    throw new Error(rawMsg || 'Failed to retrieve live weather data. Please try again.');
  }
}

export const POPULAR_CITIES = [
  { name: 'Kolhapur', icon: '🌧️' },
  { name: 'Mumbai', icon: '🌧️' },
  { name: 'Delhi', icon: '☀️' },
  { name: 'London', icon: '🌧️' },
  { name: 'New York', icon: '🍂' },
  { name: 'Tokyo', icon: '🌸' },
  { name: 'Dubai', icon: '☀️' },
  { name: 'Paris', icon: '⛅' },
  { name: 'Sydney', icon: '☀️' },
  { name: 'Singapore', icon: '⚡' }
];

export const SEASON_PRESETS = [
  { id: 'auto', name: 'Auto (Weather Driven)', icon: '🔄', description: 'Match searched city weather' },
  { id: 'sunny', name: 'Sunny (Sunrays)', icon: '☀️', description: 'Radiant golden beams & warm lens flares' },
  { id: 'rain', name: 'Rainy (Raindrops)', icon: '🌧️', description: 'Slanted rain with ripple splashes & mist' },
  { id: 'thunderstorm', name: 'Thunderstorm', icon: '⚡', description: 'Driving downpours & electric lightning flashes' },
  { id: 'snow', name: 'Winter (Snow)', icon: '❄️', description: 'Gently tumbling crystal snowflakes & frost' },
  { id: 'autumn', name: 'Autumn (Leaves)', icon: '🍂', description: 'Whirling maple & golden amber leaves' },
  { id: 'spring', name: 'Spring (Sakura)', icon: '🌸', description: 'Drifting cherry blossom sakura petals' },
  { id: 'cloudy', name: 'Cloudy (Mist)', icon: '☁️', description: 'Volumetric rolling clouds & atmospheric haze' }
];
