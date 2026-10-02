'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Users, DollarSign, SlidersHorizontal, Pill, Bell, FileText, History, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { INITIAL_USERS, INITIAL_FEATURE_FLAGS, INITIAL_MEDICATIONS, INITIAL_AUDIT_LOGS } from '@/lib/data/mockData';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const usersMatch = INITIAL_USERS.filter(
    (u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())
  );

  const flagsMatch = INITIAL_FEATURE_FLAGS.filter(
    (f) => f.name.toLowerCase().includes(query.toLowerCase()) || f.key.toLowerCase().includes(query.toLowerCase())
  );

  const medsMatch = INITIAL_MEDICATIONS.filter(
    (m) => m.brandName.toLowerCase().includes(query.toLowerCase()) || m.genericName.toLowerCase().includes(query.toLowerCase())
  );

  const auditsMatch = INITIAL_AUDIT_LOGS.filter(
    (a) => a.action.toLowerCase().includes(query.toLowerCase()) || a.adminEmail.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (url: string) => {
    router.push(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl glass-card border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-sky-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Global Search: Type user name, email, feature flag, drug, audit action..."
            className="flex-1 bg-transparent text-slate-100 text-sm focus:outline-none placeholder-slate-500 font-medium"
            autoFocus
          />
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {query.trim() === '' && (
            <div className="py-8 text-center text-slate-500 space-y-2">
              <p className="font-semibold text-slate-400">PillCare Spotlight Search</p>
              <p className="text-xs">Type anything to query Users, Subscriptions, Flags, Medication Catalog, and Audit Logs across the platform.</p>
            </div>
          )}

          {/* User Results */}
          {usersMatch.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Users ({usersMatch.length})
              </div>
              <div className="space-y-1">
                {usersMatch.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelect(`/users?search=${encodeURIComponent(u.email)}`)}
                    className="w-full p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-sky-500/40 hover:bg-slate-800/60 transition-all flex items-center justify-between group text-left"
                  >
                    <div>
                      <span className="font-semibold text-slate-200 block">{u.name}</span>
                      <span className="text-slate-400 text-[11px]">{u.email} • Plan: {u.plan} • {u.city}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feature Flag Results */}
          {flagsMatch.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" /> Feature Flags ({flagsMatch.length})
              </div>
              <div className="space-y-1">
                {flagsMatch.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => handleSelect('/app-control/feature-flags')}
                    className="w-full p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-purple-500/40 hover:bg-slate-800/60 transition-all flex items-center justify-between group text-left"
                  >
                    <div>
                      <span className="font-semibold text-slate-200 block">{f.name} ({f.key})</span>
                      <span className="text-slate-400 text-[11px]">Status: {f.enabled ? 'ON' : 'OFF'} • Rollout: {f.rolloutPercentage}%</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Medication Results */}
          {medsMatch.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-emerald-400" /> Medications ({medsMatch.length})
              </div>
              <div className="space-y-1">
                {medsMatch.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelect('/app-control/medication')}
                    className="w-full p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/40 hover:bg-slate-800/60 transition-all flex items-center justify-between group text-left"
                  >
                    <div>
                      <span className="font-semibold text-slate-200 block">{m.brandName}</span>
                      <span className="text-slate-400 text-[11px]">{m.genericName}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Shortcut Helper */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>Navigate with mouse or keyboard</span>
          <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
