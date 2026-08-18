# Jarvis — AI Voice Assistant

A modular, production-quality AI voice assistant inspired by Iron Man's Jarvis, built with Python 3.12.

## Features

- **Wake Word**: Continuous background listening for "Jarvis" (Picovoice Porcupine).
- **Speech Recognition**: English speech-to-text with graceful error handling.
- **Text-to-Speech**: Offline TTS with adjustable rate and male-voice preference.
- **AI Chat**: GPT-powered conversation with session memory (OpenAI API).
- **Desktop Automation**: Open/close apps, search Google/YouTube/Wikipedia, open websites/folders/files.
- **System Control**: Shutdown, restart, sleep, lock, volume, brightness, battery, CPU, RAM, disk.
- **Browser Automation**: Selenium-driven multi-tab Chrome control, page title reading.
- **Media Control**: Play/pause/resume/next/previous track.
- **Weather**: Current conditions, temperature, humidity, wind speed.
- **Time & Date**: Current time, date, and day of week.
- **Notes**: Create, read, delete text notes.
- **Calculator**: Safe expression evaluation and unit conversions.
- **Email**: Send emails and read unread messages.
- **Reminders & Alarms**: Scheduled notifications, multiple alarms supported.
- **News**: Latest top headlines.
- **Translation**: Translate text between languages.
- **Screenshot & Camera**: Auto-saved screenshots, photo/video capture.
- **File Management**: Create folders, rename/delete/move files.
- **Internet**: Connectivity check and speed test.
- **GUI**: Modern dark theme, animated mic indicator, chat history, start/stop control.

## Project Structure

```
Jarvis/
├── main.py                 # CLI entry point
├── assistant.py            # Main orchestrator class
├── config.py                # Configuration loader (.env + settings.json)
├── settings.json            # User-tunable preferences
├── requirements.txt
├── .env.example              # Copy to .env and fill in your keys
├── core/
│   ├── speech.py             # Speech-to-text
│   ├── listener.py           # Background listening loop
│   ├── speaker.py            # Text-to-speech
│   ├── ai.py                 # OpenAI GPT chat
│   ├── commands.py           # Command router
│   ├── wakeword.py           # Wake word detection
│   ├── weather.py, news.py, translator.py, notes.py,
│   ├── calculator.py, email_client.py, scheduler.py,
│   ├── capture.py, internet.py, datetime_service.py
├── automation/
│   ├── browser.py, system.py, files.py, media.py, apps.py
├── utils/
│   ├── logger.py, helpers.py, constants.py
├── gui/
│   └── app.py                # Dark-themed GUI
└── data/
    ├── notes/, logs/, reminders/, captures/
```

## Setup

### 1. Create and activate a virtual environment

```bash
python3.12 -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

**Windows note**: If `PyAudio` fails to install, download the matching prebuilt wheel from
[Christoph Gohlke's collection](https://www.lfd.uci.edu/~gohlke/pythonlibs/#pyaudio) or use:
```bash
pip install pipwin
pipwin install pyaudio
```

### 3. Configure secrets

```bash
cp .env.example .env
```

Then fill in `.env` with your real keys:
- **OpenAI**: https://platform.openai.com/api-keys
- **Picovoice** (wake word): https://console.picovoice.ai/ (free tier available)
- **OpenWeatherMap**: https://openweathermap.org/api
- **NewsAPI**: https://newsapi.org/
- **Gmail App Password** (for email): https://myaccount.google.com/apppasswords

Never commit `.env` — it's already excluded via `.gitignore`.

### 4. Run

Before running the application, make sure to activate your virtual environment:

**Windows:**
```powershell
.\venv\Scripts\Activate.ps1
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

**CLI mode:**
```bash
python main.py
```

**GUI mode:**
```bash
python gui/app.py
```

Say **"Jarvis"**, wait for the listening indicator, then speak your command — e.g.
*"Jarvis, what's the weather in London?"* or *"Jarvis, open Chrome."*

Say **"exit"**, **"quit"**, or **"goodbye Jarvis"** to stop the session.

## Git

```bash
git init
git add .
git commit -m "Initial Jarvis assistant project"
```

The `.gitignore` already excludes `.env`, virtual environments, logs, and generated notes/reminders.

## Extending

- Add new apps to `automation/apps.py`'s `_APP_COMMANDS` / `_APP_PROCESS_NAMES` dictionaries.
- Add new voice command patterns in `core/commands.py`'s `_route()` method.
- Tune TTS rate, wake word, and other preferences in `settings.json`.

## Troubleshooting

| Issue | Fix |
|---|---|
| No wake word detection | Check `PICOVOICE_ACCESS_KEY` in `.env` |
| No microphone found | Ensure a mic is connected and OS permissions allow access |
| AI Chat returns error | Check `OPENAI_API_KEY` and account billing/quota |
| Volume control fails (Windows) | Ensure `pycaw` and `comtypes` installed correctly |
| Selenium browser automation fails | Ensure Google Chrome is installed; `webdriver-manager` handles the driver automatically |
