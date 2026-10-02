'use client';

import React, { useState } from 'react';
import Shell from '@/components/layout/Shell';
import {
  ShieldCheck,
  ShieldAlert,
  Monitor,
  Key,
  LogOut,
  AlertTriangle,
  Users,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { INITIAL_SECURITY_EVENTS } from '@/lib/data/mockData';
import { AdminRole, AdminPermission } from '@/types/admin';
import { ROLE_PERMISSIONS, getAllAvailablePermissions } from '@/lib/auth/rbac';

export default function SecurityPage() {
  const { user, revokeSession, revokeAllOtherSessions, updateUserRole, hasPermission } = useAuth();
  const [events, setEvents] = useState(INITIAL_SECURITY_EVENTS);
  const [selectedRole, setSelectedRole] = useState<AdminRole>(user?.role || 'SUPER_ADMIN');
  const [toastMsg, setToastMsg] = useState('');

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const handleRoleChange = (role: AdminRole) => {
    if (!isSuperAdmin) {
      setToastMsg('Permission Denied: Only SUPER_ADMIN can configure RBAC roles.');
      return;
    }
    updateUserRole(role);
    setSelectedRole(role);
    setToastMsg(`Admin session role changed to ${role}. Permissions updated.`);
  };

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-cyan-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold">
              ADMIN SECURITY & RBAC ENFORCEMENT
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Security Center & Access Control</h1>
          <p className="text-xs text-slate-400">
            Active sessions, 2FA status, suspicious login rate limiting, and granular permission matrices.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Active Sessions Panel */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Monitor className="w-4 h-4 text-cyan-400" /> Active Admin Sessions ({user?.activeSessions.length || 0})
          </h2>
          <button
            onClick={() => {
              revokeAllOtherSessions();
              setToastMsg('Revoked all active admin sessions except current browser.');
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout From All Other Sessions
          </button>
        </div>

        <div className="space-y-3">
          {user?.activeSessions.map((sess) => (
            <div
              key={sess.sessionId}
              className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                sess.isCurrent
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                  : sess.isSuspicious
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{sess.userAgent}</span>
                  {sess.isCurrent && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold">
                      CURRENT SESSION
                    </span>
                  )}
                  {sess.isSuspicious && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[9px] font-mono font-bold">
                      UNRECOGNIZED LOCATION
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  IP: {sess.ipAddress} • {sess.location} • Last Active: {sess.lastActive}
                </span>
              </div>

              {!sess.isCurrent && (
                <button
                  onClick={() => {
                    revokeSession(sess.sessionId);
                    setToastMsg(`Revoked session ${sess.sessionId}`);
                  }}
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Role & Permission Matrix Editor */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-purple-400" /> Granular Role-Based Access Control (RBAC)
        </h2>

        <div className="flex flex-wrap gap-2">
          {(
            [
              'SUPER_ADMIN',
              'ADMIN',
              'FINANCE_ADMIN',
              'ANALYTICS_ADMIN',
              'MARKETING_ADMIN',
              'CONTENT_ADMIN',
              'SUPPORT_ADMIN',
              'DEVELOPER',
              'VIEWER',
            ] as AdminRole[]
          ).map((role) => (
            <button
              key={role}
              onClick={() => handleRoleChange(role)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all ${
                selectedRole === role
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <span className="text-xs font-bold text-white block">Permissions Granted to {selectedRole}:</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {getAllAvailablePermissions().map((perm) => {
              const isGranted = ROLE_PERMISSIONS[selectedRole]?.includes(perm) || selectedRole === 'SUPER_ADMIN';
              return (
                <div
                  key={perm}
                  className={`p-2 rounded-xl border text-[11px] font-mono flex items-center gap-1.5 ${
                    isGranted
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-slate-950/50 border-slate-800 text-slate-600 line-through'
                  }`}
                >
                  <CheckCircle2 className={`w-3 h-3 ${isGranted ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span className="truncate">{perm}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}
