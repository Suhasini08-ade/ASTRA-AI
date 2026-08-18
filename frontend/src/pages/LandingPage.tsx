import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Bot, 
  Kanban, 
  StickyNote, 
  Calendar as CalendarIcon, 
  Clock, 
  FileText, 
  CloudSun, 
  Newspaper, 
  BarChart3, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Globe, 
  ChevronRight, 
  Star, 
  Play, 
  Send,
  Lock,
  Cpu,
  Moon,
  Sun,
  Menu,
  X,
  Palette,
  Layout,
  Sliders,
  Check,
  Eye,
  MessageSquare,
  Plus,
  Trash2,
  ListTodo,
  Wand2,
  Smartphone,
  Layers,
  Flame,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type UiThemeOption = 'cyber-dark' | 'clean-light' | 'aurora-neon' | 'titanium-slate';
export type HeroLayoutOption = 'app-window' | 'split-pane' | 'bento-grid';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, enterGuestMode } = useAuth();

  // Customization States
  const [activeTheme, setActiveTheme] = useState<UiThemeOption>('cyber-dark');
  const [heroLayout, setHeroLayout] = useState<HeroLayoutOption>('app-window');
  const [demoTab, setDemoTab] = useState<'chat' | 'kanban' | 'notes' | 'tools'>('chat');
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);

  // Mobile menu & contact form
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  // Interactive Live Demo states
  const [demoMessages, setDemoMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Hello! I am your Astra AI Workspace Assistant. How can I streamline your productivity today?' }
  ]);
  const [demoInput, setDemoInput] = useState('');
  const [demoTasks, setDemoTasks] = useState([
    { id: '1', title: 'Review Q3 Product Roadmap', status: 'done', priority: 'High' },
    { id: '2', title: 'Prepare Client Presentation Deck', status: 'in-progress', priority: 'High' },
    { id: '3', title: 'Set up automated Firestore backups', status: 'todo', priority: 'Medium' }
  ]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Contact submit handler
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contactEmail) {
      setContactSent(true);
      setTimeout(() => setContactSent(false), 4000);
      setContactEmail('');
      setContactMessage('');
    }
  };

  const handleGetStarted = () => {
    if (currentUser || userProfile) {
      navigate('/dashboard');
    } else {
      navigate('/signup');
    }
  };

  const handleLoginClick = () => {
    if (currentUser || userProfile) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  // Demo Interactive Chat logic
  const handleSendDemoMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!demoInput.trim()) return;

    const userText = demoInput.trim();
    setDemoMessages(prev => [...prev, { role: 'user', content: userText }]);
    setDemoInput('');

    setTimeout(() => {
      let reply = "I'm ready to help you analyze notes, organize tasks, or summarize your documents in your ASTRA AI Workspace!";
      if (userText.toLowerCase().includes('task') || userText.toLowerCase().includes('todo')) {
        reply = "I've analyzed your schedule! You have 1 high-priority task in progress: 'Prepare Client Presentation Deck'. Would you like me to generate subtasks?";
      } else if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('hi')) {
        reply = "Greetings! Welcome to ASTRA AI. Try clicking the Kanban or Notes tab above to test out live workspace features!";
      } else if (userText.toLowerCase().includes('summary') || userText.toLowerCase().includes('summarize')) {
        reply = "Key Takeaways: 1. Workspace efficiency increased by 40%. 2. Cross-tool context is synced automatically across AI, Notes, and Kanban.";
      }
      setDemoMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    }, 600);
  };

  // Demo Task Adder
  const handleAddDemoTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setDemoTasks(prev => [
      ...prev,
      { id: Date.now().toString(), title: newTaskTitle.trim(), status: 'todo', priority: 'Medium' }
    ]);
    setNewTaskTitle('');
  };

  const toggleTaskStatus = (id: string) => {
    setDemoTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === 'todo' ? 'in-progress' : t.status === 'in-progress' ? 'done' : 'todo';
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  // Theme Styling Configuration Matrix
  const themeStyles = {
    'cyber-dark': {
      bg: 'bg-[#0B1020]',
      text: 'text-slate-100',
      headerBg: 'bg-[#0B1020]/80 border-white/10',
      cardBg: 'bg-slate-900/60 border-white/10 shadow-2xl backdrop-blur-xl',
      cardHover: 'hover:border-blue-500/40 hover:bg-slate-900/80',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      primaryBtn: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25',
      secondaryBtn: 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white',
      accentGlow: 'bg-blue-600/15',
      accentText: 'from-blue-400 via-indigo-300 to-purple-400',
      subtext: 'text-slate-400',
      inputBg: 'bg-slate-950/80 border-white/10 text-white placeholder-slate-500',
    },
    'clean-light': {
      bg: 'bg-[#F8FAFC]',
      text: 'text-slate-900',
      headerBg: 'bg-white/90 border-slate-200 shadow-sm',
      cardBg: 'bg-white border-slate-200 shadow-lg shadow-slate-200/50',
      cardHover: 'hover:border-indigo-400 hover:shadow-xl',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20',
      secondaryBtn: 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200',
      accentGlow: 'bg-indigo-400/10',
      accentText: 'from-indigo-700 via-blue-600 to-slate-800',
      subtext: 'text-slate-600',
      inputBg: 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    },
    'aurora-neon': {
      bg: 'bg-[#080C14]',
      text: 'text-emerald-50',
      headerBg: 'bg-[#080C14]/85 border-emerald-500/20',
      cardBg: 'bg-emerald-950/20 border-emerald-500/20 shadow-2xl backdrop-blur-2xl',
      cardHover: 'hover:border-emerald-400/50 hover:bg-emerald-950/40',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      primaryBtn: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/25',
      secondaryBtn: 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200 hover:bg-emerald-900/40',
      accentGlow: 'bg-emerald-500/15',
      accentText: 'from-emerald-400 via-teal-300 to-cyan-400',
      subtext: 'text-emerald-200/70',
      inputBg: 'bg-emerald-950/50 border-emerald-500/20 text-emerald-100 placeholder-emerald-600',
    },
    'titanium-slate': {
      bg: 'bg-[#11151E]',
      text: 'text-zinc-100',
      headerBg: 'bg-[#11151E]/90 border-zinc-800',
      cardBg: 'bg-zinc-900/80 border-zinc-800 shadow-xl',
      cardHover: 'hover:border-zinc-600 hover:bg-zinc-900',
      badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',
      primaryBtn: 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-md',
      secondaryBtn: 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white',
      accentGlow: 'bg-zinc-500/10',
      accentText: 'from-zinc-100 via-zinc-300 to-zinc-400',
      subtext: 'text-zinc-400',
      inputBg: 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500',
    }
  };

  const st = themeStyles[activeTheme];

  const featuresList = [
    {
      id: 'ai-assistant',
      icon: Bot,
      badge: 'Gemini 2.5',
      title: 'AI Assistant',
      description: 'Multi-turn conversational assistant with web knowledge, code execution, and contextual task awareness.',
    },
    {
      id: 'task-kanban',
      icon: Kanban,
      badge: 'Kanban OS',
      title: 'Task Management',
      description: 'Drag-and-drop workflow columns, priority tagging, subtasks, and automated task metrics.',
    },
    {
      id: 'smart-notes',
      icon: StickyNote,
      badge: 'Auto-Sync',
      title: 'Smart Notes',
      description: 'Markdown scratchpad with instant search, live tag organization, and single-click AI summary expansion.',
    },
    {
      id: 'file-summarizer',
      icon: FileText,
      badge: 'Document AI',
      title: 'File Summarizer',
      description: 'Upload PDFs or text files to extract key takeaways, structural bullet points, and Q&A analysis instantly.',
    },
    {
      id: 'calendar-schedules',
      icon: CalendarIcon,
      badge: 'Schedules',
      title: 'Calendar & Timelines',
      description: 'Visual month & week timeline views, recurring schedule events, and intelligent meeting reminders.',
    },
    {
      id: 'micro-tools',
      icon: Cpu,
      badge: 'Micro Suite',
      title: 'Utility Micro-Tools',
      description: 'Built-in multi-currency converter, unit transformer, word counter, and instant quick calculator.',
    },
  ];

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 selection:bg-blue-500 selection:text-white ${st.bg} ${st.text}`}>
      
      {/* Background Radial Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className={`absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[140px] ${st.accentGlow}`} />
        <div className={`absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full blur-[140px] ${st.accentGlow}`} />
      </div>

      {/* FLOATING THEME & LAYOUT OPTIONS BAR */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          <button
            onClick={() => setShowThemePanel(!showThemePanel)}
            className={`px-4 py-3 rounded-2xl font-medium text-xs shadow-2xl flex items-center space-x-2.5 transition-all transform hover:scale-105 border ${
              activeTheme === 'clean-light'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-blue-600 text-white border-blue-400/30 shadow-blue-500/30'
            }`}
          >
            <Palette className="w-4 h-4 animate-pulse" />
            <span>UI Options & Themes</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 uppercase font-mono font-bold">
              4 Themes
            </span>
          </button>

          <AnimatePresence>
            {showThemePanel && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={`absolute bottom-16 right-0 w-80 p-5 rounded-3xl border shadow-2xl backdrop-blur-2xl z-50 ${st.cardBg}`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Customize Interface</h4>
                  </div>
                  <button onClick={() => setShowThemePanel(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Theme Selector Options */}
                <div className="space-y-3 mb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">Visual Theme</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setActiveTheme('cyber-dark')}
                      className={`p-2.5 rounded-xl text-left border text-xs font-medium flex items-center justify-between transition-all ${
                        activeTheme === 'cyber-dark' ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                        <span>Cyber Glass</span>
                      </span>
                      {activeTheme === 'cyber-dark' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>

                    <button
                      onClick={() => setActiveTheme('clean-light')}
                      className={`p-2.5 rounded-xl text-left border text-xs font-medium flex items-center justify-between transition-all ${
                        activeTheme === 'clean-light' ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                        <span>Studio Light</span>
                      </span>
                      {activeTheme === 'clean-light' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>

                    <button
                      onClick={() => setActiveTheme('aurora-neon')}
                      className={`p-2.5 rounded-xl text-left border text-xs font-medium flex items-center justify-between transition-all ${
                        activeTheme === 'aurora-neon' ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                        <span>Aurora Neon</span>
                      </span>
                      {activeTheme === 'aurora-neon' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>

                    <button
                      onClick={() => setActiveTheme('titanium-slate')}
                      className={`p-2.5 rounded-xl text-left border text-xs font-medium flex items-center justify-between transition-all ${
                        activeTheme === 'titanium-slate' ? 'border-zinc-400 bg-zinc-800 text-zinc-100' : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-zinc-300 inline-block" />
                        <span>Titanium</span>
                      </span>
                      {activeTheme === 'titanium-slate' && <Check className="w-3.5 h-3.5 text-zinc-300" />}
                    </button>
                  </div>
                </div>

                {/* Hero Layout Selector */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">Hero Layout Option</p>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setHeroLayout('app-window')}
                      className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-all border ${
                        heroLayout === 'app-window' ? 'border-blue-500 bg-blue-500/10 font-bold' : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                        <span>Interactive App Window</span>
                      </span>
                      {heroLayout === 'app-window' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>

                    <button
                      onClick={() => setHeroLayout('split-pane')}
                      className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-all border ${
                        heroLayout === 'split-pane' ? 'border-blue-500 bg-blue-500/10 font-bold' : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Split Dual-Pane Showcase</span>
                      </span>
                      {heroLayout === 'split-pane' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>

                    <button
                      onClick={() => setHeroLayout('bento-grid')}
                      className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between transition-all border ${
                        heroLayout === 'bento-grid' ? 'border-blue-500 bg-blue-500/10 font-bold' : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <Layout className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Bento Grid Showcase</span>
                      </span>
                      {heroLayout === 'bento-grid' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <button
                    onClick={() => setShowDemoModal(true)}
                    className="text-xs text-blue-400 hover:underline flex items-center space-x-1 font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Try Interactive Test Drive</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* NAVBAR */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300 ${st.headerBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <span className={`text-lg font-bold tracking-tight bg-gradient-to-r ${st.accentText} bg-clip-text text-transparent`}>
                ASTRA AI
              </span>
              <span className={`block text-[10px] uppercase font-semibold tracking-widest ${st.subtext}`}>
                AI Productivity Suite
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
            <a href="#features" className={`transition-colors hover:text-blue-500 ${st.subtext}`}>Features</a>
            <a href="#demo" className={`transition-colors hover:text-blue-500 ${st.subtext}`}>Interactive Demo</a>
            <a href="#themes" className={`transition-colors hover:text-blue-500 ${st.subtext}`}>UI Options</a>
            <a href="#contact" className={`transition-colors hover:text-blue-500 ${st.subtext}`}>Contact</a>
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={() => setShowDemoModal(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center space-x-1.5 transition-all ${st.secondaryBtn}`}
            >
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Test Drive Demo</span>
            </button>

            {currentUser || userProfile ? (
              <button
                onClick={() => navigate('/dashboard')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${st.primaryBtn}`}
              >
                <span>Go to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleLoginClick}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${st.subtext} hover:text-white`}
                >
                  Sign In
                </button>
                <button
                  onClick={handleGetStarted}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${st.primaryBtn}`}
                >
                  <span>Get Started Free</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={() => setShowThemePanel(!showThemePanel)}
              className={`p-2 rounded-xl border ${st.secondaryBtn}`}
            >
              <Palette className="w-5 h-5 text-blue-400" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-xl border ${st.secondaryBtn}`}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className={`md:hidden border-b p-4 space-y-3 ${st.cardBg}`}>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm py-2">Features</a>
            <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="block text-sm py-2">Live Demo</a>
            <button onClick={() => { setMobileMenuOpen(false); setShowDemoModal(true); }} className="w-full text-left text-sm py-2 text-blue-400 font-semibold">
              Interactive Test Drive
            </button>
            <div className="pt-2 border-t border-white/10 flex flex-col space-y-2">
              <button onClick={() => { setMobileMenuOpen(false); handleLoginClick(); }} className={`w-full py-2.5 rounded-xl text-xs font-semibold ${st.secondaryBtn}`}>
                Sign In
              </button>
              <button onClick={() => { setMobileMenuOpen(false); handleGetStarted(); }} className={`w-full py-2.5 rounded-xl text-xs font-bold ${st.primaryBtn}`}>
                Get Started Free
              </button>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION WITH SELECTED HERO LAYOUT */}
      <section className="relative pt-12 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 overflow-hidden">
        
        {/* TOP BADGE */}
        <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto mb-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-4 py-1.5 rounded-full border text-xs font-semibold tracking-wide flex items-center space-x-2 ${st.badge}`}
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>AI Productivity OS with 4 Customizable Themes</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]"
          >
            Your Entire Workflow,{' '}
            <span className={`bg-gradient-to-r ${st.accentText} bg-clip-text text-transparent`}>
              Unified & Intelligent
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`text-base sm:text-lg max-w-2xl leading-relaxed ${st.subtext}`}
          >
            Seamlessly combine AI conversations, drag-and-drop Kanban tasks, auto-saving markdown notes, document summarization, and custom micro-tools in one beautiful workspace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-2"
          >
            <button
              onClick={handleGetStarted}
              className={`px-7 py-3.5 rounded-2xl text-sm font-bold flex items-center space-x-2.5 transition-all transform hover:scale-105 ${st.primaryBtn}`}
            >
              <span>Launch Workspace Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowDemoModal(true)}
              className={`px-6 py-3.5 rounded-2xl text-sm font-semibold border flex items-center space-x-2 transition-all ${st.secondaryBtn}`}
            >
              <Play className="w-4 h-4 text-blue-400 fill-blue-400" />
              <span>Interactive Test Drive</span>
            </button>
          </motion.div>
        </div>

        {/* HERO LAYOUT 1: INTERACTIVE APP WINDOW */}
        {heroLayout === 'app-window' && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`rounded-3xl border overflow-hidden shadow-2xl transition-all duration-300 ${st.cardBg}`}
          >
            {/* Window Top Controls */}
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-black/20">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-mono opacity-50">astra-ai-workspace.app</span>
              </div>

              {/* Window Tabs Selector */}
              <div className="flex items-center space-x-1 p-1 bg-white/5 rounded-xl border border-white/10">
                <button
                  onClick={() => setDemoTab('chat')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                    demoTab === 'chat' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>AI Assistant</span>
                </button>
                <button
                  onClick={() => setDemoTab('kanban')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                    demoTab === 'kanban' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>Task Kanban</span>
                </button>
                <button
                  onClick={() => setDemoTab('notes')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                    demoTab === 'notes' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <StickyNote className="w-3.5 h-3.5" />
                  <span>Smart Notes</span>
                </button>
              </div>

              <div className="hidden sm:flex items-center space-x-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  LIVE INTERACTIVE PREVIEW
                </span>
              </div>
            </div>

            {/* Window Content Body */}
            <div className="p-6 min-h-[380px]">
              {demoTab === 'chat' && (
                <div className="flex flex-col h-[340px] justify-between">
                  <div className="space-y-3 overflow-y-auto pr-2">
                    {demoMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                            AI
                          </div>
                        )}
                        <div
                          className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-md ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-white/5 border border-white/10 rounded-bl-none'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendDemoMessage} className="mt-4 flex items-center space-x-2">
                    <input
                      type="text"
                      value={demoInput}
                      onChange={e => setDemoInput(e.target.value)}
                      placeholder="Try asking: 'Summarize my roadmap' or 'Create a task list'..."
                      className={`flex-1 px-4 py-2.5 rounded-xl text-xs outline-none border transition-colors ${st.inputBg}`}
                    />
                    <button
                      type="submit"
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1 ${st.primaryBtn}`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              )}

              {demoTab === 'kanban' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ListTodo className="w-4 h-4 text-purple-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">Kanban Task Board</h3>
                    </div>
                    <span className="text-[11px] text-slate-400">Click a status badge to move task</span>
                  </div>

                  <form onSubmit={handleAddDemoTask} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      placeholder="Add a new task..."
                      className={`flex-1 px-3.5 py-2 rounded-xl text-xs border ${st.inputBg}`}
                    />
                    <button type="submit" className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 ${st.primaryBtn}`}>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </form>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {['todo', 'in-progress', 'done'].map(statusCol => (
                      <div key={statusCol} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <span>{statusCol === 'todo' ? 'To Do' : statusCol === 'in-progress' ? 'In Progress' : 'Completed'}</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
                            {demoTasks.filter(t => t.status === statusCol).length}
                          </span>
                        </div>

                        {demoTasks.filter(t => t.status === statusCol).map(task => (
                          <div
                            key={task.id}
                            onClick={() => toggleTaskStatus(task.id)}
                            className="p-3 rounded-xl bg-slate-900/80 border border-white/10 hover:border-purple-500/50 cursor-pointer transition-all space-y-1.5"
                          >
                            <p className="text-xs font-medium text-slate-200">{task.title}</p>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                                {task.priority}
                              </span>
                              <span className="text-slate-400 hover:text-white">Click to move ➔</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {demoTab === 'notes' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[320px]">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2 overflow-y-auto">
                    <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">All Notes</p>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                      <p className="font-bold text-amber-300">Quarterly Strategy</p>
                      <p className="text-[11px] text-slate-300 truncate">Expand AI summarizer integration...</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs opacity-70">
                      <p className="font-bold">Database Architecture</p>
                      <p className="text-[11px] text-slate-400 truncate">Firestore rules security check...</p>
                    </div>
                  </div>

                  <div className="md:col-span-2 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <h4 className="text-xs font-bold text-amber-300">Quarterly Strategy (Markdown Note)</h4>
                      <span className="text-[10px] text-slate-400">Auto-Saved</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">
                      # Product Launch Goals
                      <br />- 1. Deploy Gemini 2.5 context expansion.
                      <br />- 2. Refine drag-and-drop Kanban workflow responsiveness.
                      <br />- 3. Enable multi-theme user switching.
                    </p>
                    <div className="pt-2 flex items-center justify-end">
                      <button className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center space-x-1">
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>AI Summarize Note</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* HERO LAYOUT 2: SPLIT DUAL-PANE SHOWCASE */}
        {heroLayout === 'split-pane' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mt-8">
            <div className="space-y-6">
              <div className={`p-6 rounded-3xl border ${st.cardBg} space-y-4`}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Instant Multitasking</h3>
                    <p className="text-xs text-slate-400">Switch tabs without losing context or state</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  ASTRA AI automatically indexes your tasks, notes, and calendar schedules so the AI assistant can reference your active projects seamlessly.
                </p>
              </div>

              <div className={`p-6 rounded-3xl border ${st.cardBg} space-y-4`}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Enterprise Firebase Auth & Security</h3>
                    <p className="text-xs text-slate-400">Cloud Firestore persistent storage enabled</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  Your data stays securely synced across sessions with robust security rules and instant real-time synchronization.
                </p>
              </div>
            </div>

            <div className={`p-6 rounded-3xl border ${st.cardBg} space-y-4 shadow-2xl`}>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Live Workspace Preview</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">Sync Active</span>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold">Q3 Roadmap Presentation</p>
                      <p className="text-[10px] text-slate-400">Kanban Board • Due Today</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">Completed</span>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Bot className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-xs font-semibold">Gemini File Synthesis</p>
                      <p className="text-[10px] text-slate-400">PDF Document • 4 pages</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300">Summarized</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HERO LAYOUT 3: BENTO GRID */}
        {heroLayout === 'bento-grid' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className={`p-6 rounded-3xl border ${st.cardBg} md:col-span-2 space-y-3`}>
              <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <Bot className="w-4 h-4" />
                <span>Conversational Intelligence</span>
              </div>
              <h3 className="text-xl font-bold">Ask Anything, Execute Anywhere</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Connect your thoughts directly with AI actions. Ask Astra to organize your upcoming week, draft emails, or analyze technical documents with zero friction.
              </p>
            </div>

            <div className={`p-6 rounded-3xl border ${st.cardBg} space-y-3`}>
              <div className="flex items-center space-x-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <Kanban className="w-4 h-4" />
                <span>Kanban Workflow</span>
              </div>
              <h3 className="text-lg font-bold">Visual Boards</h3>
              <p className="text-xs text-slate-400">Drag & drop tasks with real-time state persistence.</p>
            </div>

            <div className={`p-6 rounded-3xl border ${st.cardBg} space-y-3`}>
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <StickyNote className="w-4 h-4" />
                <span>Auto Notes</span>
              </div>
              <h3 className="text-lg font-bold">Smart Scratchpad</h3>
              <p className="text-xs text-slate-400">Instant markdown rendering and tag organization.</p>
            </div>

            <div className={`p-6 rounded-3xl border ${st.cardBg} md:col-span-2 space-y-3`}>
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Palette className="w-4 h-4" />
                <span>4 UI Theme Presets</span>
              </div>
              <h3 className="text-xl font-bold">Designed for Dark & Light Workspaces</h3>
              <p className="text-xs text-slate-300">
                Switch seamlessly between Cyberpunk Dark Glass, Clean Studio Light, Aurora Neon, and Titanium Slate.
              </p>
            </div>
          </div>
        )}

      </section>

      {/* FEATURE HIGHLIGHTS GRID SECTION */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
        <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
          <span className={`px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${st.badge}`}>
            Complete Ecosystem
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Built for Modern High-Performers
          </h2>
          <p className={`text-sm ${st.subtext}`}>
            Everything you need in a single web workspace without switching between ten different browser tabs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresList.map(feat => {
            const IconComp = feat.icon;
            return (
              <div
                key={feat.id}
                className={`p-6 rounded-3xl border transition-all duration-300 space-y-4 ${st.cardBg} ${st.cardHover}`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold border border-blue-500/20">
                    <IconComp className="w-6 h-6" />
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${st.badge}`}>
                    {feat.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold">{feat.title}</h3>
                <p className={`text-xs leading-relaxed ${st.subtext}`}>{feat.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* THEME SHOWCASE SECTION */}
      <section id="themes" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className={`px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${st.badge}`}>
              Tailored Visual Aesthetics
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Pick the UI Aesthetic That Fits Your Flow
            </h2>
            <p className={`text-sm leading-relaxed ${st.subtext}`}>
              Whether you prefer deep focus dark modes, clean high-contrast studio lights, or vibrant aurora highlights — ASTRA AI adapts to your visual preference instantly.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setActiveTheme('cyber-dark')}
                className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                  activeTheme === 'cyber-dark' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Cyber Glass</span>
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                </div>
                <p className="text-[10px] text-slate-400">Deep navy canvas with frosted glass cards.</p>
              </button>

              <button
                onClick={() => setActiveTheme('clean-light')}
                className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                  activeTheme === 'clean-light' ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Studio Light</span>
                  <div className="w-3 h-3 rounded-full bg-indigo-600" />
                </div>
                <p className="text-[10px] text-slate-500">Crisp off-white canvas with sharp contrast.</p>
              </button>

              <button
                onClick={() => setActiveTheme('aurora-neon')}
                className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                  activeTheme === 'aurora-neon' ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Aurora Neon</span>
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[10px] text-slate-400">Emerald-teal highlights with glowing borders.</p>
              </button>

              <button
                onClick={() => setActiveTheme('titanium-slate')}
                className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                  activeTheme === 'titanium-slate' ? 'border-zinc-400 bg-zinc-800' : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Titanium</span>
                  <div className="w-3 h-3 rounded-full bg-zinc-300" />
                </div>
                <p className="text-[10px] text-slate-400">Monochromatic charcoal with silver accents.</p>
              </button>
            </div>
          </div>

          <div className={`p-8 rounded-3xl border shadow-2xl space-y-6 ${st.cardBg}`}>
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  UI
                </div>
                <div>
                  <h4 className="text-sm font-bold">Active UI Theme Preview</h4>
                  <p className="text-[10px] opacity-60">Currently showing: {activeTheme.toUpperCase()}</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${st.badge}`}>
                Live Active
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <p className="text-xs font-bold">Sample Task Metric</p>
                <p className="text-xs opacity-70">12 Tasks Completed Today • 98% On Time Velocity</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <p className="text-xs font-bold">AI Context State</p>
                <p className="text-xs opacity-70">Gemini model synced with active markdown notes.</p>
              </div>
            </div>

            <button
              onClick={handleGetStarted}
              className={`w-full py-3 rounded-xl text-xs font-bold transition-all ${st.primaryBtn}`}
            >
              Start Using This Theme Now
            </button>
          </div>
        </div>
      </section>

      {/* CONTACT & FOOTER */}
      <footer id="contact" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold">ASTRA AI Workspace</span>
            </div>
            <p className={`text-xs max-w-md ${st.subtext}`}>
              The unified AI productivity operating system for high-performing individuals and teams.
            </p>
            <p className="text-[11px] text-slate-500">© 2026 ASTRA AI. All rights reserved.</p>
          </div>

          <form onSubmit={handleContactSubmit} className={`p-6 rounded-3xl border space-y-3 ${st.cardBg}`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">Get in Touch</h4>
            {contactSent ? (
              <p className="text-xs text-emerald-400 font-semibold py-2">Thank you! Your message has been received.</p>
            ) : (
              <>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border ${st.inputBg}`}
                />
                <textarea
                  rows={2}
                  value={contactMessage}
                  onChange={e => setContactMessage(e.target.value)}
                  placeholder="How can we help you?"
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border ${st.inputBg}`}
                />
                <button type="submit" className={`w-full py-2.5 rounded-xl text-xs font-bold ${st.primaryBtn}`}>
                  Send Inquiry
                </button>
              </>
            )}
          </form>
        </div>
      </footer>

      {/* INTERACTIVE TEST DRIVE MODAL */}
      <AnimatePresence>
        {showDemoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-3xl rounded-3xl border p-6 shadow-2xl relative space-y-5 ${st.cardBg}`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold">Interactive Test Drive Demo</h3>
                </div>
                <button onClick={() => setShowDemoModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-300">
                  Experience the ASTRA AI workspace right now without signing up!
                </p>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <p className="text-xs font-bold text-blue-300">Test Drive Quick Actions:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setShowDemoModal(false);
                        handleGetStarted();
                      }}
                      className={`p-3 rounded-xl border text-left text-xs font-bold flex items-center justify-between ${st.primaryBtn}`}
                    >
                      <span>Create Free Account</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setShowDemoModal(false);
                        enterGuestMode();
                        navigate('/dashboard');
                      }}
                      className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between ${st.secondaryBtn}`}
                    >
                      <span>Launch Guest Workspace Instant</span>
                      <ArrowRight className="w-4 h-4 text-emerald-400" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
