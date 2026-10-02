'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  Users,
  TrendingUp,
  DollarSign,
  Pill,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap,
  Shield,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Sparkles,
  Info,
  X,
  CreditCard,
} from 'lucide-react';
import { fetchExecutiveKPIs } from '@/lib/api/client';
import { ExecutiveKPIs } from '@/types/admin';

export default function ExecutiveDashboard() {
  const [kpis, setKpis] = useState<ExecutiveKPIs | null>(null);
  const [dataLabel, setDataLabel] = useState('Loading live telemetry...');
  const [activeDrilldown, setActiveDrilldown] = useState<{ title: string; detail: string; metric: string } | null>(null);

  useEffect(() => {
    fetchExecutiveKPIs().then(({ data, source }) => {
      setKpis(data);
      setDataLabel(source);
    });
  }, []);

  if (!kpis) {
    return (
      <Shell>
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
          <span className="text-sm font-medium text-slate-400">Loading PillCare Executive Control Center...</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Top Banner / Pulse Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-sky-500/20 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold tracking-wide">
              LIVE TELEMETRY
            </span>
            <span className="text-xs text-slate-400 font-mono">• {dataLabel}</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Executive Control Center</h1>
          <p className="text-xs text-slate-300">
            Real-time business performance, dosage adherence, financial health, and AI telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <div className="px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">System Adherence</span>
            <span className="text-sm font-bold text-emerald-400">91.2%</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">MRR Growth</span>
            <span className="text-sm font-bold text-sky-400">+14.8%</span>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (Drill-down supported on click) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Users */}
        <div
          onClick={() =>
            setActiveDrilldown({
              title: 'Active Users Breakdown',
              metric: `${kpis.mau.toLocaleString()} MAU`,
              detail: `DAU: ${kpis.dau.toLocaleString()} • WAU: ${kpis.wau.toLocaleString()} • New Users Today: ${kpis.newUsers.toLocaleString()} • Returning: ${kpis.returningUsers.toLocaleString()}`,
            })
          }
          className="p-5 rounded-2xl glass-card border border-slate-800 hover:border-sky-500/40 transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Monthly Active Users (MAU)</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-white">{kpis.mau.toLocaleString()}</span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> +12.4%
              </span>
              <span className="text-slate-500">vs prev 30d</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>DAU: {kpis.dau.toLocaleString()}</span>
            <span>WAU: {kpis.wau.toLocaleString()}</span>
          </div>
        </div>

        {/* KPI 2: MRR & ARR */}
        <div
          onClick={() =>
            setActiveDrilldown({
              title: 'Recurring Revenue Breakdown',
              metric: `₹${(kpis.mrr / 1000).toFixed(1)}k MRR`,
              detail: `ARR: ₹${(kpis.arr / 100000).toFixed(2)} Lakhs • Active Subscriptions: ${kpis.activeSubscriptions} • ARPU: ₹${kpis.arpu} • Churn: ${kpis.churnRate}%`,
            })
          }
          className="p-5 rounded-2xl glass-card border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Monthly Recurring Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-white">₹{kpis.mrr.toLocaleString()}</span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> +18.2%
              </span>
              <span className="text-slate-500">ARR: ₹{(kpis.arr / 100000).toFixed(1)}L</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Subs: {kpis.activeSubscriptions}</span>
            <span>ARPU: ₹{kpis.arpu}</span>
          </div>
        </div>

        {/* KPI 3: Dose Reminders Logged */}
        <div
          onClick={() =>
            setActiveDrilldown({
              title: 'Medication Dose Reminders',
              metric: `${kpis.remindersCompleted.toLocaleString()} Doses Taken`,
              detail: `Created: ${kpis.remindersCreated.toLocaleString()} • Completed: ${kpis.remindersCompleted.toLocaleString()} • Missed: ${kpis.remindersMissed.toLocaleString()} • Adherence Rate: ${((kpis.remindersCompleted / kpis.remindersCreated) * 100).toFixed(1)}%`,
            })
          }
          className="p-5 rounded-2xl glass-card border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Doses Taken Today</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-white">{kpis.remindersCompleted.toLocaleString()}</span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-emerald-400 font-semibold flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5" /> 91.2% Adherence
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Missed: {kpis.remindersMissed.toLocaleString()}</span>
            <span>Created: {kpis.remindersCreated.toLocaleString()}</span>
          </div>
        </div>

        {/* KPI 4: Unit Economics (LTV : CAC) */}
        <div
          onClick={() =>
            setActiveDrilldown({
              title: 'Unit Economics & CAC/LTV',
              metric: `LTV:CAC ratio ${(kpis.ltv / kpis.cac).toFixed(2)}x`,
              detail: `CAC: ₹${kpis.cac} • LTV: ₹${kpis.ltv} • Trial Conversion: ${kpis.trialConversionRate}% • Trial Users: ${kpis.trialUsers}`,
            })
          }
          className="p-5 rounded-2xl glass-card border border-slate-800 hover:border-purple-500/40 transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">LTV : CAC Ratio</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-white">{(kpis.ltv / kpis.cac).toFixed(1)}x</span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-slate-300">LTV ₹{kpis.ltv} vs CAC ₹{kpis.cac}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Trial Conv: {kpis.trialConversionRate}%</span>
            <span>Trial Users: {kpis.trialUsers}</span>
          </div>
        </div>
      </div>

      {/* Cohort Retention & System Health Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Retention Cohort Heatmap */}
        <div className="lg:col-span-2 p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">User Retention & Cohort Performance</h2>
              <p className="text-xs text-slate-400">Percentage of active users returning after registration</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
              D1 / D7 / D30 Matrix
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center space-y-1">
              <span className="text-xs text-slate-400 font-medium block">D1 Retention</span>
              <span className="text-2xl font-black text-sky-400">{kpis.retentionD1}%</span>
              <span className="text-[10px] text-slate-500 block">First Day Returners</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center space-y-1">
              <span className="text-xs text-slate-400 font-medium block">D7 Retention</span>
              <span className="text-2xl font-black text-indigo-400">{kpis.retentionD7}%</span>
              <span className="text-[10px] text-slate-500 block">7-Day Habit Benchmark</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center space-y-1">
              <span className="text-xs text-slate-400 font-medium block">D30 Retention</span>
              <span className="text-2xl font-black text-emerald-400">{kpis.retentionD30}%</span>
              <span className="text-[10px] text-slate-500 block">30-Day Long-term Retained</span>
            </div>
          </div>

          {/* Quick Telemetry Indicators */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 text-[11px] block">Engagement Rate</span>
              <span className="font-bold text-white text-sm">{kpis.engagementRate}%</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">API Costs (Est)</span>
              <span className="font-bold text-white text-sm">${kpis.apiCostsUSD}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Error Rate</span>
              <span className="font-bold text-emerald-400 text-sm">{kpis.errorRate}%</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">App Crash Rate</span>
              <span className="font-bold text-emerald-400 text-sm">{kpis.crashRate}%</span>
            </div>
          </div>
        </div>

        {/* Executive Action Radar (Section 26 Questions) */}
        <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-white">Executive Action Radar</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200 block">User Acquisition Normal</span>
                <span className="text-slate-400 text-[11px]">Organic Google search & Doctor QR referrals generating 66.7% of new signups.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200 block">Medication Adherence Healthy</span>
                <span className="text-slate-400 text-[11px]">39,120 doses completed out of 42,890 scheduled (91.2%).</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200 block">Groq AI Token Utilization</span>
                <span className="text-slate-400 text-[11px]">Token consumption tracking at $14.82/mo. Llama 3.3 model latency optimal (240ms).</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drill-down Modal */}
      {activeDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl glass-card border border-sky-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">{activeDrilldown.title}</h3>
              <button onClick={() => setActiveDrilldown(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-center">
              <span className="text-3xl font-black text-sky-400">{activeDrilldown.metric}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              {activeDrilldown.detail}
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveDrilldown(null)}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold"
              >
                Close Drill-down
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
