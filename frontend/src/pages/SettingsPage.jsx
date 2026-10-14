import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

export default function SettingsPage() {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const { showSuccess, showInfo } = useToast();

  const [aiProviders, setAiProviders] = useState([
    {
      id: 'astra-local',
      name: 'Astra FastAPI Engine',
      type: 'Primary Microservice',
      status: 'Connected',
      endpoint: 'http://localhost:8000/api',
      active: true,
    },
    {
      id: 'openai',
      name: 'OpenAI GPT-4o / O1',
      type: 'Cloud Provider',
      status: 'API Key Configured',
      endpoint: 'https://api.openai.com/v1',
      active: true,
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude 3.5 Sonnet',
      type: 'Cloud Provider',
      status: 'Ready',
      endpoint: 'https://api.anthropic.com',
      active: false,
    },
    {
      id: 'gemini',
      name: 'Google Gemini 1.5 Pro',
      type: 'Cloud Provider',
      status: 'Ready',
      endpoint: 'https://generativelanguage.googleapis.com',
      active: true,
    },
    {
      id: 'ollama',
      name: 'Ollama Local LLM (Llama 3)',
      type: 'Local Inference',
      status: 'Standby',
      endpoint: 'http://localhost:11434',
      active: false,
    },
  ]);

  const [selectedProvider, setSelectedProvider] = useState('astra-local');

  const toggleProvider = (id) => {
    setAiProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
    if (showInfo) showInfo('AI Provider status updated.');
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    if (showSuccess) showSuccess('Settings and AI provider preferences saved!');
  };

  const colorOptions = [
    { name: 'Astra Blue', hex: '#2563eb' },
    { name: 'Deep Royal', hex: '#004ac6' },
    { name: 'Violet AI', hex: '#7c3aed' },
    { name: 'Emerald', hex: '#059669' },
    { name: 'Crimson', hex: '#dc2626' },
  ];

  return (
    <div className="max-w-4xl mx-auto pt-2 pb-12 space-y-8">
      <div>
        <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl">settings</span>
          Settings & Appearance
        </h2>
        <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
          Customize your Astra OS visual theme, AI Provider connections, and system defaults
        </p>
      </div>

      {/* 1. Theme & Appearance Section */}
      <section className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">palette</span>
          Appearance & Theme Controls
        </h3>

        <div className="space-y-6">
          {/* Mode Switcher: Light / Dark / System */}
          <div>
            <label className="font-label text-sm font-semibold text-on-surface dark:text-slate-200 block mb-2">
              Color Mode Preference
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
              <button
                onClick={() => setTheme('light')}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  theme === 'light'
                    ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm'
                    : 'border-outline-variant/40 dark:border-slate-700 text-on-surface-variant'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">light_mode</span>
                  <span className="text-xs">Light</span>
                </div>
                {theme === 'light' && <span className="material-symbols-outlined text-sm">check_circle</span>}
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm'
                    : 'border-outline-variant/40 dark:border-slate-700 text-on-surface-variant'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">dark_mode</span>
                  <span className="text-xs">Dark</span>
                </div>
                {theme === 'dark' && <span className="material-symbols-outlined text-sm">check_circle</span>}
              </button>

              <button
                onClick={() => setTheme('system')}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  theme === 'system'
                    ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm'
                    : 'border-outline-variant/40 dark:border-slate-700 text-on-surface-variant'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">brightness_auto</span>
                  <span className="text-xs">System</span>
                </div>
                {theme === 'system' && <span className="material-symbols-outlined text-sm">check_circle</span>}
              </button>
            </div>
          </div>

          {/* Accent Color Palette */}
          <div>
            <label className="font-label text-sm font-semibold text-on-surface dark:text-slate-200 block mb-2">
              Primary Accent Color
            </label>
            <div className="flex items-center gap-4">
              {colorOptions.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setAccentColor(c.hex)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${
                    accentColor === c.hex ? 'scale-110 ring-4 ring-offset-2 ring-primary' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {accentColor === c.hex && (
                    <span className="material-symbols-outlined text-white text-lg font-bold">check</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. AI Provider Section (Feature #17) */}
      <section className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">hub</span>
              AI Provider Configuration
            </h3>
            <p className="text-xs text-on-surface-variant dark:text-slate-400">
              Manage LLM backends, API credentials, and local inference models
            </p>
          </div>

          <button
            onClick={() => showInfo && showInfo('All AI Provider API endpoints operating normally.')}
            className="px-3 py-1.5 bg-surface-container-low dark:bg-slate-700 text-primary dark:text-blue-300 text-xs font-semibold rounded-xl hover:bg-surface-container-high transition-colors"
          >
            Check Status
          </button>
        </div>

        <div className="space-y-3">
          {aiProviders.map((provider) => (
            <div
              key={provider.id}
              className="p-4 rounded-xl border border-outline-variant/30 dark:border-slate-700 bg-surface-container-low/40 dark:bg-slate-700/30 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">smart_toy</span>
                </div>
                <div>
                  <h4 className="font-headline text-sm font-bold text-on-surface dark:text-slate-100">
                    {provider.name}
                  </h4>
                  <p className="text-[11px] text-on-surface-variant dark:text-slate-400">
                    {provider.type} • Endpoint: {provider.endpoint}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    provider.active
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {provider.status}
                </span>
                <input
                  type="checkbox"
                  checked={provider.active}
                  onChange={() => toggleProvider(provider.id)}
                  className="w-5 h-5 rounded accent-primary cursor-pointer"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. AI Intelligence Defaults */}
      <section className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <h3 className="font-headline text-lg font-bold text-on-surface dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">psychology</span>
          AI Model Defaults & Voice Settings
        </h3>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-outline-variant/30 dark:border-slate-700">
            <div>
              <p className="font-label text-sm font-semibold text-on-surface dark:text-slate-200">
                Default LLM Engine
              </p>
              <p className="text-xs text-on-surface-variant dark:text-slate-400">
                Primary model used for dashboard prompts and command center queries
              </p>
            </div>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs text-on-surface dark:text-slate-200"
            >
              <option value="astra-local">Astra 3.6 Pro (FastAPI Local)</option>
              <option value="openai">OpenAI GPT-4o</option>
              <option value="gemini">Google Gemini 1.5 Pro</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-label text-sm font-semibold text-on-surface dark:text-slate-200">
                Voice Input Auto-Transcript
              </p>
              <p className="text-xs text-on-surface-variant dark:text-slate-400">
                Automatically convert voice recordings to formatted notes
              </p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded accent-primary cursor-pointer" />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-95"
            >
              Save All Preferences
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
