import React, { useState, useEffect } from 'react';
import { fetchNews } from '../services/newsService';
import { Newspaper as LuNewspaper, Search as LuSearch, ExternalLink as LuExternalLink, Clock as LuClock, Bookmark as LuBookmark } from 'lucide-react';

export default function NewsCard() {
  const [news, setNews] = useState([]);
  const [category, setCategory] = useState('Technology');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const categories = ['All', 'Technology', 'Productivity', 'AI & Innovation', 'Business'];

  const loadNews = async () => {
    setLoading(true);
    try {
      const data = await fetchNews(category === 'All' ? '' : category, search);
      setNews(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, [category]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadNews();
  };

  return (
    <div className="space-y-6">
      {/* Search and Category Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                category === cat
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search news..."
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
          <LuSearch className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </form>
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs animate-pulse">
          Fetching latest AI & productivity news headlines...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {news.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-md hover:border-purple-500/40 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold">
                    {item.category}
                  </span>
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <LuClock className="w-3 h-3" />
                    {item.publishedAt}
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 group-hover:text-purple-500 transition-colors line-clamp-2 mb-2">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed mb-4">
                  {item.summary}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">{item.source}</span>

                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold hover:underline"
                >
                  <span>Read Article</span>
                  <LuExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
