"""
services/weather_service.py
===========================
Weather service using OpenWeatherMap API.
Refactored from core/weather.py — now async (httpx) and returns structured JSON.
"""

import httpx
import re

from backend.config import get_settings

_BASE_URL = "https://api.openweathermap.org/data/2.5"


def _clean_city_name(city: str) -> str:
    """
    Normalize a city name for use with the OpenWeatherMap API.

    OWM's `q` parameter does not accept US-style "City, ST" strings —
    passing "San Francisco, CA" returns 404. This strips the state/country
    code suffix so only the bare city name is sent.

    Examples:
        "San Francisco, CA"  ->  "San Francisco"
        "New York, NY"       ->  "New York"
        "London"             ->  "London"  (unchanged)
    """
    # Remove trailing ", XX" (comma + up to 3 uppercase letters)
    return re.sub(r",\s*[A-Z]{1,3}$", "", city.strip()).strip()


def _location_params(location: str, api_key: str) -> dict:
    """Return OpenWeatherMap query parameters for a city or ``lat,lon`` pair."""
    coordinates = re.fullmatch(
        r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*", location
    )
    if coordinates:
        return {
            "lat": coordinates.group(1),
            "lon": coordinates.group(2),
            "appid": api_key,
            "units": "metric",
        }

    return {
        "q": _clean_city_name(location),
        "appid": api_key,
        "units": "metric",
    }


class WeatherService:
    """Retrieves current weather and forecast data."""

    async def get_current_weather(self, city: str | None = None) -> dict:
        """
        Fetch current weather for a city.

        :param city: City name. Falls back to DEFAULT_CITY from settings.
        :return: Structured weather data dictionary.
        """
        settings = get_settings()

        if not settings.OPENWEATHER_API_KEY:
            return {"error": "Weather API key not configured."}

        target_city = city or settings.DEFAULT_CITY
        params = _location_params(target_city, settings.OPENWEATHER_API_KEY)

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{_BASE_URL}/weather", params=params)

            if response.status_code != 200:
                return {"error": f"Could not find weather data for '{target_city}'."}

            data = response.json()
            return {
                "city": data.get("name", target_city),
                "country": data.get("sys", {}).get("country", ""),
                "description": data["weather"][0]["description"],
                "icon": data["weather"][0]["icon"],
                "temperature": data["main"]["temp"],
                "feels_like": data["main"]["feels_like"],
                "temp_min": data["main"]["temp_min"],
                "temp_max": data["main"]["temp_max"],
                "humidity": data["main"]["humidity"],
                "pressure": data["main"]["pressure"],
                "wind_speed": data["wind"]["speed"],
                "visibility": data.get("visibility", 0),
            }

    async def get_forecast(self, city: str | None = None) -> dict:
        """
        Fetch 5-day / 3-hour forecast for a city.

        :param city: City name. Falls back to DEFAULT_CITY from settings.
        :return: Structured forecast data dictionary.
        """
        settings = get_settings()

        if not settings.OPENWEATHER_API_KEY:
            return {"error": "Weather API key not configured."}

        target_city = city or settings.DEFAULT_CITY
        params = _location_params(target_city, settings.OPENWEATHER_API_KEY)

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{_BASE_URL}/forecast", params=params)

            if response.status_code != 200:
                return {"error": f"Could not find forecast data for '{target_city}'."}

            data = response.json()
            forecasts = []
            for item in data.get("list", []):
                forecasts.append({
                    "datetime": item["dt_txt"],
                    "temperature": item["main"]["temp"],
                    "feels_like": item["main"]["feels_like"],
                    "description": item["weather"][0]["description"],
                    "icon": item["weather"][0]["icon"],
                    "humidity": item["main"]["humidity"],
                    "wind_speed": item["wind"]["speed"],
                })

            return {
                "city": data.get("city", {}).get("name", target_city),
                "country": data.get("city", {}).get("country", ""),
                "forecasts": forecasts,
            }


# Module-level singleton
weather_service = WeatherService()
