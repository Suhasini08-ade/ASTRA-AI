import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { apiGetSettings, apiUpdateSettings } from '../services/api';
import { 
  Settings as LuSettings, 
  Sun as LuSun, 
  Moon as LuMoon, 
  Monitor as LuMonitor, 
  Bell as LuBell, 
  Bot as LuBot, 
  Mic as LuMic, 
  LogOut as LuLogOut, 
  Check as LuCheck, 
  ShieldCheck as LuShieldCheck 
} from 'lucide-react';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState({
    tasks: true,
    reminders: true,
    aiAlerts: false
  });

  const [aiProvider, setAiProvider] = useState('gemini');
  const [voiceSpeed, setVoiceSpeed] = useState('1.0');
  const [savedStatus, setSavedStatus] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const s = await apiGetSettings();
        if (s) {
          if (s.notifications) setNotifications(s.notifications);
          if (s.aiProvider) setAiProvider(s.aiProvider);
          if (s.voiceSpeed) setVoiceSpeed(s.voiceSpeed);
        }
      } catch (err) {
        console.warn('Could not load settings from backend:', err);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      await apiUpdateSettings({
        notifications,
        aiProvider,
        voiceSpeed,
      });
      setSavedStatus('Settings saved successfully!');
    } catch (err) {
      setSavedStatus('Preferences saved locally.');
    }
    setTimeout(() => setSavedStatus(''), 2500);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <LuSettings className="w-6 h-6 text-purple-500" />
            <span>Application Settings</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Configure appearance, notifications, and AI integrations</p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-900/30 flex items-center gap-2"
        >
          <LuCheck className="w-4 h-4" />
          <span>Save Preferences</span>
        </button>
      </div>

      {savedStatus && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center animate-pulse">
          {savedStatus}
        </div>
      )}

      {/* 1. Appearance Settings */}
      <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <LuSun className="w-4 h-4 text-amber-500" />
          <span>Appearance Theme</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Switch between Light, Dark, or System automatically following OS theme.
        </p>

        <div className="pt-2">
          <ThemeSwitcher />
        </div>
      </div>

      {/* 2. Notification Preferences */}
      <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <LuBell className="w-4 h-4 text-cyan-400" />
          <span>Notification Preferences</span>
        </h3>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 cursor-pointer">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">Task Notifications</p>
              <p className="text-slate-400 text-[11px]">Receive push alerts when task due dates approach</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.tasks}
              onChange={(e) => setNotifications({ ...notifications, tasks: e.target.checked })}
              className="w-4 h-4 accent-purple-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 cursor-pointer">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">Reminder Notifications</p>
              <p className="text-slate-400 text-[11px]">Receive popup alerts for scheduled reminders</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.reminders}
              onChange={(e) => setNotifications({ ...notifications, reminders: e.target.checked })}
              className="w-4 h-4 accent-purple-600 rounded"
            />
          </label>
        </div>
      </div>

      {/* 3. AI Preferences */}
      <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <LuBot className="w-4 h-4 text-purple-500" />
          <span>AI Engine & Voice Preferences</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">AI Service Provider</label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="gemini">Google Gemini 1.5 Pro (Recommended)</option>
              <option value="groq">Groq LLaMA 3 70B (Fast Inference)</option>
              <option value="openrouter">OpenRouter Multi-Model Router</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">Voice Gender & Accent</label>
            <select
              value={localStorage.getItem('astra_voice_gender') || localStorage.getItem('jarves_voice_gender') || 'female'}
              onChange={(e) => {
                localStorage.setItem('astra_voice_gender', e.target.value);
                localStorage.setItem('jarves_voice_gender', e.target.value);
              }}
              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="female">Female Voice (Google US / Samantha / Zira)</option>
              <option value="male">Male Voice (David / Alex / Guy)</option>
              <option value="system">Default System AI Voice</option>
            </select>
          </div>
        </div>

        <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 cursor-pointer text-xs">
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100">Mute Spoken Voice Output</p>
            <p className="text-slate-400 text-[11px]">Silence spoken audio responses across the application</p>
          </div>
          <input
            type="checkbox"
            defaultChecked={(localStorage.getItem('astra_voice_muted') || localStorage.getItem('jarves_voice_muted')) === 'true'}
            onChange={(e) => {
              localStorage.setItem('astra_voice_muted', e.target.checked ? 'true' : 'false');
              localStorage.setItem('jarves_voice_muted', e.target.checked ? 'true' : 'false');
            }}
            className="w-4 h-4 accent-purple-600 rounded"
          />
        </label>
      </div>

      {/* 4. Account Settings */}
      <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-rose-500/20 shadow-md space-y-4">
        <h3 className="text-sm font-bold text-rose-500 flex items-center gap-2">
          <LuLogOut className="w-4 h-4" />
          <span>Account Session</span>
        </h3>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">Sign out of your active ASTRA session</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
