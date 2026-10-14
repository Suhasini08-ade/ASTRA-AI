import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { currentUser } = useAuth();
  const getStartedTarget = currentUser ? '/app' : '/signup';
  const signInTarget = currentUser ? '/app' : '/login';

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-600">
      {/* Navigation Header */}
      <header className="py-5 px-8 max-w-7xl mx-auto w-full flex justify-between items-center bg-transparent relative z-20">
        <div className="flex items-center gap-2">
          <Link to="/" className="font-headline text-xl font-extrabold tracking-tight text-slate-900">
            ASTRA AI
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
          <Link to="/features" className="hover:text-blue-600 transition-colors">Platform</Link>
          <Link to="/features" className="hover:text-blue-600 transition-colors">Features</Link>
          <a href="#enterprise" className="hover:text-blue-600 transition-colors">Enterprise</a>
          <Link to="/pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link to={signInTarget} className="text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors">
            {currentUser ? 'Go to App' : 'Sign In'}
          </Link>
          <Link
            to={getStartedTarget}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-6 pt-10 pb-16 flex flex-col items-center text-center relative">
        {/* Soft Radial Background Blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-blue-100/60 via-purple-100/30 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />

        {/* Hero Title */}
        <h1 className="font-headline text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15] max-w-3xl">
          Your AI. Your Day.<br />
          <span className="text-blue-600">Simplified.</span>
        </h1>

        {/* Subtitle */}
        <p className="font-body text-sm md:text-base text-slate-500 max-w-lg mt-5 leading-relaxed">
          ASTRA is your intelligent personal assistant that helps you think, plan, create, and get things done — all in one place.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-4 mt-8">
          <Link
            to={getStartedTarget}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-full transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95"
          >
            <span>Get Started</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
          <Link
            to="/features"
            className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs rounded-full transition-colors shadow-sm"
          >
            Explore ASTRA
          </Link>
        </div>

        {/* Trust Badge */}
        <p className="font-label text-[10px] md:text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-10">
          JOIN 10,000+ PROFESSIONALS ORGANIZING THEIR LIFE WITH AI
        </p>

        {/* Product Showcase UI Mockup Card */}
        <div className="w-full max-w-4xl mt-12 bg-white rounded-3xl border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.06)] p-6 md:p-8 relative text-left overflow-hidden min-h-[420px] flex">
          {/* Left Mini Sidebar Mockup */}
          <div className="w-44 border-r border-slate-100 pr-4 flex flex-col justify-between hidden sm:flex">
            <div className="space-y-6">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-600 flex items-center justify-center font-bold text-sm">
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
              </div>
              <nav className="space-y-3 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="material-symbols-outlined text-base">calendar_today</span>
                  <span>Calendar</span>
                </div>
                <div className="flex items-center gap-2 hover:text-slate-900 cursor-pointer">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Tasks</span>
                </div>
                <div className="flex items-center gap-2 hover:text-slate-900 cursor-pointer">
                  <span className="material-symbols-outlined text-base">description</span>
                  <span>Notes</span>
                </div>
              </nav>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-600">
              <span className="material-symbols-outlined text-base">logout</span>
              <span>Exit</span>
            </div>
          </div>

          {/* Main Mockup Content Area */}
          <div className="flex-1 pl-0 sm:pl-6 relative min-h-[360px] flex flex-col justify-between">
            <div className="space-y-4 max-w-md">
              <div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse" />
              <div className="h-3 bg-slate-50 rounded-full w-1/2" />
            </div>

            {/* Overlaid Floating AI Chat Widget */}
            <div className="absolute bottom-2 right-2 sm:right-6 w-80 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-slate-700 font-semibold">
                <span>Chat</span>
                <span className="material-symbols-outlined text-sm cursor-pointer text-slate-400">remove</span>
              </div>

              <div className="space-y-2">
                {/* AI Bubble */}
                <div className="bg-blue-50/70 text-slate-700 p-3 rounded-2xl text-[11px] leading-relaxed">
                  Good morning, Alex. Your day is clear until 10 AM. Shall we prepare for the Q3 review?
                </div>

                {/* User Reply Bubble */}
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-2xl text-[11px]">
                    Yes, please.
                  </div>
                </div>
              </div>

              {/* Chat Input Bar */}
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-slate-400 text-[11px] justify-between">
                <span>Type a message...</span>
                <span className="material-symbols-outlined text-blue-600 text-sm">send</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Row Section */}
        <div className="w-full mt-20 pt-10 border-t border-slate-200/60">
          <p className="font-label text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-8">
            ONE ASSISTANT. EVERYTHING YOU NEED.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-xs font-semibold text-slate-700">
            <div className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200/60 rounded-xl shadow-2xl shadow-slate-100">
              <span className="material-symbols-outlined text-blue-600 text-lg">smart_toy</span>
              <span>AI Assistant</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200/60 rounded-xl shadow-2xl shadow-slate-100">
              <span className="material-symbols-outlined text-blue-600 text-lg">mic</span>
              <span>Voice Control</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200/60 rounded-xl shadow-2xl shadow-slate-100">
              <span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span>
              <span>Smart Productivity</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200/60 rounded-xl shadow-2xl shadow-slate-100">
              <span className="material-symbols-outlined text-blue-600 text-lg">description</span>
              <span>Document Intelligence</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Section */}
      <footer className="bg-white border-t border-slate-200/80 pt-14 pb-8 px-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 pb-12">
          {/* Brand Col */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <h3 className="font-headline text-base font-extrabold text-slate-900 tracking-tight">
              ASTRA AI
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs">
              Your Personal Intelligence. Unified, secure, and built for your productivity.
            </p>
          </div>

          {/* Product Col */}
          <div className="space-y-3">
            <h4 className="font-label text-[11px] font-bold text-slate-900 uppercase tracking-wider">
              PRODUCT
            </h4>
            <ul className="space-y-2 text-slate-600 text-[11px]">
              <li><Link to="/app/assistant" className="hover:text-blue-600 transition-colors">AI Assistant</Link></li>
              <li><Link to="/app/voice" className="hover:text-blue-600 transition-colors">Voice</Link></li>
              <li><Link to="/app/tasks" className="hover:text-blue-600 transition-colors">Tasks</Link></li>
              <li><Link to="/app/calendar" className="hover:text-blue-600 transition-colors">Calendar</Link></li>
              <li><Link to="/app/notes" className="hover:text-blue-600 transition-colors">Notes</Link></li>
              <li><Link to="/app/docs" className="hover:text-blue-600 transition-colors">Documents</Link></li>
            </ul>
          </div>

          {/* Resources Col */}
          <div className="space-y-3">
            <h4 className="font-label text-[11px] font-bold text-slate-900 uppercase tracking-wider">
              RESOURCES
            </h4>
            <ul className="space-y-2 text-slate-600 text-[11px]">
              <li><Link to="/docs" className="hover:text-blue-600 transition-colors">Documentation</Link></li>
              <li><a href="#help" className="hover:text-blue-600 transition-colors">Help Center</a></li>
              <li><a href="#faq" className="hover:text-blue-600 transition-colors">FAQ</a></li>
              <li><a href="#updates" className="hover:text-blue-600 transition-colors">Product Updates</a></li>
            </ul>
          </div>

          {/* Company Col */}
          <div className="space-y-3">
            <h4 className="font-label text-[11px] font-bold text-slate-900 uppercase tracking-wider">
              COMPANY
            </h4>
            <ul className="space-y-2 text-slate-600 text-[11px]">
              <li><a href="#about" className="hover:text-blue-600 transition-colors">About</a></li>
              <li><a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a></li>
              <li><a href="#privacy" className="hover:text-blue-600 transition-colors">Privacy</a></li>
              <li><a href="#terms" className="hover:text-blue-600 transition-colors">Terms</a></li>
            </ul>
          </div>

          {/* Developers Col */}
          <div className="space-y-3">
            <h4 className="font-label text-[11px] font-bold text-slate-900 uppercase tracking-wider">
              DEVELOPERS
            </h4>
            <ul className="space-y-2 text-slate-600 text-[11px]">
              <li><Link to="/docs" className="hover:text-blue-600 transition-colors">API Docs</Link></li>
              <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors">GitHub</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & icons bar */}
        <div className="max-w-6xl mx-auto pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <p>© 2026 ASTRA AI. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="material-symbols-outlined text-sm hover:text-slate-600 cursor-pointer">grid_view</span>
            <span className="material-symbols-outlined text-sm hover:text-slate-600 cursor-pointer">code</span>
            <span className="material-symbols-outlined text-sm hover:text-slate-600 cursor-pointer">group</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
