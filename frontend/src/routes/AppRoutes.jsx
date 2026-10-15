import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import Landing from '../pages/Landing';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import AIAssistant from '../pages/AIAssistant';
import VoiceAssistant from '../pages/VoiceAssistant';
import Tasks from '../pages/Tasks';
import Notes from '../pages/Notes';
import Reminders from '../pages/Reminders';
import CalendarPage from '../pages/CalendarPage';
import Weather from '../pages/Weather';
import News from '../pages/News';
import Documents from '../pages/Documents';
import FocusMode from '../pages/FocusMode';
import DeepDive from '../pages/DeepDive';
import Profile from '../pages/Profile';
import Settings from '../pages/Settings';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Dashboard Pages */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/voice-assistant" element={<VoiceAssistant />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/news" element={<News />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/focus-mode" element={<FocusMode />} />
          <Route path="/deep-dive" element={<DeepDive />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Catch-all Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
