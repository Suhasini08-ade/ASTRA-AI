"""
routes/weather.py
=================
Weather endpoints retrieving data via weather_service.
"""

from fastapi import APIRouter, HTTPException, Query
from backend.services.weather_service import weather_service
from collections import defaultdict
from datetime import date as _date

router = APIRouter(prefix="/api/weather", tags=["Weather"])


def _pick_representative(entries: list) -> dict:
    """Return the noon entry for a day, or the entry with the highest temperature."""
    for entry in entries:
        if "12:00:00" in entry.get("datetime", ""):
            return entry
    return max(entries, key=lambda e: e.get("temperature", 0))


def _day_label(date_str: str) -> str:
    """Convert 'YYYY-MM-DD' to a human-readable day label."""
    try:
        d = _date.fromisoformat(date_str)
        today = _date.today()
        delta = (d - today).days
        if delta == 0:
            return "Today"
        if delta == 1:
            return "Tomorrow"
        return d.strftime("%a %d")   # e.g. "Wed 28"
    except Exception:
        return date_str


def _group_forecast_by_day(raw_forecasts: list) -> list:
    """
    Group 3-hour OWM forecast entries by calendar date.
    Returns up to 5 unique days, each represented by one entry,
    sorted chronologically.
    """
    daily_buckets: dict[str, list] = defaultdict(list)

    for item in raw_forecasts:
        dt_txt = item.get("datetime", "")
        # dt_txt format: "YYYY-MM-DD HH:MM:SS"
        date_key = dt_txt[:10] if dt_txt else ""
        if date_key:
            daily_buckets[date_key].append(item)

    sorted_dates = sorted(daily_buckets.keys())[:5]

    result = []
    for date_key in sorted_dates:
        rep = _pick_representative(daily_buckets[date_key])
        result.append({
            "day": _day_label(date_key),
            "date": date_key,
            "tempHigh": round(rep.get("temperature", 25)),
            "tempLow": round(rep.get("temperature", 20) - 3),
            "condition": rep.get("description", "Clear").title(),
            "icon": rep.get("icon", "sunny"),
            "pop": "10%",
        })
    return result


@router.get("")
async def get_weather(
    location: str | None = Query(default=None),
    lat: float | None = Query(default=None),
    lon: float | None = Query(default=None),
):
    """Get current weather and 5-day forecast for a location (city name or lat,lon coordinates)."""
    if lat is not None and lon is not None:
        target = f"{lat},{lon}"
    elif location and location.strip():
        target = location.strip()
    else:
        target = "Kolhapur"

    current = await weather_service.get_current_weather(city=target)
    forecast = await weather_service.get_forecast(city=target)

    if "error" in current:
        err = current["error"]
        if "Could not find weather data" in err or "not found" in err.lower():
            raise HTTPException(status_code=404, detail=f"Location '{target}' not found. Please verify the city name or coordinates.")
        raise HTTPException(status_code=502, detail=err)

    # ── Group 3-hour intervals into one entry per calendar day ───────────────
    daily_forecast = _group_forecast_by_day(forecast.get("forecasts", []))

    if not daily_forecast:
        # Fallback: single today card using current weather
        daily_forecast = [{
            "day": "Today",
            "date": str(_date.today()),
            "tempHigh": round(current.get("temp_max", current.get("temperature", 25))),
            "tempLow": round(current.get("temp_min", current.get("temperature", 20))),
            "condition": current.get("description", "Clear").title(),
            "icon": current.get("icon", "01d"),
            "pop": "0%",
        }]

    return {
        "location": ", ".join(filter(None, [current.get("city", target), current.get("country", "")])),
        "current": {
            "temp": round(current.get("temperature", 25)),
            "condition": current.get("description", "Clear").title(),
            "icon": current.get("icon", "01d"),
            "high": round(current.get("temp_max", current.get("temperature", 28))),
            "low": round(current.get("temp_min", current.get("temperature", 20))),
            "humidity": current.get("humidity", 50),
            "windSpeed": f"{current.get('wind_speed', 5)} m/s",
            "pressure": f"{current.get('pressure', 1013)} hPa",
            "uvIndex": 5,
            "airQuality": "Good",
            "sunrise": "06:00 AM",
            "sunset": "06:30 PM",
            "feelsLike": round(current.get("feels_like", current.get("temperature", 25)))
        },
        "forecast": daily_forecast,
        "aiSummary": f"Current weather in {current.get('city', target)}: {current.get('description', 'Clear')} with temperature around {round(current.get('temperature', 25))}°C."
    }
