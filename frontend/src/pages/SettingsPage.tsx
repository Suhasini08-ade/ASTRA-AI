import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Palette, 
  Bell, 
  ShieldCheck, 
  Mic, 
  Sparkles, 
  Check, 
  CheckCircle2, 
  Moon, 
  Sun, 
  Monitor, 
  Lock, 
  Save, 
  RotateCcw,
  Sliders,
  Volume2,
  LockKeyhole
} from 'lucide-react';
import { AppSettings, AccentColor, FontSize, DashboardLayoutType, AiResponseStyle } from '../types';

interface SettingsPageProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'notifications' | 'privacy' | 'ai'>('appearance');
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...formData, [key]: value };
    setFormData(updated);
    setSettings(updated);
    showToast(`Setting updated: ${String(key)}`);
  };

  const handleSaveAll = () => {
    setSettings(formData);
    showToast('All personalized settings saved!');
  };

  const handleResetDefaults = () => {
    const defaults: AppSettings = {
      theme: 'dark',
      accentColor: 'blue',
      fontSize: 'medium',
      dashboardLayout: 'grid-3',
      sidebarCollapsed: false,
      language: 'English (US)',
      aiResponseStyle: 'balanced',
      voiceName: 'Kore (Female - Cheerful)',
      speechRate: 1.0,
      speechPitch: 1.0,
      triggerPhrase: 'Hey Astra',
      notificationsEnabled: true,
      emailNotifications: true,
      pushNotifications: true,
      soundEffects: true,
      dailySummaryNotification: true,
      autoSaveNotes: true,
      analyticsEnabled: true,
      clearOnExit: false,
      twoFactorEnabled: true,
      sessionTimeoutMinutes: 30,
    };
    setFormData(defaults);
    setSettings(defaults);
    showToast('Settings reset to default!');
  };

  const accentColors: Array<{ id: AccentColor; name: string; bg: string; border: string }> = [
    { id: 'blue', name: 'Cyber Blue', bg: 'bg-blue-600', border: 'border-blue-400' },
    { id: 'cyan', name: 'Neon Cyan', bg: 'bg-cyan-500', border: 'border-cyan-300' },
    { id: 'purple', name: 'Deep Purple', bg: 'bg-purple-600', border: 'border-purple-400' },
    { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500', border: 'border-emerald-300' },
    { id: 'rose', name: 'Rose', bg: 'bg-rose-500', border: 'border-rose-300' },
    { id: 'amber', name: 'Amber', bg: 'bg-amber-500', border: 'border-amber-300' },
  ];

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-500/90 border border-emerald-400/40 text-white shadow-2xl flex items-center space-x-3 text-xs font-semibold backdrop-blur-xl"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-[#0D1428] border border-white/10 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">System & Personalization Settings</h1>
          </div>
          <p className="text-xs text-slate-400">
            Customize visual theme, accent colors, AI behavior, voice preferences, and notifications.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors flex items-center space-x-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSaveAll}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center space-x-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'appearance', label: 'Appearance & Theme', icon: Palette },
          { id: 'general', label: 'General & Layout', icon: Settings },
          { id: 'ai', label: 'AI & Voice Preferences', icon: Sparkles },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center space-x-2 transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings Content Panels */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0D1428] border border-white/10 shadow-2xl space-y-6">
        
        {/* TAB 1: APPEARANCE */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Theme Mode</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'dark', label: 'Dark Mode', icon: Moon },
                  { id: 'light', label: 'Light Mode', icon: Sun },
                  { id: 'system', label: 'System Default', icon: Monitor },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleChange('theme', t.id as any)}
                      className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 transition-all ${
                        formData.theme === t.id
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-6 h-6 text-blue-400" />
                      <span className="text-xs font-semibold">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Accent Color</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {accentColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => handleChange('accentColor', color.id)}
                    className={`p-3 rounded-2xl border flex items-center space-x-2.5 transition-all ${
                      formData.accentColor === color.id
                        ? 'bg-white/10 border-white/30 ring-2 ring-blue-500'
                        : 'bg-white/5 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${color.bg}`} />
                    <span className="text-xs font-semibold text-slate-200">{color.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Font Size Scale</h2>
              <div className="grid grid-cols-3 gap-3">
                {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => handleChange('fontSize', size)}
                    className={`p-3.5 rounded-2xl border text-xs font-bold uppercase tracking-wider transition-all ${
                      formData.fontSize === size
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GENERAL & LAYOUT */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Dashboard Layout Preference</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'grid-3', label: '3-Column Grid' },
                  { id: 'grid-2', label: '2-Column Grid' },
                  { id: 'compact', label: 'Compact List' },
                  { id: 'spaced', label: 'Spaced Bento' },
                ].map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => handleChange('dashboardLayout', layout.id as any)}
                    className={`p-3.5 rounded-2xl border text-xs font-bold transition-all ${
                      formData.dashboardLayout === layout.id
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    {layout.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <div className="text-xs font-bold text-white">Default Sidebar State</div>
                <div className="text-[10px] text-slate-400">Keep navigation sidebar collapsed by default</div>
              </div>
              <button
                type="button"
                onClick={() => handleChange('sidebarCollapsed', !formData.sidebarCollapsed)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  formData.sidebarCollapsed ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    formData.sidebarCollapsed ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: AI & VOICE */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">AI Response Style</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(['concise', 'balanced', 'detailed', 'creative', 'code'] as AiResponseStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => handleChange('aiResponseStyle', style)}
                    className={`p-3 rounded-2xl border text-xs font-bold capitalize transition-all ${
                      formData.aiResponseStyle === style
                        ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Voice Assistant Customization</h2>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Voice Personality</label>
                <select
                  value={formData.voiceName}
                  onChange={(e) => handleChange('voiceName', e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="Kore (Female - Cheerful)">Kore (Female - Cheerful & Fast)</option>
                  <option value="Puck (Male - Calm)">Puck (Male - Calm & Professional)</option>
                  <option value="Fenrir (Deep Voice)">Fenrir (Deep Cybernetic Voice)</option>
                  <option value="Zephyr (Smooth Speech)">Zephyr (Smooth Natural Speech)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Trigger Phrase</label>
                <input
                  type="text"
                  value={formData.triggerPhrase}
                  onChange={(e) => handleChange('triggerPhrase', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Speech Rate</span>
                    <span>{formData.speechRate}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={formData.speechRate}
                    onChange={(e) => handleChange('speechRate', parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Speech Pitch</span>
                    <span>{formData.speechPitch}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={formData.speechPitch}
                    onChange={(e) => handleChange('speechPitch', parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            {[
              { key: 'notificationsEnabled', label: 'Master Notification Toggle', desc: 'Enable or disable all app alerts' },
              { key: 'emailNotifications', label: 'Email Digest Notifications', desc: 'Receive daily summary emails' },
              { key: 'pushNotifications', label: 'Browser Push Alerts', desc: 'Instant desktop popups for reminders' },
              { key: 'soundEffects', label: 'Audio & Sound Cues', desc: 'Play subtle audio feedback on actions' },
              { key: 'dailySummaryNotification', label: 'Daily Productivity Briefing', desc: 'Morning notification summarizing tasks' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <div>
                  <div className="text-xs font-bold text-white">{item.label}</div>
                  <div className="text-[10px] text-slate-400">{item.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange(item.key as any, !(formData as any)[item.key])}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    (formData as any)[item.key] ? 'bg-blue-600' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      (formData as any)[item.key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: PRIVACY & SECURITY */}
        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <div className="text-xs font-bold text-white">Two-Factor Authentication (2FA)</div>
                <div className="text-[10px] text-slate-400">Require secondary code on new session logins</div>
              </div>
              <button
                type="button"
                onClick={() => handleChange('twoFactorEnabled', !formData.twoFactorEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  formData.twoFactorEnabled ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    formData.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <div className="text-xs font-bold text-white">Clear Temporary Data on Exit</div>
                <div className="text-[10px] text-slate-400">Automatically clear session audio cache</div>
              </div>
              <button
                type="button"
                onClick={() => handleChange('clearOnExit', !formData.clearOnExit)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  formData.clearOnExit ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    formData.clearOnExit ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Session Timeout (Minutes)</label>
              <select
                value={formData.sessionTimeoutMinutes}
                onChange={(e) => handleChange('sessionTimeoutMinutes', parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={120}>2 Hours</option>
              </select>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
