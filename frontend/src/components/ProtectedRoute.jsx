import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles as LuSparkles, Loader2 as LuLoader2 } from 'lucide-react';

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050816] text-[#F8FAFC] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 animate-pulse">
          <LuSparkles className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <LuLoader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Authenticating ASTRA session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
