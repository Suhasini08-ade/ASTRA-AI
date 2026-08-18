import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TabType, 
  TaskItem, 
  Note, 
  ReminderItem, 
  CalendarEventItem, 
  ChatMessage, 
  AppSettings, 
  UserProfile,
  FeatureModule,
  DashboardWidget
} from '../types';
import { 
  INITIAL_TASKS, 
  INITIAL_NOTES, 
  INITIAL_REMINDERS, 
  INITIAL_CALENDAR_EVENTS, 
  INITIAL_CHAT_MESSAGES 
} from '../data/initialData';
import { 
  INITIAL_USER_PROFILE_EXTENDED, 
  INITIAL_EXTENDED_SETTINGS, 
  INITIAL_FEATURE_MODULES, 
  INITIAL_DASHBOARD_WIDGETS 
} from '../data/featureRegistry';
import {
  fetchNotesApi,
  fetchTasksApi,
  fetchRemindersApi,
  fetchCalendarEventsApi,
  fetchChatHistory
} from '../services/api';

// Layout Components
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { RightWidgetsSidebar } from './RightWidgetsSidebar';

// Page Components
import { MainDashboard } from '../pages/MainDashboard';
import { AiChatPage } from '../pages/AiChatPage';
import { VoiceAssistantPage } from '../pages/VoiceAssistantPage';
import { NotesPage } from '../pages/NotesPage';
import { TaskManagementPage } from '../pages/TaskManagementPage';
import { RemindersPage } from '../pages/RemindersPage';
import { CalendarPage } from '../pages/CalendarPage';
import { WeatherPage } from '../pages/WeatherPage';
import { NewsPage } from '../pages/NewsPage';
import { FileSummarizerPage } from '../pages/FileSummarizerPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AuthPage } from '../pages/AuthPage';
import { ProfilePage } from '../pages/ProfilePage';
import { FeatureMarketplacePage } from '../pages/FeatureMarketplacePage';
import { MicroToolsPage } from '../pages/MicroToolsPage';
import { useAuth } from '../context/AuthContext';

export const DashboardApp: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile: authProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedToolId, setSelectedToolId] = useState<string>('translator');

  // States
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    const saved = localStorage.getItem('astra_tasks') || localStorage.getItem('nexus_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('astra_notes') || localStorage.getItem('nexus_notes');
    return saved ? JSON.parse(saved) : INITIAL_NOTES;
  });

  const [reminders, setReminders] = useState<ReminderItem[]>(() => {
    const saved = localStorage.getItem('astra_reminders') || localStorage.getItem('nexus_reminders');
    return saved ? JSON.parse(saved) : INITIAL_REMINDERS;
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>(() => {
    const saved = localStorage.getItem('astra_calendar') || localStorage.getItem('nexus_calendar');
    return saved ? JSON.parse(saved) : INITIAL_CALENDAR_EVENTS;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('astra_chat') || localStorage.getItem('nexus_chat');
    return saved ? JSON.parse(saved) : INITIAL_CHAT_MESSAGES;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('astra_settings') || localStorage.getItem('nexus_settings');
    return saved ? JSON.parse(saved) : INITIAL_EXTENDED_SETTINGS;
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    if (authProfile) return authProfile;
    const saved = localStorage.getItem('astra_user_profile') || localStorage.getItem('nexus_user_profile');
    return saved ? JSON.parse(saved) : INITIAL_USER_PROFILE_EXTENDED;
  });

  useEffect(() => {
    if (authProfile) {
      setUserProfile(authProfile);
    }
  }, [authProfile]);

  // Fetch live API data from FastAPI backend on mount
  useEffect(() => {
    async function loadBackendData() {
      try {
        const [fetchedNotes, fetchedTasks, fetchedReminders, fetchedCalendar, fetchedChat] = await Promise.all([
          fetchNotesApi(),
          fetchTasksApi(),
          fetchRemindersApi(),
          fetchCalendarEventsApi(),
          fetchChatHistory()
        ]);

        if (fetchedNotes.length > 0) setNotes(fetchedNotes);
        if (fetchedTasks.length > 0) setTasks(fetchedTasks);
        if (fetchedReminders.length > 0) setReminders(fetchedReminders);
        if (fetchedCalendar.length > 0) setCalendarEvents(fetchedCalendar);
        if (fetchedChat.length > 0) setChatMessages(fetchedChat);
      } catch (err) {
        console.warn('Backend live sync fallback active:', err);
      }
    }
    loadBackendData();
  }, []);

  const [features, setFeatures] = useState<FeatureModule[]>(() => {
    const saved = localStorage.getItem('astra_features') || localStorage.getItem('nexus_features');
    return saved ? JSON.parse(saved) : INITIAL_FEATURE_MODULES;
  });

  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    const saved = localStorage.getItem('astra_widgets') || localStorage.getItem('nexus_widgets');
    return saved ? JSON.parse(saved) : INITIAL_DASHBOARD_WIDGETS;
  });

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('astra_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('astra_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('astra_reminders', JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem('astra_calendar', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  useEffect(() => {
    localStorage.setItem('astra_chat', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('astra_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('astra_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('astra_features', JSON.stringify(features));
  }, [features]);

  useEffect(() => {
    localStorage.setItem('astra_widgets', JSON.stringify(widgets));
  }, [widgets]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <MainDashboard
            userProfile={userProfile}
            tasks={tasks}
            notes={notes}
            reminders={reminders}
            calendarEvents={calendarEvents}
            setActiveTab={setActiveTab}
            widgets={widgets}
            setWidgets={setWidgets}
          />
        );
      case 'chat':
        return (
          <AiChatPage
            messages={chatMessages}
            setMessages={setChatMessages}
          />
        );
      case 'voice':
        return <VoiceAssistantPage />;
      case 'notes':
        return (
          <NotesPage
            notes={notes}
            setNotes={setNotes}
          />
        );
      case 'tasks':
        return (
          <TaskManagementPage
            tasks={tasks}
            setTasks={setTasks}
          />
        );
      case 'reminders':
        return (
          <RemindersPage
            reminders={reminders}
            setReminders={setReminders}
          />
        );
      case 'calendar':
        return (
          <CalendarPage
            events={calendarEvents}
            setEvents={setCalendarEvents}
            tasks={tasks}
            reminders={reminders}
          />
        );
      case 'weather':
        return <WeatherPage />;
      case 'news':
        return <NewsPage />;
      case 'summarizer':
        return <FileSummarizerPage />;
      case 'profile':
        return (
          <ProfilePage
            userProfile={userProfile}
            setUserProfile={setUserProfile}
          />
        );
      case 'marketplace':
        return (
          <FeatureMarketplacePage
            features={features}
            setFeatures={setFeatures}
            setActiveTab={setActiveTab}
            setSelectedToolId={setSelectedToolId}
          />
        );
      case 'tools':
        return <MicroToolsPage initialToolId={selectedToolId} />;
      case 'settings':
        return (
          <SettingsPage
            settings={settings}
            setSettings={setSettings}
          />
        );
      case 'auth':
        return (
          <AuthPage initialMode="login" />
        );
      default:
        return (
          <MainDashboard
            userProfile={userProfile}
            tasks={tasks}
            notes={notes}
            reminders={reminders}
            calendarEvents={calendarEvents}
            setActiveTab={setActiveTab}
            widgets={widgets}
            setWidgets={setWidgets}
          />
        );
    }
  };

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-[#0B1020] text-white font-sans selection:bg-blue-500 selection:text-white flex overflow-hidden antialiased relative">
      
      {/* Ambient Mesh Glow Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
        />
      )}

      {/* Static Fixed Left Sidebar (Fixed 100vh height, overflow-hidden, no scrollbar) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userProfile={userProfile}
        features={features}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        onLogout={handleLogout}
      />

      {/* Main Area Container (Next to sidebar on desktop) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10 md:ml-60">
        {/* Top Navbar */}
        <TopNavbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userProfile={userProfile}
          onLogout={handleLogout}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />

        {/* Inner Content Area: Main Content holds the ONLY vertical scrollbar */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Main Content Viewport */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full transition-all duration-300">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {renderActivePage()}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Right Widget Sidebar (Rendered on Dashboard) */}
          {activeTab === 'dashboard' && (
            <div className="hidden xl:block w-80 p-6 pr-8 shrink-0 overflow-y-auto">
              <RightWidgetsSidebar
                reminders={reminders}
                setReminders={setReminders}
                tasks={tasks}
                setActiveTab={setActiveTab}
              />
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
