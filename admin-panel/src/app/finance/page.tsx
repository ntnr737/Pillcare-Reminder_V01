'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  PieChart,
  ShieldCheck,
  Download,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { fetchFinancialSummary } from '@/lib/api/client';
import { FinancialSummary } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const [finData, setFinData] = useState<FinancialSummary | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');

  const canViewFinance = hasPermission('finance.view');
  const canRefund = hasPermission('finance.refund');
  const canExport = hasPermission('finance.export');

  useEffect(() => {
    fetchFinancialSummary().then(({ data, source }) => {
      setFinData(data);
      setSourceLabel(source);
    });
  }, []);

  if (!canViewFinance) {
    return (
      <Shell>
        <div className="py-20 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Restricted</h2>
          <p className="text-xs text-slate-400 max-w-md">
            You do not have <code className="text-rose-400">finance.view</code> permissions required to inspect executive revenue & billing ledgers.
          </p>
        </div>
      </Shell>
    );
  }

  if (!finData) return null;

  return (
    <Shell>
      {/* Finance Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-indigo-950/30">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
              HIGHLY PROTECTED FINANCIAL COMMAND
            </span>
            <span className="text-xs text-slate-400 font-mono">• {sourceLabel}</span>
          </div>
          <h1 className="text-2xl font-black text-white">Financial Command Center</h1>
          <p className="text-xs text-slate-400">
            Gross & Net Revenue ledgers, Razorpay/Stripe subscription cohorts, and JP Morgan Unit Economics.
          </p>
        </div>

        {canExport && (
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-200 text-xs font-medium transition-all shadow-sm">
            <Download className="w-4 h-4 text-emerald-400" /> Export Financial Ledger (CSV)
          </button>
        )}
      </div>

      {/* Top Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Gross Revenue (MTD)</span>
          <span className="text-2xl font-black text-white">₹{finData.grossRevenue.toLocaleString()}</span>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" /> +16.4% MoM
          </span>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Net Revenue (After Taxes & Fees)</span>
          <span className="text-2xl font-black text-emerald-400">₹{finData.netRevenue.toLocaleString()}</span>
          <span className="text-[11px] text-slate-500 block">GST (18%): ₹{finData.payments.taxesGST.toLocaleString()}</span>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Monthly Recurring Revenue (MRR)</span>
          <span className="text-2xl font-black text-sky-400">₹{finData.mrr.toLocaleString()}</span>
          <span className="text-[11px] text-slate-400 block">ARR: ₹{(finData.arr / 100000).toFixed(2)} Lakhs</span>
        </div>

        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Unit Economics (LTV : CAC)</span>
          <span className="text-2xl font-black text-purple-400">{finData.unitEconomics.ltvCacRatio}x</span>
          <span className="text-[11px] text-slate-400 block">CAC ₹{finData.unitEconomics.cac} | LTV ₹{finData.unitEconomics.ltv}</span>
        </div>
      </div>

      {/* Subscription Breakdown & Unit Economics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan */}
        <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center justify-between">
            <span>Subscription Tier Breakdown</span>
            <span className="text-xs font-mono text-slate-400 font-normal">Active: {finData.subscriptions.active}</span>
          </h2>

          <div className="space-y-3">
            {finData.revenueByPlan.map((plan) => (
              <div key={plan.plan} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-200">{plan.plan}</span>
                  <span className="font-bold text-emerald-400 font-mono">₹{plan.revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{plan.count} Active Subscribers</span>
                  <span>Share: {((plan.revenue / finData.grossRevenue) * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* JP Morgan Unit Economics */}
        <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white">JP Morgan Unit Economics & Margins</h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">Customer Acquisition Cost (CAC)</span>
              <span className="font-black text-white text-lg">₹{finData.unitEconomics.cac}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">Customer Lifetime Value (LTV)</span>
              <span className="font-black text-emerald-400 text-lg">₹{finData.unitEconomics.ltv}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">Gross Margin %</span>
              <span className="font-black text-sky-400 text-lg">{finData.unitEconomics.grossMarginPercent}%</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">Contribution Margin %</span>
              <span className="font-black text-indigo-400 text-lg">{finData.unitEconomics.contributionMarginPercent}%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs flex justify-between items-center text-slate-300">
            <span>Marketing Spend: ₹{finData.unitEconomics.marketingSpend.toLocaleString()}</span>
            <span>Cost per Acquisition: ₹{finData.unitEconomics.costPerAcquisition}</span>
          </div>
        </div>
      </div>

      {/* Security & Payment Credentials Policy Notice */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-3 font-mono">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <span>
          FINANCIAL PRIVACY COMPLIANCE: Raw credit card numbers, CVV codes, bank credentials and gateway secret tokens are NEVER stored in PillCare databases or exposed in API payloads.
        </span>
      </div>
    </Shell>
  );
}
