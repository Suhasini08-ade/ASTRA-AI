import React, { useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopHeader from './components/layout/TopHeader';
import HomePage from './pages/HomePage';
import AssistantPage from './pages/AssistantPage';
import VoicePage from './pages/VoicePage';
import ProductivityPage from './pages/ProductivityPage';
import FocusPage from './pages/FocusPage';
import CalendarPage from './pages/CalendarPage';
import NotesPage from './pages/NotesPage';
import WeatherPage from './pages/WeatherPage';
import NewsPage from './pages/NewsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import LandingPage from './pages/LandingPage';
import FeaturesPage from './pages/FeaturesPage';
import PricingPage from './pages/PricingPage';
import DocsPage from './pages/DocsPage';
import DeepDivePage from './pages/DeepDivePage';
import RemindersPage from './pages/RemindersPage';
import { LoginPage, SignupPage, RecoverPasswordPage, ResetPasswordPage } from './pages/AuthPages';

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background dark:bg-slate-900 transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Container */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto ml-0 md:ml-64 bg-background dark:bg-slate-900 transition-colors">
        <TopHeader onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
        <div className="mt-16 p-4 md:p-8 max-w-7xl mx-auto w-full flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/recover-password" element={<RecoverPasswordPage />} />
      <Route path="/forgot-password" element={<RecoverPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Main OS App Routes */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="voice" element={<VoicePage />} />
        <Route path="tasks" element={<ProductivityPage />} />
        <Route path="focus" element={<FocusPage />} />
        <Route path="deep-dive" element={<DeepDivePage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="reminders" element={<RemindersPage />} />
        <Route path="docs" element={<DocsPage />} />
        <Route path="weather" element={<WeatherPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Fallback Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
