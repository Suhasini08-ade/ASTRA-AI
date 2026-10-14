import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PricingPage() {
  const { currentUser } = useAuth();
  const getStartedTarget = currentUser ? '/app' : '/signup';

  return (
    <div className="min-h-screen bg-background dark:bg-slate-950 text-on-background dark:text-slate-100 flex flex-col">
      <header className="border-b border-outline-variant/30 dark:border-slate-800 py-4 px-8 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link to="/" className="font-headline text-2xl font-extrabold text-primary dark:text-blue-400">ASTRA AI</Link>
        <Link to={getStartedTarget} className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl">
          {currentUser ? 'Launch App' : 'Get Started'}
        </Link>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-8 py-16 text-center">
        <h1 className="font-display text-4xl font-extrabold mb-4">Flexible Plans for Every Workflow</h1>
        <p className="font-body text-on-surface-variant dark:text-slate-400 max-w-xl mx-auto mb-12">
          Unlock unlimited AI reasoning, voice streaming, and priority API speed.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          {/* Free Tier */}
          <div className="bg-surface dark:bg-slate-900 border border-outline-variant/40 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-headline text-xl font-bold">Starter</h3>
              <div className="my-4">
                <span className="font-display text-4xl font-extrabold">$0</span>
                <span className="text-xs text-on-surface-variant"> / month</span>
              </div>
              <ul className="space-y-3 text-xs text-on-surface-variant dark:text-slate-300">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Standard AI Assistant</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Basic Bento Grid Widgets</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> 5 Voice minutes / day</li>
              </ul>
            </div>
            <Link to={getStartedTarget} className="w-full mt-8 py-3 bg-surface-container-high dark:bg-slate-800 text-center font-semibold text-xs rounded-xl block hover:bg-surface-container-highest">
              Get Started Free
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="bg-surface dark:bg-slate-900 border-2 border-primary rounded-3xl p-8 shadow-xl flex flex-col justify-between relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              Most Popular
            </span>
            <div>
              <h3 className="font-headline text-xl font-bold text-primary">Pro OS</h3>
              <div className="my-4">
                <span className="font-display text-4xl font-extrabold">$29</span>
                <span className="text-xs text-on-surface-variant"> / month</span>
              </div>
              <ul className="space-y-3 text-xs text-on-surface-variant dark:text-slate-300">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Astra 3.6 Pro Model</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Unlimited Neural Voice AI</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> FastAPI Custom Endpoints</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Priority 24/7 Support</li>
              </ul>
            </div>
            <Link to={getStartedTarget} className="w-full mt-8 py-3 bg-primary text-white text-center font-semibold text-xs rounded-xl block hover:bg-blue-700 shadow-md">
              Upgrade to Pro
            </Link>
          </div>

          {/* Enterprise */}
          <div className="bg-surface dark:bg-slate-900 border border-outline-variant/40 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-headline text-xl font-bold">Enterprise</h3>
              <div className="my-4">
                <span className="font-display text-4xl font-extrabold">Custom</span>
              </div>
              <ul className="space-y-3 text-xs text-on-surface-variant dark:text-slate-300">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Dedicated Private Instances</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> Custom LLM Fine-Tuning</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-base">check</span> SLA & SSO Security</li>
              </ul>
            </div>
            <Link to="/docs" className="w-full mt-8 py-3 bg-surface-container-high dark:bg-slate-800 text-center font-semibold text-xs rounded-xl block hover:bg-surface-container-highest">
              Contact Sales
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
