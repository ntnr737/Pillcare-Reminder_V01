'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  Tag,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { fetchGTMConfig } from '@/lib/api/client';
import { GTMContainerConfig } from '@/types/admin';

export default function GTMPage() {
  const [config, setConfig] = useState<GTMContainerConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchGTMConfig().then(({ data, isConfigured }) => {
      setConfig(data);
      setIsConfigured(isConfigured);
    });
  }, []);

  return (
    <Shell>
      {/* GTM Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-cyan-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold">
              GOOGLE TAG MANAGER PIPELINE
            </span>
            <span className={`text-xs font-mono ${isConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
              • {isConfigured ? `Container ID: ${config?.containerId}` : 'Integration Not Configured'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">GTM & Conversion Tracking Center</h1>
          <p className="text-xs text-slate-400">
            Map application events, define triggers, and manage container draft/approval/publishing lifecycles.
          </p>
        </div>
      </div>

      {!isConfigured || !config ? (
        <div className="py-16 px-6 rounded-3xl glass-card border border-amber-500/30 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Integration Not Configured</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Google Tag Manager API container ID is not set for this environment. Configure <code className="text-amber-400 bg-slate-900 px-2 py-0.5 rounded">GTM_CONTAINER_ID</code> to enable GTM conversion tag deployment.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 text-left space-y-1">
            <span className="text-slate-300 font-bold block">Production Environment Requirement:</span>
            <p>GTM_CONTAINER_ID=GTM-W8T9DWZL</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-2">
            <h2 className="text-base font-bold text-white">Container ID: {config.containerId}</h2>
            <p className="text-xs text-slate-400">Status: {config.status} | Version: v{config.publishedVersion}</p>
          </div>
        </div>
      )}
    </Shell>
  );
}
