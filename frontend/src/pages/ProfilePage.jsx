import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || 'Alex Morgan');
  const [email] = useState(currentUser?.email || 'alex@astra-ai.io');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto pt-2 pb-12">
      <div className="mb-8">
        <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100">
          Account Profile
        </h2>
        <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
          Manage your personal details, plan subscription, and credentials
        </p>
      </div>

      <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center gap-6 pb-6 border-b border-outline-variant/30 dark:border-slate-700">
          <img
            src={currentUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'}
            alt="Profile Avatar"
            className="w-20 h-20 rounded-full object-cover border-2 border-primary"
          />
          <div>
            <h3 className="font-headline text-xl font-bold text-on-surface dark:text-slate-100">
              {displayName}
            </h3>
            <p className="font-label text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">
              {email}
            </p>
            <span className="inline-block mt-2 font-label text-xs font-semibold text-primary dark:text-blue-400 bg-primary-fixed dark:bg-blue-950 px-3 py-1 rounded-full">
              ASTRA Pro Subscriber
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-4 max-w-lg">
          <div>
            <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-surface-container-high/50 dark:bg-slate-700/50 border border-outline-variant/30 dark:border-slate-600 rounded-xl px-4 py-2 text-sm text-on-surface-variant cursor-not-allowed"
            />
          </div>

          <div className="pt-2 flex items-center gap-4">
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            >
              Save Profile Changes
            </button>
            {saved && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span> Changes saved!
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
