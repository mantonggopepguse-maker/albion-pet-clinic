import React, { useState } from 'react';
import { Mail, Lock, Loader2, Dog, Cat, PawPrint, Chrome, ArrowRight, Shield, Stethoscope } from 'lucide-react';
import { ClinicSettings } from '../../types';
import { api } from '../../services/apiService';
import { getFirebaseIdToken, requestFcmToken, signInWithFirebaseEmail, signInWithGoogle } from '../../services/firebaseService';
import { toast } from 'sonner';
import { Logo } from '../shared/Logo';

interface AuthProps {
  onLogin: (settings: Partial<ClinicSettings>) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [accountPicker, setAccountPicker] = useState<null | {
    staff: any;
    client: any;
  }>(null);

  const syncNotifications = async () => {
    try {
      const token = await requestFcmToken();
      if (token) {
        await api.firebase.registerFcmToken(token);
      }
    } catch (error) {
      console.warn('Notification setup skipped:', error);
    }
  };

  const handleSharedResponse = (response: any) => {
    if (response?.requiresAccountSelection && response?.sessions) {
      setAccountPicker(response.sessions);
      toast.message('Choose which workspace you want to enter for this email.');
      return;
    }

    if (response?.accountType === 'client' && response?.client) {
      localStorage.setItem('client', JSON.stringify(response.client));
      syncNotifications();
      window.location.href = '/portal';
      return;
    }

    if (response?.user) {
      syncNotifications();
      onLogin(response.user);
    }
  };

  const handleFirebaseEmailLogin = async () => {
    try {
      const credential = await signInWithFirebaseEmail(formData.email, formData.password);
      const idToken = await getFirebaseIdToken(credential);
      return api.auth.firebaseLogin(idToken);
    } catch (firebaseError) {
      return api.auth.login({ email: formData.email, password: formData.password });
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const credential = await signInWithGoogle();
      const idToken = await getFirebaseIdToken(credential);
      const response = await api.auth.firebaseLogin(idToken);
      handleSharedResponse(response);
    } catch (error: any) {
      const code = error?.data?.code || error?.code;
      if (code === 'POSTGRES_USER_NOT_FOUND') {
        toast.error('Create your clinic account first, then Google sign-in will work for that email.');
      } else if (code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || 'Google sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const DEMO_USERS = [
    { role: 'Super Admin', email: 'superadmin@albionpetclinic.com', password: 'superadmin123', icon: Shield, desc: 'Full system access' },
    { role: 'Admin / Vet', email: 'admin@albionpetclinic.com', password: 'admin123', icon: Stethoscope, desc: 'Clinic operations' },
  ];

  const handleDemoLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      let response;
      try {
        const credential = await signInWithFirebaseEmail(email, password);
        const idToken = await getFirebaseIdToken(credential);
        response = await api.auth.firebaseLogin(idToken);
      } catch {
        response = await api.auth.login({ email, password });
      }
      if (response?.user) {
        syncNotifications();
        onLogin(response.user);
      }
    } catch (error: any) {
      toast.error(error.message || `Unable to sign in as ${email}. Check that the server is running.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await handleFirebaseEmailLogin();
      handleSharedResponse(response);
    } catch (error: any) {
      toast.error(error.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modern-shell min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="auth-orb auth-orb-a animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="auth-orb auth-orb-b animate-pulse" style={{ animationDuration: '10s' }}></div>
        <div className="absolute top-20 left-20 text-[#596B48]/15 animate-bounce" style={{ animationDuration: '3s' }}><Dog className="w-12 h-12" /></div>
        <div className="absolute bottom-40 right-20 text-[#6F805E]/15 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}><Cat className="w-10 h-10" /></div>
        <div className="absolute top-40 right-1/4 text-[#596B48]/15 animate-bounce" style={{ animationDuration: '5s', animationDelay: '0.5s' }}><PawPrint className="w-8 h-8" /></div>
      </div>

      <div className="auth-modern-card auth-glass-card w-full max-w-[26rem] min-h-[650px] relative z-10 transition-all duration-500">
        <div className="auth-form-panel auth-glass-panel p-5 sm:p-6 md:p-7 flex flex-col relative transition-all duration-500">
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="auth-logo-shell auth-logo-glass">
                  <Logo size="md" />
                </div>
                <div>
                  <span className="text-xl font-extrabold tracking-tight text-slate-800 block">Albion Pharmaceuticals</span>
                  <span className="text-[11px] font-semibold text-teal-700 tracking-wider uppercase">Pet Clinic OS</span>
                </div>
              </div>
              <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/40 backdrop-blur-xl px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-700 shadow-[0_12px_30px_rgba(148,163,184,0.16)]">
                Secure
              </div>
            </div>

            <h1 className="font-extrabold text-slate-800 tracking-tight text-2xl md:text-3xl mt-2 mb-2">Sign in</h1>
            <p className="text-slate-500 font-semibold leading-relaxed">Use your email and password to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <div className="flex-1">
              <div className="space-y-4 animate-fade-in-up">
                <div className="group">
                  <div className="relative transition-all duration-300 group-focus-within:-translate-y-1">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 transition-colors group-focus-within:text-[#14B8A6]" />
                    <input
                      type="email"
                      required
                      placeholder="Email"
                      className="w-full auth-neo-input pl-12 pr-4"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="group">
                  <div className="relative transition-all duration-300 group-focus-within:-translate-y-1">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 transition-colors group-focus-within:text-[#14B8A6]" />
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      className="w-full auth-neo-input pl-12 pr-4"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>

                {accountPicker && (
                  <div className="rounded-[1.6rem] border border-white/70 bg-white/50 backdrop-blur-2xl p-4 space-y-3 shadow-[0_20px_40px_rgba(148,163,184,0.16)]">
                    <p className="text-sm font-bold text-slate-700">This email belongs to both a clinic workspace and a client portal.</p>
                    <div className="grid gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountPicker(null);
                          localStorage.setItem('token', accountPicker.staff.token);
                          syncNotifications();
                          onLogin(accountPicker.staff.user);
                        }}
                        className="w-full rounded-2xl bg-white/75 border border-white/70 px-4 py-3 text-left shadow-[0_12px_26px_rgba(148,163,184,0.12)] transition hover:bg-white"
                      >
                        <span className="block text-xs font-black uppercase tracking-widest text-[#14B8A6]">Clinic Staff</span>
                        <span className="block text-sm font-bold text-slate-700">{accountPicker.staff.user?.name || formData.email}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountPicker(null);
                          localStorage.setItem('token', accountPicker.client.token);
                          localStorage.setItem('client', JSON.stringify(accountPicker.client.client));
                          syncNotifications();
                          window.location.href = '/portal';
                        }}
                        className="w-full rounded-2xl bg-white/75 border border-white/70 px-4 py-3 text-left shadow-[0_12px_26px_rgba(148,163,184,0.12)] transition hover:bg-white"
                      >
                        <span className="block text-xs font-black uppercase tracking-widest text-[#14B8A6]">Client Portal</span>
                        <span className="block text-sm font-bold text-slate-700">
                          {accountPicker.client.client?.firstName} {accountPicker.client.client?.lastName}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full btn-luminous btn-luminous-emerald py-4"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="mt-3 w-full rounded-2xl border border-white/70 bg-white/55 px-4 py-3.5 text-sm font-extrabold text-slate-700 shadow-[inset_8px_8px_18px_rgba(148,163,184,0.16),inset_-8px_-8px_18px_rgba(255,255,255,0.82),0_14px_30px_rgba(148,163,184,0.14)] transition hover:-translate-y-0.5 hover:bg-white/70 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Chrome className="w-5 h-5 text-[#EA4335]" />
                Continue with Google
              </button>

              <div className="mt-5 pt-5 border-t border-white/50">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 text-center">Quick Access</p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_USERS.map(({ role, email, password, icon: Icon, desc }) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setFormData({ email, password });
                        setTimeout(() => handleDemoLogin(email, password), 50);
                      }}
                      disabled={loading}
                      className="rounded-xl border border-white/60 bg-white/40 px-3 py-3 text-left shadow-[0_8px_20px_rgba(148,163,184,0.1)] transition hover:-translate-y-0.5 hover:bg-white/70 disabled:opacity-50"
                    >
                      <Icon className="w-4 h-4 text-teal-600 mb-1" />
                      <span className="block text-sm font-bold text-slate-700 leading-tight">{role}</span>
                      <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 w-full text-center md:hidden text-slate-400 text-xs">
        Albion Pet Clinic &copy; 2026
      </div>
    </div>
  );
};
