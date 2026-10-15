import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Aurora from '../components/Aurora';
import JarvesRobot from '../components/JarvesRobot';
import { 
  Sparkles as LuSparkles, 
  Bot as LuBot, 
  Mic as LuMic, 
  Timer as LuTimer, 
  Brain as LuBrain, 
  ArrowRight as LuArrowRight, 
  ShieldCheck as LuShieldCheck, 
  Zap as LuZap 
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  // Smooth Cursor position handler
  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    setMousePos({
      x: clientX / innerWidth,
      y: clientY / innerHeight
    });
  };

  const featureCards = [
    {
      title: 'Conversational AI Assistant',
      desc: 'Multi-modal integration for intelligent task synthesis and workflow planning.',
      icon: LuBot,
      color: 'from-purple-500/20 to-blue-500/20 text-purple-400'
    },
    {
      title: 'Voice Assistant Robot',
      desc: 'Real-time Web Speech with interactive humanoid robot state visualizer.',
      icon: LuMic,
      color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400'
    },
    {
      title: 'Distraction-Free Focus Mode',
      desc: 'Structured 50-minute Pomodoro sprints with calm ambient sound tracking.',
      icon: LuTimer,
      color: 'from-cyan-500/20 to-purple-500/20 text-cyan-300'
    },
    {
      title: 'AI Deep Dive Explorer',
      desc: 'Transform complex topics into visual concept node maps and auto-generated tasks.',
      icon: LuBrain,
      color: 'from-purple-500/20 to-pink-500/20 text-purple-300'
    }
  ];

  return (
    <div 
      onMouseMove={handleMouseMove}
      className="min-h-screen bg-transparent text-[#F8FAFC] relative overflow-x-hidden selection:bg-purple-500 selection:text-white"
    >
      {/* REACT BITS AURORA BASE ANIMATION (Softened to harmonize with Neural Network) */}
      <Aurora 
        colorStops={['#7C3AED', '#2563EB', '#06B6D4']}
        amplitude={0.9}
        blend={0.35}
        speed={0.8}
        lightMode={false}
        mousePos={mousePos}
      />

      {/* Subtle background cursor glow */}
      <div 
        className="pointer-events-none fixed w-[500px] h-[500px] rounded-full bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-cyan-500/10 blur-3xl transition-transform duration-300 ease-out z-0"
        style={{
          left: `${mousePos.x * 100}%`,
          top: `${mousePos.y * 100}%`,
          transform: 'translate(-50%, -50%)'
        }}
      />

      {/* Top Navbar */}
      <nav className="relative z-20 max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-slate-800/40">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <LuSparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-wider text-white">
              ASTRA <span className="text-cyan-400">AI</span>
            </span>
            <p className="text-[10px] text-[#94A3B8] tracking-widest uppercase font-mono">Productivity Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 text-white shadow-lg shadow-purple-900/40 hover:opacity-95 transition-all"
          >
            Open Dashboard
          </button>
        </div>
      </nav>

      {/* Hero Section: Grid layout with Text on Left & Interactive Robot on Right */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* LEFT: Hero Content */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold tracking-widest uppercase shadow-inner">
              <LuSparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>✦ AI POWERED PRODUCTIVITY</span>
            </div>

            <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white leading-tight">
              Meet <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-cyan-300 to-blue-400">ASTRA</span>
            </h1>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] tracking-tight">
              Your Smart AI Productivity Assistant
            </h2>

            <p className="text-base sm:text-lg text-[#94A3B8] max-w-xl leading-relaxed font-normal">
              Think smarter. Stay organized. Get more done.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 text-white font-bold text-sm shadow-xl shadow-purple-900/40 hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <span>Get Started Free</span>
                <LuArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-[#F8FAFC] font-semibold text-sm backdrop-blur-md transition-all flex items-center justify-center gap-2"
              >
                <LuZap className="w-4 h-4 text-cyan-400" />
                <span>Explore ASTRA</span>
              </button>
            </div>
          </div>

          {/* RIGHT: Interactive JARVES Robot Character */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <JarvesRobot state="idle" cursorPosition={mousePos} />
          </div>
        </div>
      </section>

      {/* Feature Preview Cards Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2">Next-Gen Workspace Architecture</h3>
          <p className="text-2xl font-extrabold text-white">Built for speed, clarity, and deep work</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featureCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
                className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md hover:border-purple-500/50 hover:bg-slate-900/90 transition-all group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-white mb-2">{card.title}</h4>
                <p className="text-xs text-[#94A3B8] leading-relaxed">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-8 border-t border-slate-800/40 text-center text-xs text-[#94A3B8] flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© 2026 ASTRA AI Assistant — KIT College of Engineering Project</p>
        <p className="flex items-center gap-2 text-[11px]">
          <LuShieldCheck className="w-4 h-4 text-emerald-400" />
          Firebase Auth & FastAPI Engine Connected
        </p>
      </footer>
    </div>
  );
}
