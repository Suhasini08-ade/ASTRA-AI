import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, 
  Search, 
  Check, 
  Sliders, 
  Sparkles, 
  Zap, 
  Settings, 
  ExternalLink, 
  ShieldCheck,
  MessageSquare,
  Mic,
  FileText,
  CheckSquare,
  Bell,
  Calendar,
  CloudSun,
  Newspaper,
  FileSearch,
  Languages,
  Calculator,
  BookOpen,
  Mail,
  DollarSign,
  Activity,
  Timer,
  QrCode,
  ArrowLeftRight,
  Key,
  CheckCircle2
} from 'lucide-react';
import { FeatureModule, TabType } from '../types';

interface FeatureMarketplacePageProps {
  features: FeatureModule[];
  setFeatures: React.Dispatch<React.SetStateAction<FeatureModule[]>>;
  setActiveTab: (tab: TabType) => void;
  setSelectedToolId?: (toolId: string) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  MessageSquare,
  Mic,
  FileText,
  CheckSquare,
  Bell,
  Calendar,
  CloudSun,
  Newspaper,
  FileSearch,
  Languages,
  Calculator,
  BookOpen,
  Mail,
  DollarSign,
  Activity,
  Timer,
  QrCode,
  ArrowLeftRight,
  Key,
};

export const FeatureMarketplacePage: React.FC<FeatureMarketplacePageProps> = ({
  features,
  setFeatures,
  setActiveTab,
  setSelectedToolId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 3000);
  };

  const handleToggleModule = (id: string) => {
    setFeatures((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const newState = !m.isEnabled;
          showToast(`${m.name} is now ${newState ? 'ENABLED' : 'DISABLED'}. Navigation updated.`);
          return { ...m, isEnabled: newState };
        }
        return m;
      })
    );
  };

  const categories = ['All', 'Core AI', 'Productivity', 'Utilities', 'Intelligence'];

  const filteredFeatures = features.filter((feat) => {
    const matchesSearch =
      feat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feat.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || feat.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const enabledCount = features.filter((f) => f.isEnabled).length;

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastText && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-blue-600/90 border border-blue-400/30 text-white shadow-2xl flex items-center space-x-3 text-xs font-semibold backdrop-blur-xl"
          >
            <CheckCircle2 className="w-5 h-5 text-cyan-300 shrink-0" />
            <span>{toastText}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Banner */}
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden bg-gradient-to-br from-[#161B30] via-[#0D1428] to-[#0A0E1A] border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-widest flex items-center space-x-1.5">
                <Store className="w-3.5 h-3.5 text-purple-400" />
                <span>Modular Architecture</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Feature & Extension Marketplace
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Dynamically activate, customize, or disable AI productivity tools, calculators, timers, and translators.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center space-x-4 shrink-0 backdrop-blur-xl">
            <div className="text-center">
              <div className="text-2xl font-black text-blue-400">{enabledCount} / {features.length}</div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Modules</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <button
              onClick={() => {
                setFeatures((prev) => prev.map((f) => ({ ...f, isEnabled: true })));
                showToast('All marketplace features enabled!');
              }}
              className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold text-xs border border-blue-500/30 transition-colors"
            >
              Enable All
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features, tools, or AI modules..."
            className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredFeatures.map((module) => {
          const IconComp = ICON_MAP[module.icon] || Zap;

          return (
            <div
              key={module.id}
              className={`p-5 rounded-3xl border transition-all relative flex flex-col justify-between group ${
                module.isEnabled
                  ? 'bg-gradient-to-b from-white/10 to-white/5 border-white/15 shadow-xl hover:border-blue-500/40'
                  : 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                        module.isEnabled
                          ? 'bg-gradient-to-tr from-blue-600 to-purple-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors">
                        {module.name}
                      </h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5">
                        {module.category}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleModule(module.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      module.isEnabled ? 'bg-blue-600' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        module.isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {module.description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-[10px] font-semibold text-slate-500">
                  {module.isEnabled ? '● Active in Sidebar' : '○ Disabled'}
                </span>

                {module.isEnabled && (
                  <button
                    onClick={() => {
                      if (module.routeTab) {
                        if (module.toolId && setSelectedToolId) {
                          setSelectedToolId(module.toolId);
                        }
                        setActiveTab(module.routeTab);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-blue-300 font-semibold border border-white/10 flex items-center space-x-1.5 transition-all"
                  >
                    <span>Launch</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
