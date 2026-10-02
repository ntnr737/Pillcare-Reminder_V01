'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Tag,
  Users,
  DollarSign,
  CreditCard,
  SlidersHorizontal,
  Pill,
  Sparkles,
  Bell,
  FileText,
  Server,
  ShieldCheck,
  FileSpreadsheet,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeColor?: string;
  requiredPermission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Executive Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Google Analytics 4', href: '/analytics/ga4', icon: BarChart3 },
  { name: 'Google Tag Manager', href: '/analytics/gtm', icon: Tag, badge: 'v14', badgeColor: 'bg-cyan-500/20 text-cyan-400' },
  { name: 'User Management', href: '/users', icon: Users, badge: '184k', badgeColor: 'bg-indigo-500/20 text-indigo-400' },
  { name: 'Financial Command', href: '/finance', icon: DollarSign, badge: '₹2.4L', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
  { name: 'Feature Flags', href: '/app-control/feature-flags', icon: SlidersHorizontal, badge: '6 Active', badgeColor: 'bg-purple-500/20 text-purple-400' },
  { name: 'Medication Catalog', href: '/app-control/medication', icon: Pill },
  { name: 'AI / Groq Telemetry', href: '/ai/groq', icon: Sparkles, badge: 'Llama 3.3', badgeColor: 'bg-amber-500/20 text-amber-400' },
  { name: 'Notification Center', href: '/engagement/notifications', icon: Bell },
  { name: 'CMS & Announcements', href: '/content', icon: FileText },
  { name: 'Infrastructure Health', href: '/system/infrastructure', icon: Server, badge: '100%', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
  { name: 'Security Center', href: '/security', icon: ShieldCheck, badge: '2FA', badgeColor: 'bg-cyan-500/20 text-cyan-400' },
  { name: 'Reports & Exports', href: '/reports', icon: FileSpreadsheet },
  { name: 'Immutable Audit Log', href: '/audit-log', icon: History },
  { name: 'Global Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col glass-panel transition-all duration-300 border-r border-slate-800 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/20">
            <Pill className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-1">
                PillCare <span className="text-sky-400 text-xs font-mono px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">ENT</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider">admin.pillcare.in</span>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Role Indicator Banner */}
      {!collapsed && (
        <div className="mx-3 mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">{user?.role || 'SUPER_ADMIN'}</span>
              <span className="text-[10px] text-slate-400">Full Access Privileges</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative ${
                isActive
                  ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/10 text-sky-400 border border-sky-500/30 shadow-sm shadow-sky-500/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
              title={collapsed ? item.name : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              {!collapsed && <span className="truncate flex-1">{item.name}</span>}

              {!collapsed && item.badge && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-700/50 ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                  {item.badge}
                </span>
              )}

              {collapsed && isActive && (
                <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-sky-400"></span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer User Profile Summary */}
      <div className="p-3 border-t border-slate-800/80">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-bold text-xs text-indigo-300 shrink-0">
            {user?.name?.[0] || 'A'}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-medium text-slate-200 truncate">{user?.name || 'Admin User'}</span>
              <span className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@pillcare.in'}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
