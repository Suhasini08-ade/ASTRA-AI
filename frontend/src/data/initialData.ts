import { Note, TaskItem, ReminderItem, CalendarEventItem, UserProfile, AppSettings, ChatMessage } from '../types';
import { INITIAL_USER_PROFILE_EXTENDED, INITIAL_EXTENDED_SETTINGS } from './featureRegistry';

export const INITIAL_USER_PROFILE: UserProfile = INITIAL_USER_PROFILE_EXTENDED;

export const INITIAL_SETTINGS: AppSettings = INITIAL_EXTENDED_SETTINGS;

export const INITIAL_NOTES: Note[] = [
  {
    id: 'note-1',
    title: '🚀 Q3 AI Product Architecture',
    content: `Key Objectives:
1. Integrate Gemini 3.6 Flash for multi-turn assistant reasoning.
2. Implement low-latency streaming for voice command processing.
3. Establish robust full-stack proxy routes to secure server API keys.
4. Enhance Kanban task automation with AI break-down features.

Next steps: Finalize backend schema, verify CORS headers, and run benchmark tests on response latency.`,
    category: 'Work',
    color: 'from-blue-600/20 to-indigo-600/20 border-blue-500/30',
    isPinned: true,
    updatedAt: '10 mins ago',
    tags: ['Architecture', 'Gemini', 'Sprint-3'],
  },
  {
    id: 'note-2',
    title: '💡 Deep Work & Focus Protocol',
    content: `Daily Productivity Routine:
- 08:30 AM: Morning AI Briefing & Task Prioritization
- 09:00 AM - 11:30 AM: Uninterrupted Deep Work (90-min Pomodoro)
- 01:30 PM: File Summarizer & Team Alignment Sync
- 04:30 PM: Evening Review & Next-Day Time Blocking`,
    category: 'Personal',
    color: 'from-purple-600/20 to-pink-600/20 border-purple-500/30',
    isPinned: true,
    updatedAt: '1 hour ago',
    tags: ['Habits', 'Focus', 'Mindfulness'],
  },
  {
    id: 'note-3',
    title: '🎨 SaaS Design System Guidelines',
    content: `Aesthetic Directives:
- Dark glassmorphism cards with rgba(255,255,255,0.06) background.
- Gradient glow accents: Cyan (#06B6D4), Purple (#8B5CF6), Blue (#3B82F6).
- Typography: Clean display headers paired with high-contrast body text.
- Micro-interactions: Framer Motion spring physics on buttons and modal transitions.`,
    category: 'Ideas',
    color: 'from-cyan-600/20 to-teal-600/20 border-cyan-500/30',
    isPinned: false,
    updatedAt: 'Yesterday',
    tags: ['UI/UX', 'Tailwind', 'Motion'],
  },
  {
    id: 'note-4',
    title: '🔬 Multi-Agent Benchmark Notes',
    content: `Observation from trial run:
- Parallel sub-task execution reduced latency by 42%.
- Context window handling improved summary coherence for documents >15 pages.
- Recommend implementing structured schema outputs for all JSON endpoints.`,
    category: 'Research',
    color: 'from-amber-600/20 to-orange-600/20 border-amber-500/30',
    isPinned: false,
    updatedAt: '2 days ago',
    tags: ['Benchmarking', 'Research'],
  },
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    title: 'Implement Gemini 3.6 Flash Server Proxy',
    description: 'Secure server-side API routes for chat, text summary, and voice prompt generation.',
    priority: 'High',
    category: 'Development',
    dueDate: '2026-07-28',
    status: 'in-progress',
    progress: 75,
    createdAt: '2026-07-24',
  },
  {
    id: 'task-2',
    title: 'Design Cybernetic Dark Dashboard Layout',
    description: 'Create responsive glassmorphism cards, glowing sidebar, and top navigation bar.',
    priority: 'High',
    category: 'Design',
    dueDate: '2026-07-26',
    status: 'completed',
    progress: 100,
    createdAt: '2026-07-23',
  },
  {
    id: 'task-3',
    title: 'Integrate Web Speech Voice Visualizer',
    description: 'Build animated glowing audio waveform with speech-to-text transcript panel.',
    priority: 'Medium',
    category: 'Development',
    dueDate: '2026-07-29',
    status: 'in-progress',
    progress: 50,
    createdAt: '2026-07-25',
  },
  {
    id: 'task-4',
    title: 'Kanban Drag & Drop Task Automation',
    description: 'Enable smart AI breakdown generator that populates task cards based on goals.',
    priority: 'High',
    category: 'Operations',
    dueDate: '2026-07-30',
    status: 'todo',
    progress: 0,
    createdAt: '2026-07-25',
  },
  {
    id: 'task-5',
    title: 'File Summarizer Document Upload Dropzone',
    description: 'Support PDF, DOCX, TXT uploads with AI key-points extraction & Markdown export.',
    priority: 'Medium',
    category: 'Research',
    dueDate: '2026-07-31',
    status: 'todo',
    progress: 0,
    createdAt: '2026-07-25',
  },
  {
    id: 'task-6',
    title: 'Real-time Weather & Tech News Feed Sync',
    description: 'Fetch live forecast & AI tech news with category filtering and AI article summarizer.',
    priority: 'Low',
    category: 'Development',
    dueDate: '2026-08-01',
    status: 'completed',
    progress: 100,
    createdAt: '2026-07-22',
  },
];

export const INITIAL_REMINDERS: ReminderItem[] = [
  {
    id: 'rem-1',
    title: 'Quarterly AI Strategy Sync with Executive Board',
    time: '11:00 AM',
    date: 'Today',
    category: 'Meeting',
    isCompleted: false,
    priority: 'High',
  },
  {
    id: 'rem-2',
    title: 'Review Sprint 3 Pull Requests & Code Architecture',
    time: '02:30 PM',
    date: 'Today',
    category: 'Work',
    isCompleted: false,
    priority: 'High',
  },
  {
    id: 'rem-3',
    title: '30-Minute Hydration & Posture Reset Break',
    time: '04:00 PM',
    date: 'Today',
    category: 'Health',
    isCompleted: true,
    priority: 'Low',
  },
  {
    id: 'rem-4',
    title: 'Submit Q3 Cloud Infrastructure Budget Approval',
    time: '10:00 AM',
    date: 'Tomorrow',
    category: 'Work',
    isCompleted: false,
    priority: 'Medium',
  },
  {
    id: 'rem-5',
    title: 'AI Product Demonstration for Engineering College Summit',
    time: '03:00 PM',
    date: 'Jul 28',
    category: 'Focus',
    isCompleted: false,
    priority: 'High',
  },
];

export const INITIAL_CALENDAR_EVENTS: CalendarEventItem[] = [
  {
    id: 'evt-1',
    title: 'Product Sprint Planning & Demo',
    date: '2026-07-25',
    time: '10:00 AM - 11:30 AM',
    location: 'Astra Virtual Conference Room A',
    category: 'Meeting',
    attendees: ['Alex Morgan', 'Sarah Chen', 'David Kim'],
    color: '#3B82F6',
  },
  {
    id: 'evt-2',
    title: 'Gemini 3.6 API Security Audit',
    date: '2026-07-25',
    time: '02:00 PM - 03:00 PM',
    location: 'Security Room 402',
    category: 'Review',
    attendees: ['Alex Morgan', 'Elena Rostova'],
    color: '#8B5CF6',
  },
  {
    id: 'evt-3',
    title: 'College Project Milestone Submission Deadline',
    date: '2026-07-28',
    time: '05:00 PM',
    location: 'Academic Portal',
    category: 'Deadline',
    attendees: ['Project Team Alpha'],
    color: '#EF4444',
  },
  {
    id: 'evt-4',
    title: 'UI/UX Interactive Visual Refresh Review',
    date: '2026-07-29',
    time: '01:00 PM - 02:00 PM',
    location: 'Design Studio B',
    category: 'Review',
    attendees: ['Alex Morgan', 'Maya Lin'],
    color: '#06B6D4',
  },
  {
    id: 'evt-5',
    title: 'AI Developer Hackathon Keynote Presentation',
    date: '2026-07-31',
    time: '09:00 AM - 11:00 AM',
    location: 'Innovation Main Stage',
    category: 'Meeting',
    attendees: ['Alex Morgan', 'Keynote Audience'],
    color: '#22C55E',
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content: 'Hello Alex! I am Astra AI, your full-stack productivity intelligence assistant powered by Gemini 3.6 Flash. How can I assist your workflow today?',
    timestamp: '09:00 AM',
    suggestedFollowups: [
      'Analyze my Q3 Kanban roadmap',
      'Summarize top technology news',
      'Draft an email to the engineering team'
    ]
  }
];
