export type TabType = 
  | 'dashboard'
  | 'chat'
  | 'voice'
  | 'notes'
  | 'tasks'
  | 'reminders'
  | 'calendar'
  | 'weather'
  | 'news'
  | 'summarizer'
  | 'settings'
  | 'auth'
  | 'profile'
  | 'marketplace'
  | 'tools';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedFollowups?: string[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: 'Work' | 'Personal' | 'Ideas' | 'Projects' | 'Research';
  color: string;
  isPinned: boolean;
  updatedAt: string;
  tags: string[];
}

export type Priority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'todo' | 'in-progress' | 'completed';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  category: string;
  dueDate: string;
  status: TaskStatus;
  progress: number; // 0 - 100
  createdAt: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  time: string;
  date: string;
  category: 'Meeting' | 'Health' | 'Work' | 'Personal' | 'Focus';
  isCompleted: boolean;
  priority: Priority;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  location?: string;
  category: 'Meeting' | 'Deadline' | 'Personal' | 'Review';
  attendees?: string[];
  color: string;
}

export interface WeatherData {
  location: string;
  current: {
    temp: number;
    condition: string;
    icon: string;
    high: number;
    low: number;
    humidity: number;
    windSpeed: string;
    pressure: string;
    uvIndex: number;
    airQuality: string;
    sunrise: string;
    sunset: string;
    feelsLike: number;
  };
  forecast: Array<{
    day: string;
    tempHigh: number;
    tempLow: number;
    condition: string;
    icon: string;
    pop: string;
  }>;
  aiSummary: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  category: string;
  source: string;
  timeAgo: string;
  readTime: string;
  image: string;
  description: string;
  url: string;
  featured?: boolean;
}

export interface FileSummary {
  executiveSummary: string;
  keyPoints: string[];
  actionableInsights: string[];
  readingTime: string;
  sentimentOrCategory: string;
}

export interface SystemStatus {
  backend: 'connected' | 'reconnecting' | 'offline';
  database: 'active (local & cloud sync)' | 'syncing' | 'offline';
  ai: 'online' | 'busy' | 'simulated/ready';
  model: string;
  ping: number;
}

export interface UserProfile {
  name: string;
  username: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  role: string; // Profession / Occupation
  organization: string; // College / Organization
  bio: string;
  location: string;
  language: string;
  timeZone: string;
  avatar: string;
  plan: string;
}

export type AccentColor = 'blue' | 'cyan' | 'purple' | 'emerald' | 'rose' | 'amber';
export type FontSize = 'small' | 'medium' | 'large';
export type DashboardLayoutType = 'grid-3' | 'grid-2' | 'compact' | 'spaced';
export type AiResponseStyle = 'concise' | 'balanced' | 'detailed' | 'creative' | 'code';

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  accentColor: AccentColor;
  fontSize: FontSize;
  dashboardLayout: DashboardLayoutType;
  sidebarCollapsed: boolean;
  language: string;
  aiResponseStyle: AiResponseStyle;
  voiceName: string;
  speechRate: number;
  speechPitch: number;
  triggerPhrase: string;
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEffects: boolean;
  dailySummaryNotification: boolean;
  autoSaveNotes: boolean;
  analyticsEnabled: boolean;
  clearOnExit: boolean;
  twoFactorEnabled: boolean;
  sessionTimeoutMinutes: number;
}

export type WidgetType = 
  | 'weather'
  | 'notes'
  | 'calendar'
  | 'reminders'
  | 'tasks'
  | 'news'
  | 'ai_chat'
  | 'file_summary'
  | 'quick_actions'
  | 'recent_activity'
  | 'productivity_stats'
  | 'micro_tools';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  isPinned: boolean;
  position: number;
  enabled: boolean;
}

export interface FeatureModule {
  id: string;
  name: string;
  description: string;
  category: 'Core AI' | 'Productivity' | 'Utilities' | 'Intelligence';
  icon: string; // Lucide icon name
  isEnabled: boolean;
  isCore?: boolean;
  routeTab?: TabType;
  toolId?: string;
}

