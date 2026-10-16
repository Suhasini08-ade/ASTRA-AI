"""
test_weather_e2e.py
===================
End-to-end integration and verification suite testing ASTRA AI Weather:
1. Manual city search (e.g. London, Paris)
2. Geolocation coordinates (lat, lon) query
3. Invalid city error handling (404 City not found)
4. Default location retrieval
"""

import unittest
from fastapi.testclient import TestClient

from backend.main import app


class WeatherE2ETests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_manual_city_weather(self):
        """Verify fetching weather for a manual city search."""
        res = self.client.get("/api/weather?location=London")
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIn("location", data)
        self.assertIn("London", data["location"])
        self.assertIn("current", data)
        self.assertIn("temp", data["current"])
        self.assertIn("condition", data["current"])
        self.assertIn("humidity", data["current"])
        self.assertIn("windSpeed", data["current"])
        self.assertIn("forecast", data)
        self.assertIsInstance(data["forecast"], list)
        self.assertGreaterEqual(len(data["forecast"]), 1)

    def test_02_coordinates_weather(self):
        """Verify fetching weather using geolocation coordinates (lat, lon)."""
        # New York coordinates: 40.7128, -74.0060
        res = self.client.get("/api/weather?lat=40.7128&lon=-74.0060")
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIn("location", data)
        self.assertIn("New York", data["location"])
        self.assertIn("current", data)
        self.assertIsInstance(data["current"]["temp"], (int, float))

    def test_03_coordinates_in_location_string(self):
        """Verify fetching weather with 'lat,lon' passed in location parameter."""
        res = self.client.get("/api/weather?location=48.8566,2.3522") # Paris
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIn("location", data)
        self.assertIn("Paris", data["location"])

    def test_04_invalid_city_returns_404(self):
        """Verify that an invalid city returns 404 without mock fallback."""
        res = self.client.get("/api/weather?location=NonExistentCityXYZ123456789")
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertIn("detail", data)
        self.assertIn("not found", data["detail"].lower())

    def test_05_default_city_weather(self):
        """Verify that omitting parameters returns valid default weather."""
        res = self.client.get("/api/weather")
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIn("current", data)
        self.assertIn("temp", data["current"])


if __name__ == "__main__":
    unittest.main()
