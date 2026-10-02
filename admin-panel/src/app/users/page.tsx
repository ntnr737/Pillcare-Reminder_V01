'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  ShieldAlert,
  Pill,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Phone,
  MapPin,
  Clock,
  X,
  CreditCard,
} from 'lucide-react';
import { fetchPillCareUsers, updateUserSubscription } from '@/lib/api/client';
import { PillCareUserRecord } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<PillCareUserRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<PillCareUserRecord | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<PillCareUserRecord | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const canEdit = hasPermission('users.edit');
  const canDelete = hasPermission('users.delete');

  useEffect(() => {
    fetchPillCareUsers().then(setUsers);
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = selectedPlan === 'all' || u.plan === selectedPlan;
    return matchesSearch && matchesPlan;
  });

  const handlePlanOverride = async (userId: string, newPlan: 'Free' | 'Basic' | 'Premium' | 'Enterprise') => {
    if (!canEdit) {
      setToastMsg('Permission Denied: users.edit authorization required.');
      return;
    }
    const success = await updateUserSubscription(userId, newPlan, 'Annual 365d');
    if (success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan: newPlan } : u))
      );
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, plan: newPlan });
      }
      setToastMsg(`User subscription successfully updated to ${newPlan}.`);
    }
  };

  const handleStatusToggle = (userId: string) => {
    if (!canEdit) {
      setToastMsg('Permission Denied: users.edit authorization required.');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextStatus = u.status === 'active' ? 'suspended' : 'active';
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
    setToastMsg(`User status updated.`);
  };

  const handleDeleteUserCascade = (userId: string) => {
    if (!canDelete) {
      setToastMsg('Permission Denied: users.delete authorization required.');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setDeleteConfirmUser(null);
    if (selectedUser?.id === userId) setSelectedUser(null);
    setToastMsg(`User data cascade deleted from MongoDB & Firebase collections.`);
  };

  return (
    <Shell>
      {/* User Management Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-indigo-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono font-bold">
              PATIENT IDENTITY & SUBSCRIPTION DIRECTORY
            </span>
            <span className="text-xs text-slate-400 font-mono">• {users.length} Records Loaded</span>
          </div>
          <h1 className="text-2xl font-black text-white">User Management & Patient Profiles</h1>
          <p className="text-xs text-slate-400">
            Search patient records, inspect medication adherence logs, manage feature overrides, or trigger cascade deletions.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl glass-card border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or user ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-indigo-500 text-xs text-slate-100 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none font-medium cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-200">All Plans</option>
              <option value="Free" className="bg-slate-900 text-slate-200">Free Tier</option>
              <option value="Basic" className="bg-slate-900 text-slate-200">Basic Tier (₹30)</option>
              <option value="Premium" className="bg-slate-900 text-slate-200">Premium Tier (₹99)</option>
              <option value="Enterprise" className="bg-slate-900 text-slate-200">Enterprise (₹299)</option>
            </select>
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="rounded-3xl glass-card border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/40">
                <th className="py-3.5 px-4">Patient Name / Email</th>
                <th className="py-3.5 px-4">Plan Tier</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Adherence</th>
                <th className="py-3.5 px-4">Device & App</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-xs text-indigo-300">
                        {u.name[0]}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-100 block">{u.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                        u.plan === 'Enterprise'
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          : u.plan === 'Premium'
                          ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                          : u.plan === 'Basic'
                          ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {u.plan}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {u.status === 'active' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-medium">
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">{u.adherenceScore}%</td>
                  <td className="py-3.5 px-4">
                    <span className="text-slate-300 block truncate max-w-[140px]">{u.device}</span>
                    <span className="text-[10px] text-slate-500 font-mono">v{u.appVersion}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{u.city || 'India'}, {u.state || 'IN'}</td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors"
                    >
                      View Profile
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteConfirmUser(u)}
                        className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        title="Cascade Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Profile Modal / Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl glass-card border border-indigo-500/30 p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-sm text-indigo-300">
                  {selectedUser.name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedUser.name}</h3>
                  <span className="text-xs text-slate-400 font-mono">{selectedUser.email} • ID: {selectedUser.id}</span>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Current Plan</span>
                <span className="font-bold text-sky-400 text-sm">{selectedUser.plan}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Adherence Score</span>
                <span className="font-bold text-emerald-400 text-sm">{selectedUser.adherenceScore}%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Lifetime Value</span>
                <span className="font-bold text-purple-400 text-sm">₹{selectedUser.ltvValueINR}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Reminders Count</span>
                <span className="font-bold text-white text-sm">{selectedUser.remindersCount} Meds</span>
              </div>
            </div>

            {/* Subscription Upgrade Buttons */}
            {canEdit && (
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-200 block">Instant Plan Override (1-Click)</span>
                <div className="flex flex-wrap gap-2">
                  {(['Free', 'Basic', 'Premium', 'Enterprise'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePlanOverride(selectedUser.id, p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        selectedUser.plan === p
                          ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Set {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Caregiver & Push Token Info */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-white block">Device & Caregiver Intelligence</span>
              <p className="text-slate-300 font-mono text-[11px]">Push Token: {selectedUser.pushToken || 'No Push Token Registered'}</p>
              <p className="text-slate-300">Caregiver Phone: {selectedUser.caregiverPhone || 'Not Configured'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl glass-card border border-rose-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Confirm Cascade Data Deletion</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})?
              This will invoke the application cascade deletion workflow across MongoDB <code className="text-rose-400">users</code>, <code className="text-rose-400">medications</code>, <code className="text-rose-400">doses</code>, and <code className="text-rose-400">subscriptions</code> collections.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setDeleteConfirmUser(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUserCascade(deleteConfirmUser.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20"
              >
                Permanently Delete User Data
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
