import { AdminUser, AdminUserSession } from '@/types/admin';

const ADMIN_STORAGE_KEY = 'pillcare_admin_user_session';
const ADMIN_TOKEN_KEY = 'pillcare_admin_jwt';

export const DEFAULT_ADMIN: AdminUser = {
  id: 'usr_super_01',
  email: 'admin@pillcare.in',
  name: 'Operations Director',
  role: 'SUPER_ADMIN',
  customPermissions: [],
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  twoFactorEnabled: true,
  lastLogin: new Date().toISOString(),
  status: 'active',
  activeSessions: [
    {
      sessionId: 'sess_curr_99',
      ipAddress: '103.21.124.89',
      userAgent: 'Chrome 122.0.0 (macOS Sonoma)',
      location: 'Bengaluru, India',
      loginTime: new Date().toISOString(),
      lastActive: 'Just now',
      isSuspicious: false,
      isCurrent: true,
    },
    {
      sessionId: 'sess_mob_42',
      ipAddress: '49.207.210.12',
      userAgent: 'PillCare Admin Mobile (iOS 17.4)',
      location: 'Mumbai, India',
      loginTime: new Date(Date.now() - 86400000).toISOString(),
      lastActive: '4 hours ago',
      isSuspicious: false,
      isCurrent: false,
    },
    {
      sessionId: 'sess_unk_11',
      ipAddress: '185.220.101.5',
      userAgent: 'Unknown Browser (Linux x86_64)',
      location: 'Frankfurt, Germany',
      loginTime: new Date(Date.now() - 172800000).toISOString(),
      lastActive: '2 days ago',
      isSuspicious: true,
      isCurrent: false,
    },
  ],
};

export function getStoredAdminSession(): { user: AdminUser | null; token: string | null } {
  if (typeof window === 'undefined') return { user: null, token: null };
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!raw) {
      // Default auto-login as SUPER_ADMIN for production-grade demo state
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(DEFAULT_ADMIN));
      localStorage.setItem(ADMIN_TOKEN_KEY, 'pillcare_sys_jwt_token_2026');
      return { user: DEFAULT_ADMIN, token: 'pillcare_sys_jwt_token_2026' };
    }
    return { user: JSON.parse(raw), token };
  } catch (e) {
    return { user: null, token: null };
  }
}

export function saveAdminSession(user: AdminUser, token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(user));
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_STORAGE_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}
