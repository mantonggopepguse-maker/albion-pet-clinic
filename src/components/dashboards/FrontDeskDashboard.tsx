import React, { useState, useEffect } from 'react';
import { ClinicSettings, User, AppView } from '../../types';
import { Calendar, Users, PawPrint, ChevronRight, Clock, Plus, CreditCard, Bell, Package, CheckCircle2, UserCheck, AlertCircle, ArrowRight, ShieldCheck, Phone } from 'lucide-react';
import { api } from '../../services/apiService';
import PageLoader from '../shared/PageLoader';

interface FrontDeskDashboardProps {
    settings: ClinicSettings;
    user?: User | null;
    onNavigate: (view: AppView) => void;
}

export const FrontDeskDashboard: React.FC<FrontDeskDashboardProps> = ({
    settings,
    user,
    onNavigate
}) => {
    const [stats, setStats] = useState(() => {
        const cached = api.getCache<any>('dashboard', 'stats');
        return cached || {
            upcomingAppointments: [],
            clients: { today: 0 },
            patients: { today: 0 },
            outstandingDebt: 0
        };
    });

    const [loading, setLoading] = useState(!api.getCache('dashboard', 'stats'));

    useEffect(() => {
        const fetchStats = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const data = await api.dashboard.getStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to load front desk stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, [settings.acronym]);

    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20 relative max-w-7xl mx-auto px-4 md:px-0">
            {/* Header */}
            <div className="dashboard-hero">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="flex flex-col text-slate-900">
                        <span className="eyebrow-label mb-2">{settings.name || 'Your clinic'}</span>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-11 h-11 bg-amber-500 rounded-[1.3rem] flex items-center justify-center text-white shadow-lg shadow-amber-100/60">
                                <Users className="w-5 h-5" />
                            </div>
                            <h1 className="section-title text-3xl md:text-5xl">Front Desk Hub</h1>
                        </div>
                        <span className="mb-3 text-xs font-extrabold uppercase tracking-[0.28em] text-amber-600/80">Reception & Patient Intake</span>
                        <p className="font-semibold text-lg text-slate-500 max-w-2xl">
                            {getTimeGreeting()}, <span className="text-amber-600">{user?.name?.split(' ')[0] || 'Reception Team'}</span>. Track patient arrivals, check-in waiting queues, POS billing, and vaccination recalls.
                        </p>
                    </div>
                    <div className="neo-pill text-amber-700">Live Reception Stream</div>
                </div>
            </div>

            {/* 4 Bento KPI Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                <div className="stat-widget stat-widget-amber">
                    <div className="stat-kicker">Client sign-ins</div>
                    <div className="stat-value mt-2">{stats.clients?.today || 0}</div>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                            <div className="h-full w-3/4 rounded-full bg-amber-500"></div>
                        </div>
                        <span className="text-xs font-extrabold text-slate-700">Active flow</span>
                    </div>
                    <div className="stat-footer">
                        <span>Front desk</span>
                        <span>Today</span>
                    </div>
                </div>
                <div className="stat-widget stat-widget-blue">
                    <div className="stat-kicker">Upcoming arrivals</div>
                    <div className="stat-value mt-2">{stats.upcomingAppointments?.length || 0}</div>
                    <div className="mt-4 grid grid-cols-4 gap-1.5">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className={`h-6 rounded-[0.7rem] ${index < Math.min(stats.upcomingAppointments?.length || 0, 4) ? 'bg-amber-500 shadow-sm' : 'bg-slate-100'}`}></div>
                        ))}
                    </div>
                    <div className="stat-footer">
                        <span>Check-ins</span>
                        <span>Queue</span>
                    </div>
                </div>
                <div className="stat-widget stat-widget-red">
                    <div className="stat-kicker">Outstanding balance</div>
                    <div className="stat-value mt-2">{settings.currencySymbol}{(stats.outstandingDebt || 0).toLocaleString()}</div>
                    <div className="mt-4 text-xs font-extrabold text-rose-600">Pending receipts</div>
                    <div className="stat-footer">
                        <span>POS Billing</span>
                        <span>Collection</span>
                    </div>
                </div>
                <div className="stat-widget stat-widget-teal">
                    <div className="stat-kicker">Patients today</div>
                    <div className="stat-value mt-2">{stats.patients?.today || 0}</div>
                    <div className="mt-4 flex justify-between gap-1.5">
                        {['Morning', 'Afternoon', 'Evening'].map((slot) => (
                            <div key={slot} className="flex-1 rounded-xl bg-slate-100/90 px-1 py-1 text-center text-[9px] font-black uppercase tracking-wider text-slate-700 border border-slate-200/60">
                                {slot}
                            </div>
                        ))}
                    </div>
                    <div className="stat-footer">
                        <span>Intake</span>
                        <span>Slots</span>
                    </div>
                </div>
            </div>

            {/* Reception Tools - 6 Neomorphic Action Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {[
                    { label: 'Book Appt', icon: Calendar, view: 'APPOINTMENTS', tint: 'soft-tint-amber' },
                    { label: 'Add Client', icon: Users, view: 'CLIENTS', tint: 'soft-tint-rose' },
                    { label: 'Queue / Triage', icon: UserCheck, view: 'PATIENT_QUEUE', tint: 'soft-tint-teal' },
                    { label: 'POS Checkout', icon: CreditCard, view: 'POS', tint: 'soft-tint-indigo' },
                    { label: 'Food & Retail', icon: Package, view: 'INVENTORY', tint: 'soft-tint-amber' },
                    { label: 'Reminders Due', icon: Bell, view: 'REMINDERS', tint: 'soft-tint-rose' }
                ].map(tool => (
                    <button
                        key={tool.label}
                        onClick={() => onNavigate(tool.view as AppView)}
                        className="quick-access-card group active:scale-95 text-left"
                    >
                        <div className={`quick-access-inner ${tool.tint}`}>
                            <div className="flex justify-between items-start">
                                <div className="quick-access-badge">
                                    <tool.icon className="w-4.5 h-4.5" />
                                </div>
                            </div>
                        </div>
                        <span className="quick-access-label">{tool.label}</span>
                    </button>
                ))}
            </div>

            {/* High-Level Flow Stats - Prism Glass */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="metric-card flex items-center justify-between gap-6">
                    <div className="relative z-10">
                        <p className="eyebrow-label text-amber-700/70 mb-3">New clients today</p>
                        <p className="section-title text-3xl">{stats.clients?.today || 0} Registrations</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-amber-500 relative z-10">
                        <Users className="w-6 h-6" />
                    </div>
                </div>
                
                <div className="metric-card flex items-center justify-between gap-6">
                    <div className="relative z-10">
                        <p className="eyebrow-label text-amber-700/70 mb-3">Today&apos;s schedule</p>
                        <p className="section-title text-3xl">{stats.upcomingAppointments?.length || 0} Arrivals</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-amber-500 relative z-10">
                        <Calendar className="w-6 h-6" />
                    </div>
                </div>

                <div className="metric-card flex items-center justify-between gap-6">
                    <div className="relative z-10">
                        <p className="eyebrow-label text-rose-700/70 mb-3">Outstanding balance</p>
                        <p className="section-title text-3xl text-rose-600">{settings.currencySymbol}{(stats.outstandingDebt || 0).toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-rose-500 relative z-10">
                        <CreditCard className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Daily Schedule - Check-in Dashboard & Triage Flow */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 dashboard-panel-strong p-8">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="section-title text-2xl flex items-center gap-3">
                                <Clock className="w-6 h-6 text-amber-500" />
                                Patient Arrivals & Check-ins
                            </h3>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Live Lobby Status & Examination Routing</p>
                        </div>
                        <button onClick={() => onNavigate('APPOINTMENTS')} className="text-[10px] font-black text-amber-600 uppercase hover:underline">Full Daily View</button>
                    </div>

                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                        {stats.upcomingAppointments && stats.upcomingAppointments.length > 0 ? (
                            stats.upcomingAppointments.map((apt: any, idx: number) => {
                                const isFirst = idx === 0;
                                const isSecond = idx === 1;
                                const stage = isFirst ? 'In Consultation' : isSecond ? 'In Lobby (Waiting)' : 'Expected';
                                const stageColor = isFirst ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isSecond ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200';

                                return (
                                    <div key={apt.id} className="neo-tile flex items-center justify-between p-4.5 gap-4 group">
                                        <div className="flex items-center gap-5 min-w-0">
                                            <div className="flex flex-col items-center justify-center w-14 px-2 border-r border-slate-200 shrink-0">
                                                <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Time</span>
                                                <span className="text-base font-black text-amber-600">{apt.time}</span>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-slate-800 truncate">{apt.client?.firstName} {apt.client?.lastName}</span>
                                                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${stageColor}`}>
                                                        {stage}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <PawPrint className="w-3 h-3 text-slate-400" />
                                                        <span className="text-xs font-bold text-slate-600">{apt.patient?.name || 'Guest Pet'}</span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold text-slate-400 truncate">· {apt.procedure?.name || 'General Consultation'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button 
                                                onClick={() => onNavigate('PATIENT_QUEUE')}
                                                className="py-1.5 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-xs font-bold transition flex items-center gap-1"
                                                title="Send to Triage Queue"
                                            >
                                                <span>Check In</span>
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                            <button 
                                                onClick={() => onNavigate('POS')}
                                                className="py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold transition flex items-center gap-1"
                                                title="Open POS Checkout"
                                            >
                                                <CreditCard className="w-3 h-3" />
                                                <span>Pay</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                                <Bell className="w-12 h-12 mb-3 opacity-15" />
                                <p className="text-base font-black text-slate-400">No scheduled arrivals for today.</p>
                                <button onClick={() => onNavigate('APPOINTMENTS')} className="mt-4 btn-luminous btn-luminous-neutral px-6 py-2.5 text-xs font-black">Open Scheduler</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Vaccination Recalls & Fast Walk-in */}
                <div className="space-y-6">
                    {/* Fast Walk-in Intake Tile */}
                    <div className="dashboard-panel p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-teal-600" />
                                Fast Walk-in Routing
                            </h4>
                            <span className="text-[10px] font-black uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">Emergency & Drop-in</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mb-4">
                            Route unexpected client arrivals directly to the veterinarian triage queue or register their pet immediately.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => onNavigate('CLIENTS')}
                                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>New Client</span>
                            </button>
                            <button
                                onClick={() => onNavigate('PATIENT_QUEUE')}
                                className="py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                                <ArrowRight className="w-3.5 h-3.5" />
                                <span>Triage Queue</span>
                            </button>
                        </div>
                    </div>

                    {/* Vaccination & Preventive Recalls Due */}
                    <div className="dashboard-panel p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                                <Bell className="w-4 h-4 text-rose-500" />
                                Preventive Recalls Due
                            </h4>
                            <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">This Week</span>
                        </div>
                        <div className="space-y-2.5 mb-4">
                            {[
                                { pet: 'Bruno', vaccine: 'Rabies Booster', owner: 'Mrs. Adebayo', phone: '0803 234 5678' },
                                { pet: 'Coco', vaccine: 'DHPP Core 5-in-1', owner: 'Mr. Okafor', phone: '0802 987 6543' },
                                { pet: 'Whiskers', vaccine: 'Deworming & FVRCP', owner: 'Dr. Nwosu', phone: '0814 555 1234' }
                            ].map((rem, i) => (
                                <div key={i} className="p-3 bg-white/70 rounded-xl border border-white/80 flex items-center justify-between gap-2 shadow-xs">
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-800 truncate">{rem.pet} · <span className="text-[10px] font-semibold text-rose-600">{rem.vaccine}</span></p>
                                        <p className="text-[10px] text-slate-400 font-medium truncate">{rem.owner} ({rem.phone})</p>
                                    </div>
                                    <button
                                        onClick={() => onNavigate('REMINDERS')}
                                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shrink-0"
                                        title="Dispatch Reminder"
                                    >
                                        <Phone className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => onNavigate('REMINDERS')}
                            className="btn-luminous btn-luminous-emerald w-full text-[10px] uppercase tracking-widest py-2.5"
                        >
                            Open Recall Center
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
