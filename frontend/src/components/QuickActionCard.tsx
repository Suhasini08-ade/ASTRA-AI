import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon, ArrowUpRight } from 'lucide-react';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  borderColor: string;
  onClick: () => void;
  badge?: string;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  icon: Icon,
  gradient,
  borderColor,
  onClick,
  badge,
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.025, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      onClick={onClick}
      className={`relative group cursor-pointer p-5 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-white/10 ${borderColor} transition-all duration-300 shadow-lg hover:shadow-2xl overflow-hidden`}
    >
      {/* Top Gradient Border Highlight */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-80 group-hover:opacity-100 transition-opacity`} />

      {/* Subtle Background Glow on Hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none`} />

      <div className="flex items-start justify-between relative z-10">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md group-hover:shadow-cyan-500/20 transition-all duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
        
        {badge ? (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {badge}
          </span>
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-white/10 transition-all">
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        )}
      </div>

      <div className="mt-4 relative z-10">
        <h3 className="text-base font-bold text-white group-hover:text-cyan-200 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2 group-hover:text-slate-300 transition-colors">
          {description}
        </p>
      </div>
    </motion.div>
  );
};
