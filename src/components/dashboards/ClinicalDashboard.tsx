import React, { useState, useEffect } from 'react';
import { ClinicSettings, User, AppView } from '../../types';
import { PawPrint, Plus, ChevronRight, Clock, Activity, HeartPulse, ShieldAlert, Stethoscope, ClipboardList, Sparkles, Inbox, FlaskConical, AlertTriangle, CheckCircle2, Droplets, ArrowRight, TestTube2, Thermometer } from 'lucide-react';
import { api } from '../../services/apiService';
import PageLoader from '../shared/PageLoader';
import { parseDateOnly } from '../../utils/date';

interface ClinicalDashboardProps {
    settings: ClinicSettings;
    user?: User | null;
    onNavigate: (view: AppView) => void;
}

export const ClinicalDashboard: React.FC<ClinicalDashboardProps> = ({
    settings,
    user,
    onNavigate
}) => {
    const [stats, setStats] = useState(() => {
        const cached = api.getCache<any>('dashboard', 'stats');
        return cached || {
            upcomingAppointments: [],
            ongoingTreatments: [],
            hospitalization: { active: 0, totalKennels: 0, occupiedKennels: 0, occupancyRate: 0 },
            patients: { today: 0, week: 0, month: 0 }
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
                console.error("Failed to load clinical stats", error);
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

    const isLabScientist = user?.roles?.includes('Lab Scientist');
    const isVetTech = user?.roles?.includes('Vet Tech') || user?.roles?.includes('Vet Assistant');
    const isVet = !isLabScientist && !isVetTech;

    return (
        <div className="space-y-8 animate-fade-in pb-20 relative max-w-7xl mx-auto px-4 md:px-0">
            {/* Header & Greetings */}
            <div className="dashboard-hero">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="flex flex-col text-slate-900">
                        <span className="eyebrow-label mb-2">{settings.name || 'Your clinic'}</span>
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-11 h-11 ${isLabScientist ? 'bg-indigo-50 text-indigo-600' : isVetTech ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'} rounded-[1.3rem] flex items-center justify-center shadow-inner`}>
                                {isLabScientist ? <FlaskConical className="w-5 h-5" /> : isVetTech ? <HeartPulse className="w-5 h-5" /> : <Stethoscope className="w-5 h-5" />}
                            </div>
                            <h1 className="section-title text-3xl md:text-5xl">
                                {isLabScientist ? 'Diagnostic Lab Hub' : isVetTech ? 'Inpatient & ICU Ward' : 'Clinical Hub'}
                            </h1>
                        </div>
                        <span className={`mb-3 text-xs font-extrabold uppercase tracking-[0.28em] ${isLabScientist ? 'text-indigo-600/80' : isVetTech ? 'text-rose-600/80' : 'text-emerald-600/80'}`}>
                            {isLabScientist ? 'Pathology & Diagnostics' : isVetTech ? 'Nursing & Vital Monitoring' : 'Care Coordination'}
                        </span>
                        <p className="font-semibold text-lg text-slate-500 max-w-2xl">
                            {getTimeGreeting()}, <span className={isLabScientist ? 'text-indigo-600' : isVetTech ? 'text-rose-600' : 'text-emerald-600'}>{user?.name || 'Clinical Team'}</span>. {
                                isLabScientist
                                    ? 'Track pending specimens, review critical abnormal alerts, and parse reports with AI.'
                                    : isVetTech
                                    ? 'Inpatient kennel rounds, vital signs monitoring, and fluid therapy rates are all in one place.'
                                    : 'Your treatment queue, ward visibility, and next appointments are ready.'
                            }
                        </p>
                    </div>
                    <div className={`neo-pill ${isLabScientist ? 'text-indigo-700' : isVetTech ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {isLabScientist ? 'Live Pathology Stream' : isVetTech ? 'Active Ward Care' : 'Live Clinical View'}
                    </div>
                </div>
            </div>

            {/* KPI Matrix - Role Aware */}
            {isLabScientist ? (
                <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                    <div className="stat-widget stat-widget-blue">
                        <div className="stat-kicker">Pending Specimens</div>
                        <div className="stat-value mt-2">4</div>
                        <div className="mt-4 flex gap-1.5">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="h-6 flex-1 rounded-[0.7rem] bg-indigo-500 shadow-sm"></div>
                            ))}
                        </div>
                        <div className="stat-footer">
                            <span>Specimen Queue</span>
                            <span>CBC / Chem</span>
                        </div>
                    </div>
                    <div className="stat-widget stat-widget-rose">
                        <div className="stat-kicker">Critical Abnormal Alerts</div>
                        <div className="stat-value mt-2">1</div>
                        <div className="mt-4 text-xs font-extrabold text-rose-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> High BUN/Creatinine
                        </div>
                        <div className="stat-footer">
                            <span>Priority Review</span>
                            <span>Needs Vet</span>
                        </div>
                    </div>
                    <div className="stat-widget stat-widget-teal">
                        <div className="stat-kicker">Completed Today</div>
                        <div className="stat-value mt-2">12</div>
                        <div className="mt-4 text-xs font-extrabold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> All Verified
                        </div>
                        <div className="stat-footer">
                            <span>Diagnostic Output</span>
                            <span>Today</span>
                        </div>
                    </div>
                    <div className="stat-widget stat-widget-purple">
                        <div className="stat-kicker">AI Parsed Reports</div>
                        <div className="stat-value mt-2">8</div>
                        <div className="mt-4 text-xs font-extrabold text-purple-600 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" /> Gemini Vision 99%
                        </div>
                        <div className="stat-footer">
                            <span>AI Parser Hub</span>
                            <span>Automated</span>
                        </div>
                    </div>
                </div>
            ) : isVetTech ? (
                <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                    <div className="stat-widget stat-widget-amber">
                        <div className="stat-kicker">Vitals Due (2h)</div>
                        <div className="stat-value mt-2">3</div>
                        <div className="mt-4 flex gap-1.5">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="h-6 flex-1 rounded-[0.7rem] bg-amber-500 shadow-sm"></div>
                            ))}
                        </div>
                        <div className="stat-footer">
                            <span>Kennel Rounds</span>
                            <span>Temp/HR/RR</span>
                        </div>
                    </div>
                    <div className="stat-widget stat-widget-blue">
                        <div className="stat-kicker">Ward Occupancy</div>
                        <div className="mt-2 flex items-end justify-between">
                            <div className="stat-value">{Math.round((stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100) || 0}%</div>
                            <div className="text-xs font-extrabold text-slate-500">{stats.hospitalization?.occupiedKennels || 0}/{stats.hospitalization?.totalKennels || 0} kennels</div>
                        </div>
                        <div className="mt-4 h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round((stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100) || 0}%` }}></div>
                        </div>
                        <div className="stat-footer">
                            <span>ICU Beds</span>
                            <span>Capacity</span>
                        </div>
                    </div>
                    <div className="stat-widget stat-widget-teal">
                        <div className="stat-kicker">Active IV Infusions</div>
                        <div className="stat-value mt-2">2</div>
                        <div className="mt-4 text-xs font-extrabold text-teal-600 flex items-center gap-1">
                            <Droplets className="w-3.5 h-3.5" /> Fluid Rate Monitored
                        </div>
                        <div className="stat-footer">
                            <span>Fluid Therapy</span>
                            <span>LRS / Saline</span>
                        </div>
                    </div>
                    <div className="stat-widget stat-widget-rose">
                        <div className="stat-kicker">Post-Op Recoveries</div>
                        <div className="stat-value mt-2">1</div>
                        <div className="mt-4 text-xs font-extrabold text-rose-600 flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5" /> Waking & Monitored
                        </div>
                        <div className="stat-footer">
                            <span>Surgical Ward</span>
                            <span>Warmth/Pain</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                    <div className="stat-widget stat-widget-teal">
                        <div className="stat-kicker">Triage queue</div>
                        <div className="stat-value mt-2">{stats.triageQueue?.length || 0}</div>
                        <div className="mt-4 flex gap-1.5">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} className={`h-6 flex-1 rounded-[0.7rem] ${index < Math.min(stats.triageQueue?.length || 0, 5) ? 'bg-amber-500 shadow-sm' : 'bg-slate-100'}`}></div>
                            ))}
                        </div>
                        <div className="stat-footer">
                            <span>Priority intake</span>
                            <span>Live</span>
                        </div>
                    </div>
                    <div className="stat-widget stat-widget-blue">
                        <div className="stat-kicker">Ward occupancy</div>
                        <div className="mt-2 flex items-end justify-between">
                            <div className="stat-value">{Math.round((stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100) || 0}%</div>
                            <div className="text-xs font-extrabold text-slate-500">{stats.hospitalization?.occupiedKennels || 0}/{stats.hospitalization?.totalKennels || 0} kennels</div>
                        </div>
                        <div className="mt-4 h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round((stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100) || 0}%` }}></div>
                        </div>
                        <div className="stat-footer">
                            <span>ICU beds</span>
                            <span>Capacity</span>
                        </div>
                    </div>
                    <div className="stat-widget stat-widget-rose">
                        <div className="stat-kicker">Active treatments</div>
                        <div className="stat-value mt-2">{stats.ongoingTreatments?.length || 0}</div>
                        <div className="mt-4 text-xs font-extrabold text-emerald-600 flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5" /> Care in progress
                        </div>
                        <div className="stat-footer">
                            <span>Case load</span>
                            <span>7 days</span>
                        </div>
                    </div>
                    <div className="stat-widget stat-widget-purple">
                        <div className="stat-kicker">Appointments</div>
                        <div className="stat-value mt-2">{stats.upcomingAppointments?.length || 0}</div>
                        <div className="mt-4 flex gap-1">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className={`h-6 flex-1 rounded-[0.7rem] ${index < Math.min(stats.upcomingAppointments?.length || 0, 4) ? 'bg-amber-500 shadow-sm' : 'bg-slate-100'}`}></div>
                            ))}
                        </div>
                        <div className="stat-footer">
                            <span>Upcoming</span>
                            <span>Today</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Command Center - Role-Specific Quick Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {(isLabScientist ? [
                    { label: 'Lab Hub', icon: FlaskConical, view: 'LAB_HUB', tint: 'soft-tint-indigo' },
                    { label: 'AI Lab Parser', icon: Sparkles, view: 'AI_HUB', tint: 'soft-tint-teal' },
                    { label: 'Procedures', icon: ClipboardList, view: 'PROCEDURES', tint: 'soft-tint-amber' },
                    { label: 'Treatments', icon: Stethoscope, view: 'TREATMENTS', tint: 'soft-tint-teal' },
                    { label: 'ICU Board', icon: HeartPulse, view: 'ICU_BOARD', tint: 'soft-tint-rose' },
                    { label: 'Reports', icon: Activity, view: 'REPORTS', tint: 'soft-tint-indigo' }
                ] : isVetTech ? [
                    { label: 'ICU Board', icon: HeartPulse, view: 'ICU_BOARD', tint: 'soft-tint-rose' },
                    { label: 'Hospitalization', icon: HeartPulse, view: 'HOSPITALIZATION', tint: 'soft-tint-indigo' },
                    { label: 'Calculators', icon: Activity, view: 'CLINICAL_CALCULATORS', tint: 'soft-tint-amber' },
                    { label: 'Treatments', icon: Stethoscope, view: 'TREATMENTS', tint: 'soft-tint-teal' },
                    { label: 'ER Triage', icon: Activity, view: 'TRIAGE', tint: 'soft-tint-rose' },
                    { label: 'Appointments', icon: Clock, view: 'APPOINTMENTS', tint: 'soft-tint-amber' }
                ] : [
                    { label: 'ICU Board', icon: HeartPulse, view: 'ICU_BOARD', tint: 'soft-tint-rose' },
                    { label: 'ER Triage', icon: Activity, view: 'TRIAGE', tint: 'soft-tint-amber' },
                    { label: 'Surgery Hub', icon: Activity, view: 'SURGERY', tint: 'soft-tint-rose' },
                    { label: 'Treatments', icon: Stethoscope, view: 'TREATMENTS', tint: 'soft-tint-teal' },
                    { label: 'AI Scribe', icon: Sparkles, view: 'AI_HUB', tint: 'soft-tint-teal' },
                    { label: 'Procedures', icon: ClipboardList, view: 'PROCEDURES', tint: 'soft-tint-indigo' }
                ]).map((link) => (
                    <button
                        key={link.label}
                        onClick={() => onNavigate(link.view as AppView)}
                        className="quick-access-card group active:scale-95 text-left"
                    >
                        <div className={`quick-access-inner ${link.tint}`}>
                            <div className="flex justify-between items-start">
                                <div className="quick-access-badge">
                                    <link.icon className="w-4.5 h-4.5" />
                                </div>
                            </div>
                        </div>
                        <span className="quick-access-label">{link.label}</span>
                    </button>
                ))}
            </div>

            {/* Specialized Clinical Matrix based on Role */}
            {isLabScientist ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Active Specimen Pipeline */}
                    <div className="dashboard-panel p-8 h-full group transition-all duration-500">
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h3 className="section-title text-2xl flex items-center gap-3 uppercase text-indigo-900">
                                <TestTube2 className="w-6 h-6 text-indigo-500" />
                                Specimen Pipeline
                            </h3>
                            <span className="neo-pill text-indigo-600">4 Active</span>
                        </div>
                        <div className="space-y-3 relative z-10">
                            {[
                                { pet: 'Max', species: 'Canine', test: 'Blood Chemistry Panel', time: '15m ago', status: 'Processing' },
                                { pet: 'Bella', species: 'Feline', test: 'Complete Blood Count (CBC)', time: '35m ago', status: 'In Machine' },
                                { pet: 'Rocky', species: 'Canine', test: 'Urinalysis Sediment', time: '1h ago', status: 'Queued' },
                                { pet: 'Luna', species: 'Avian', test: 'Fecal Parasitology', time: '2h ago', status: 'Awaiting' }
                            ].map((specimen, i) => (
                                <div key={i} className="p-4 bg-white/70 rounded-[1.2rem] border border-white/80 flex items-center justify-between gap-3 shadow-sm hover:bg-white transition">
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-800 truncate">{specimen.pet} <span className="text-[10px] font-semibold text-slate-400">({specimen.species})</span></p>
                                        <p className="text-[11px] font-bold text-indigo-600 truncate mt-0.5">{specimen.test}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            {specimen.status}
                                        </span>
                                        <span className="block text-[9px] text-slate-400 mt-1">{specimen.time}</span>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => onNavigate('LAB_HUB')}
                                className="btn-luminous btn-luminous-emerald w-full text-[10px] uppercase tracking-widest mt-4"
                            >
                                Open Laboratory Hub
                            </button>
                        </div>
                    </div>

                    {/* Critical Abnormal Findings */}
                    <div className="dashboard-panel p-8 h-full group transition-all duration-500">
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h3 className="section-title text-2xl flex items-center gap-3 uppercase text-rose-900">
                                <AlertTriangle className="w-6 h-6 text-rose-500" />
                                Critical Alerts
                            </h3>
                            <span className="neo-pill text-rose-600">Urgent</span>
                        </div>
                        <div className="space-y-3 relative z-10">
                            <div className="p-4 rounded-[1.3rem] bg-rose-50/80 border border-rose-200/90 shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-rose-800">Max (Canine · German Shepherd)</span>
                                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-200 text-rose-900">Critical High</span>
                                </div>
                                <p className="text-xs font-bold text-rose-900 mt-1">Serum Creatinine: 4.8 mg/dL (Ref: 0.5 - 1.5)</p>
                                <p className="text-xs font-bold text-rose-900">Blood Urea Nitrogen: 84 mg/dL (Ref: 7 - 27)</p>
                                <p className="text-[11px] text-slate-500 mt-2 font-medium">Acute renal azotemia flagged. Attending veterinarian notified.</p>
                            </div>
                            <div className="p-4 rounded-[1.3rem] bg-amber-50/80 border border-amber-200/90 shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-amber-800">Rocky (Canine · Boerboel)</span>
                                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">Alert</span>
                                </div>
                                <p className="text-xs font-bold text-amber-900 mt-1">Platelet Count: 28,000 /μL (Ref: 175k - 500k)</p>
                                <p className="text-[11px] text-slate-500 mt-1 font-medium">Severe thrombocytopenia. Suspect Babesia or Ehrlichia.</p>
                            </div>
                            <button
                                onClick={() => onNavigate('LAB_HUB')}
                                className="inline-flex items-center justify-between w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm mt-2"
                            >
                                <span>Inspect All Pathological Flags</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* AI Pathology Parser Hub */}
                    <div className="dashboard-panel p-8 h-full group transition-all duration-500 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-6 relative z-10">
                                <h3 className="section-title text-2xl flex items-center gap-3 uppercase text-purple-900">
                                    <Sparkles className="w-6 h-6 text-purple-500" />
                                    AI Diagnostic Hub
                                </h3>
                                <span className="neo-pill text-purple-600">Gemini 2.0</span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium mb-4 leading-relaxed">
                                Upload physical laboratory slips, hematology analyzer printouts, or biochemistry panels for instant optical recognition, reference range normalization, and clinical interpretation.
                            </p>
                            <div className="p-4 rounded-[1.2rem] bg-purple-50/80 border border-purple-200 mb-4">
                                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block mb-1">Recent Automated Parse</span>
                                <p className="text-xs font-bold text-slate-800">Idexx Catalyst One Serum Panel #4029</p>
                                <span className="text-[10px] text-slate-500">Auto-mapped to patient record: Milo (Feline)</span>
                            </div>
                        </div>
                        <button
                            onClick={() => onNavigate('AI_HUB')}
                            className="btn-luminous btn-luminous-emerald w-full text-[10px] uppercase tracking-widest py-3.5"
                        >
                            Launch AI Lab Parser
                        </button>
                    </div>
                </div>
            ) : isVetTech ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Kennel Rounds & Vitals Due */}
                    <div className="dashboard-panel p-8 h-full group transition-all duration-500">
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h3 className="section-title text-2xl flex items-center gap-3 uppercase text-amber-900">
                                <Thermometer className="w-6 h-6 text-amber-500" />
                                Vitals Due
                            </h3>
                            <span className="neo-pill text-amber-600">3 Due</span>
                        </div>
                        <div className="space-y-3 relative z-10">
                            {[
                                { kennel: 'ICU-01', pet: 'Simba', species: 'Canine', due: 'In 15 min', items: 'Temp, HR, CRT, Hydration' },
                                { kennel: 'Ward-03', pet: 'Milo', species: 'Feline', due: 'In 45 min', items: 'Pain score, Respiratory rate' },
                                { kennel: 'ICU-02', pet: 'Daisy', species: 'Canine', due: 'In 1 hr', items: 'Blood glucose curve' }
                            ].map((v, i) => (
                                <div key={i} className="p-4 bg-white/70 rounded-[1.2rem] border border-white/80 flex items-center justify-between gap-3 shadow-sm hover:bg-white transition">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">{v.kennel}</span>
                                            <span className="text-sm font-black text-slate-800">{v.pet}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium mt-1 truncate">{v.items}</p>
                                    </div>
                                    <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg shrink-0">
                                        {v.due}
                                    </span>
                                </div>
                            ))}
                            <button
                                onClick={() => onNavigate('ICU_BOARD')}
                                className="btn-luminous btn-luminous-emerald w-full text-[10px] uppercase tracking-widest mt-4"
                            >
                                Open ICU Board
                            </button>
                        </div>
                    </div>

                    {/* Active Fluid Therapy Monitor */}
                    <div className="dashboard-panel p-8 h-full group transition-all duration-500">
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h3 className="section-title text-2xl flex items-center gap-3 uppercase text-teal-900">
                                <Droplets className="w-6 h-6 text-teal-500" />
                                Fluid Therapy
                            </h3>
                            <span className="neo-pill text-teal-600">2 Active Drips</span>
                        </div>
                        <div className="space-y-3 relative z-10">
                            <div className="p-4 rounded-[1.3rem] bg-teal-50/80 border border-teal-200/90 shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-teal-900">Simba (Post-Op Gastrotomy)</span>
                                    <span className="text-[10px] font-extrabold text-teal-700">45 ml/hr</span>
                                </div>
                                <p className="text-[11px] font-semibold text-slate-600">Lactated Ringer&apos;s Solution (LRS)</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="h-2 flex-1 rounded-full bg-teal-100 overflow-hidden">
                                        <div className="h-full bg-teal-500 rounded-full" style={{ width: '65%' }}></div>
                                    </div>
                                    <span className="text-[10px] font-black text-teal-800">325 / 500 ml</span>
                                </div>
                            </div>
                            <div className="p-4 rounded-[1.3rem] bg-teal-50/80 border border-teal-200/90 shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-teal-900">Daisy (Canine DKA Rehydration)</span>
                                    <span className="text-[10px] font-extrabold text-teal-700">30 ml/hr</span>
                                </div>
                                <p className="text-[11px] font-semibold text-slate-600">0.9% NaCl + 20mEq KCl/L</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="h-2 flex-1 rounded-full bg-teal-100 overflow-hidden">
                                        <div className="h-full bg-teal-500 rounded-full" style={{ width: '40%' }}></div>
                                    </div>
                                    <span className="text-[10px] font-black text-teal-800">400 / 1000 ml</span>
                                </div>
                            </div>
                            <button
                                onClick={() => onNavigate('CLINICAL_CALCULATORS')}
                                className="inline-flex items-center justify-between w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-sm mt-2"
                            >
                                <span>Drug & Infusion Calculators</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Ward Nursing Checklist */}
                    <div className="dashboard-panel p-8 h-full group transition-all duration-500 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-6 relative z-10">
                                <h3 className="section-title text-2xl flex items-center gap-3 uppercase text-slate-800">
                                    <ClipboardList className="w-6 h-6 text-slate-600" />
                                    Ward Checklist
                                </h3>
                                <span className="neo-pill text-slate-700">Shift Rounds</span>
                            </div>
                            <div className="space-y-2.5">
                                {[
                                    { text: 'Catheter flushing & bandage inspection', done: true },
                                    { text: 'Medication administration - Ampicillin IV (12:00)', done: true },
                                    { text: 'Post-op temperature checks & warming pads', done: false },
                                    { text: 'Clean kennel sanitation & water replenishment', done: false }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-white/70">
                                        <div className={`w-4 h-4 rounded-md flex items-center justify-center ${item.done ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}>
                                            {item.done && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </div>
                                        <span className={`text-xs font-semibold ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => onNavigate('HOSPITALIZATION')}
                            className="btn-luminous btn-luminous-emerald w-full text-[10px] uppercase tracking-widest py-3.5 mt-4"
                        >
                            Open Hospitalization Ward
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ER Waiting List - Rose Prism */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="dashboard-panel p-8 h-full group transition-all duration-500">
                            <div className="flex justify-between items-center mb-8 relative z-10">
                                <h3 className="section-title text-2xl flex items-center gap-3 uppercase">
                                    <Activity className="w-6 h-6 text-rose-500" />
                                    Triage Status
                                </h3>
                                <span className="neo-pill text-rose-600">
                                    {stats.triageQueue?.length || 0} waiting
                                </span>
                            </div>

                            <div className="space-y-4 relative z-10">
                                {stats.triageQueue && stats.triageQueue.length > 0 ? (
                                    stats.triageQueue.map((patient: any) => (
                                        <div key={patient.id} className="flex items-center gap-4 p-5 bg-white/60 rounded-[1.5rem] border border-white/60 group/item hover:bg-white transition-all shadow-sm">
                                            <div className={`w-1.5 h-8 rounded-full ${patient.triageStatus === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-400'} animate-pulse`}></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-slate-800 truncate uppercase tracking-tight">{patient.name}</p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{patient.species}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Urgent</p>
                                                <div className="flex items-center justify-end gap-1 text-[9px] font-bold text-slate-400">
                                                    <Clock size={10} />
                                                    {Math.floor((new Date().getTime() - new Date(patient.triageStartTime).getTime()) / 60000)}m
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-16 flex flex-col items-center justify-center text-center bg-white/20 border border-dashed border-white/60 rounded-[2.5rem]">
                                        <Activity size={24} className="mb-4 text-slate-200" />
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No patients waiting</p>
                                    </div>
                                )}
                                <button 
                                    onClick={() => onNavigate('TRIAGE')}
                                    className="btn-luminous btn-luminous-emerald w-full text-[9px] uppercase tracking-widest mt-4"
                                >
                                    Open triage board
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ICU Ward Status - Emerald Prism */}
                    <div className="dashboard-panel p-8 h-full group transition-all duration-500">
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h3 className="section-title text-2xl flex items-center gap-3 uppercase">
                                <HeartPulse className="w-6 h-6 text-emerald-500" />
                                ICU Occupancy
                            </h3>
                            <div className="flex items-center gap-4">
                                <span className="neo-pill text-emerald-600">
                                    {stats.hospitalization?.active || 0} active
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            <div className="neo-tile p-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Ward use</p>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-black text-slate-800">{Math.round((stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100) || 0}%</span>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase mb-1">{stats.hospitalization?.occupiedKennels}/{stats.hospitalization?.totalKennels} kennels</span>
                                </div>
                                <div className="h-[2px] w-full bg-emerald-100 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${(stats.hospitalization?.occupiedKennels / stats.hospitalization?.totalKennels) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="neo-tile p-6 flex flex-col justify-between">
                                <button 
                                    onClick={() => onNavigate('ICU_BOARD')}
                                    className="btn-luminous btn-luminous-neutral w-full text-[9px] uppercase tracking-[0.2em] py-4 shadow-xl"
                                >
                                    Open ward board
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Active Follow-up Cases - Amber Prism */}
                    <div className="dashboard-panel p-8 group transition-all duration-500">
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h3 className="section-title text-2xl flex items-center gap-3 uppercase">
                                <Activity className="w-6 h-6 text-amber-500" />
                                Active cases
                            </h3>
                            <button onClick={() => onNavigate('TREATMENTS')} className="text-[9px] font-black text-amber-600 uppercase tracking-widest hover:underline">View all</button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            {stats.ongoingTreatments && stats.ongoingTreatments.slice(0, 4).map((treatment: any) => (
                                <div key={treatment.id} className="neo-tile p-6 flex items-start gap-5 hover:bg-white transition-all group/item shadow-sm">
                                    <div className="w-14 h-14 rounded-2xl bg-white border border-amber-100 shadow-xl flex flex-col items-center justify-center flex-shrink-0 group-hover/item:scale-110 transition-transform">
                                        <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest leading-none">Days</span>
                                        <span className="text-xl font-black text-slate-800 leading-none mt-1">
                                            {treatment.endDate ? Math.ceil((new Date(treatment.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-800 truncate uppercase tracking-tight">{treatment.patient?.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase truncate tracking-widest">Plan: {treatment.diagnosis || 'Standard care'}</p>
                                        <div className="mt-4">
                                            <button 
                                                onClick={() => window.dispatchEvent(new CustomEvent('app-navigate', { detail: { view: 'PATIENT_DETAILS', patientId: treatment.patientId } }))}
                                                className="text-[9px] font-black text-amber-600 flex items-center gap-2 hover:translate-x-2 transition-all uppercase tracking-[0.2em]"
                                            >
                                                Update Chart <ChevronRight size={14} className="text-amber-300" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Grid - Amber Prism */}
            <div className="dashboard-panel-strong p-10 group transition-all duration-500">
                <div className="flex justify-between items-center mb-10 relative z-10">
                    <h3 className="section-title text-3xl flex items-center gap-4 uppercase">
                        <Clock className="w-8 h-8 text-amber-500" />
                        Schedule
                    </h3>
                    <button onClick={() => onNavigate('APPOINTMENTS')} className="btn-luminous btn-luminous-emerald px-8 py-3 text-[10px] uppercase tracking-[0.2em] shadow-xl">Open appointments</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                    {stats.upcomingAppointments && stats.upcomingAppointments.length > 0 ? (
                        stats.upcomingAppointments.map((apt: any) => (
                            <div key={apt.id} className="neo-tile p-6 shadow-xl flex items-start gap-5 group/item">
                                <div className="w-16 h-16 rounded-2xl bg-white border border-amber-100 shadow-2xl flex flex-col items-center justify-center flex-shrink-0 group-hover/item:scale-110 transition-transform">
                                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{parseDateOnly(apt.date).toLocaleString('default', { month: 'short' })}</span>
                                    <span className="text-2xl font-black text-amber-700 leading-none">{parseDateOnly(apt.date).getDate()}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-base font-black text-slate-800 truncate uppercase tracking-tight">{apt.client?.firstName} {apt.client?.lastName}</p>
                                    <p className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">Visit: {apt.procedure?.name || 'Checkup'}</p>
                                    <div className="flex items-center gap-2 mt-4 px-3 py-1.5 bg-amber-50 rounded-xl w-fit border border-amber-100 shadow-inner">
                                        <Clock size={12} className="text-amber-500" />
                                        <span className="text-[10px] font-black text-amber-700">{apt.time}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center text-slate-400 bg-white/20 rounded-[3rem] border-2 border-dashed border-white/60">
                            <Clock className="w-16 h-16 mb-4 mx-auto opacity-10" />
                            <p className="text-[11px] font-black uppercase tracking-[0.3em]">No appointments scheduled</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
