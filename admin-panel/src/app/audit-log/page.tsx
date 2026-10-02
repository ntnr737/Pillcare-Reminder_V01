'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  History,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Lock,
  Eye,
  X,
} from 'lucide-react';
import { fetchAuditLogs } from '@/lib/api/client';
import { AuditLogRecord } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function AuditLogPage() {
  const { hasPermission } = useAuth();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [search, setSearch] = useState('');
  const [inspectRecord, setInspectRecord] = useState<AuditLogRecord | null>(null);

  const canViewAudit = hasPermission('audit.view');

  useEffect(() => {
    fetchAuditLogs().then(setLogs);
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.adminEmail.toLowerCase().includes(search.toLowerCase()) ||
      l.objectAffected.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    const csv =
      'data:text/csv;charset=utf-8,' +
      'ID,Admin,Role,Action,Timestamp,IP,Object,Approval\n' +
      logs
        .map(
          (l) =>
            `${l.id},${l.adminEmail},${l.adminRole},${l.action},${l.timestamp},${l.ipAddress},${l.objectAffected},${l.approvalStatus}`
        )
        .join('\n');

    const encoded = encodeURI(csv);
    const a = document.createElement('a');
    a.href = encoded;
    a.download = `PillCare_Immutable_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!canViewAudit) {
    return (
      <Shell>
        <div className="py-20 flex flex-col items-center justify-center space-y-4 text-center">
          <Lock className="w-8 h-8 text-rose-400" />
          <h2 className="text-xl font-bold text-white">Audit Trail Restricted</h2>
          <p className="text-xs text-slate-400">You need <code className="text-rose-400">audit.view</code> permissions.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-emerald-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
              IMMUTABLE CRYPTOGRAPHIC AUDIT TRAIL
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Platform Audit Log</h1>
          <p className="text-xs text-slate-400">
            Read-only, tamper-proof record of all privileged administrator actions, feature flag changes, and data exports.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-200 text-xs font-medium transition-all shadow-sm"
        >
          <Download className="w-4 h-4 text-emerald-400" /> Export Audit Log (CSV)
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl glass-card border border-slate-800 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter audit entries by action, admin email, or affected object..."
          className="w-full bg-transparent text-xs text-slate-100 focus:outline-none"
        />
      </div>

      {/* Audit Table */}
      <div className="rounded-3xl glass-card border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider bg-slate-900/40">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Admin & Role</th>
                <th className="py-3.5 px-4">Action Executed</th>
                <th className="py-3.5 px-4">Object Affected</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4 text-slate-400">{new Date(l.timestamp).toLocaleString()}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-white block">{l.adminEmail}</span>
                    <span className="text-[10px] text-sky-400">{l.adminRole}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-indigo-400">{l.action}</td>
                  <td className="py-3.5 px-4 text-slate-300">{l.objectAffected}</td>
                  <td className="py-3.5 px-4 text-slate-400">{l.ipAddress}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setInspectRecord(l)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans font-medium"
                    >
                      View Diff
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Diff Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl glass-card border border-emerald-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Audit Trail Inspector</h3>
              <button onClick={() => setInspectRecord(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <p><strong className="text-slate-400">Action:</strong> {inspectRecord.action}</p>
              <p><strong className="text-slate-400">Previous Value:</strong> {inspectRecord.previousValue || 'N/A'}</p>
              <p><strong className="text-slate-400">New Value:</strong> {inspectRecord.newValue || 'N/A'}</p>
              <p><strong className="text-slate-400">Reason:</strong> {inspectRecord.reason || 'Standard operational update'}</p>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setInspectRecord(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
