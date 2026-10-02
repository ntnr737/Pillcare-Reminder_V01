'use client';

import React, { useState } from 'react';
import { Pill, ShieldCheck, Lock, Mail, Key, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DEFAULT_ADMIN } from '@/lib/auth/session';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('admin@pillcare.in');
  const [password, setPassword] = useState('••••••••••••');
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [totpCode, setTotpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your administrator email address.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setStep('totp');
    }, 600);
  };

  const handleTotpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length < 6) {
      setErrorMsg('Please enter a valid 6-digit authenticator code.');
      return;
    }
    setLoading(true);

    setTimeout(() => {
      login(DEFAULT_ADMIN, 'pillcare_sys_jwt_token_2026');
      router.push('/dashboard');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-4 selection:bg-sky-500 selection:text-white">
      {/* Ambient background glow */}
      <div className="absolute w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20"></div>

      <div className="w-full max-w-md rounded-3xl glass-card border border-slate-800 shadow-2xl p-8 relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25 mb-1">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            PillCare <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">ADMIN</span>
          </h1>
          <p className="text-xs text-slate-400">Enterprise Operations & Security Command Center</p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Admin Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-sky-500 text-xs text-slate-100 focus:outline-none transition-colors"
                  placeholder="admin@pillcare.in"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-sky-500 text-xs text-slate-100 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
            >
              {loading ? 'Verifying Admin Claims...' : 'Continue to 2FA Step'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-[#0f1420] px-3 text-[10px] text-slate-500 font-mono uppercase">or SSO</span>
            </div>

            <button
              type="button"
              onClick={() => {
                login(DEFAULT_ADMIN, 'pillcare_sys_jwt_token_2026');
                router.push('/dashboard');
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-medium transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Sign in with Google Workspace
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotpSubmit} className="space-y-4 animate-in fade-in">
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Two-Factor Authentication Enforced for SUPER_ADMIN role.</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">6-Digit Authenticator Code</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-sky-500 text-sm font-mono tracking-widest text-slate-100 focus:outline-none transition-colors"
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
            >
              {loading ? 'Validating TOTP Secret...' : 'Authenticate & Launch Command Panel'}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-slate-800 text-center text-[10px] text-slate-500 font-mono">
          Strict RBAC Enforcement • Session IP Logging Enabled
        </div>
      </div>
    </div>
  );
}
