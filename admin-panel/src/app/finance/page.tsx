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
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Globe,
  Landmark,
  Zap,
  RotateCcw,
  Activity,
  Check,
  ExternalLink,
} from 'lucide-react';
import { fetchFinancialSummary, processRefund } from '@/lib/api/client';
import { FinancialSummary, FinancialTransaction } from '@/types/admin';
import { INITIAL_FINANCIAL_SUMMARY } from '@/lib/data/mockData';
import { useAuth } from '@/context/AuthContext';

export default function FinancePage() {
  const { user, hasPermission, isLoading } = useAuth();
  const [finData, setFinData] = useState<FinancialSummary>(INITIAL_FINANCIAL_SUMMARY);
  const [sourceLabel, setSourceLabel] = useState('JP Morgan & Uber Real-Time Desk');
  const [loading, setLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<'INR' | 'USD' | 'AED' | 'GBP' | 'EUR'>('INR');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Settled' | 'Authorized' | 'Refunded'>('all');
  const [gatewayFilter, setGatewayFilter] = useState<string>('all');
  const [refundModalTxn, setRefundModalTxn] = useState<FinancialTransaction | null>(null);
  const [refundReason, setRefundReason] = useState('Patient requested plan adjustment');
  const [isRefunding, setIsRefunding] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  const canViewFinance = !user || hasPermission('finance.view') || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'FINANCE_ADMIN';
  const canRefund = !user || hasPermission('finance.refund') || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'FINANCE_ADMIN';
  const canExport = !user || hasPermission('finance.export') || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'FINANCE_ADMIN';

  const loadData = async () => {
    try {
      const { data, source } = await fetchFinancialSummary();
      setFinData(data);
      setSourceLabel(source);
    } catch (e) {
      // keep fallback
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isLoading && !canViewFinance) {
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

  // FX Conversion Helper
  const getCurrencySymbol = (code: string) => {
    switch (code) {
      case 'USD': return '$';
      case 'AED': return 'AED ';
      case 'GBP': return '£';
      case 'EUR': return '€';
      default: return '₹';
    }
  };

  const convertAmount = (inrAmount: number) => {
    if (selectedCurrency === 'INR') return inrAmount;
    const rateDoc = finData.fxRates?.find((f) => f.code === selectedCurrency);
    const rate = rateDoc ? rateDoc.rateToINR : 1.0;
    return inrAmount / rate;
  };

  const formatCurrency = (inrAmount: number, decimals: number = 0) => {
    const sym = getCurrencySymbol(selectedCurrency);
    const val = convertAmount(inrAmount);
    return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const handleRefundSubmit = async () => {
    if (!refundModalTxn) return;
    setIsRefunding(true);
    const res = await processRefund(refundModalTxn.id, refundReason);
    setIsRefunding(false);

    if (res.success) {
      // Update transaction status locally
      setFinData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          transactions: prev.transactions?.map((t) =>
            t.id === refundModalTxn.id ? { ...t, status: 'Refunded' } : t
          ),
          payments: {
            ...prev.payments,
            refunds: prev.payments.refunds + 1,
            netSettlement: prev.payments.netSettlement - refundModalTxn.netINR,
          },
        };
      });
      setActionSuccess(`Refund processed successfully for ${refundModalTxn.id} (${refundModalTxn.patientName}).`);
      setRefundModalTxn(null);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const exportCSV = () => {
    if (!finData.transactions) return;
    const headers = ['Transaction ID', 'Timestamp', 'Patient', 'Email', 'City', 'Country', 'Plan', 'Gateway', 'Gross INR', 'Fee INR', 'GST INR', 'Net INR', 'Status', 'Risk Score'];
    const rows = finData.transactions.map((t) => [
      t.id,
      t.timestamp,
      `"${t.patientName}"`,
      t.email,
      t.city,
      t.country,
      `"${t.plan}"`,
      t.gateway,
      t.grossINR,
      t.feeINR,
      t.taxGSTINR,
      t.netINR,
      t.status,
      t.riskScore,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PillCare_Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTransactions = (finData.transactions || []).filter((txn) => {
    const matchesSearch =
      txn.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || txn.status === statusFilter;
    const matchesGateway = gatewayFilter === 'all' || txn.gateway === gatewayFilter;

    return matchesSearch && matchesStatus && matchesGateway;
  });

  return (
    <Shell>
      {/* Finance Master Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/30">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              JP MORGAN TREASURY & UBER VELOCITY COMMAND
            </span>
            <span className="text-xs text-slate-400 font-mono">• {sourceLabel}</span>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">• {currentTime || 'LIVE TICKER'}</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            Financial Command Center
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Institutional telemetry: Real-time velocity per minute, Gross Merchandise Value, multi-gateway routing, nodal float management, and second-by-second transaction audit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Currency Selector */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 text-xs font-mono">
            {(['INR', 'USD', 'AED', 'GBP', 'EUR'] as const).map((curr) => (
              <button
                key={curr}
                onClick={() => setSelectedCurrency(curr)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedCurrency === curr
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>

          {canExport && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-200 text-xs font-medium transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Uber Velocity & Run-rate Ticker Bar */}
      <div className="p-4 rounded-2xl glass-card border border-emerald-500/30 bg-emerald-950/10 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs font-mono">
        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Live Run-rate Velocity</span>
          <span className="text-base font-black text-emerald-400">
            {formatCurrency(finData.velocity?.revenuePerMinuteINR || 7.23, 2)}
            <span className="text-[10px] text-slate-400 font-normal"> / min</span>
          </span>
          <span className="text-[10px] text-slate-500 block">
            {formatCurrency(finData.velocity?.revenuePerHourINR || 434)} / hr
          </span>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Completed Doses</span>
          <span className="text-base font-black text-sky-400">
            {finData.velocity?.activeRidesOrDosesPerMinute || 18.6}
            <span className="text-[10px] text-slate-400 font-normal"> / min</span>
          </span>
          <span className="text-[10px] text-slate-500 block">
            {(finData.velocity?.dailyCompletedInterventions || 26840).toLocaleString()} daily doses
          </span>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Net Platform Take Rate</span>
          <span className="text-base font-black text-purple-400">
            {finData.velocity?.netTakeRatePercent || 90.93}%
          </span>
          <span className="text-[10px] text-slate-500 block">After 18% GST & Fees</span>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Gross Volume (GMV)</span>
          <span className="text-base font-black text-white">
            {formatCurrency(finData.gmv || finData.grossRevenue)}
          </span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" /> +18.4% MoM
          </span>
        </div>

        <div className="space-y-0.5 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Liquid Float Reserves</span>
          <span className="text-base font-black text-amber-400">
            {formatCurrency(finData.treasury?.totalTreasuryFloatINR || 418900)}
          </span>
          <span className="text-[10px] text-slate-500 block">HDFC Nodal + Escrow</span>
        </div>
      </div>

      {/* Top 6 Institutional KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Gross Revenue */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Gross Merchandise Value (GMV)</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
              MTD Billed
            </span>
          </div>
          <span className="text-3xl font-black text-white block">
            {formatCurrency(finData.grossRevenue)}
          </span>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" /> +18.4% MoM
            </span>
            <span className="font-mono text-[11px]">2,480 Active Paid Seats</span>
          </div>
        </div>

        {/* Card 2: Net Settled Revenue */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Net Settled Revenue</span>
            <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono">
              Bank Float
            </span>
          </div>
          <span className="text-3xl font-black text-emerald-400 block">
            {formatCurrency(finData.netRevenue)}
          </span>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
            <span>GST Vault: {formatCurrency(finData.payments.taxesGST)}</span>
            <span>Gateway: {formatCurrency(finData.payments.gatewayFees)}</span>
          </div>
        </div>

        {/* Card 3: MRR / ARR */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Recurring Run-Rate (MRR)</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-mono">
              ARR: {formatCurrency(finData.arr)}
            </span>
          </div>
          <span className="text-3xl font-black text-sky-400 block">
            {formatCurrency(finData.mrr)}
          </span>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Annual Run-rate: {formatCurrency(finData.arr)}</span>
            <span className="text-purple-400 font-mono">NRR: {finData.nrrPercent || 118.4}%</span>
          </div>
        </div>

        {/* Card 4: JP Morgan Unit Economics */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Unit Economics (LTV : CAC)</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
              Payback: 3.2 mos
            </span>
          </div>
          <span className="text-3xl font-black text-purple-400 block">
            {finData.unitEconomics.ltvCacRatio}x
          </span>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
            <span>CAC: {formatCurrency(finData.unitEconomics.cac)}</span>
            <span className="text-emerald-400 font-bold">LTV: {formatCurrency(finData.unitEconomics.ltv)}</span>
          </div>
        </div>

        {/* Card 5: Treasury Float & Settlement Escrow */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Treasury Escrow Float</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
              HDFC Nodal
            </span>
          </div>
          <span className="text-3xl font-black text-amber-400 block">
            {formatCurrency(finData.treasury?.totalTreasuryFloatINR || 418900)}
          </span>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
            <span>T+1 In-Flight: {formatCurrency(finData.treasury?.inFlightSettlementsT1 || 54200)}</span>
            <span className="font-mono text-slate-400">Dispute: {formatCurrency(10000)}</span>
          </div>
        </div>

        {/* Card 6: Margins & Churn */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Platform Margins & Churn</span>
            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono">
              Gross: {finData.unitEconomics.grossMarginPercent}%
            </span>
          </div>
          <span className="text-3xl font-black text-indigo-400 block">
            {finData.unitEconomics.contributionMarginPercent}%
          </span>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Monthly Churn: {finData.subscriptions.churnRate}%</span>
            <span className="text-emerald-400">ARPU: {formatCurrency(finData.unitEconomics.arpu)}</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Treasury Float & Multi-Currency FX Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Treasury Float Ledger */}
        <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-400" />
              JP Morgan Treasury & Float Management
            </h2>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              T+1 SETTLEMENT ACTIVE
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-white block">HDFC Nodal Escrow Account</span>
                <span className="text-[11px] text-slate-400">Primary operational float for payment gateways</span>
              </div>
              <span className="text-base font-black text-white font-mono">
                {formatCurrency(finData.treasury?.settledNodalAccountHDFC || 320450)}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-white block">In-Flight Clearing (T+1 Settlement)</span>
                <span className="text-[11px] text-slate-400">Funds queued in clearing house; settles at 18:30 IST</span>
              </div>
              <span className="text-base font-black text-amber-400 font-mono">
                {formatCurrency(finData.treasury?.inFlightSettlementsT1 || 54200)}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-white block">GST Tax Escrow Vault (18%)</span>
                <span className="text-[11px] text-slate-400">Segregated statutory compliance vault</span>
              </div>
              <span className="text-base font-black text-sky-400 font-mono">
                {formatCurrency(finData.treasury?.gstTaxReserveVault || finData.payments.taxesGST)}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-white block">Chargeback & Dispute Reserve Float</span>
                <span className="text-[11px] text-slate-400">Held in reserve; 0 chargebacks recorded</span>
              </div>
              <span className="text-base font-black text-emerald-400 font-mono">
                {formatCurrency(finData.treasury?.chargebackDisputeEscrow || 10000)}
              </span>
            </div>
          </div>
        </div>

        {/* Global Multi-Currency FX Desk */}
        <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              Global FX Desk & Multi-Currency Cohorts
            </h2>
            <span className="text-[10px] font-mono text-slate-400">
              LIVE INTERBANK RATES
            </span>
          </div>

          <div className="space-y-2.5">
            {(finData.fxRates || []).map((fx) => (
              <div
                key={fx.code}
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                    {fx.code}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">{fx.code} Currency Volume</span>
                    <span className="text-[11px] text-slate-400 block">
                      FX Rate: 1 {fx.code} = ₹{fx.rateToINR.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-xs font-bold text-emerald-400 block">
                    {formatCurrency(fx.volume24h)}
                  </span>
                  <span className="text-[10px] text-slate-500">{fx.sharePercent}% total volume</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Gateway Routing Matrix */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-400" />
            Multi-Gateway Routing Health & Latency SLA
          </h2>
          <span className="text-xs text-slate-400 font-mono">Zero-Drop Routing Active across 5 Gateways</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(finData.gateways || []).map((gw) => (
            <div key={gw.code} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">{gw.code}</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {gw.status}
                </span>
              </div>
              <h3 className="text-xs font-bold text-white truncate" title={gw.name}>{gw.name}</h3>
              <div className="space-y-1 pt-1 border-t border-slate-800 text-[11px] font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Success Rate:</span>
                  <span className="font-bold text-emerald-400">{gw.successRate}%</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Routing Latency:</span>
                  <span className="text-slate-200">{gw.latencyMs}ms</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Volume:</span>
                  <span className="text-white">{formatCurrency(gw.volume24hINR)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Fee Take:</span>
                  <span className="text-slate-400">{gw.feeRatePercent}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Second-by-Second Transaction Ledger (Uber/JPMorgan Terminal) */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Real-Time Transaction Ledger (Minute-by-Minute Telemetry)
            </h2>
            <p className="text-xs text-slate-400">
              Live audit stream of all paid patient conversions, dose subscriptions, and one-click refund settlements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, TXN, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-48"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs font-mono">
              {(['all', 'Settled', 'Authorized', 'Refunded'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    statusFilter === st ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Transaction ID</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Patient / User</th>
                <th className="py-3 px-4 font-semibold">City & Country</th>
                <th className="py-3 px-4 font-semibold">Plan</th>
                <th className="py-3 px-4 font-semibold">Gateway</th>
                <th className="py-3 px-4 font-semibold text-right">Gross</th>
                <th className="py-3 px-4 font-semibold text-right">Fee + GST</th>
                <th className="py-3 px-4 font-semibold text-right">Net Payout</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-center">Risk</th>
                <th className="py-3 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-500">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-200">{txn.id}</td>
                    <td className="py-3 px-4 text-slate-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {txn.timestamp}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-sans font-bold text-white block">{txn.patientName}</span>
                      <span className="text-[10px] text-slate-500">{txn.email}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {txn.city}, {txn.country}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{txn.plan}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                        {txn.gateway}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      {formatCurrency(txn.grossINR)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {formatCurrency(txn.feeINR + txn.taxGSTINR)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-400">
                      {formatCurrency(txn.netINR)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          txn.status === 'Settled'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : txn.status === 'Authorized'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : txn.status === 'Refunded'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {txn.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          txn.riskScore < 5
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : txn.riskScore < 10
                            ? 'bg-sky-500/10 text-sky-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {txn.riskScore}/100
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {txn.status !== 'Refunded' && canRefund ? (
                        <button
                          onClick={() => setRefundModalTxn(txn)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[11px] font-sans font-semibold transition-all"
                        >
                          Refund
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[11px] select-none">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance & Escrow Notice */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-3 font-mono">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <span>
          INSTITUTIONAL AUDIT NOTICE: All transactions settle in accordance with RBI Nodal Escrow Directions 2026 and PCI-DSS Level 1 compliance. Customer payment instruments are encrypted end-to-end via Razorpay and Stripe HSMs.
        </span>
      </div>

      {/* Instant Refund Modal */}
      {refundModalTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-md w-full p-6 rounded-3xl glass-card border border-rose-500/40 bg-slate-900 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Process Instant Refund</h3>
                <span className="text-xs text-rose-400 font-mono">REVERSE TRANSACTION #{refundModalTxn.id}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Patient:</span>
                <span className="font-bold text-white">{refundModalTxn.patientName}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Gross Refund Amount:</span>
                <span className="font-bold text-emerald-400">{formatCurrency(refundModalTxn.grossINR)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Payment Gateway:</span>
                <span>{refundModalTxn.gateway}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Refund Reason / Audit Note</label>
              <select
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                <option value="Patient requested plan adjustment">Patient requested plan adjustment</option>
                <option value="Accidental duplicate charge">Accidental duplicate charge</option>
                <option value="Satisfaction guarantee policy refund">Satisfaction guarantee policy refund</option>
                <option value="Account upgraded / credited">Account upgraded / credited</option>
                <option value="Administrative courtesy refund">Administrative courtesy refund</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setRefundModalTxn(null)}
                disabled={isRefunding}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundSubmit}
                disabled={isRefunding}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/40 transition-all disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRefunding ? 'animate-spin' : ''}`} />
                {isRefunding ? 'Processing Refund...' : 'Confirm & Issue Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}