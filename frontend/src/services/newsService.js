import { apiGetNews } from './api';

const DEFAULT_NEWS = [
  {
    id: '1',
    title: 'Next-Generation AI Assistants Revolutionize Personal Productivity in 2026',
    summary: 'Autonomous AI agents with multi-modal voice processing and deep knowledge graph exploration are changing how professionals manage daily workflows.',
    category: 'Technology',
    source: 'TechCrunch AI',
    publishedAt: '2 hours ago',
    readTime: '4 min read',
    url: 'https://news.ycombinator.com',
  },
  {
    id: '2',
    title: 'How Deep Work and AI Focus Sessions Double Cognitive Output',
    summary: 'Neuroscience studies confirm that structured 50-minute Pomodoro focus sprints with smart notification blocking boost retention by 80%.',
    category: 'Productivity',
    source: 'Productivity Insights',
    publishedAt: '4 hours ago',
    readTime: '6 min read',
    url: 'https://news.ycombinator.com',
  },
  {
    id: '3',
    title: 'Web Speech API & Local Large Language Models: The Future of On-Device Voice',
    summary: 'Low-latency speech-to-text combined with lightweight neural engines enable instantaneous voice command processing on browser client devices.',
    category: 'AI & Innovation',
    source: 'AI Developer Journal',
    publishedAt: '6 hours ago',
    readTime: '5 min read',
    url: 'https://news.ycombinator.com',
  },
  {
    id: '4',
    title: 'Global Tech Leaders Shift Focus to Localized Micro-Task Automation',
    summary: 'Enterprise software platforms are adopting modular dashboard architectures with smart calendar and reminder synthesis.',
    category: 'Business',
    source: 'Bloomberg Tech',
    publishedAt: '12 hours ago',
    readTime: '3 min read',
    url: 'https://news.ycombinator.com',
  },
];

/**
 * Fetches latest headlines via the backend FastAPI news route (/api/news),
 * falling back gracefully to curated articles if the external news provider is unconfigured.
 */
export async function fetchNews(category = 'Technology', search = '') {
  let articles = [];

  try {
    const res = await apiGetNews(category || 'All');
    if (res && Array.isArray(res.articles) && res.articles.length > 0) {
      articles = res.articles.map((art) => ({
        id: art.id || String(Math.random()),
        title: art.title || 'Untitled',
        summary: art.description || art.summary || '',
        category: art.category || category || 'General',
        source: art.source || 'News',
        publishedAt: art.timeAgo || art.publishedAt || 'Recently',
        readTime: art.readTime || '3 min read',
        url: art.url || '#',
      }));
    }
  } catch (err) {
    console.warn(`Backend news fetch failed for category "${category}":`, err);
  }

  // Fallback to default articles if backend is empty
  if (articles.length === 0) {
    articles = DEFAULT_NEWS;
    if (category && category !== 'All') {
      articles = articles.filter(
        (n) => n.category.toLowerCase() === category.toLowerCase()
      );
      if (articles.length === 0) articles = DEFAULT_NEWS;
    }
  }

  // Apply search query filter if provided
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    const searchFiltered = articles.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.summary && n.summary.toLowerCase().includes(q))
    );
    if (searchFiltered.length > 0) return searchFiltered;
  }

  return articles;
}
