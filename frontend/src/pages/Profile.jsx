import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User as LuUser, Mail as LuMail, Edit3 as LuEdit3, CheckCircle2 as LuCheckCircle2, Award as LuAward, Calendar as LuCalendar, Sparkles as LuSparkles, Save as LuSave } from 'lucide-react';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || user?.email?.split('@')[0] || 'ASTRA User',
    email: user?.email || '',
    bio: user?.bio || 'ASTRA AI Productivity Power User',
    avatar: user?.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80'
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || user.email?.split('@')[0] || 'ASTRA User',
        email: user.email || '',
        bio: user.bio || 'ASTRA AI Productivity Power User',
        avatar: user.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80'
      });
    }
  }, [user]);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateUser(form);
    setEditing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Card Header */}
      <div className="bg-white dark:bg-slate-900/80 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          <div className="relative">
            <img
              src={form.avatar}
              alt={form.name}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-purple-500/40 shadow-xl"
            />
            <span className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-500 ring-2 ring-slate-900 text-white text-xs" title="Pro Verified">
              <LuCheckCircle2 className="w-4 h-4" />
            </span>
          </div>

          <div className="text-center sm:text-left flex-1 space-y-1">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">{user?.name}</h1>
              <span className="px-3 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold text-[10px] uppercase tracking-wider">
                {user?.role || 'Pro Member'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1">
              <LuMail className="w-3.5 h-3.5" />
              {user?.email}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 italic">"{user?.bio}"</p>
          </div>

          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all"
          >
            <LuEdit3 className="w-4 h-4" />
            <span>{editing ? 'Cancel' : 'Edit Profile'}</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Form */}
      {editing ? (
        <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Update Profile Information</h3>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Bio / Role Description</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-md shadow-purple-900/30 flex items-center gap-2"
              >
                <LuSave className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Workspace Statistics */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
              <LuAward className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Productivity Score</p>
              <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">98 / 100</h4>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
              <LuSparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">AI Assistant Queries</p>
              <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">142 Streamed</h4>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <LuCalendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">Joined Workspace</p>
              <h4 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{user?.joinDate || 'July 2026'}</h4>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
