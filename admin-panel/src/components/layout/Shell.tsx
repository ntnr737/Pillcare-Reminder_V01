'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import GlobalSearchModal from '@/components/search/GlobalSearchModal';
import { DateRangePreset } from '@/types/admin';

export default function Shell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangePreset>('30d');

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col pl-64 min-w-0 transition-all duration-300">
        {/* Top Header Bar */}
        <Topbar
          onOpenSearch={() => setSearchOpen(true)}
          selectedRange={dateRange}
          onRangeChange={setDateRange}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>

      {/* Spotlight CMD+K Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
