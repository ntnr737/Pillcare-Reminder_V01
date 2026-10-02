'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  SlidersHorizontal,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Smartphone,
  Globe,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { fetchFeatureFlags } from '@/lib/api/client';
import { FeatureFlagRecord } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function FeatureFlagsPage() {
  const { hasPermission } = useAuth();
  const [flags, setFlags] = useState<FeatureFlagRecord[]>([]);
  const [confirmFlag, setConfirmFlag] = useState<FeatureFlagRecord | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const canEdit = hasPermission('features.edit');

  useEffect(() => {
    fetchFeatureFlags().then(setFlags);
  }, []);

  const handleToggleClick = (flag: FeatureFlagRecord) => {
    if (!canEdit) {
      setToastMsg('Permission Denied: features.edit permission required.');
      return;
    }
    if (flag.requiresConfirmation) {
      setConfirmFlag(flag);
    } else {
      executeToggle(flag.key);
    }
  };

  const executeToggle = (key: string) => {
    setFlags((prev) =>
      prev.map((f) => {
        if (f.key === key) {
          const updatedState = !f.enabled;
          return {
            ...f,
            enabled: updatedState,
            lastModifiedBy: 'admin@pillcare.in',
            lastModifiedAt: new Date().toISOString(),
          };
        }
        return f;
      })
    );
    setConfirmFlag(null);
    setToastMsg(`Feature flag ${key} successfully updated & audit logged.`);
  };

  const handleRolloutChange = (key: string, percent: number) => {
    if (!canEdit) return;
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, rolloutPercentage: percent } : f))
    );
  };

  return (
    <Shell>
      {/* Feature Flag Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-purple-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-mono font-bold">
              SYSTEM FEATURE OVERRIDE ENGINE
            </span>
            <span className="text-xs text-slate-400 font-mono">• {flags.length} Flags Configured</span>
          </div>
          <h1 className="text-2xl font-black text-white">App Feature Flags & Granular Rollouts</h1>
          <p className="text-xs text-slate-400">
            Control live app capabilities, set percentage rollouts, and restrict beta features by country or platform.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Feature Flags Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {flags.map((flag) => (
          <div
            key={flag.key}
            className={`p-6 rounded-3xl glass-card border transition-all space-y-4 ${
              flag.enabled ? 'border-slate-800 hover:border-purple-500/40' : 'border-slate-900 opacity-80'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-white">{flag.name}</span>
                  {flag.isBetaOnly && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-mono font-bold">
                      BETA
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-purple-400 block">{flag.key}</span>
              </div>

              {/* ON/OFF Switch */}
              <button
                onClick={() => handleToggleClick(flag)}
                disabled={!canEdit}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  flag.enabled ? 'bg-purple-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    flag.enabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                ></span>
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{flag.description}</p>

            {/* Percentage Rollout Slider */}
            <div className="space-y-1 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Percentage Rollout</span>
                <span className="text-purple-400 font-mono font-bold">{flag.rolloutPercentage}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={flag.rolloutPercentage}
                onChange={(e) => handleRolloutChange(flag.key, parseInt(e.target.value))}
                disabled={!canEdit || !flag.enabled}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Targeting Chips */}
            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 flex items-center gap-1">
                <Globe className="w-3 h-3 text-sky-400" /> {flag.countries.join(', ')}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-indigo-400" /> {flag.platforms.join(' & ')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Dangerous Confirmation Modal */}
      {confirmFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl glass-card border border-amber-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Confirm Critical Feature Toggle</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are toggling <strong className="text-white">{confirmFlag.name}</strong> ({confirmFlag.key}). This action directly impacts live mobile app user sessions.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setConfirmFlag(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={() => executeToggle(confirmFlag.key)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20"
              >
                Confirm & Audit Log Action
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
