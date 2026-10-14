import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function FeaturesPage() {
  const { currentUser } = useAuth();
  const getStartedTarget = currentUser ? "/app" : "/signup";

  const capabilities = [
    { icon: "smart_toy", title: "AI Assistant", desc: "Multi-turn conversational AI with tool execution, memory, and model fallback routing." },
    { icon: "mic", title: "Voice AI", desc: "Near-zero latency voice conversations — speak naturally, ASTRA understands and responds." },
    { icon: "check_circle", title: "Tasks", desc: "Smart task manager with AI-assisted prioritization, deadlines, and status tracking." },
    { icon: "calendar_today", title: "Calendar", desc: "Intelligent scheduling, event management, and meeting organization — all in one place." },
    { icon: "note_alt", title: "Notes", desc: "Capture ideas, create structured notes with tags and instantly search your knowledge base." },
    { icon: "summarize", title: "Doc Summarizer", desc: "Upload PDFs, Markdown, or text files — AI extracts key insights, summaries, and action items." },
    { icon: "cloud", title: "Weather", desc: "Live weather intelligence with AI-powered insights tailored to your location." },
    { icon: "article", title: "News Feed", desc: "Curated AI-summarized news across categories — stay informed without the noise." },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Nav */}
      <header className="py-5 px-8 max-w-7xl mx-auto w-full flex justify-between items-center sticky top-0 z-30 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200/60">
        <Link to="/" className="font-headline text-xl font-extrabold tracking-tight text-slate-900">ASTRA AI</Link>
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
          <Link to="/" className="hover:text-blue-600 transition-colors">Platform</Link>
          <Link to="/features" className="text-blue-600 border-b-2 border-blue-600 pb-0.5">Features</Link>
          <a href="#enterprise" className="hover:text-blue-600 transition-colors">Enterprise</a>
          <Link to="/pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link to={currentUser ? "/app" : "/login"} className="text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors">
            {currentUser ? "Go to App" : "Sign In"}
          </Link>
          <Link to={getStartedTarget} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full transition-all shadow-sm active:scale-95">
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-blue-100/70 via-purple-100/30 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />
          <h1 className="font-headline text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
            Redefining Interaction.
          </h1>
          <p className="text-slate-500 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Explore the deep capabilities of ASTRA AI. From parsing complex documents in seconds to engaging in natural, contextual voice conversations, experience the next generation of productivity.
          </p>
          <div className="flex items-center justify-center gap-4 mt-10">
            <Link to={getStartedTarget} className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-full transition-all shadow-md flex items-center gap-2 active:scale-95">
              Try It Free <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
            <Link to="/pricing" className="px-7 py-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-sm rounded-full transition-colors shadow-sm">
              View Pricing
            </Link>
          </div>
        </section>

        {/* Document Intelligence */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-200/60">
          <div className="flex items-center gap-3 mb-10">
            <span className="material-symbols-outlined text-2xl text-blue-600">description</span>
            <h2 className="font-headline text-2xl md:text-3xl font-bold text-slate-900">Document Intelligence</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-blue-600 text-xl">upload_file</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-[10px] text-slate-400 font-mono">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-slate-400 text-sm">description</span>
                  <span>Drag &amp; drop quarterly_report.pdf</span>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-slate-200 rounded-full w-full" />
                  <div className="h-1.5 bg-slate-200 rounded-full w-4/5" />
                  <div className="h-1.5 bg-slate-200 rounded-full w-3/5" />
                </div>
              </div>
              <h3 className="font-headline text-base font-bold text-slate-900 mb-2">Ingestion</h3>
              <p className="text-xs text-slate-500 leading-relaxed">ASTRA instantly processes unstructured data, extracting key metrics, tables, and narrative context from complex PDFs.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-purple-600 text-xl">psychology</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                <div className="text-[10px] text-slate-500 font-mono space-y-1">
                  <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" /><span>Parsing document structure...</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" /><span>Identifying semantic sections...</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" /><span>Extracting financial figures...</span></div>
                </div>
              </div>
              <h3 className="font-headline text-base font-bold text-slate-900 mb-2">Neural Synthesis</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Advanced LLMs analyze the extracted content, connecting disparate data points to form a cohesive understanding.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-emerald-600 text-xl">task_alt</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">A</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Summary Generated</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">Q3 Revenue grew by 14% YoY, driven primarily by enterprise software adoption in the APAC region. Operating margins improved by 200bps.</p>
                <div className="flex gap-1 mt-2">
                  <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">Finance</span>
                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold">Report</span>
                </div>
              </div>
              <h3 className="font-headline text-base font-bold text-slate-900 mb-2">Actionable Output</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Receive concise summaries, exact data point extraction, and answers to specific queries based entirely on your source document.</p>
            </div>
          </div>
        </section>

        {/* Voice Experience */}
        <section className="bg-white border-t border-b border-slate-200/60 py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center gap-3 mb-10">
              <span className="material-symbols-outlined text-2xl text-blue-600">mic</span>
              <h2 className="font-headline text-2xl md:text-3xl font-bold text-slate-900">Voice Experience</h2>
            </div>
            <div className="bg-slate-50 rounded-3xl border border-slate-200 p-8 md:p-12 text-center">
              <h3 className="font-headline text-2xl font-bold text-slate-900 mb-3">Fluid Conversational Loop</h3>
              <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed mb-10">
                Experience near-zero latency interactions. ASTRA listens, interprets intent continuously, and responds with natural cadence.
              </p>
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-0">
                <div className="flex flex-col items-center max-w-[160px]">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-slate-600 text-2xl">person</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Input</span>
                  <p className="text-xs text-slate-600 italic">"Summarize the legal risks in section 4."</p>
                </div>
                <div className="flex items-center mx-6">
                  <div className="w-10 h-px bg-slate-300 hidden md:block" />
                  <span className="material-symbols-outlined text-slate-300 text-2xl md:hidden">arrow_downward</span>
                  <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-slate-300 hidden md:block" />
                </div>
                <div className="flex flex-col items-center max-w-[160px]">
                  <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-200 relative">
                    <span className="material-symbols-outlined text-white text-2xl">graphic_eq</span>
                    <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Processing</span>
                  <p className="text-xs text-slate-600">Contextualizing intent &amp; retrieving data</p>
                </div>
                <div className="flex items-center mx-6">
                  <div className="w-10 h-px bg-slate-300 hidden md:block" />
                  <span className="material-symbols-outlined text-slate-300 text-2xl md:hidden">arrow_downward</span>
                  <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-slate-300 hidden md:block" />
                </div>
                <div className="flex flex-col items-center max-w-[160px]">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-blue-500 text-2xl">volume_up</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Output</span>
                  <p className="text-xs text-slate-600 italic">"The main risks involve compliance timelines..."</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Grid */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="font-headline text-3xl md:text-4xl font-bold text-slate-900 mb-4">Everything You Need, In One OS</h2>
            <p className="text-slate-500 text-sm max-w-xl mx-auto leading-relaxed">ASTRA is built as a unified intelligence platform — every feature connects and amplifies the others.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {capabilities.map((cap, idx) => (
              <Link key={idx} to={getStartedTarget} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-blue-300 hover:-translate-y-1 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center mb-4 transition-colors">
                  <span className="material-symbols-outlined text-blue-600 text-xl">{cap.icon}</span>
                </div>
                <h3 className="font-headline text-sm font-bold text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors">{cap.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{cap.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-headline text-4xl font-extrabold text-white mb-4">Ready to experience ASTRA?</h2>
            <p className="text-blue-100 text-sm leading-relaxed mb-10 max-w-lg mx-auto">Join thousands of professionals who have transformed their workflow with ASTRA AI.</p>
            <div className="flex items-center justify-center gap-4">
              <Link to={getStartedTarget} className="px-8 py-3.5 bg-white text-blue-700 font-bold text-sm rounded-full hover:bg-blue-50 transition-all shadow-lg active:scale-95">Get Started Free</Link>
              <Link to="/pricing" className="px-8 py-3.5 border border-white/40 text-white font-semibold text-sm rounded-full hover:bg-white/10 transition-colors">View Pricing</Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <Link to="/" className="font-headline text-xl font-extrabold text-white">ASTRA AI</Link>
          <div className="flex items-center gap-6 text-xs font-medium">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Security</a>
            <a href="#" className="hover:text-white transition-colors">Status</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <p className="text-xs text-slate-500">© 2024 ASTRA AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
