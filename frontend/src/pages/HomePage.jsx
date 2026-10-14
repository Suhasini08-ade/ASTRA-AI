import React from 'react';
import { useAuth } from '../context/AuthContext';
import CommandCenter from '../components/dashboard/CommandCenter';
import BentoGrid from '../components/dashboard/BentoGrid';

export default function HomePage() {
  const { currentUser } = useAuth();
  const userName = currentUser?.displayName || 'Alex';

  return (
    <div className="max-w-7xl mx-auto w-full pt-4">
      {/* Hero Section */}
      <section className="mb-8 text-left">
        <h2 className="font-display text-4xl font-extrabold text-on-surface dark:text-slate-100 tracking-tight mb-2">
          Good morning, {userName}.
        </h2>
        <p className="font-body text-lg text-on-surface-variant dark:text-slate-400 max-w-2xl">
          What would you like to accomplish today?
        </p>
      </section>

      {/* Command Center Input */}
      <CommandCenter />

      {/* Bento Grid Widgets */}
      <BentoGrid />
    </div>
  );
}
