import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50/85 dark:bg-[#070B18]/50 text-slate-900 dark:text-slate-100 transition-colors flex relative">
      {/* FIXED STATIC SIDEBAR */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* MAIN CONTENT CONTAINER (Offsetted by 260px / 64 tailwind width on large screens) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 min-h-screen relative z-10">
        <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        
        {/* Scrollable Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
