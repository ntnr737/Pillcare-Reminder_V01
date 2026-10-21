'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  Flame,
  Trophy,
  ShieldCheck,
  AlertTriangle,
  Users,
  TrendingUp,
  Plus,
  Bell,
  Play,
  Pause,
  Calendar,
  Award,
  Sparkles,
  CheckCircle2,
  X,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  fetchStreakDashboard,
  createStreakCompetition,
  toggleStreakCompetition,
  grantStreakShield,
  adjustUserStreak,
  sendAtRiskStreakReminder,
} from '@/lib/api/client';
import {
  StreakDashboardAnalytics,
  StreakCompetitionRecord,
  StreakLeaderboardEntry,
} from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function StreakCompetitionPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<StreakDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'streak' | 'adherence' | 'points' | 'name'>('streak');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newComp, setNewComp] = useState({
    title: '',
    description: '',
    prize_pool: '₹10,000 Cash Pool + 1 Year Pro',
    target_streak: 30,
    badge_reward: 'Grand Master Champion',
    end_date: '2026-11-30T23:59:59Z',
  });

  const [adjustingUser, setAdjustingUser] = useState<StreakLeaderboardEntry | null>(null);
  const [newStreakValue, setNewStreakValue] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Customer Support Resolution');

  const [confirmNudge, setConfirmNudge] = useState(false);
  const [nudging, setNudging] = useState(false);

  const canEdit = hasPermission('users.edit') || hasPermission('features.edit');

  const loadDashboard = async () => {
    try {
      const res = await fetchStreakDashboard();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleToggleComp = async (compId: string) => {
    if (!canEdit) {
      setToastMsg('Permission Denied: User/Feature edit permissions required.');
      return;
    }
    const success = await toggleStreakCompetition(compId);
    if (success) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          competitions: prev.competitions.map((c) =>
            c.id === compId ? { ...c, status: c.status === 'active' ? 'paused' : 'active' } : c
          ),
        };
      });
      setToastMsg(`Competition status updated.`);
    }
  };

  const handleCreateComp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComp.title.trim()) return;
    const success = await createStreakCompetition({
      ...newComp,
      status: 'active',
      participants_count: data?.totalActiveStreaks || 100,
    });
    if (success) {
      setShowCreateModal(false);
      setToastMsg(`🎉 Streak Competition "${newComp.title}" published!`);
      loadDashboard();
    }
  };

  const handleGrantShield = async (user: StreakLeaderboardEntry) => {
    if (!canEdit) {
      setToastMsg('Permission Denied: Edit permission required.');
      return;
    }
    const nextState = !user.shieldActive;
    const success = await grantStreakShield(user.userId, nextState);
    if (success) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          leaderboard: prev.leaderboard.map((u) =>
            u.userId === user.userId ? { ...u, shieldActive: nextState } : u
          ),
        };
      });
      setToastMsg(`Streak Saver Shield ${nextState ? 'ACTIVATED' : 'DEACTIVATED'} for ${user.name}.`);
    }
  };

  const handleAdjustStreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingUser) return;
    const success = await adjustUserStreak(adjustingUser.userId, newStreakValue, adjustReason);
    if (success) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          leaderboard: prev.leaderboard.map((u) =>
            u.userId === adjustingUser.userId
              ? {
                  ...u,
                  streakDays: newStreakValue,
                  points: newStreakValue * 100 + Math.round(u.adherenceRate * 10),
                }
              : u
          ),
        };
      });
      setToastMsg(`Streak adjusted to ${newStreakValue} days for ${adjustingUser.name}.`);
      setAdjustingUser(null);
    }
  };

  const handleSendNudge = async () => {
    setNudging(true);
    const res = await sendAtRiskStreakReminder();
    setNudging(false);
    setConfirmNudge(false);
    setToastMsg(res.message || 'Notification broadcast completed.');
  };

  const filteredLeaderboard = (data?.leaderboard || [])
    .filter((u) => {
      const matchesQuery =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTier = selectedTier === 'all' || u.tier.toLowerCase().includes(selectedTier.toLowerCase());
      return matchesQuery && matchesTier;
    })
    .sort((a, b) => {
      if (sortBy === 'streak') return b.streakDays - a.streakDays || b.points - a.points;
      if (sortBy === 'adherence') return b.adherenceRate - a.adherenceRate || b.streakDays - a.streakDays;
      if (sortBy === 'points') return b.points - a.points;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  return (
    <Shell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Streak Management & Competitions
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  LIVE ENGINE
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Monitor platform-wide adherence streaks, run gamified competitions, and protect patient habits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700/60 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={() => setConfirmNudge(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500/20 to-orange-500/20 hover:from-rose-500/30 hover:to-orange-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Bell className="w-3.5 h-3.5 text-rose-400" />
              Nudge At-Risk Users
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-orange-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Competition
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMsg && (
          <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4 Core KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Streaks */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Streaks</span>
              <div className="text-2xl font-bold text-white tracking-tight">
                {loading ? '...' : (data?.totalActiveStreaks || 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-400 font-medium">Consecutive ≥ 1 day</span>
            </div>
          </div>

          {/* Average Streak */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Average Platform Streak</span>
              <div className="text-2xl font-bold text-white tracking-tight">
                {loading ? '...' : `${data?.avgStreakDays || 0} Days`}
              </div>
              <span className="text-[10px] text-sky-400 font-medium">+1.8d vs last month</span>
            </div>
          </div>

          {/* Longest Record */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Record Longest Streak</span>
              <div className="text-2xl font-bold text-white tracking-tight">
                {loading ? '...' : `${data?.maxStreakDays || 0} Days`}
              </div>
              <span className="text-[10px] text-yellow-400 font-medium">Grand Master Tier</span>
            </div>
          </div>

          {/* At-Risk Today */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-rose-900/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Streaks At Risk Today</span>
              <div className="text-2xl font-bold text-rose-300 tracking-tight">
                {loading ? '...' : (data?.atRiskCount || 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-rose-400 font-medium">Pending doses before 23:59</span>
            </div>
          </div>
        </div>

        {/* Active Competitions Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Active Health Streak Competitions
            </h2>
            <span className="text-xs text-slate-400">
              {data?.competitions?.length || 0} Configured Challenges
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.competitions.map((comp) => {
              const isActive = comp.status === 'active';
              return (
                <div
                  key={comp.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-amber-950/20 border-amber-500/30'
                      : 'bg-slate-900/40 border-slate-800 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {comp.status}
                        </span>
                        <span className="text-[11px] font-mono text-amber-400/90 flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          {comp.target_streak}-Day Goal
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white tracking-tight">{comp.title}</h3>
                      <p className="text-xs text-slate-300 line-clamp-2">{comp.description}</p>
                    </div>

                    <button
                      onClick={() => handleToggleComp(comp.id)}
                      className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors ${
                        isActive
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                      }`}
                      title={isActive ? 'Pause competition' : 'Activate competition'}
                    >
                      {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 text-amber-300/90 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {comp.prize_pool}
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span>{comp.participants_count.toLocaleString()} Participants</span>
                      <span className="font-mono text-slate-500">Badge: {comp.badge_reward}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak Cohort Retention Distribution */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                Streak Retention & Cohort Distribution
              </h2>
              <p className="text-xs text-slate-400">
                Breakdown of active platform users across habit progression milestones.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total Active: {(data?.totalActiveStreaks || 0).toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
            {[
              { bracket: '1-3d', label: '1–3 Days', title: 'Novice Starters', color: 'bg-amber-500', text: 'text-amber-400' },
              { bracket: '4-7d', label: '4–7 Days', title: 'Emerging Habit', color: 'bg-sky-500', text: 'text-sky-400' },
              { bracket: '8-14d', label: '8–14 Days', title: 'Streak Warriors', color: 'bg-indigo-500', text: 'text-indigo-400' },
              { bracket: '15-30d', label: '15–30 Days', title: 'Adherence Legends', color: 'bg-purple-500', text: 'text-purple-400' },
              { bracket: '30d+', label: '30+ Days', title: 'Grand Masters', color: 'bg-emerald-500', text: 'text-emerald-400' },
            ].map((cohort) => {
              const count = data?.streakBrackets?.[cohort.bracket] ?? 0;
              const total = Math.max(data?.totalActiveStreaks || 1, 1);
              const pct = Math.round((count / total) * 100);

              return (
                <div key={cohort.bracket} className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{cohort.label}</span>
                    <span className={`font-mono font-bold ${cohort.text}`}>{pct}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{cohort.title}</div>
                  <div className="w-full h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                    <div
                      className={`h-full ${cohort.color} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-mono text-slate-300 font-semibold pt-1">
                    {count.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">users</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Streak Leaderboard Table */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Live Streak Competition Leaderboard
              </h2>
              <p className="text-xs text-slate-400">
                Real-time patient ranking sorted by active consecutive streak days and accumulated Health XP.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Tiers</option>
                <option value="grand master">Grand Master (30d+)</option>
                <option value="legend">Adherence Legend (14d+)</option>
                <option value="warrior">Streak Warrior (7d+)</option>
                <option value="starter">Health Starter (1-6d)</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="streak">Sort: Streak Days</option>
                <option value="adherence">Sort: Adherence %</option>
                <option value="points">Sort: Health XP</option>
                <option value="name">Sort: Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Current Streak</th>
                  <th className="py-2.5 px-3">Adherence Rate</th>
                  <th className="py-2.5 px-3">Health XP</th>
                  <th className="py-2.5 px-3">Rank Tier</th>
                  <th className="py-2.5 px-3">Streak Shield</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeaderboard.map((user) => {
                  const isTop3 = user.rank <= 3;
                  const rankIcon =
                    user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`;

                  return (
                    <tr key={user.userId + user.email} className="hover:bg-slate-800/30 transition-colors">
                      {/* Rank */}
                      <td className="py-3 px-3">
                        <span
                          className={`font-mono font-bold text-sm ${
                            isTop3 ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          {rankIcon}
                        </span>
                      </td>

                      {/* Patient Details */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-amber-300 shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              {user.name}
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {user.plan}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Current Streak */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20 font-mono">
                          <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          {user.streakDays} Days
                        </span>
                      </td>

                      {/* Adherence Rate */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${Math.min(user.adherenceRate, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-slate-300 font-medium">{user.adherenceRate}%</span>
                        </div>
                      </td>

                      {/* Health XP */}
                      <td className="py-3 px-3 font-mono text-slate-300 font-bold">
                        {user.points.toLocaleString()} XP
                      </td>

                      {/* Tier */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {user.tier}
                        </span>
                      </td>

                      {/* Shield */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                            user.shieldActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          {user.shieldActive ? 'Active' : 'Off'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleGrantShield(user)}
                            className={`p-1.5 rounded-lg border text-[11px] transition-all ${
                              user.shieldActive
                                ? 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                                : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30'
                            }`}
                            title={user.shieldActive ? 'Revoke Streak Shield' : 'Grant 1-Day Streak Saver Shield'}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setAdjustingUser(user);
                              setNewStreakValue(user.streakDays);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] transition-all"
                            title="Adjust Streak Days"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Competition Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Launch New Streak Competition
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateComp} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Competition Title</label>
                  <input
                    type="text"
                    required
                    value={newComp.title}
                    onChange={(e) => setNewComp({ ...newComp, title: e.target.value })}
                    placeholder="e.g. 21-Day Habit Transformation Cup"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Description & Patient Guidelines</label>
                  <textarea
                    rows={2}
                    value={newComp.description}
                    onChange={(e) => setNewComp({ ...newComp, description: e.target.value })}
                    placeholder="Describe qualifying actions, dose adherence criteria, and rewards..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Target Streak Goal (Days)</label>
                    <input
                      type="number"
                      min={3}
                      max={90}
                      value={newComp.target_streak}
                      onChange={(e) => setNewComp({ ...newComp, target_streak: parseInt(e.target.value) || 7 })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Badge Reward</label>
                    <input
                      type="text"
                      value={newComp.badge_reward}
                      onChange={(e) => setNewComp({ ...newComp, badge_reward: e.target.value })}
                      placeholder="e.g. 21-Day Champion"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Prize Pool / Incentive</label>
                  <input
                    type="text"
                    value={newComp.prize_pool}
                    onChange={(e) => setNewComp({ ...newComp, prize_pool: e.target.value })}
                    placeholder="e.g. ₹5,000 + 6 Months Free Pro"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-md shadow-orange-500/20"
                  >
                    Publish Challenge
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Adjust Streak Modal */}
        {adjustingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  Adjust Patient Streak
                </h3>
                <button
                  onClick={() => setAdjustingUser(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAdjustStreak} className="space-y-3.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 space-y-1">
                  <div className="font-semibold text-white">{adjustingUser.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{adjustingUser.email}</div>
                  <div className="text-[11px] text-amber-400 font-medium">
                    Current Streak: {adjustingUser.streakDays} Days
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">New Streak Days</label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    required
                    value={newStreakValue}
                    onChange={(e) => setNewStreakValue(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Audit Reason</label>
                  <input
                    type="text"
                    required
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Hospitalization claim approved"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAdjustingUser(null)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                  >
                    Save Adjustment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Nudge Confirmation Modal */}
        {confirmNudge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">Broadcast Streak Saver Alert</h3>
                <p className="text-xs text-slate-400">
                  This will dispatch a high-priority heads-up push notification via Google Cloud FCM v1 to{' '}
                  <span className="text-rose-300 font-semibold">{data?.atRiskCount || 12} patients</span> at risk
                  of breaking their health streak today.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-1">
                <div className="font-semibold text-slate-200">Notification Preview:</div>
                <div className="text-amber-300 font-medium">🔥 Don't Break Your Health Streak!</div>
                <div className="text-slate-400 text-[11px]">
                  Your PillCare Competition Streak is at risk! Log your daily doses & hydration before midnight to protect your ranking.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmNudge(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendNudge}
                  disabled={nudging}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-600 hover:from-rose-600 hover:to-orange-700 text-white font-semibold text-xs shadow-md shadow-rose-500/20"
                >
                  {nudging ? 'Dispatching...' : 'Dispatch Alert Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
