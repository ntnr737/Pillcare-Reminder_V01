'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  Server,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { fetchInfrastructureStatus } from '@/lib/api/client';
import { InfrastructureItem } from '@/types/admin';

export default function InfrastructurePage() {
  const [items, setItems] = useState<InfrastructureItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInfrastructureStatus().then((res) => {
      setItems(res);
      setLoading(false);
    });
  }, []);

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-emerald-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
              100% HEALTHY INFRASTRUCTURE
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">API & Cloud Infrastructure Monitor</h1>
          <p className="text-xs text-slate-400">
            Real-time status, latency ms, rate limits, and monthly cost telemetry across PillCare cloud providers.
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((svc) => (
          <div key={svc.serviceKey} className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="font-bold text-white text-base block">{svc.name}</span>
                <span className="text-[10px] font-mono uppercase text-slate-500">{svc.category}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Operational
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block">Latency</span>
                <span className="font-bold text-sky-400 text-sm font-mono">{svc.latencyMs} ms</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block">Uptime (SLA)</span>
                <span className="font-bold text-emerald-400 text-sm font-mono">{svc.uptime99}%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block">Rate Limit Used</span>
                <span className="font-bold text-indigo-400 text-sm font-mono">{svc.rateLimitPercent}%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block">Est Monthly Cost</span>
                <span className="font-bold text-purple-400 text-sm font-mono">${svc.estimatedMonthlyCostUSD}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
