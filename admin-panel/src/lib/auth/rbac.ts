import { AdminRole, AdminPermission } from '@/types/admin';

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    'analytics.view',
    'analytics.export',
    'finance.view',
    'finance.export',
    'finance.refund',
    'users.view',
    'users.edit',
    'users.delete',
    'gtm.view',
    'gtm.edit',
    'gtm.publish',
    'features.view',
    'features.edit',
    'ai.view',
    'ai.configure',
    'notifications.view',
    'notifications.create',
    'notifications.send',
    'settings.view',
    'settings.edit',
    'audit.view',
  ],
  ADMIN: [
    'analytics.view',
    'analytics.export',
    'finance.view',
    'finance.export',
    'users.view',
    'users.edit',
    'gtm.view',
    'gtm.edit',
    'features.view',
    'features.edit',
    'ai.view',
    'ai.configure',
    'notifications.view',
    'notifications.create',
    'notifications.send',
    'settings.view',
    'settings.edit',
    'audit.view',
  ],
  FINANCE_ADMIN: [
    'finance.view',
    'finance.export',
    'finance.refund',
    'analytics.view',
    'analytics.export',
    'audit.view',
  ],
  ANALYTICS_ADMIN: [
    'analytics.view',
    'analytics.export',
    'gtm.view',
    'gtm.edit',
    'gtm.publish',
    'audit.view',
  ],
  MARKETING_ADMIN: [
    'analytics.view',
    'analytics.export',
    'gtm.view',
    'gtm.edit',
    'notifications.view',
    'notifications.create',
    'notifications.send',
    'audit.view',
  ],
  CONTENT_ADMIN: [
    'notifications.view',
    'notifications.create',
    'settings.view',
    'audit.view',
  ],
  SUPPORT_ADMIN: [
    'users.view',
    'users.edit',
    'notifications.view',
    'audit.view',
  ],
  DEVELOPER: [
    'features.view',
    'features.edit',
    'ai.view',
    'ai.configure',
    'settings.view',
    'settings.edit',
    'audit.view',
  ],
  VIEWER: [
    'analytics.view',
    'finance.view',
    'users.view',
    'features.view',
    'ai.view',
    'notifications.view',
    'settings.view',
    'audit.view',
  ],
};

export function hasPermission(
  role: AdminRole,
  customPermissions: AdminPermission[] | undefined,
  requiredPermission: AdminPermission
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  if (rolePerms.includes(requiredPermission)) return true;
  if (customPermissions && customPermissions.includes(requiredPermission)) return true;
  return false;
}

export function getAllAvailablePermissions(): AdminPermission[] {
  return [
    'analytics.view',
    'analytics.export',
    'finance.view',
    'finance.export',
    'finance.refund',
    'users.view',
    'users.edit',
    'users.delete',
    'gtm.view',
    'gtm.edit',
    'gtm.publish',
    'features.view',
    'features.edit',
    'ai.view',
    'ai.configure',
    'notifications.view',
    'notifications.create',
    'notifications.send',
    'settings.view',
    'settings.edit',
    'audit.view',
  ];
}
