'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  FileText,
  Plus,
  CheckCircle2,
  Edit,
  Sparkles,
  Zap,
  Tag,
  Eye,
} from 'lucide-react';
import { fetchCMSContent, updateCMSStatus } from '@/lib/api/client';
import { CMSContentRecord } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function CMSPage() {
  const { hasPermission } = useAuth();
  const [contents, setContents] = useState<CMSContentRecord[]>([]);
  const [toastMsg, setToastMsg] = useState('');

  const canEdit = hasPermission('settings.edit');

  useEffect(() => {
    fetchCMSContent().then(setContents);
  }, []);

  const handleStatusChange = async (id: string, newStatus: 'Draft' | 'InReview' | 'Published' | 'Unpublished') => {
    if (!canEdit) {
      setToastMsg('Permission Denied: settings.edit authorization required.');
      return;
    }
    const targetStatus = newStatus === 'Published' ? 'Published' : 'Unpublished';
    try {
      const ok = await updateCMSStatus(id, targetStatus);
      if (ok) {
        setContents((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: targetStatus, updatedAt: new Date().toISOString() } : c))
        );
        setToastMsg(`Content status updated to ${targetStatus} and persisted to database.`);
      } else {
        setToastMsg('Failed to update status on backend server.');
      }
    } catch (e: any) {
      setToastMsg(`Error updating status: ${e?.message || 'Server error'}`);
    }
  };

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-indigo-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono font-bold">
              SWIGGY/ZOMATO FLASH ANNOUNCEMENTS & HEALTH CMS
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Content Management & Flash Announcements</h1>
          <p className="text-xs text-slate-400">
            Publish health articles, yoga recommendations, and instant flash announcements to mobile app today screen.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Content List */}
      <div className="space-y-4">
        {contents.length === 0 ? (
          <div className="p-12 text-center rounded-3xl glass-card border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No CMS Announcements Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No CMS announcements found in database. Create and publish announcements above to broadcast to app users.
            </p>
          </div>
        ) : (
          contents.map((item) => (
            <div key={item.id} className="p-6 rounded-3xl glass-card border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-base">{item.title}</span>
                  <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono uppercase">
                    {item.type}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-semibold">
                    {item.status}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() =>
                        handleStatusChange(
                          item.id,
                          item.status === 'Published' ? 'Unpublished' : 'Published'
                        )
                      }
                      className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                    >
                      {item.status === 'Published' ? 'Unpublish' : 'Publish Live'}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                {item.content}
              </p>

              <div className="flex justify-between items-center text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                <span>Author: {item.author}</span>
                <span>Version v{item.version} • Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Shell>
  );
}
