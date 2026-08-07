import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Building2,
    ArrowLeft,
    Mail,
    MapPin,
    Globe,
    Phone,
    Users,
    Dog,
    Package,
    Stethoscope,
    Receipt,
    Calendar,
    Database,
    Cpu,
    ShieldCheck,
    Briefcase
} from 'lucide-react';
import { api } from '../../services/apiService';

interface ClinicDetailsProps {
    clinicId: string;
    onBack: () => void;
}

export const ClinicDetails: React.FC<ClinicDetailsProps> = ({ clinicId, onBack }) => {
    const [clinic, setClinic] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadClinicDetails();
    }, [clinicId]);

    const loadClinicDetails = async () => {
        setLoading(true);
        try {
            const clinicData = await api.superAdmin.getClinicDetails(clinicId);
            setClinic(clinicData);
        } catch (error) {
            console.error("Failed to load clinic details", error);
            toast.error("Failed to load clinic data");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
            </div>
        );
    }

    if (!clinic) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Clinic not found.</p>
                <button onClick={onBack} className="mt-4 text-amber-600 font-bold flex items-center gap-2 justify-center w-full">
                    <ArrowLeft className="w-4 h-4" /> Go Back
                </button>
            </div>
        );
    }

    const stats = [
        { label: 'Staff', value: clinic._count?.users || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Clients', value: clinic._count?.clients || 0, icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Patients', value: clinic.patientCount || 0, icon: Dog, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Inventory', value: clinic._count?.inventoryItems || 0, icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Procedures', value: clinic._count?.procedures || 0, icon: Stethoscope, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Sales', value: clinic._count?.sales || 0, icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Appointments', value: clinic._count?.appointments || 0, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50' },
    ];

    const systemUsage = [
        { label: 'Storage Usage', value: `${clinic.storageUsage.toFixed(2)} MB`, icon: Database, color: 'text-slate-600', bg: 'bg-slate-100' },
        { label: 'RAM Allocation', value: `${clinic.ramUsage.toFixed(2)} GB`, icon: Cpu, color: 'text-slate-600', bg: 'bg-slate-100' },
    ];

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{clinic.name}</h1>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${clinic.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                            }`}>
                            {clinic.status}
                        </span>
                    </div>
                    <p className="text-slate-500 font-medium">Detailed clinic overview and resource allocation</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Basic Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="soft-card p-6 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white text-2xl font-black">
                                {clinic.acronym || clinic.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-lg">/{clinic.slug}</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-50">
                            <div className="flex items-start gap-3">
                                <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Contact Email</p>
                                    <p className="text-sm font-medium text-slate-700">{clinic.email || 'No email set'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Phone className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Phone Number</p>
                                    <p className="text-sm font-medium text-slate-700">{clinic.phone || 'No phone set'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Address</p>
                                    <p className="text-sm font-medium text-slate-700">{clinic.address || 'No address set'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Globe className="w-5 h-5 text-slate-400 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Location</p>
                                    <p className="text-sm font-medium text-slate-700">{clinic.country || 'Nigeria'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-50">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-3 text-center">Admin Contact</p>
                            {clinic.users?.[0] ? (
                                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-amber-600 font-bold border border-slate-100 shadow-sm">
                                        {clinic.users[0].name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{clinic.users[0].name}</p>
                                        <p className="text-xs text-slate-500 font-medium">{clinic.users[0].email}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-center text-slate-400 italic">No admin user found</p>
                            )}
                        </div>
                    </div>

                    <div className="soft-card p-6 bg-amber-600 text-white relative overflow-hidden">
                        <ShieldCheck className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
                        <h3 className="font-bold text-lg mb-2 relative z-10">Administrative Review</h3>
                        <p className="text-amber-100 text-sm relative z-10 opacity-90">Use this view to review tenant status, infrastructure usage, and operator actions before making changes.</p>
                        <button className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-all backdrop-blur-md relative z-10">
                            Review Security Logs
                        </button>
                    </div>
                </div>

                {/* Right Column: Resource Usage & Stats */}
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Building2 className="w-6 h-6 text-amber-500" />
                            Resource Usage
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stats.map((stat, i) => (
                                <div key={i} className="soft-card p-5 flex items-center gap-4 hover:translate-y-[-2px] transition-transform cursor-default">
                                    <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0`}>
                                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                                        <p className="text-xl font-black text-slate-800">{stat.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="soft-card p-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Database className="w-4 h-4" />
                                Infrastructure Allocation
                            </h3>
                            <div className="space-y-6">
                                {systemUsage.map((usage, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <p className="font-bold text-slate-700">{usage.label}</p>
                                            <p className="text-sm font-black text-amber-600">{usage.value}</p>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-amber-600 rounded-full"
                                                style={{ width: i === 0 ? `${Math.min((parseFloat(usage.value) / 100) * 100, 100)}%` : '40%' }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="soft-card p-6 flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Management Actions</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={async () => {
                                            const newStatus = clinic.status === 'Active' ? 'Suspended' : 'Active';
                                            if (!window.confirm(`Are you sure you want to ${newStatus === 'Active' ? 'activate' : 'suspend'} this clinic?`)) return;
                                            
                                            try {
                                                await api.superAdmin.updateClinic(clinic.id, { status: newStatus });
                                                toast.success(`Clinic ${newStatus}`);
                                                loadClinicDetails();
                                            } catch (error) {
                                                toast.error("Failed to update status");
                                            }
                                        }}
                                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${clinic.status === 'Active' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                            }`}
                                    >
                                        <ShieldCheck className="w-5 h-5" />
                                        {clinic.status === 'Active' ? 'Suspend Clinic' : 'Activate Clinic'}
                                    </button>

                                    <button
                                        onClick={async () => {
                                            if (!window.confirm("CRITICAL: Permanently delete this clinic and ALL its data? This cannot be undone.")) return;
                                            try {
                                                await api.superAdmin.deleteClinic(clinic.id);
                                                toast.success("Clinic deleted");
                                                onBack();
                                            } catch (error) {
                                                toast.error("Failed to delete clinic");
                                            }
                                        }}
                                        className="w-full py-3 rounded-xl font-bold text-red-600 border border-red-100 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        Delete Forever
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
