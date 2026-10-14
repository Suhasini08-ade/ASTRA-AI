import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { apiGetNews } from '../services/api';

export default function NewsPage() {
  const { showError, showSuccess } = useToast();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState(null);

  const [articles, setArticles] = useState([]);

  const fetchNews = useCallback(async (cat) => {
    setLoading(true);
    try {
      const data = await apiGetNews(cat);
      if (data && data.articles) {
        const mapped = data.articles.map((art) => ({
          id: art.id,
          title: art.title,
          category: art.category || cat,
          source: art.source || 'News Source',
          time: art.timeAgo || 'Recently',
          readTime: art.readTime || '3 min read',
          snippet: art.description || 'No description provided.',
          content: art.description || 'Full article content retrieved from news service.',
          image: art.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600',
          url: art.url || '#',
        }));
        setArticles(mapped);
      }
    } catch (e) {
      if (showError) showError('Failed to load news: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchNews(activeCategory);
  }, [activeCategory, fetchNews]);

  const filteredArticles = articles.filter((a) => {
    const matchesQuery =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.snippet.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesQuery;
  });

  return (
    <div className="max-w-5xl mx-auto pt-2 pb-10 space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-on-surface dark:text-slate-100 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">article</span>
            Astra Intelligence News
          </h2>
          <p className="font-body text-sm text-on-surface-variant dark:text-slate-400 mt-1">
            Curated developer updates, AI breakthroughs, and live news feeds
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full pl-9 pr-4 py-2 bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-xl text-sm text-on-surface dark:text-slate-200 focus:outline-none focus:border-primary shadow-sm"
          />
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex gap-2 border-b border-outline-variant/30 dark:border-slate-800 pb-4 overflow-x-auto">
        {['All', 'Technology', 'Business', 'Science', 'Entertainment', 'Health'].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
              activeCategory === cat
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface dark:bg-slate-800 text-on-surface-variant dark:text-slate-300 hover:bg-surface-container-high'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl p-4 animate-pulse space-y-3"
            >
              <div className="w-full h-40 bg-slate-300 dark:bg-slate-700 rounded-xl" />
              <div className="w-1/3 h-4 bg-slate-300 dark:bg-slate-700 rounded" />
              <div className="w-full h-6 bg-slate-300 dark:bg-slate-700 rounded" />
              <div className="w-2/3 h-4 bg-slate-300 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-12 bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant/30 dark:border-slate-700 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-2 text-slate-400">newspaper</span>
          <p className="text-sm font-semibold">No news articles found in this category.</p>
        </div>
      ) : (
        /* Articles Stream */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredArticles.map((article) => (
            <article
              key={article.id}
              onClick={() => setSelectedArticle(article)}
              className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col group cursor-pointer"
            >
              <img
                src={article.image}
                alt={article.title}
                className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center text-[11px] text-on-surface-variant dark:text-slate-400 mb-2">
                    <span className="font-semibold text-primary dark:text-blue-400">{article.category}</span>
                    <span>{article.time}</span>
                  </div>
                  <h3 className="font-headline text-base font-bold text-on-surface dark:text-slate-100 group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="font-body text-xs text-on-surface-variant dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                    {article.snippet}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-outline-variant/30 dark:border-slate-700 flex justify-between items-center text-xs text-on-surface-variant">
                  <span>{article.source}</span>
                  <span>{article.readTime}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-outline-variant/30 dark:border-slate-700">
              <div>
                <span className="text-xs font-bold text-primary dark:text-blue-400 uppercase tracking-wider">
                  {selectedArticle.category} • {selectedArticle.source}
                </span>
                <h3 className="font-headline text-xl font-bold text-on-surface dark:text-slate-100 mt-1">
                  {selectedArticle.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <img
              src={selectedArticle.image}
              alt={selectedArticle.title}
              className="w-full h-56 object-cover rounded-2xl mb-4"
            />

            <p className="font-body text-sm text-on-surface dark:text-slate-200 leading-relaxed mb-6">
              {selectedArticle.content}
            </p>

            <div className="flex justify-between items-center border-t border-outline-variant/30 dark:border-slate-700 pt-4">
              {selectedArticle.url && selectedArticle.url !== '#' ? (
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Read full story at source</span>
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              ) : <div />}

              <button
                onClick={() => setSelectedArticle(null)}
                className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-blue-700 shadow-md"
              >
                Close Article
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
