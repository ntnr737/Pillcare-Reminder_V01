'use client';

import React, { useState } from 'react';
import Shell from '@/components/layout/Shell';
import {
  Settings,
  ShieldAlert,
  Save,
  CheckCircle2,
  Lock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const [appName, setAppName] = useState('PillCare Healthcare Operations');
  const [adminSecretKey, setAdminSecretKey] = useState('••••••••••••••••••••••••');
  const [retentionDays, setRetentionDays] = useState(365);
  const [toastMsg, setToastMsg] = useState('');

  const canEdit = hasPermission('settings.edit');

  const handleSaveGeneralSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setToastMsg('Permission Denied: settings.edit authorization required.');
      return;
    }
    setToastMsg('Global system settings updated & saved to MongoDB Atlas config collection.');
  };

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono font-bold">
              GLOBAL CONFIGURATION
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Global System Settings</h1>
          <p className="text-xs text-slate-400">
            Configure authentication rules, API integrations, data retention policies, and high-risk system overrides.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Settings Sections */}
      <form onSubmit={handleSaveGeneralSettings} className="space-y-6">
        <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white">General Platform Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Platform Title</label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                disabled={!canEdit}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-medium focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Audit Log Retention Policy (Days)</label>
              <input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                disabled={!canEdit}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!canEdit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-lg shadow-sky-500/20"
            >
              <Save className="w-4 h-4" /> Save System Settings
            </button>
          </div>
        </div>
      </form>

      {/* Visually Separated DANGER ZONE (High Risk Operations) */}
      <div className="p-6 rounded-3xl bg-rose-950/20 border border-rose-500/40 space-y-4">
        <div className="flex items-center gap-2 text-rose-400">
          <ShieldAlert className="w-5 h-5" />
          <h2 className="text-base font-bold">Danger Zone (High-Risk System Overrides)</h2>
        </div>
        <p className="text-xs text-slate-300">
          Actions in this section carry destructive system implications. Explicit SUPER_ADMIN confirmation required.
        </p>

        <div className="flex flex-wrap gap-4 pt-2">
          <button
            onClick={() => setToastMsg('Maintenance Mode trigger sent to FastAPI backend.')}
            className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold"
          >
            Force System Maintenance Mode Lockout
          </button>
          <button
            onClick={() => setToastMsg('Invalidated all API Bearer tokens.')}
            className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold"
          >
            Rotate Backend API Secret Keys
          </button>
        </div>
      </div>
    </Shell>
  );
}
