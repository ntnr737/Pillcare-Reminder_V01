'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  Tag,
  ArrowRight,
  ShieldCheck,
  History,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Plus,
  Lock,
} from 'lucide-react';
import { fetchGTMConfig } from '@/lib/api/client';
import { GTMContainerConfig, GTMEventMap } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function GTMPage() {
  const { hasPermission } = useAuth();
  const [config, setConfig] = useState<GTMContainerConfig | null>(null);
  const [publishStep, setPublishStep] = useState<'Draft' | 'Review' | 'Approved' | 'Published'>('Published');
  const [publishing, setPublishing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    fetchGTMConfig().then(({ data }) => {
      setConfig(data);
      setPublishStep(data.status);
    });
  }, []);

  const canPublish = hasPermission('gtm.publish');

  const handlePublish = () => {
    if (!canPublish) {
      setToastMsg('Permission Denied: You need gtm.publish authorization to publish container changes.');
      return;
    }
    setPublishing(true);
    setTimeout(() => {
      setPublishing(false);
      setPublishStep('Published');
      if (config) {
        setConfig({
          ...config,
          publishedVersion: config.publishedVersion + 1,
          draftVersion: config.publishedVersion + 2,
          lastPublishedAt: new Date().toISOString(),
        });
      }
      setToastMsg('GTM Container Version successfully published & audit logged.');
    }, 1000);
  };

  const handleRollback = () => {
    if (!canPublish) {
      setToastMsg('Permission Denied: gtm.publish authorization required.');
      return;
    }
    if (config && config.publishedVersion > 1) {
      setConfig({
        ...config,
        publishedVersion: config.publishedVersion - 1,
      });
      setToastMsg(`Rolled back container to Version ${config.publishedVersion - 1}. Action logged to audit trail.`);
    }
  };

  if (!config) return null;

  return (
    <Shell>
      {/* GTM Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-cyan-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold">
              GOOGLE TAG MANAGER PIPELINE
            </span>
            <span className="text-xs text-slate-400 font-mono">• Container ID: {config.containerId}</span>
          </div>
          <h1 className="text-2xl font-black text-white">GTM & Conversion Tracking Center</h1>
          <p className="text-xs text-slate-400">
            Map application events, define triggers, and manage container draft/approval/publishing lifecycles.
          </p>
        </div>

        {/* Publishing Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRollback}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Rollback to v{config.publishedVersion - 1}
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing || !canPublish}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
              canPublish
                ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            {!canPublish && <Lock className="w-3.5 h-3.5" />}
            {publishing ? 'Deploying Container...' : `Publish Version ${config.draftVersion}`}
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Container Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Published Version</span>
          <span className="text-2xl font-black text-cyan-400">v{config.publishedVersion}</span>
          <span className="text-[11px] text-slate-500 block">Draft Version: v{config.draftVersion}</span>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Active Tags</span>
          <span className="text-2xl font-black text-white">{config.tagsCount}</span>
          <span className="text-[11px] text-slate-500 block">GA4, Meta CAPI, Google Ads</span>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Triggers Configured</span>
          <span className="text-2xl font-black text-white">{config.triggersCount}</span>
          <span className="text-[11px] text-slate-500 block">Custom & DataLayer Events</span>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Variables</span>
          <span className="text-2xl font-black text-white">{config.variablesCount}</span>
          <span className="text-[11px] text-slate-500 block">DataLayer & User Properties</span>
        </div>
      </div>

      {/* Container Pipeline Stage Visualizer */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" /> Container Publishing Pipeline Lifecycle
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {(['Draft', 'Review', 'Approved', 'Published'] as const).map((stage, i) => {
            const isCurrent = publishStep === stage;
            return (
              <div
                key={stage}
                className={`p-4 rounded-2xl border transition-all text-center space-y-1 ${
                  isCurrent
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider block text-slate-500">Stage 0{i + 1}</span>
                <span className="text-sm font-bold block">{stage}</span>
                <span className="text-[10px] block opacity-80">{isCurrent ? 'Active Container State' : 'Pipeline Phase'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Event Mapping Interface (PillCare Event -> GA4 -> GTM -> Marketing) */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Event Mapping & Conversion Matrix</h2>
            <p className="text-xs text-slate-400">Maps internal PillCare mobile app events to GTM triggers & ad network conversions</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-cyan-400 font-semibold hover:border-cyan-500/40">
            <Plus className="w-3.5 h-3.5" /> Map New Event
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">PillCare App Event</th>
                <th className="py-3 px-4">GA4 DataLayer Event</th>
                <th className="py-3 px-4">GTM Trigger ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Marketing Destination</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {config.eventMappings.map((m) => (
                <tr key={m.pillcareEvent} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">{m.pillcareEvent}</td>
                  <td className="py-3.5 px-4 text-sky-400">{m.ga4Event}</td>
                  <td className="py-3.5 px-4 text-indigo-400">{m.gtmTrigger}</td>
                  <td className="py-3.5 px-4">
                    {m.isConversion ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
                        CONVERSION
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                        Telemetry
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-200 font-sans font-medium">{m.marketingDestination}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
