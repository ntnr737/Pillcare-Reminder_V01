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
  Globe,
  Tag,
} from 'lucide-react';
import { fetchNotifications, sendBroadcastPushNotification } from '@/lib/api/client';
import { NotificationCampaign } from '@/types/admin';
import { useAuth } from '@/context/AuthContext';

const SAMPLE_USERS = {
  rahul: {
    first_name: 'Rahul',
    full_name: 'Rahul Sharma',
    streak: 14,
    city: 'Mumbai',
    country: 'India',
    flag: '🇮🇳',
    desc: 'Rahul (India, 14-day streak)',
  },
  sarah: {
    first_name: 'Sarah',
    full_name: 'Sarah Connor',
    streak: 21,
    city: 'Los Angeles',
    country: 'United States',
    flag: '🇺🇸',
    desc: 'Sarah (USA, 21-day streak)',
  },
  anon: {
    first_name: 'Friend',
    full_name: 'PillCare User',
    streak: 0,
    city: 'your city',
    country: 'your region',
    flag: '👤',
    desc: 'New / Anonymous User',
  },
};

const AVAILABLE_TAGS = [
  { tag: '{First_name}', label: 'First Name', hint: 'e.g. Rahul' },
  { tag: '{Full_Name}', label: 'Full Name', hint: 'e.g. Rahul Sharma' },
  { tag: '{Streak_Days}', label: 'Streak Days', hint: 'e.g. 14' },
  { tag: '{City}', label: 'City', hint: 'e.g. Mumbai' },
  { tag: '{Country}', label: 'Country', hint: 'e.g. India' },
  { tag: '{App_Name}', label: 'App Name', hint: 'PillCare' },
];

const TARGET_COUNTRIES = [
  { code: 'all', label: '🌐 All Countries (Global Audience)', flag: '🌐' },
  { code: 'IN', label: '🇮🇳 India (IN) — Diwali, Holi, Republic Day', flag: '🇮🇳' },
  { code: 'US', label: '🇺🇸 United States (US) — Thanksgiving, 4th of July', flag: '🇺🇸' },
  { code: 'GB', label: '🇬🇧 United Kingdom (GB) — Bank Holidays, NHS', flag: '🇬🇧' },
  { code: 'CA', label: '🇨🇦 Canada (CA) — Victoria Day, Canada Day', flag: '🇨🇦' },
  { code: 'AU', label: '🇦🇺 Australia (AU) — Australia Day', flag: '🇦🇺' },
  { code: 'AE', label: '🇦🇪 United Arab Emirates (AE) — UAE National Day, Ramadan', flag: '🇦🇪' },
  { code: 'DE', label: '🇩🇪 Germany (DE) — European Health Days', flag: '🇩🇪' },
  { code: 'SG', label: '🇸🇬 Singapore (SG) — National Day, Wellness', flag: '🇸🇬' },
];

export default function NotificationsPage() {
  const { hasPermission } = useAuth();
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [notifType, setNotifType] = useState<'flash' | 'medication' | 'offer' | 'warning' | 'info'>('flash');
  const [routeKey, setRouteKey] = useState('/today');
  const [targetAudience, setTargetAudience] = useState<'all' | 'free_users' | 'premium_users' | 'inactive_7d'>('all');
  const [targetCountry, setTargetCountry] = useState<string>('all');
  const [inAppChannel, setInAppChannel] = useState(true);
  const [pushChannel, setPushChannel] = useState(true);
  const [confirmSendModal, setConfirmSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [activeInput, setActiveInput] = useState<'title' | 'body'>('body');
  const [previewUserKey, setPreviewUserKey] = useState<'rahul' | 'sarah' | 'anon'>('rahul');

  const canCreate = hasPermission('notifications.create');
  const canSend = hasPermission('notifications.send');

  useEffect(() => {
    fetchNotifications().then(setCampaigns);
  }, []);

  const insertTag = (tag: string) => {
    if (!canCreate) return;
    if (activeInput === 'title') {
      setTitle((prev) => (prev ? `${prev} ${tag}` : tag));
    } else {
      setBody((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };

  const interpolatePreview = (text: string): string => {
    if (!text) return '';
    const u = SAMPLE_USERS[previewUserKey];
    return text
      .replace(/\{\{?\s*(?:first_name|first\s*name)\s*\}?\}/gi, u.first_name)
      .replace(/\{\{?\s*(?:full_name|full\s*name|name)\s*\}?\}/gi, u.full_name)
      .replace(/\{\{?\s*(?:streak_days|streak\s*days|streak)\s*\}?\}/gi, String(u.streak))
      .replace(/\{\{?\s*(?:city|location_city)\s*\}?\}/gi, u.city)
      .replace(/\{\{?\s*(?:country|location_country)\s*\}?\}/gi, u.country)
      .replace(/\{\{?\s*(?:app_name|app)\s*\}?\}/gi, 'PillCare');
  };

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
        targetCountry: targetCountry,
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
          targetCountry: targetCountry,
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
            `✅ Broadcast dispatched: Reached cohort '${targetAudience}' [${targetCountry}] across ${channels.join(' & ')}.`
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
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
              <Globe className="w-3 h-3" /> GEO-TARGETING & PERSONALIZATION
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Engagement & Notification Command</h1>
          <p className="text-xs text-slate-400">
            Broadcast personalized notifications with dynamic tags like <code className="text-amber-400 font-mono">{'{First_name}'}</code>, target users by country/event, and trigger flash HUD alerts.
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
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-400" /> Create Rich Broadcast Campaign
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Editing: <strong className="text-sky-400">{activeInput.toUpperCase()}</strong>
            </span>
          </div>

          {/* Interactive Personalization Tag Toolbar */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Dynamic Personalization Tags (Click to Insert)
              </span>
              <span className="text-[10px] text-slate-400">Inserts into {activeInput === 'title' ? 'Title' : 'Message Body'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => insertTag(t.tag)}
                  title={t.hint}
                  className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-mono text-[11px] flex items-center gap-1 transition-all hover:scale-105 active:scale-95"
                >
                  <Tag className="w-3 h-3 text-indigo-400" />
                  <span className="font-bold">{t.tag}</span>
                  <span className="text-[9px] text-indigo-400/80">({t.label})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 flex items-center justify-between">
                <span>Notification Title</span>
                <button
                  type="button"
                  onClick={() => setActiveInput('title')}
                  className={`text-[10px] font-mono ${activeInput === 'title' ? 'text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  {activeInput === 'title' ? '● Focused' : 'Focus for Tags'}
                </button>
              </label>
              <input
                type="text"
                value={title}
                onFocus={() => setActiveInput('title')}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. ⚡ {First_name}, time for your evening pills!"
                disabled={!canCreate}
                className={`w-full p-2.5 rounded-xl bg-slate-900/90 border text-slate-100 focus:outline-none font-medium transition-all ${
                  activeInput === 'title' ? 'border-sky-500 ring-1 ring-sky-500/30' : 'border-slate-800'
                }`}
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
              <label className="font-semibold text-slate-300">Target Audience Cohort</label>
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
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" /> Target Country / Event Region
              </label>
              <select
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value)}
                disabled={!canCreate}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-medium focus:outline-none font-medium"
              >
                {TARGET_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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

            <div className="space-y-1">
              <label className="font-semibold text-slate-300 flex items-center justify-between">
                <span>Message Body Text</span>
                <button
                  type="button"
                  onClick={() => setActiveInput('body')}
                  className={`text-[10px] font-mono ${activeInput === 'body' ? 'text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  {activeInput === 'body' ? '● Focused' : 'Focus for Tags'}
                </button>
              </label>
              <div className="relative">
                <textarea
                  value={body}
                  onFocus={() => setActiveInput('body')}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="e.g. Keep your {Streak_Days}-day streak strong in {City}! Remember your 8:00 PM dose with water."
                  rows={3}
                  disabled={!canCreate}
                  className={`w-full p-2.5 rounded-xl bg-slate-900/90 border text-slate-100 focus:outline-none transition-all ${
                    activeInput === 'body' ? 'border-sky-500 ring-1 ring-sky-500/30' : 'border-slate-800'
                  }`}
                />
              </div>
            </div>
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

        {/* Right 1 Col: Live Device Preview with User Switcher */}
        <div className="p-6 rounded-3xl glass-card border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" /> Live In-App & Push Preview
            </h2>
          </div>

          {/* Simulated User Selector */}
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400">
                Simulated User Preview
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Live Tag Engine</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['rahul', 'sarah', 'anon'] as const).map((key) => {
                const u = SAMPLE_USERS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreviewUserKey(key)}
                    className={`px-2 py-1.5 rounded-xl text-[10px] font-medium border text-center transition-all ${
                      previewUserKey === key
                        ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 font-bold shadow-sm'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div>{u.flag} {u.first_name}</div>
                    <div className="text-[8px] text-slate-500 truncate">{u.country}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phone Frame Mockup */}
          <div className="w-full rounded-2xl bg-slate-950 border-2 border-slate-800 p-4 relative min-h-[340px] flex flex-col justify-end overflow-hidden shadow-2xl">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-slate-800 rounded-full"></div>

            {/* Target Country Tag Watermark */}
            <div className="absolute top-8 right-3 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-[9px] font-mono text-slate-300">
              Target: {targetCountry === 'all' ? '🌐 Global' : targetCountry}
            </div>

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

              {/* Title & Body with dynamic tag interpolation */}
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
                    {interpolatePreview(title) || 'PillCare Notification Title'}
                  </h4>
                  <p className="text-[11px] text-slate-300 line-clamp-3 leading-tight">
                    {interpolatePreview(body) || 'Your notification body and health guidance will appear here.'}
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
          Build v1.50 sends push tokens to <code className="text-sky-400 font-mono">/push-token</code> when opened. You can also paste your phone&apos;s push token below to send a live push payload directly to your device.
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
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{c.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border bg-slate-800/80 text-slate-300 border-slate-700">
                      {c.targetCountry === 'IN' ? '🇮🇳 India' : c.targetCountry === 'US' ? '🇺🇸 USA' : c.targetCountry === 'GB' ? '🇬🇧 UK' : c.targetCountry === 'CA' ? '🇨🇦 Canada' : c.targetCountry === 'AU' ? '🇦🇺 Australia' : c.targetCountry === 'AE' ? '🇦🇪 UAE' : c.targetCountry === 'DE' ? '🇩🇪 Germany' : c.targetCountry === 'SG' ? '🇸🇬 Singapore' : '🌐 Global'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-[10px]">
                    {c.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-300">{c.body}</p>
                <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Dispatched to {c.sentCount.toLocaleString()} devices ({c.targetAudience})</span>
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
              You are about to broadcast push notifications to registered devices in cohort <strong className="text-sky-400">&apos;{targetAudience}&apos;</strong> and country <strong className="text-amber-400">&apos;{targetCountry === 'all' ? 'Global' : targetCountry}&apos;</strong>.
            </p>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1">
              <div className="text-slate-400 font-mono">Title: {title}</div>
              <div className="text-slate-300 line-clamp-2">Body: {body}</div>
            </div>
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
