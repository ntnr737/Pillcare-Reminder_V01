'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  BarChart3,
  Globe,
  Download,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { fetchGA4Analytics } from '@/lib/api/client';
import { GA4AnalyticsData } from '@/types/admin';

export default function GA4AnalyticsPage() {
  const [ga4Data, setGa4Data] = useState<GA4AnalyticsData | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchGA4Analytics().then(({ data, isConfigured }) => {
      setGa4Data(data);
      setIsConfigured(isConfigured);
    });
  }, []);

  return (
    <Shell>
      {/* GA4 Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-sky-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-mono font-bold">
              GOOGLE ANALYTICS 4 DATASTREAM
            </span>
            <span className={`text-xs font-mono ${isConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
              • {isConfigured ? 'GA4 Measurement Active' : 'Integration Not Configured'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Google Analytics 4 Command Center</h1>
          <p className="text-xs text-slate-400">
            Real-time web & mobile application telemetry retrieved from official Google Analytics 4 Data API.
          </p>
        </div>
      </div>

      {!isConfigured || !ga4Data ? (
        <div className="py-16 px-6 rounded-3xl glass-card border border-amber-500/30 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Integration Not Configured</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Google Analytics 4 API credentials are not set for this environment. To enable real-time GA4 stream ingestion, set <code className="text-amber-400 bg-slate-900 px-2 py-0.5 rounded">GA4_PROPERTY_ID</code> in environment settings.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 text-left space-y-1">
            <span className="text-slate-300 font-bold block">Production Environment Requirement:</span>
            <p>GA4_PROPERTY_ID=properties/123456789</p>
            <p>GA4_CLIENT_EMAIL=pillcare-ga4@gcp-project.iam.gserviceaccount.com</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active GA4 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Real-Time Users</span>
              <span className="text-3xl font-black text-white">{ga4Data.realtimeUsers}</span>
            </div>
            <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Total Sessions</span>
              <span className="text-3xl font-black text-white">{ga4Data.sessions}</span>
            </div>
            <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Avg Engagement Time</span>
              <span className="text-3xl font-black text-white">{ga4Data.avgEngagementTime}</span>
            </div>
            <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Screen Views</span>
              <span className="text-3xl font-black text-white">{ga4Data.screenViews}</span>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
