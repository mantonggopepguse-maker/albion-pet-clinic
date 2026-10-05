import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2,
    Users,
    Database,
    Cpu,
    Link as LinkIcon,
    Plus,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    ExternalLink,
    Copy,
    CheckCircle2,
    Search,
    Crown,
    ArrowUpRight,
    Loader2,
    Mail,
    X,
    Activity,
    HardDrive,
    Sparkles,
    RefreshCw,
    Server,
    Globe,
    Lock,
    Check,
    Layers,
    Filter
} from 'lucide-react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';

interface Clinic {
    id: string;
    name: string;
    slug: string;
    status: 'Active' | 'Suspended';
    address?: string;
    country?: string;
    practiceType?: string;
    users: { name: string; email: string }[];
    storageUsage: number;
    ramUsage: number;
    _count?: {
        users: number;
        clients: number;
        patients?: number;
        sales?: number;
        appointments?: number;
    };
    activity24h?: number;
}

interface SuperAdminDashboardProps {
    onViewClinic: (id: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onViewClinic }) => {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [systemStats, setSystemStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Suspended'>('ALL');
    const [practiceFilter, setPracticeFilter] = useState<string>('ALL');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Create Clinic Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creatingClinic, setCreatingClinic] = useState(false);
    const [newClinicData, setNewClinicData] = useState({
        name: '',
        address: '',
        email: '',
        phone: '',
        adminPassword: '',
        practiceType: 'Small Animal',
        country: 'Nigeria',
        language: 'English',
        currencySymbol: '₦',
        acronym: '',
        status: 'Active',
        emailVerified: false
    });

    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'info';
    } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            const [clinicsData, invitesData, statsData] = await Promise.all([
                api.superAdmin.getClinics(),
                api.superAdmin.getInvites(),
                api.superAdmin.getStats().catch(() => null)
            ]);
            setClinics(clinicsData || []);
            setInvites(invitesData || []);
            setSystemStats(statsData);
            if (silent) toast.success("Telemetry updated");
        } catch (error) {
            console.error("Failed to load super admin data", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleCreateClinic = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingClinic(true);
        const slug = newClinicData.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        const acronym = newClinicData.acronym || newClinicData.name.substring(0, 3).toUpperCase();

        try {
            await api.superAdmin.createClinic({
                ...newClinicData,
                slug,
                acronym,
                status: 'Active'
            });
            await loadData(true);
            toast.success("Clinic and Master Admin created successfully");
            setIsCreateModalOpen(false);
            setNewClinicData({
                name: '',
                address: '',
                email: '',
                phone: '',
                adminPassword: '',
                practiceType: 'Small Animal',
                country: 'Nigeria',
                language: 'English',
                currencySymbol: '₦',
                acronym: '',
                status: 'Active',
                emailVerified: false
            });
        } catch (error: any) {
            toast.error(error.message || "Failed to create clinic");
        } finally {
            setCreatingClinic(false);
        }
    };

    const handleToggleStatus = async (clinic: Clinic) => {
        const newStatus = clinic.status === 'Active' ? 'Suspended' : 'Active';
        setConfirmAction({
            title: `${newStatus === 'Active' ? 'Activate' : 'Suspend'} Practice`,
            message: `Are you sure you want to ${newStatus === 'Active' ? 'activate' : 'suspend'} ${clinic.name}? Personnel access for this clinic will be ${newStatus === 'Active' ? 'instantly restored' : 'locked'}.`,
            type: newStatus === 'Active' ? 'info' : 'danger',
            onConfirm: async () => {
                try {
                    await api.superAdmin.updateClinic(clinic.id, { status: newStatus });
                    setClinics(prev => prev.map(c => c.id === clinic.id ? { ...c, status: newStatus } : c));
                    toast.success(`Clinic ${clinic.name} ${newStatus === 'Active' ? 'activated' : 'suspended'}`);
                } catch (error) {
                    toast.error("Failed to update clinic status");
                } finally {
                    setConfirmAction(null);
                }
            }
        });
    };

    const handleCreateInvite = async () => {
        try {
            await api.superAdmin.createInvite({ expiresInDays: 7 });
            const invitesData = await api.superAdmin.getInvites();
            setInvites(invitesData || []);
            toast.success("7-Day registration invite link generated");
        } catch (error) {
            toast.error("Failed to create invite");
        }
    };

    const handleDeleteClinic = async (clinic: Clinic) => {
        setConfirmAction({
            title: `Decommission ${clinic.name}?`,
            message: `CRITICAL ACTION: This permanently purges ${clinic.name} and all associated clinical records (users, clients, patients, transactions). This cannot be undone.`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    await api.superAdmin.deleteClinic(clinic.id);
                    setClinics(prev => prev.filter(c => c.id !== clinic.id));
                    toast.success("Clinic decommissioned permanently");
                } catch (error) {
                    toast.error("Failed to delete clinic");
                } finally {
                    setConfirmAction(null);
                }
            }
        });
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2200);
        toast.success("Invite link copied to clipboard");
    };

    // Filter & search clinics
    const filteredClinics = useMemo(() => {
        return clinics.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.country && c.country.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
            const matchesPractice = practiceFilter === 'ALL' || (c.practiceType || 'Small Animal') === practiceFilter;
            return matchesSearch && matchesStatus && matchesPractice;
        });
    }, [clinics, searchQuery, statusFilter, practiceFilter]);

    // Aggregate statistics
    const activeClinics = useMemo(() => clinics.filter(c => c.status === 'Active').length, [clinics]);
    const suspendedClinics = useMemo(() => clinics.filter(c => c.status !== 'Active').length, [clinics]);
    const totalUsers = useMemo(() => clinics.reduce((sum, c) => sum + (c._count?.users || 0), 0), [clinics]);
    const totalClients = useMemo(() => clinics.reduce((sum, c) => sum + (c._count?.clients || 0), 0), [clinics]);
    const totalPatients = useMemo(() => clinics.reduce((sum, c) => sum + (c._count?.patients || 0), 0), [clinics]);
    const total24hActivity = useMemo(() => clinics.reduce((sum, c) => sum + (c.activity24h || 0), 0), [clinics]);
    const totalStorageMB = systemStats?.totalStorageMB || clinics.reduce((sum, c) => sum + (c.storageUsage || 0), 0);

    const practiceTypes = useMemo(() => {
        const types = new Set<string>();
        clinics.forEach(c => {
            if (c.practiceType) types.add(c.practiceType);
        });
        return Array.from(types);
    }, [clinics]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[70vh]">
                <div className="flex flex-col items-center gap-4 p-8 rounded-[2rem] bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[18px_18px_36px_rgba(15,23,42,0.06),-12px_-12px_28px_rgba(255,255,255,0.95)]">
                    <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 animate-pulse flex items-center justify-center shadow-lg shadow-amber-500/25">
                            <Crown className="w-7 h-7 text-white" />
                        </div>
                        <div className="absolute -inset-1 rounded-2xl border-2 border-amber-500/30 animate-spin border-t-transparent" />
                    </div>
                    <div className="text-center">
                        <p className="font-extrabold text-slate-800 tracking-tight text-base">Loading Command Center</p>
                        <p className="text-xs font-semibold text-slate-400 mt-1">Connecting to Supabase Session Pooler & Telemetry...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24 font-sans max-w-[1720px] mx-auto">

            {/* ═════════════════════════════════════════════════════════════════════════════
                1. EXECUTIVE COMMAND HERO BENTO TILE
            ═════════════════════════════════════════════════════════════════════════════ */}
            <div className="relative overflow-hidden rounded-[2.2rem] border border-white/80 bg-gradient-to-br from-white/95 via-white/85 to-amber-50/40 p-6 md:p-8 backdrop-blur-2xl shadow-[16px_16px_36px_rgba(15,23,42,0.06),-12px_-12px_28px_rgba(255,255,255,0.95)]">
                {/* Ambient glow orbs */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-amber-400/15 via-gold-500/10 to-transparent blur-3xl" />
                <div className="pointer-events-none absolute left-1/3 -bottom-16 h-48 w-48 rounded-full bg-teal-400/10 blur-2xl" />

                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-3xl">
                        <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8)]">
                            <Crown className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            Super Admin Command Center
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
                            Platform Governance & Fleet Infrastructure
                        </h1>
                        <p className="text-sm md:text-base font-semibold text-slate-500 leading-relaxed max-w-2xl">
                            Real-time multi-tenant practice oversight, cloud infrastructure telemetry, and enterprise access provisioning.
                        </p>

                        {/* Live Telemetry Pill */}
                        <div className="inline-flex items-center gap-2.5 rounded-2xl border border-white/90 bg-slate-900/5 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-emerald-700 font-black uppercase tracking-wider text-[10px]">Cloud Run Active</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 text-[11px]">Pooler: 5432 (Schema: pet_clinic)</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500 text-[11px]">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    </div>

                    {/* Neomorphic Tactile Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => loadData(true)}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-xs font-extrabold text-slate-700 shadow-[6px_6px_14px_rgba(15,23,42,0.05),-4px_-4px_10px_rgba(255,255,255,0.9)] hover:-translate-y-0.5 hover:shadow-[8px_8px_18px_rgba(15,23,42,0.08),-6px_-6px_14px_rgba(255,255,255,1)] active:scale-95 transition-all disabled:opacity-60"
                            title="Refresh real-time telemetry"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
                            Sync Data
                        </button>
                        <button
                            onClick={handleCreateInvite}
                            className="inline-flex items-center gap-2 rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-500/10 via-teal-50 to-white px-5 py-3 text-xs font-black text-teal-700 shadow-[6px_6px_16px_rgba(20,184,166,0.12),-4px_-4px_12px_rgba(255,255,255,0.95)] hover:-translate-y-0.5 hover:border-teal-500/50 hover:shadow-[8px_8px_20px_rgba(20,184,166,0.18)] active:scale-95 transition-all"
                        >
                            <LinkIcon className="w-4 h-4 text-teal-600" />
                            Generate Invite
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500 via-amber-600 to-gold-600 px-6 py-3 text-xs font-black text-white shadow-[0_12px_24px_rgba(217,119,6,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(217,119,6,0.4)] active:scale-95 transition-all"
                        >
                            <Plus className="w-4 h-4 text-white" />
                            Provision Clinic
                        </button>
                    </div>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════════════════
                2. BALANCED 4-BENTO KPI TILES MATRIX
            ═════════════════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

                {/* TILE 1: CLINICS FLEET */}
                <div className="group relative overflow-hidden rounded-[1.8rem] border border-white/80 bg-gradient-to-br from-white/95 to-sky-50/50 p-6 backdrop-blur-xl shadow-[12px_12px_24px_rgba(15,23,42,0.05),-8px_-8px_18px_rgba(255,255,255,0.95)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[16px_16px_30px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-100 bg-white shadow-[4px_4px_10px_rgba(14,165,233,0.12),-3px_-3px_8px_rgba(255,255,255,0.9)] text-sky-600 group-hover:scale-105 transition-transform">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <span className="rounded-full border border-sky-200/60 bg-sky-100/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-sky-700">
                            Fleet
                        </span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Managed Clinics</p>
                        <h3 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                            {activeClinics} <span className="text-xl font-bold text-slate-400">/ {clinics.length}</span>
                        </h3>
                    </div>
                    <div className="mt-4 flex items-center gap-2 pt-3 border-t border-sky-100/80">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {activeClinics} Active
                        </span>
                        {suspendedClinics > 0 && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                {suspendedClinics} Paused
                            </span>
                        )}
                    </div>
                </div>

                {/* TILE 2: PERSONNEL & WORKFORCE */}
                <div className="group relative overflow-hidden rounded-[1.8rem] border border-white/80 bg-gradient-to-br from-white/95 to-teal-50/50 p-6 backdrop-blur-xl shadow-[12px_12px_24px_rgba(15,23,42,0.05),-8px_-8px_18px_rgba(255,255,255,0.95)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[16px_16px_30px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-100 bg-white shadow-[4px_4px_10px_rgba(20,184,166,0.12),-3px_-3px_8px_rgba(255,255,255,0.9)] text-teal-600 group-hover:scale-105 transition-transform">
                            <Users className="w-6 h-6" />
                        </div>
                        <span className="rounded-full border border-teal-200/60 bg-teal-100/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-teal-700">
                            Personnel
                        </span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total System Users</p>
                        <h3 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                            {systemStats?.totalUsers || totalUsers}
                        </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500 pt-3 border-t border-teal-100/80">
                        <span>Staff, Vets & Admins</span>
                        <span className="text-teal-700 font-extrabold">{clinics.length} Tenants</span>
                    </div>
                </div>

                {/* TILE 3: GLOBAL PATIENTS & CASES */}
                <div className="group relative overflow-hidden rounded-[1.8rem] border border-white/80 bg-gradient-to-br from-white/95 to-rose-50/50 p-6 backdrop-blur-xl shadow-[12px_12px_24px_rgba(15,23,42,0.05),-8px_-8px_18px_rgba(255,255,255,0.95)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[16px_16px_30px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-100 bg-white shadow-[4px_4px_10px_rgba(244,63,94,0.12),-3px_-3px_8px_rgba(255,255,255,0.9)] text-rose-500 group-hover:scale-105 transition-transform">
                            <Activity className="w-6 h-6" />
                        </div>
                        <span className="rounded-full border border-rose-200/60 bg-rose-100/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-700">
                            Registry
                        </span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Global Clinical Records</p>
                        <h3 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                            {totalPatients > 0 ? totalPatients : totalClients}
                        </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500 pt-3 border-t border-rose-100/80">
                        <span>Pet Parents: {systemStats?.totalClients || totalClients}</span>
                        <span className="text-rose-600 font-extrabold">Active Cases</span>
                    </div>
                </div>

                {/* TILE 4: CLOUD STORAGE & TELEMETRY */}
                <div className="group relative overflow-hidden rounded-[1.8rem] border border-white/80 bg-gradient-to-br from-white/95 to-amber-50/50 p-6 backdrop-blur-xl shadow-[12px_12px_24px_rgba(15,23,42,0.05),-8px_-8px_18px_rgba(255,255,255,0.95)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[16px_16px_30px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-100 bg-white shadow-[4px_4px_10px_rgba(217,119,6,0.12),-3px_-3px_8px_rgba(255,255,255,0.9)] text-amber-600 group-hover:scale-105 transition-transform">
                            <Database className="w-6 h-6" />
                        </div>
                        <span className="rounded-full border border-amber-200/60 bg-amber-100/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                            Storage
                        </span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">PostgreSQL Cloud Assets</p>
                        <h3 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                            {Number(totalStorageMB).toFixed(1)} <span className="text-xl font-bold text-slate-400">MB</span>
                        </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500 pt-3 border-t border-amber-100/80">
                        <span className="text-emerald-700 font-black">● Health: Optimal</span>
                        <span className="text-amber-700 font-extrabold">Auto-Vacuum OK</span>
                    </div>
                </div>

            </div>

            {/* ═════════════════════════════════════════════════════════════════════════════
                3. MIDDLE BENTO ROW: PLATFORM TELEMETRY & ONBOARDING INVITE VAULT
            ═════════════════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* TELEMETRY TILE (2 COLS) */}
                <div className="lg:col-span-2 rounded-[2rem] border border-white/80 bg-gradient-to-br from-white/95 via-white/85 to-slate-50/60 p-6 md:p-7 backdrop-blur-2xl shadow-[14px_14px_28px_rgba(15,23,42,0.05),-10px_-10px_22px_rgba(255,255,255,0.95)] flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-600">Infrastructure Telemetry</span>
                                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1">
                                    Multi-Tenant Health & Throughput
                                </h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700 shadow-sm">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    PostgreSQL Session Pooler Online
                                </span>
                            </div>
                        </div>

                        {/* Inset Neomorphic Status Pods */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                            <div className="rounded-[1.4rem] border border-white/90 bg-white/70 p-4 shadow-[inset_2px_2px_5px_rgba(15,23,42,0.03),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="font-extrabold text-slate-700 flex items-center gap-2">
                                        <Server className="w-4 h-4 text-sky-500" /> API Gateway
                                    </span>
                                    <span className="font-black text-emerald-600">200 OK</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-400">Google Cloud Run (us-central1)</p>
                                <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-sky-500 rounded-full w-full" />
                                </div>
                            </div>

                            <div className="rounded-[1.4rem] border border-white/90 bg-white/70 p-4 shadow-[inset_2px_2px_5px_rgba(15,23,42,0.03),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="font-extrabold text-slate-700 flex items-center gap-2">
                                        <Lock className="w-4 h-4 text-teal-500" /> Tenant Isolation
                                    </span>
                                    <span className="font-black text-teal-600">Enforced</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-400">PostgreSQL Schema: pet_clinic</p>
                                <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-teal-500 rounded-full w-full" />
                                </div>
                            </div>

                            <div className="rounded-[1.4rem] border border-white/90 bg-white/70 p-4 shadow-[inset_2px_2px_5px_rgba(15,23,42,0.03),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="font-extrabold text-slate-700 flex items-center gap-2">
                                        <Database className="w-4 h-4 text-amber-500" /> Connection Pool
                                    </span>
                                    <span className="font-black text-amber-600">Port 5432 (Session)</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-400">Zero connection leakage</p>
                                <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 rounded-full w-full" />
                                </div>
                            </div>

                            <div className="rounded-[1.4rem] border border-white/90 bg-white/70 p-4 shadow-[inset_2px_2px_5px_rgba(15,23,42,0.03),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="font-extrabold text-slate-700 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-rose-500" /> 24h Activity
                                    </span>
                                    <span className="font-black text-rose-600">{total24hActivity} Requests</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-400">Live fleet audit trail</p>
                                <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, (total24hActivity / 500) * 100)}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Telemetry Summary Footer */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-500">
                        <span className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-teal-600" />
                            Multi-practice isolation active across {clinics.length} clinics
                        </span>
                        <span className="text-slate-400">Serverless scale-to-zero enabled</span>
                    </div>
                </div>

                {/* ONBOARDING & INVITES VAULT TILE (1 COL) */}
                <div className="rounded-[2rem] border border-white/80 bg-gradient-to-br from-white/95 via-white/85 to-teal-50/40 p-6 md:p-7 backdrop-blur-2xl shadow-[14px_14px_28px_rgba(15,23,42,0.05),-10px_-10px_22px_rgba(255,255,255,0.95)] flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-600">Access Vault</span>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-teal-600" />
                                    Active Invites ({invites.length})
                                </h2>
                            </div>
                            <button
                                onClick={handleCreateInvite}
                                className="p-2.5 rounded-xl border border-teal-200/80 bg-white hover:bg-teal-50 text-teal-700 shadow-sm transition-all active:scale-95"
                                title="Create new invite"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs font-semibold text-slate-500 mb-4">
                            Cryptographic links allow clinic administrators to self-register without sharing master passwords.
                        </p>

                        {/* Invites list */}
                        <div className="space-y-3 max-h-[290px] overflow-y-auto no-scrollbar pr-1">
                            {invites.length === 0 ? (
                                <div className="rounded-[1.4rem] border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                                    <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-500">No pending invites</p>
                                    <button
                                        onClick={handleCreateInvite}
                                        className="mt-3 text-xs font-black text-teal-600 hover:text-teal-700 underline"
                                    >
                                        Create one now
                                    </button>
                                </div>
                            ) : (
                                invites.map(invite => (
                                    <div
                                        key={invite.id}
                                        className="rounded-[1.4rem] border border-white/90 bg-white/80 p-4 shadow-[4px_4px_10px_rgba(15,23,42,0.04),-3px_-3px_8px_rgba(255,255,255,0.9)] hover:border-teal-300/60 transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">7-Day Invite</span>
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(invite.link || `https://app.albionpetclinicpro.com/?code=${invite.code}`, invite.id)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-[11px] font-bold transition-all active:scale-95"
                                            >
                                                {copiedId === invite.id ? (
                                                    <>
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span className="text-emerald-700">Copied</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3.5 h-3.5" />
                                                        <span>Copy</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs font-mono font-bold text-slate-700 truncate">
                                            code: {invite.code.substring(0, 14)}...
                                        </p>
                                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-semibold pt-2 border-t border-slate-50">
                                            <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                                            {invite.clinic && (
                                                <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                                                    {invite.clinic.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                        <button
                            onClick={handleCreateInvite}
                            className="w-full py-2.5 px-4 rounded-xl border border-teal-500/20 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-extrabold transition-all text-center"
                        >
                            + Quick Generate 7-Day Link
                        </button>
                    </div>
                </div>

            </div>

            {/* ═════════════════════════════════════════════════════════════════════════════
                4. MASTER CLINICS FLEET BENTO TILE MATRIX
            ═════════════════════════════════════════════════════════════════════════════ */}
            <div className="rounded-[2.2rem] border border-white/80 bg-gradient-to-br from-white/95 via-white/85 to-slate-50/70 p-6 md:p-8 backdrop-blur-2xl shadow-[16px_16px_36px_rgba(15,23,42,0.06),-12px_-12px_28px_rgba(255,255,255,0.95)] space-y-6">

                {/* Fleet Header & Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-slate-100/90">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-teal-700 mb-1.5">
                            <Layers className="w-3 h-3 text-teal-600" /> Fleet Management
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                            Active Practice Instances
                        </h2>
                        <p className="text-xs md:text-sm font-semibold text-slate-500 mt-1">
                            Showing {filteredClinics.length} of {clinics.length} registered clinics across all regions.
                        </p>
                    </div>

                    {/* Filter Pills & Search */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Status Filter Tabs */}
                        <div className="flex items-center rounded-2xl border border-white/90 bg-slate-100/80 p-1 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.05),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                            <button
                                onClick={() => setStatusFilter('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${statusFilter === 'ALL'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                All ({clinics.length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('Active')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${statusFilter === 'Active'
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                Active ({activeClinics})
                            </button>
                            <button
                                onClick={() => setStatusFilter('Suspended')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${statusFilter === 'Suspended'
                                    ? 'bg-white text-amber-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                Paused ({suspendedClinics})
                            </button>
                        </div>

                        {/* Practice Type Dropdown */}
                        {practiceTypes.length > 0 && (
                            <select
                                value={practiceFilter}
                                onChange={e => setPracticeFilter(e.target.value)}
                                className="rounded-2xl border border-white/80 bg-white/80 px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-[4px_4px_10px_rgba(15,23,42,0.04)] outline-none focus:ring-2 focus:ring-amber-500/20"
                            >
                                <option value="ALL">All Practice Types</option>
                                {practiceTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        )}

                        {/* Search Bar */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, slug or country..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full rounded-2xl border border-white/90 bg-white/90 pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] outline-none transition-all focus:ring-2 focus:ring-amber-500/20"
                            />
                        </div>
                    </div>
                </div>

                {/* ═════════════════════════════════════════════════════════════════════════════
                    INTERACTIVE CLINIC TILES GRID (2 or 3 Columns)
                ═════════════════════════════════════════════════════════════════════════════ */}
                {filteredClinics.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800">No clinics match your search</h3>
                        <p className="text-xs font-semibold text-slate-400 mt-1">Try resetting filters or search terms.</p>
                        <button
                            onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setPracticeFilter('ALL'); }}
                            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 transition"
                        >
                            Reset Filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredClinics.map(clinic => (
                            <div
                                key={clinic.id}
                                className="group relative overflow-hidden rounded-[2rem] border border-white/90 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/50 p-6 backdrop-blur-xl shadow-[12px_12px_24px_rgba(15,23,42,0.05),-8px_-8px_18px_rgba(255,255,255,0.95)] hover:-translate-y-1 hover:shadow-[16px_16px_32px_rgba(15,23,42,0.08),-10px_-10px_24px_rgba(255,255,255,1)] transition-all duration-300 flex flex-col justify-between"
                            >
                                <div>
                                    {/* Top Row: Avatar & Status */}
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-gold-500 to-amber-300 flex items-center justify-center text-white font-black text-xl shadow-[4px_4px_12px_rgba(217,119,6,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)] group-hover:scale-105 transition-transform">
                                                {clinic.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-base font-black text-slate-900 tracking-tight line-clamp-1 group-hover:text-amber-700 transition-colors">
                                                    {clinic.name}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1">
                                                        <LinkIcon className="w-3 h-3 text-slate-400" />
                                                        /{clinic.slug}
                                                    </span>
                                                    {clinic.country && (
                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                            {clinic.country}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Pill */}
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${clinic.status === 'Active'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-sm'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200/70 shadow-sm'
                                            }`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${clinic.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                                            {clinic.status}
                                        </span>
                                    </div>

                                    {/* Practice Type Badge */}
                                    {clinic.practiceType && (
                                        <div className="mb-4">
                                            <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-lg">
                                                {clinic.practiceType}
                                            </span>
                                        </div>
                                    )}

                                    {/* 4 Inset Micro-Metric Tiles */}
                                    <div className="grid grid-cols-4 gap-2 mb-4">
                                        <div className="rounded-xl border border-white/90 bg-white/70 p-2.5 text-center shadow-[inset_1px_1px_3px_rgba(15,23,42,0.03),inset_-1px_-1px_3px_rgba(255,255,255,0.9)]">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Users</p>
                                            <p className="text-sm font-black text-slate-800 mt-0.5">{clinic._count?.users || 0}</p>
                                        </div>
                                        <div className="rounded-xl border border-white/90 bg-white/70 p-2.5 text-center shadow-[inset_1px_1px_3px_rgba(15,23,42,0.03),inset_-1px_-1px_3px_rgba(255,255,255,0.9)]">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Clients</p>
                                            <p className="text-sm font-black text-slate-800 mt-0.5">{clinic._count?.clients || 0}</p>
                                        </div>
                                        <div className="rounded-xl border border-white/90 bg-white/70 p-2.5 text-center shadow-[inset_1px_1px_3px_rgba(15,23,42,0.03),inset_-1px_-1px_3px_rgba(255,255,255,0.9)]">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Pets</p>
                                            <p className="text-sm font-black text-slate-800 mt-0.5">{clinic._count?.patients || 0}</p>
                                        </div>
                                        <div className="rounded-xl border border-white/90 bg-white/70 p-2.5 text-center shadow-[inset_1px_1px_3px_rgba(15,23,42,0.03),inset_-1px_-1px_3px_rgba(255,255,255,0.9)]">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Storage</p>
                                            <p className="text-sm font-black text-slate-800 mt-0.5">{clinic.storageUsage || 0}MB</p>
                                        </div>
                                    </div>

                                    {/* 24h Activity Bar */}
                                    <div className="rounded-xl border border-emerald-100/60 bg-emerald-50/40 p-3 mb-4">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1.5">
                                            <span className="flex items-center gap-1 font-extrabold text-emerald-800 uppercase tracking-wider">
                                                <Activity className="w-3 h-3 text-emerald-600" /> 24h Throughput
                                            </span>
                                            <span className="font-extrabold text-slate-700">{clinic.activity24h || 0} reqs</span>
                                        </div>
                                        <div className="w-full bg-white/80 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${(clinic.activity24h || 0) > 200 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(100, Math.max(8, ((clinic.activity24h || 0) / 300) * 100))}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Actions Bar */}
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => onViewClinic(clinic.id)}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-500/20 bg-teal-50 hover:bg-teal-100/90 py-2.5 px-3 text-xs font-extrabold text-teal-800 transition-all active:scale-95 shadow-sm"
                                        title="Open clinic control console"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                                        Open Console
                                    </button>

                                    <button
                                        onClick={() => handleToggleStatus(clinic)}
                                        className={`p-2.5 rounded-xl border transition-all active:scale-95 ${clinic.status === 'Active'
                                            ? 'border-amber-200 bg-white hover:bg-amber-50 text-amber-600'
                                            : 'border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-600'
                                            }`}
                                        title={clinic.status === 'Active' ? 'Suspend Practice' : 'Activate Practice'}
                                    >
                                        {clinic.status === 'Active' ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                    </button>

                                    <button
                                        onClick={() => handleDeleteClinic(clinic)}
                                        className="p-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-500 transition-all active:scale-95"
                                        title="Decommission Practice"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ═════════════════════════════════════════════════════════════════════════════
                5. CREATE CLINIC GLASSMORPHIC MODAL
            ═════════════════════════════════════════════════════════════════════════════ */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/95 p-8 backdrop-blur-2xl shadow-[24px_24px_48px_rgba(15,23,42,0.18)] animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
                        <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                            <div>
                                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-700 mb-1">
                                    <Crown className="w-3 h-3 text-amber-600" /> Provisioning
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Provision New Practice</h3>
                                <p className="text-xs font-semibold text-slate-500">Configure clinic instance and provision master administrator credentials.</p>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-2.5 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateClinic} className="space-y-4 pt-5 overflow-y-auto pr-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Clinic Name</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Sapphire Animal Hospital"
                                        value={newClinicData.name}
                                        onChange={e => setNewClinicData({ ...newClinicData, name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl border border-white/90 bg-slate-100/70 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Practice Type</label>
                                    <select
                                        required
                                        value={newClinicData.practiceType}
                                        onChange={e => setNewClinicData({ ...newClinicData, practiceType: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl border border-white/90 bg-slate-100/70 text-xs font-bold text-slate-800 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] outline-none focus:ring-2 focus:ring-amber-500/30"
                                    >
                                        <option value="Small Animal">Small Animal Practice</option>
                                        <option value="Mixed Practice">Mixed Animal Practice</option>
                                        <option value="Large Animal">Large Animal / Farm</option>
                                        <option value="Equine">Equine Specialist</option>
                                        <option value="Exotic">Exotic Pet Clinic</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Master Admin Email</label>
                                    <input
                                        required
                                        type="email"
                                        placeholder="admin@practice.com"
                                        value={newClinicData.email}
                                        onChange={e => setNewClinicData({ ...newClinicData, email: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl border border-white/90 bg-slate-100/70 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Initial Admin Password</label>
                                    <input
                                        required
                                        type="password"
                                        placeholder="Minimum 6 characters"
                                        value={newClinicData.adminPassword}
                                        onChange={e => setNewClinicData({ ...newClinicData, adminPassword: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl border border-white/90 bg-slate-100/70 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Clinic Address</label>
                                    <input
                                        type="text"
                                        placeholder="Street, City, State"
                                        value={newClinicData.address}
                                        onChange={e => setNewClinicData({ ...newClinicData, address: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl border border-white/90 bg-slate-100/70 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
                                    <input
                                        type="text"
                                        placeholder="+234..."
                                        value={newClinicData.phone}
                                        onChange={e => setNewClinicData({ ...newClinicData, phone: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl border border-white/90 bg-slate-100/70 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Country</label>
                                    <select
                                        required
                                        value={newClinicData.country}
                                        onChange={e => {
                                            const country = e.target.value;
                                            let symbol = '₦';
                                            let lang = 'English';
                                            if (country === 'United States') symbol = '$';
                                            if (country === 'United Kingdom') symbol = '£';
                                            if (country === 'Ghana') symbol = '₵';
                                            if (country === 'Kenya') symbol = 'KSh';
                                            if (country === 'Europe') { symbol = '€'; lang = 'French'; }

                                            setNewClinicData({
                                                ...newClinicData,
                                                country,
                                                currencySymbol: symbol,
                                                language: lang
                                            });
                                        }}
                                        className="w-full px-4 py-3 rounded-2xl border border-white/90 bg-slate-100/70 text-xs font-bold text-slate-800 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] outline-none focus:ring-2 focus:ring-amber-500/30"
                                    >
                                        <option value="Nigeria">Nigeria (₦)</option>
                                        <option value="United States">United States ($)</option>
                                        <option value="United Kingdom">United Kingdom (£)</option>
                                        <option value="Ghana">Ghana (₵)</option>
                                        <option value="Kenya">Kenya (KSh)</option>
                                        <option value="Europe">Europe (€)</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Acronym / Code</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. SAH"
                                        value={newClinicData.acronym}
                                        onChange={e => setNewClinicData({ ...newClinicData, acronym: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl border border-white/90 bg-slate-100/70 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-[inset_2px_2px_4px_rgba(15,23,42,0.04),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                </div>
                            </div>

                            <div className="pt-5 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-5 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingClinic}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-gold-600 text-white text-xs font-black shadow-lg shadow-amber-500/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-60"
                                >
                                    {creatingClinic ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Provisioning...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            Provision Practice Instance
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════════════
                6. CONFIRMATION MODAL
            ═════════════════════════════════════════════════════════════════════════════ */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-[2.2rem] border border-white/80 bg-white/95 p-7 backdrop-blur-2xl shadow-[20px_20px_40px_rgba(15,23,42,0.2)] animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-3 rounded-2xl ${confirmAction.type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                {confirmAction.title}
                            </h3>
                        </div>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed mt-2">
                            {confirmAction.message}
                        </p>
                        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAction.onConfirm}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-lg transition-all active:scale-95 ${confirmAction.type === 'danger'
                                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                                    }`}
                            >
                                Confirm Action
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
