import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Newspaper, 
  Search, 
  Sparkles, 
  ExternalLink, 
  Clock, 
  BookOpen, 
  X,
  Share2
} from 'lucide-react';
import { NewsArticle } from '../types';
import { fetchNewsArticles, sendChatMessage } from '../services/api';

export const NewsPage: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [category, setCategory] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);

  const categories = ['All', 'AI & Tech', 'Productivity', 'World'];

  useEffect(() => {
    fetchNewsArticles(category).then(setArticles);
  }, [category]);

  const handleOpenArticleSummary = async (article: NewsArticle) => {
    setSelectedArticle(article);
    setAiSummary(null);
    setIsSummarizing(true);

    try {
      const prompt = [
        {
          role: 'user',
          content: `Provide a 3-bullet executive AI summary for this news headline and story:\n\nTitle: ${article.title}\nDescription: ${article.description}`,
        },
      ];
      const summaryText = await sendChatMessage(prompt, 'You are an AI News Analyst. Provide concise, high-impact bullet points.');
      setAiSummary(summaryText);
    } catch (err) {
      setAiSummary('Failed to summarize article text.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const filteredArticles = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 text-left">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center space-x-2">
            <Newspaper className="w-6 h-6 text-rose-400" />
            <span>AI Tech & SaaS Intelligence News</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Curated industry feeds with instant AI article key takeaways
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search news..."
            className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              category === cat
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.map(article => (
          <motion.div
            key={article.id}
            whileHover={{ y: -4 }}
            className="rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 hover:border-rose-500/40 shadow-xl overflow-hidden flex flex-col group transition-all"
          >
            {/* Article Image Header */}
            <div className="relative h-44 overflow-hidden">
              <img
                src={article.image}
                alt={article.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
              <span className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-950/80 text-rose-300 border border-rose-500/30 backdrop-blur-md">
                {article.category}
              </span>
            </div>

            {/* Content Body */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-[10px] text-slate-400 mb-1">
                  <span>{article.source}</span>
                  <span>•</span>
                  <span>{article.timeAgo}</span>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-rose-200 transition-colors line-clamp-2">
                  {article.title}
                </h3>

                <p className="text-xs text-slate-300 mt-2 line-clamp-3 leading-relaxed">
                  {article.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
                <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-rose-400" />
                  <span>{article.readTime}</span>
                </span>

                <button
                  onClick={() => handleOpenArticleSummary(article)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-bold text-[11px] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  <span>AI Summary</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* AI News Summary Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-slate-900 border border-rose-500/30 p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    AI News Breakdown
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1 leading-snug">
                    {selectedArticle.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-2 text-xs">
                {isSummarizing ? (
                  <div className="flex items-center space-x-2 text-cyan-300 py-4">
                    <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span>Gemini AI distilling article key insights...</span>
                  </div>
                ) : (
                  <div className="text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                    {aiSummary}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
