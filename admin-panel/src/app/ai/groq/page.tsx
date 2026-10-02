'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  Sparkles,
  Cpu,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Plus,
  Save,
  Lock,
} from 'lucide-react';
import { fetchGroqTelemetry } from '@/lib/api/client';
import { INITIAL_GROQ_PROMPTS } from '@/lib/data/mockData';
import { GroqTelemetry, GroqPromptVersion } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function GroqAIPage() {
  const { hasPermission } = useAuth();
  const [telemetry, setTelemetry] = useState<GroqTelemetry | null>(null);
  const [prompts, setPrompts] = useState<GroqPromptVersion[]>(INITIAL_GROQ_PROMPTS);
  const [activeModel, setActiveModel] = useState('llama-3.3-70b-versatile');
  const [temperature, setTemperature] = useState(0.1);
  const [maxTokens, setMaxTokens] = useState(500);
  const [toastMsg, setToastMsg] = useState('');

  const canConfigure = hasPermission('ai.configure');

  useEffect(() => {
    fetchGroqTelemetry().then(setTelemetry);
  }, []);

  const handleSaveAIConfig = () => {
    if (!canConfigure) {
      setToastMsg('Permission Denied: ai.configure authorization required.');
      return;
    }
    setToastMsg(`Groq AI configuration updated to ${activeModel} (Temp: ${temperature}, Tokens: ${maxTokens}).`);
  };

  if (!telemetry) return null;

  return (
    <Shell>
      {/* Groq Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-amber-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold">
              GROQ LPU INFERENCE ENGINE
            </span>
            <span className="text-xs text-slate-400 font-mono">• Model: {activeModel}</span>
          </div>
          <h1 className="text-2xl font-black text-white">Groq AI Telemetry & Prompt Manager</h1>
          <p className="text-xs text-slate-400">
            Monitor AI latency, token costs, rate limits, and maintain versioned clinical prompt pipelines.
          </p>
        </div>

        {canConfigure && (
          <button
            onClick={handleSaveAIConfig}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
          >
            <Save className="w-4 h-4" /> Save Groq Model Config
          </button>
        )}
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Groq Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Total AI Inferences</span>
          <span className="text-2xl font-black text-white">{telemetry.totalRequests.toLocaleString()}</span>
          <span className="text-[11px] text-emerald-400 block">{telemetry.successfulRequests.toLocaleString()} Success</span>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Average LPU Latency</span>
          <span className="text-2xl font-black text-amber-400">{telemetry.avgLatencyMs} ms</span>
          <span className="text-[11px] text-slate-500 block">Sub-second response target</span>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Tokens Processed</span>
          <span className="text-2xl font-black text-sky-400">{((telemetry.tokensPrompt + telemetry.tokensCompletion) / 1000000).toFixed(2)}M</span>
          <span className="text-[11px] text-slate-500 block">Prompt: {(telemetry.tokensPrompt / 1000000).toFixed(1)}M | Comp: {(telemetry.tokensCompletion / 1000000).toFixed(1)}M</span>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Estimated Cost (MTD)</span>
          <span className="text-2xl font-black text-emerald-400">${telemetry.estimatedCostUSD}</span>
          <span className="text-[11px] text-slate-500 block">Error Rate: {telemetry.errorRatePercent}%</span>
        </div>
      </div>

      {/* Groq Model Configuration Panel */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-400" /> Active Model & Inference Controls
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Model Selection</label>
            <select
              value={activeModel}
              onChange={(e) => setActiveModel(e.target.value)}
              disabled={!canConfigure}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono focus:outline-none"
            >
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
              <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
              <option value="gemma2-9b-it">gemma2-9b-it</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Temperature ({temperature})</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              disabled={!canConfigure}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 mt-2"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Max Token Limit</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              disabled={!canConfigure}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Versioned System Prompts Pipeline */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white">Versioned Clinical System Prompts</h2>

        <div className="space-y-4">
          {prompts.map((p) => (
            <div key={p.id} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{p.title}</span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 font-mono text-[10px]">
                    v{p.version}
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-semibold">
                  {p.status}
                </span>
              </div>
              <pre className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 text-slate-300 font-mono text-[11px] whitespace-pre-wrap">
                {p.systemPrompt}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
