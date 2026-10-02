'use client';

import React, { useState } from 'react';
import { Search, Calendar, Bell, Shield, LogOut, CheckCircle2, ChevronDown, Monitor, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DateRangePreset } from '@/types/admin';

interface TopbarProps {
  onOpenSearch: () => void;
  selectedRange: DateRangePreset;
  onRangeChange: (range: DateRangePreset) => void;
}

const DATE_PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
  { label: '6 Months', value: '6m' },
  { label: '12 Months', value: '12m' },
];

export default function Topbar({ onOpenSearch, selectedRange, onRangeChange }: TopbarProps) {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 glass-panel border-b border-slate-800 px-6 flex items-center justify-between">
      {/* Left: Global Search Trigger */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all text-xs w-64 md:w-80 shadow-inner group"
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-sky-400 transition-colors" />
          <span className="flex-1 text-left">Search users, MRR, flags, AI logs...</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
            ⌘K
          </kbd>
        </button>

        {/* Live System Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>FastAPI + MongoDB Engine Operational</span>
        </div>
      </div>

      {/* Right Tools: Date Range, Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* Global Date Range Selector */}
        <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <Calendar className="w-3.5 h-3.5 text-sky-400" />
          <select
            value={selectedRange}
            onChange={(e) => onRangeChange(e.target.value as DateRangePreset)}
            className="bg-transparent text-slate-200 focus:outline-none font-medium cursor-pointer"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value} className="bg-slate-900 text-slate-200">
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors relative"
            title="System Alerts & Telemetry"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sky-400 ring-2 ring-slate-950"></span>
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl glass-card border border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Real-time System Feed
                </span>
                <span className="text-[10px] text-slate-400">3 Unread</span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400">
                    <span>⚡ GTM Container Published</span>
                    <span className="text-[10px] text-slate-400">10m ago</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">Version 14 approved and deployed to production.</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400">
                    <span>💳 Razorpay Webhook Sync</span>
                    <span className="text-[10px] text-slate-400">42m ago</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">+16 New Premium subscriptions processed (₹15,840).</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Admin User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all text-xs"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xs">
              {user?.name?.[0] || 'A'}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="font-semibold text-slate-200 leading-none">{user?.name || 'Admin'}</span>
              <span className="text-[10px] text-sky-400 font-mono mt-0.5 leading-none">{user?.role || 'SUPER_ADMIN'}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-card border border-slate-800 shadow-2xl p-3 z-50">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 mb-2">
                <span className="text-xs font-bold text-white block truncate">{user?.name}</span>
                <span className="text-[11px] text-slate-400 block truncate">{user?.email}</span>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                    2FA Verified
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-mono">
                    {user?.role}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <a
                  href="/security"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800/60 transition-colors"
                >
                  <Shield className="w-4 h-4 text-sky-400" /> Security & 2FA Settings
                </a>
                <a
                  href="/security"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800/60 transition-colors"
                >
                  <Monitor className="w-4 h-4 text-indigo-400" /> Active Sessions ({user?.activeSessions.length || 1})
                </a>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors text-left font-medium mt-1 border-t border-slate-800/80 pt-2"
                >
                  <LogOut className="w-4 h-4" /> End Admin Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
