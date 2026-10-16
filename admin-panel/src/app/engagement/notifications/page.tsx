'use client';

import React, { useState, useEffect } from 'react';
import Shell from '@/components/layout/Shell';
import {
  Bell,
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  History,
  Sparkles,
  Lock,
} from 'lucide-react';
import { fetchNotifications, sendBroadcastPushNotification } from '@/lib/api/client';
import { NotificationCampaign } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function NotificationsPage() {
  const { hasPermission } = useAuth();
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'free_users' | 'premium_users' | 'inactive_7d'>('all');
  const [confirmSendModal, setConfirmSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const canCreate = hasPermission('notifications.create');
  const canSend = hasPermission('notifications.send');

  useEffect(() => {
    fetchNotifications().then(setCampaigns);
  }, []);

  const handleTriggerSend = async () => {
    if (!canSend) {
      setToastMsg('Permission Denied: notifications.send authorization required.');
      return;
    }
    setSending(true);
    try {
      const res = await sendBroadcastPushNotification(title, body, targetAudience);
      setSending(false);
      setConfirmSendModal(false);
      if (res.ok) {
        const actualSent = res.sent ?? 0;
        const newCamp: NotificationCampaign = {
          id: res.campaign_id || `cmp_${Date.now()}`,
          title,
          body,
          channels: ['push'],
          targetAudience,
          sentAt: new Date().toISOString(),
          status: 'sent',
          sentCount: actualSent,
          openRatePercent: 0.0,
          clickRatePercent: 0.0,
          createdBy: 'admin@pillcare.in',
        };
        setCampaigns([newCamp, ...campaigns]);
        setTitle('');
        setBody('');
        setToastMsg(
          res.message ||
            `Broadcast dispatched: ${actualSent} device(s) reached in cohort '${targetAudience}'.`
        );
      } else {
        // FL-03: On failure, keep the form values, show error reason, and allow safe retry
        setToastMsg(`Broadcast Error: ${res.error || 'Failed to dispatch push notifications'}. Form preserved.`);
      }
    } catch (e: any) {
      setSending(false);
      setConfirmSendModal(false);
      setToastMsg(`Broadcast Error: ${e?.message || 'Network error'}. Form preserved.`);
    }
  };

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-sky-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-mono font-bold">
              EXPO & FCM PUSH BROADCAST GATEWAY
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Engagement & Notification Command</h1>
          <p className="text-xs text-slate-400">
            Create scheduled push notifications, segment target cohorts, and track open/click rates.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Broadcast Composer */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-sky-400" /> Create Broadcast Campaign
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1 md:col-span-2">
            <label className="font-semibold text-slate-300">Notification Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 🌧️ Monsoon Refill Alert - Check Medicine Supply"
              disabled={!canCreate}
              className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-sky-500 text-slate-100 focus:outline-none font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Target Audience Segment</label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value as any)}
              disabled={!canCreate}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-medium focus:outline-none"
            >
              <option value="all">All Active App Users</option>
              <option value="free_users">Free Tier Patients</option>
              <option value="premium_users">Premium Subscribers</option>
              <option value="inactive_7d">Inactive Users (Last 7 Days)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1 text-xs">
          <label className="font-semibold text-slate-300">Notification Message Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type notification text to send to devices..."
            rows={3}
            disabled={!canCreate}
            className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-sky-500 text-slate-100 focus:outline-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setConfirmSendModal(true)}
            disabled={!title || !body || !canSend}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all ${
              canSend && title && body
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sky-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" /> Send Mass Notification Broadcast
          </button>
        </div>
      </div>

      {/* Device Push Token QC Debugger Card */}
      <div className="p-6 rounded-3xl glass-card border border-indigo-500/30 bg-indigo-950/20 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            <Sparkles className="w-4 h-4" /> Device Push Token QC & Diagnostic Debugger
          </div>
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
            Expo & FCM Gateway Active
          </span>
        </div>
        <p className="text-slate-300">
          Build v1.50 sends push tokens to <code className="text-sky-400 font-mono">/push-token</code> when opened. You can also paste your phone's push token below to send a live push payload directly to your device.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <input
            type="text"
            placeholder="Paste your device Push Token (e.g. ExponentPushToken[...])"
            id="manualPushTokenInput"
            className="flex-1 w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-slate-100 font-mono"
          />
          <button
            onClick={async () => {
              const el = document.getElementById('manualPushTokenInput') as HTMLInputElement;
              const val = el?.value?.trim() || '';
              if (val) {
                const { registerTestPushToken } = await import('@/lib/api/client');
                const ok = await registerTestPushToken(val);
                setToastMsg(ok ? '✅ Push Token registered successfully! Click Send Broadcast above to test your device.' : 'Failed to register token');
              } else {
                setToastMsg('Please paste a valid push token string first.');
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shrink-0"
          >
            Register Device Token
          </button>
        </div>
      </div>

      {/* Sent Campaign History */}
      <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white">Broadcast Delivery History</h2>

        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <div className="p-8 text-center text-slate-400 rounded-2xl bg-slate-900/40 border border-slate-800">
              <p className="text-xs">No broadcast campaigns found in database. Create and dispatch your first push notification above.</p>
            </div>
          ) : (
            campaigns.map((c) => (
              <div key={c.id} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-sm">{c.title}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-[10px]">
                    {c.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-300">{c.body}</p>
                <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Dispatched to {c.sentCount.toLocaleString()} devices</span>
                  <span>Open Rate: {c.openRatePercent}% | Click Rate: {c.clickRatePercent}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Guard Modal */}
      {confirmSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl glass-card border border-sky-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-sky-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Confirm Mass Push Broadcast</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to broadcast push notifications to registered devices in target cohort <strong className="text-sky-400">&apos;{targetAudience}&apos;</strong>.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setConfirmSendModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={handleTriggerSend}
                disabled={sending}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-lg shadow-sky-500/20"
              >
                {sending ? 'Sending Push Payload...' : 'Confirm Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
