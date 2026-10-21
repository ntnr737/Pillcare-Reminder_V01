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
  Image as ImageIcon,
  Zap,
  Smartphone,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { fetchNotifications, sendBroadcastPushNotification } from '@/lib/api/client';
import { NotificationCampaign } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

export default function NotificationsPage() {
  const { hasPermission } = useAuth();
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [notifType, setNotifType] = useState<'flash' | 'medication' | 'offer' | 'warning' | 'info'>('flash');
  const [routeKey, setRouteKey] = useState('/today');
  const [targetAudience, setTargetAudience] = useState<'all' | 'free_users' | 'premium_users' | 'inactive_7d'>('all');
  const [inAppChannel, setInAppChannel] = useState(true);
  const [pushChannel, setPushChannel] = useState(true);
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
      const channels: ('push' | 'email' | 'sms' | 'in_app')[] = [];
      if (pushChannel) channels.push('push');
      if (inAppChannel) channels.push('in_app');

      const res = await sendBroadcastPushNotification(title, body, targetAudience, {
        routeKey,
        channels: channels.length ? channels : ['push', 'in_app'],
        imageUrl: imageUrl.trim() || undefined,
        type: notifType,
      });
      setSending(false);
      setConfirmSendModal(false);
      if (res.ok) {
        const actualSent = res.sent ?? 0;
        const newCamp: NotificationCampaign = {
          id: res.campaign_id || `cmp_${Date.now()}`,
          title,
          body,
          channels: channels.length ? channels : ['push', 'in_app'],
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
        setImageUrl('');
        setToastMsg(
          res.message ||
            `✅ Broadcast dispatched: Reached cohort '${targetAudience}' across ${channels.join(' & ')}.`
        );
      } else {
        setToastMsg(`Broadcast Error: ${res.error || 'Failed to dispatch push notifications'}. Form preserved.`);
      }
    } catch (e: any) {
      setSending(false);
      setConfirmSendModal(false);
      setToastMsg(`Broadcast Error: ${e?.message || 'Network error'}. Form preserved.`);
    }
  };

  const sampleImages = [
    {
      label: '💊 Medication Refill',
      url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    },
    {
      label: '🧘 Yoga Therapy',
      url: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&auto=format&fit=crop&q=80',
    },
    {
      label: '⚡ Flash Alert',
      url: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&auto=format&fit=crop&q=80',
    },
    {
      label: '🎁 Special Offer',
      url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80',
    },
  ];

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-sky-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-mono font-bold">
              EXPO & FCM PUSH BROADCAST GATEWAY
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
              <Zap className="w-3 h-3" /> FLASH NOTIFICATIONS ENABLED
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Engagement & Notification Command</h1>
          <p className="text-xs text-slate-400">
            Broadcast rich notifications with text and images, trigger flash in-app popups, and segment cohorts.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Broadcast Composer & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Composer Form */}
        <div className="lg:col-span-2 p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-sky-400" /> Create Rich Broadcast Campaign
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Notification Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. ⚡ Flash Reminder: Evening Dose & Hydration"
                disabled={!canCreate}
                className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-sky-500 text-slate-100 focus:outline-none font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Notification Style / Type</label>
              <select
                value={notifType}
                onChange={(e) => setNotifType(e.target.value as any)}
                disabled={!canCreate}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-medium focus:outline-none"
              >
                <option value="flash">⚡ Flash Notification (High-Priority HUD Banner)</option>
                <option value="medication">💊 Medication & Refill Alert</option>
                <option value="offer">🎁 Special Offer & Dharma Plan Upgrade</option>
                <option value="warning">⚠️ Health Precaution & Warning</option>
                <option value="info">🔔 General System Update</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Action Route Destination</label>
              <select
                value={routeKey}
                onChange={(e) => setRouteKey(e.target.value)}
                disabled={!canCreate}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-medium focus:outline-none font-mono"
              >
                <option value="/today">Today Tab (/today)</option>
                <option value="/yoga">Yoga Studio (/yoga)</option>
                <option value="/treatment">Treatment & Meds (/treatment)</option>
                <option value="/progress">Progress Tracker (/progress)</option>
                <option value="/support">Support & Settings (/support)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-300">Notification Message Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter message text with clinical guidance or user instructions..."
              rows={3}
              disabled={!canCreate}
              className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-sky-500 text-slate-100 focus:outline-none"
            />
          </div>

          {/* Image URL input with preset chips */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-purple-400" /> Rich Notification Image URL (Optional)
              </label>
              <span className="text-[10px] text-slate-400 font-mono">PNG, JPG, or WebP</span>
            </div>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.png or choose preset below"
              disabled={!canCreate}
              className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-purple-500 text-slate-100 focus:outline-none font-mono text-[11px]"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {sampleImages.map((img) => (
                <button
                  key={img.label}
                  type="button"
                  onClick={() => setImageUrl(img.url)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition-colors"
                >
                  {img.label}
                </button>
              ))}
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[11px] border border-rose-500/30"
                >
                  Clear Image
                </button>
              )}
            </div>
          </div>

          {/* Delivery Channels */}
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
            <span className="font-semibold text-slate-300">Delivery Channels:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={pushChannel}
                  onChange={(e) => setPushChannel(e.target.checked)}
                  className="accent-sky-500 rounded"
                />
                <span>OS Push Notification</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={inAppChannel}
                  onChange={(e) => setInAppChannel(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>In-App Flash Alert</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setConfirmSendModal(true)}
              disabled={!title || !body || !canSend || (!pushChannel && !inAppChannel)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                canSend && title && body && (pushChannel || inAppChannel)
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sky-500/20 hover:scale-[1.02]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" /> Send Mass Notification Broadcast
            </button>
          </div>
        </div>

        {/* Right 1 Col: Live Device Preview */}
        <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" /> Live In-App / Flash Preview
          </h2>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Real-time visual rendering of how the notification card will display inside the PillCare mobile app on Android & iOS.
          </p>

          {/* Phone Frame Mockup */}
          <div className="w-full rounded-2xl bg-slate-950 border-2 border-slate-800 p-4 relative min-h-[340px] flex flex-col justify-end overflow-hidden shadow-2xl">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-slate-800 rounded-full"></div>

            {/* Simulated In-App Notification Card */}
            <div
              className={`w-full p-3.5 rounded-2xl border shadow-xl transition-all space-y-2.5 ${
                notifType === 'flash'
                  ? 'bg-[#221338] border-amber-500/50 shadow-amber-500/10'
                  : notifType === 'medication'
                  ? 'bg-[#064e3b] border-emerald-500/50 shadow-emerald-500/10'
                  : notifType === 'offer'
                  ? 'bg-[#1e1b4b] border-indigo-500/50 shadow-indigo-500/10'
                  : notifType === 'warning'
                  ? 'bg-[#451a03] border-amber-600/50'
                  : 'bg-[#161926] border-sky-500/50'
              }`}
            >
              {/* Badge & Type indicator */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[9px] font-mono font-black px-2 py-0.5 rounded ${
                    notifType === 'flash'
                      ? 'bg-amber-500/20 text-amber-300'
                      : notifType === 'medication'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : notifType === 'offer'
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'bg-sky-500/20 text-sky-300'
                  }`}
                >
                  {notifType === 'flash'
                    ? '⚡ FLASH ALERT'
                    : notifType === 'medication'
                    ? 'MEDICATION'
                    : notifType === 'offer'
                    ? 'SPECIAL OFFER'
                    : notifType === 'warning'
                    ? 'WARNING'
                    : 'NOTIFICATION'}
                </span>
                <span className="text-[10px] text-slate-400">Just now</span>
              </div>

              {/* Title & Body */}
              <div className="flex items-start gap-3">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0 bg-slate-800"
                  />
                )}
                <div className="space-y-1 flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {title || 'PillCare Notification Title'}
                  </h4>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight">
                    {body || 'Your notification body and health guidance will appear here.'}
                  </p>
                </div>
              </div>

              {/* Image banner preview if provided */}
              {imageUrl && (
                <div className="w-full h-24 rounded-xl overflow-hidden border border-white/10 mt-1">
                  <img src={imageUrl} alt="Banner" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Action route button */}
              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px]">
                <span className="text-slate-400 font-mono">Route: {routeKey}</span>
                <span className="text-sky-400 font-bold flex items-center gap-1">
                  Tap to open <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
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
