import React from 'react';
import NewsCard from '../components/NewsCard';

export default function News() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Latest AI & Technology Headlines</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Curated real-time news feeds powered by external News API services</p>
      </div>

      <NewsCard />
    </div>
  );
}
