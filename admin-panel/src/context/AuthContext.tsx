'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser, AdminRole, AdminPermission } from '@/types/admin';
import { getStoredAdminSession, saveAdminSession, clearAdminSession, DEFAULT_ADMIN } from '@/lib/auth/session';
import { hasPermission as checkRolePermission } from '@/lib/auth/rbac';

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: AdminUser, token: string) => void;
  logout: () => void;
  revokeSession: (sessionId: string) => void;
  revokeAllOtherSessions: () => void;
  updateUserRole: (newRole: AdminRole) => void;
  updateUserPermissions: (newPerms: AdminPermission[]) => void;
  hasPermission: (permission: AdminPermission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { user: storedUser, token: storedToken } = getStoredAdminSession();
    setUser(storedUser || DEFAULT_ADMIN);
    setToken(storedToken || 'pillcare_sys_jwt_token_2026');
    setIsLoading(false);
  }, []);

  const login = (newUser: AdminUser, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    saveAdminSession(newUser, newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearAdminSession();
  };

  const revokeSession = (sessionId: string) => {
    if (!user) return;
    const updated = {
      ...user,
      activeSessions: user.activeSessions.filter((s) => s.sessionId !== sessionId),
    };
    setUser(updated);
    if (token) saveAdminSession(updated, token);
  };

  const revokeAllOtherSessions = () => {
    if (!user) return;
    const updated = {
      ...user,
      activeSessions: user.activeSessions.filter((s) => s.isCurrent),
    };
    setUser(updated);
    if (token) saveAdminSession(updated, token);
  };

  const updateUserRole = (newRole: AdminRole) => {
    if (!user) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    if (token) saveAdminSession(updated, token);
  };

  const updateUserPermissions = (newPerms: AdminPermission[]) => {
    if (!user) return;
    const updated = { ...user, customPermissions: newPerms };
    setUser(updated);
    if (token) saveAdminSession(updated, token);
  };

  const canAccess = (permission: AdminPermission): boolean => {
    if (!user) return false;
    return checkRolePermission(user.role, user.customPermissions, permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        revokeSession,
        revokeAllOtherSessions,
        updateUserRole,
        updateUserPermissions,
        hasPermission: canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
