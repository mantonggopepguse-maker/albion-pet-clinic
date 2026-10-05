import React, { useState } from 'react';
import { Mail, Lock, Loader2, Dog, Cat, PawPrint, Chrome, ArrowRight, Shield, Stethoscope, Building2, FlaskConical, HeartPulse, UserRound } from 'lucide-react';
import { ClinicSettings, User, UserRole } from '../../types';
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
    {
      role: 'Super Admin',
      name: 'Dr. Emeka Moneke',
      systemRole: 'SUPER_ADMIN' as UserRole,
      email: 'superadmin@albionpetclinic.com',
      password: 'superadmin123',
      icon: Shield,
      badgeColor: 'text-purple-600 bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600',
      desc: 'Multi-clinic & system config'
    },
    {
      role: 'Clinic Admin',
      name: 'Dr. Kalu Okonkwo',
      systemRole: 'Admin' as UserRole,
      email: 'admin@albionpetclinic.com',
      password: 'admin123',
      icon: Building2,
      badgeColor: 'text-teal-600 bg-teal-50 border-teal-200',
      iconColor: 'text-teal-600',
      desc: 'Clinic ops, staff & financials'
    },
    {
      role: 'Veterinarian',
      name: 'Dr. Amaka Bello, DVM',
      systemRole: 'Veterinarian' as UserRole,
      email: 'vet@albionpetclinic.com',
      password: 'vet123',
      icon: Stethoscope,
      badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      iconColor: 'text-emerald-600',
      desc: 'Treatments, surgery & AI hub'
    },
    {
      role: 'Receptionist',
      name: 'Chioma Eze',
      systemRole: 'Receptionist' as UserRole,
      email: 'reception@albionpetclinic.com',
      password: 'reception123',
      icon: UserRound,
      badgeColor: 'text-sky-600 bg-sky-50 border-sky-200',
      iconColor: 'text-sky-600',
      desc: 'Queue, appointments & POS'
    },
    {
      role: 'Lab Scientist',
      name: 'Babatunde Adeleke',
      systemRole: 'Lab Scientist' as UserRole,
      email: 'lab@albionpetclinic.com',
      password: 'lab123',
      icon: FlaskConical,
      badgeColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      iconColor: 'text-indigo-600',
      desc: 'Lab hub, tests & pathology'
    },
    {
      role: 'Vet Technician',
      name: 'Ibrahim Musa',
      systemRole: 'Vet Tech' as UserRole,
      email: 'vettech@albionpetclinic.com',
      password: 'vettech123',
      icon: HeartPulse,
      badgeColor: 'text-rose-600 bg-rose-50 border-rose-200',
      iconColor: 'text-rose-600',
      desc: 'ICU board & patient vitals'
    },
  ];

  const handleDemoLogin = async (demo: typeof DEMO_USERS[0]) => {
    setLoading(true);
    try {
      let response;
      try {
        const credential = await signInWithFirebaseEmail(demo.email, demo.password);
        const idToken = await getFirebaseIdToken(credential);
        response = await api.auth.firebaseLogin(idToken);
      } catch {
        response = await api.auth.login({ email: demo.email, password: demo.password });
      }
      if (response?.user) {
        syncNotifications();
        onLogin(response.user);
        toast.success(`Signed in as ${response.user.name || demo.name}`);
        return;
      }
    } catch (backendError) {
      console.warn('Backend service offline or unreachable, switching to instant demo session:', backendError);
    }

    // Instant offline/fallback demo authentication
    const demoUser: User = {
      id: `demo-${demo.systemRole.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: demo.name,
      email: demo.email,
      roles: [demo.systemRole],
      status: 'Active',
      isSuperAdmin: demo.systemRole === 'SUPER_ADMIN',
      clinicId: 'clinic-default-01',
      clinic: {
        name: 'Albion Pet Clinic (Lagos)',
        acronym: 'APC',
        address: '123 Albion Pet Street, Lagos, Nigeria',
        phone: '+234 800 123 4567',
        email: 'contact@albionpetclinic.com',
        taxEnabled: true,
        taxRate: 7.5,
        bankName: 'First Bank',
        accountName: 'Albion Pet Clinic Ltd',
        accountNumber: '1234567890',
        currencySymbol: '₦',
        country: 'Nigeria',
        language: 'English',
        useShiftTimetable: true,
      },
    };

    localStorage.setItem('token', 'demo-token-' + Date.now());
    localStorage.setItem('user', JSON.stringify(demoUser));
    toast.success(`Signed in as ${demo.name} (${demo.role})`);
    onLogin(demoUser);
    setLoading(false);
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

  const PHARMA_DEMO_USERS = [
    {
      role: 'Super Admin (CEO)',
      name: 'Dr. Emeka Moneke',
      systemRole: 'super_admin',
      email: 'admin@albionpharma.com',
      icon: Shield,
      badgeColor: 'text-purple-600 bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600',
      desc: 'Full enterprise governance across all 12 modules'
    },
    {
      role: 'Sales Representative',
      name: 'Chidi Okafor',
      systemRole: 'sales_rep',
      email: 'chidi@albionpharma.com',
      icon: UserRound,
      badgeColor: 'text-sky-600 bg-sky-50 border-sky-200',
      iconColor: 'text-sky-600',
      desc: 'Field orders, territory stock & targets'
    },
    {
      role: 'Finance Manager',
      name: 'Ngozi Eze',
      systemRole: 'finance_manager',
      email: 'ngozi@albionpharma.com',
      icon: Building2,
      badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      iconColor: 'text-emerald-600',
      desc: 'Payment approvals, receivables & payroll'
    },
    {
      role: 'Inventory Manager',
      name: 'Tunde Adeyemi',
      systemRole: 'inventory_manager',
      email: 'tunde@albionpharma.com',
      icon: Building2,
      badgeColor: 'text-amber-600 bg-amber-50 border-amber-200',
      iconColor: 'text-amber-600',
      desc: 'Warehouse stock, batches & expiry control'
    },
    {
      role: 'Executive Director (CEO)',
      name: 'Chief Executive Officer',
      systemRole: 'ceo',
      email: 'ceo@albionpharma.com',
      icon: Shield,
      badgeColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      iconColor: 'text-indigo-600',
      desc: 'High-level financial KPIs & strategic oversight'
    },
  ];

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'CLINIC' | 'PHARMA'>('CLINIC');

  const getPharmaBaseUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return 'http://localhost:3000';
    }
    return 'https://albion-os-180033031286.us-central1.run.app';
  };

  const handlePharmaHandoff = (demo: typeof PHARMA_DEMO_USERS[0]) => {
    toast.loading(`Redirecting to AlbionOS Commercial Suite as ${demo.role}...`);
    const baseUrl = getPharmaBaseUrl();
    window.location.href = `${baseUrl}/login?demo_role=${encodeURIComponent(demo.systemRole)}`;
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

      <div className="auth-modern-card auth-glass-card w-full max-w-[34rem] min-h-[680px] relative z-10 transition-all duration-500">
        <div className="auth-form-panel auth-glass-panel p-5 sm:p-6 md:p-7 flex flex-col relative transition-all duration-500">
          <div className="mb-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="auth-logo-shell auth-logo-glass">
                  <Logo size="md" />
                </div>
                <div>
                  <span className="text-xl font-extrabold tracking-tight text-slate-800 block">Albion Pharmaceuticals</span>
                  <span className="text-[11px] font-semibold text-teal-700 tracking-wider uppercase">Unified Portal & Clinic OS</span>
                </div>
              </div>
              <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/40 backdrop-blur-xl px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-700 shadow-[0_12px_30px_rgba(148,163,184,0.16)]">
                Dual Suite
              </div>
            </div>

            <h1 className="font-extrabold text-slate-800 tracking-tight text-2xl md:text-3xl mt-1 mb-1">Single Sign-On</h1>
            <p className="text-slate-500 font-semibold text-sm leading-relaxed">Sign in to your clinical or commercial pharmaceutical account.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <div className="flex-1">
              <div className="space-y-3.5 animate-fade-in-up">
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
                className="mt-5 w-full btn-luminous btn-luminous-emerald py-3.5"
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
                className="mt-2.5 w-full rounded-2xl border border-white/70 bg-white/55 px-4 py-3 text-sm font-extrabold text-slate-700 shadow-[inset_8px_8px_18px_rgba(148,163,184,0.16),inset_-8px_-8px_18px_rgba(255,255,255,0.82),0_14px_30px_rgba(148,163,184,0.14)] transition hover:-translate-y-0.5 hover:bg-white/70 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Chrome className="w-4 h-4 text-[#EA4335]" />
                Continue with Google
              </button>

              {/* ── Unified Workspace Profile Switcher ── */}
              <div className="mt-5 pt-4 border-t border-white/60">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Unified 1-Click Access</p>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                    All 11 Roles
                  </span>
                </div>

                {/* Workspace Segmented Tabs */}
                <div className="grid grid-cols-2 p-1 bg-slate-200/60 rounded-xl mb-3 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceTab('CLINIC')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      activeWorkspaceTab === 'CLINIC'
                        ? 'bg-white text-teal-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🐾 Clinic Fleet (6)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceTab('PHARMA')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      activeWorkspaceTab === 'PHARMA'
                        ? 'bg-white text-sky-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    💊 Pharma OS (5)
                  </button>
                </div>

                {/* Tab 1: Clinic Profiles (Current App) */}
                {activeWorkspaceTab === 'CLINIC' && (
                  <div className="grid grid-cols-2 gap-2 animate-fade-in">
                    {DEMO_USERS.map((demo) => {
                      const Icon = demo.icon;
                      return (
                        <button
                          key={demo.role}
                          type="button"
                          onClick={() => {
                            setFormData({ email: demo.email, password: demo.password });
                            handleDemoLogin(demo);
                          }}
                          disabled={loading}
                          className="group rounded-xl border border-white/70 bg-white/50 hover:bg-white/90 p-2.5 text-left shadow-[0_4px_14px_rgba(148,163,184,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 flex flex-col justify-between"
                          title={`1-Click login as ${demo.name} (${demo.role})`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1.5 rounded-lg ${demo.badgeColor} border flex-shrink-0`}>
                              <Icon className={`w-3.5 h-3.5 ${demo.iconColor}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-bold text-slate-800 leading-tight truncate">{demo.role}</span>
                              <span className="block text-[10px] text-slate-500 truncate">{demo.name}</span>
                            </div>
                          </div>
                          <span className="block text-[10px] text-slate-400 font-medium leading-tight mt-0.5 line-clamp-1">{demo.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Tab 2: Pharma OS Profiles (Direct Handoff to AlbionOS) */}
                {activeWorkspaceTab === 'PHARMA' && (
                  <div className="grid grid-cols-2 gap-2 animate-fade-in">
                    {PHARMA_DEMO_USERS.map((demo) => {
                      const Icon = demo.icon;
                      return (
                        <button
                          key={demo.role}
                          type="button"
                          onClick={() => handlePharmaHandoff(demo)}
                          disabled={loading}
                          className="group rounded-xl border border-sky-200/80 bg-sky-50/50 hover:bg-sky-50/90 p-2.5 text-left shadow-[0_4px_14px_rgba(148,163,184,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 flex flex-col justify-between"
                          title={`1-Click handoff to AlbionOS as ${demo.name} (${demo.role})`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1.5 rounded-lg ${demo.badgeColor} border flex-shrink-0`}>
                              <Icon className={`w-3.5 h-3.5 ${demo.iconColor}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-bold text-slate-800 leading-tight truncate">{demo.role}</span>
                              <span className="block text-[10px] text-slate-500 truncate">{demo.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="block text-[9.5px] text-slate-400 font-medium leading-tight truncate max-w-[80%]">{demo.desc}</span>
                            <span className="text-[10px] font-extrabold text-sky-600 group-hover:translate-x-0.5 transition-transform">→</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
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
