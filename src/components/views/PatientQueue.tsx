import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/apiService';
import { User, ClinicSettings, QueueEntry, Department } from '../../types';
import { toast } from 'sonner';
import {
  ListOrdered, Clock, Users, CheckCircle2, XCircle, ArrowRight,
  Phone, Play, UserCheck, AlertTriangle, Search, RefreshCw, Plus,
  ChevronRight, Timer, Building2, Filter
} from 'lucide-react';

interface PatientQueueProps {
  currentUser: User | null;
  settings: ClinicSettings | null;
  onViewPatient: (patientId: string) => void;
}

interface QueueStats {
  total: number;
  waiting: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  avgWaitMinutes: number;
}

interface AddToQueueModal {
  show: boolean;
  searchQuery: string;
  searchResults: any[];
  selectedPatient: any | null;
  departmentId: string;
  reason: string;
  priority: 'Normal' | 'Urgent' | 'Emergency';
}

const PatientQueue: React.FC<PatientQueueProps> = ({ currentUser, settings, onViewPatient }) => {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<QueueStats>({ total: 0, waiting: 0, inProgress: 0, completed: 0, cancelled: 0, avgWaitMinutes: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [transferModal, setTransferModal] = useState<{ show: boolean; entryId: string; currentDeptId: string }>({ show: false, entryId: '', currentDeptId: '' });
  const [addModal, setAddModal] = useState<AddToQueueModal>({
    show: false, searchQuery: '', searchResults: [], selectedPatient: null,
    departmentId: '', reason: '', priority: 'Normal'
  });

  const currencySymbol = settings?.currencySymbol || '₦';

  const fetchData = useCallback(async () => {
    try {
      const [queueData, deptData, statsData] = await Promise.all([
        api.queue.getToday(),
        api.departments.getAll(),
        api.queue.getStats()
      ]);
      setEntries(queueData);
      setDepartments(deptData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch queue data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Ensure default department exists on first load
  useEffect(() => {
    api.departments.ensureDefault().catch(() => {});
  }, []);

  const getWaitTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const handleCall = async (id: string) => {
    try {
      await api.queue.call(id);
      toast.success('Patient called — you are now assigned');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to call patient');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.queue.complete(id);
      toast.success('Consultation completed');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete');
    }
  };

  const handleCancel = async (id: string, type: 'Cancelled' | 'NoShow') => {
    try {
      await api.queue.cancel(id, type);
      toast.success(type === 'NoShow' ? 'Marked as no-show' : 'Queue entry cancelled');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  };

  const handleTransfer = async () => {
    if (!transferModal.entryId) return;
    const deptId = (document.getElementById('transfer-dept-select') as HTMLSelectElement)?.value;
    if (!deptId) return toast.error('Select a department');
    try {
      await api.queue.transfer(transferModal.entryId, deptId);
      toast.success('Patient transferred');
      setTransferModal({ show: false, entryId: '', currentDeptId: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to transfer');
    }
  };

  const handleSearchPatients = async (query: string) => {
    setAddModal(m => ({ ...m, searchQuery: query }));
    if (query.length < 2) {
      setAddModal(m => ({ ...m, searchResults: [] }));
      return;
    }
    try {
      const results = await api.patients.getAll();
      const filtered = results.filter((p: any) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.owner?.firstName?.toLowerCase().includes(query.toLowerCase()) ||
        p.owner?.lastName?.toLowerCase().includes(query.toLowerCase())
      );
      setAddModal(m => ({ ...m, searchResults: filtered.slice(0, 10) }));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleAddToQueue = async () => {
    if (!addModal.selectedPatient) return toast.error('Select a patient');
    try {
      await api.queue.add({
        patientId: addModal.selectedPatient.id,
        clientId: addModal.selectedPatient.ownerId || undefined,
        departmentId: addModal.departmentId || undefined,
        reason: addModal.reason || undefined,
        priority: addModal.priority
      });
      toast.success(`${addModal.selectedPatient.name} added to queue`);
      setAddModal({ show: false, searchQuery: '', searchResults: [], selectedPatient: null, departmentId: '', reason: '', priority: 'Normal' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to queue');
    }
  };

  // Filter entries
  const filteredEntries = entries.filter(e => {
    // Status filter
    if (statusFilter === 'active' && (e.status === 'Completed' || e.status === 'Cancelled' || e.status === 'NoShow')) return false;
    if (statusFilter === 'Waiting' && e.status !== 'Waiting') return false;
    if (statusFilter === 'InProgress' && e.status !== 'InProgress') return false;
    if (statusFilter === 'Completed' && e.status !== 'Completed') return false;
    // Department filter
    if (departmentFilter && e.departmentId !== departmentFilter) return false;
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.patient?.name?.toLowerCase().includes(q) ||
        e.client?.firstName?.toLowerCase().includes(q) ||
        e.client?.lastName?.toLowerCase().includes(q) ||
        e.reason?.toLowerCase().includes(q);
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    Waiting: '#f59e0b',
    InProgress: '#3b82f6',
    Completed: '#10b981',
    Cancelled: '#6b7280',
    NoShow: '#ef4444',
  };

  const priorityConfig: Record<string, { color: string; label: string; bg: string }> = {
    Normal: { color: '#6b7280', label: 'Normal', bg: 'transparent' },
    Urgent: { color: '#f59e0b', label: 'Urgent', bg: 'rgba(245,158,11,0.12)' },
    Emergency: { color: '#ef4444', label: 'Emergency', bg: 'rgba(239,68,68,0.12)' },
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="text-center">
          <RefreshCw size={32} className="animate-spin text-purple-600 mx-auto" />
          <p className="mt-3 text-slate-500 font-bold text-sm">Loading queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-7 max-w-[1400px] mx-auto pb-24 md:pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <ListOrdered size={28} className="text-purple-600 flex-shrink-0" />
            Patient Queue
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center w-full sm:w-auto">
          <button
            onClick={() => fetchData()}
            className="flex-1 sm:flex-none justify-center bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 text-xs md:text-sm font-bold shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setAddModal(m => ({ ...m, show: true }))}
            className="flex-1 sm:flex-none justify-center bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-500 rounded-xl px-4 py-2.5 text-white hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 text-xs md:text-sm font-bold shadow-md shadow-purple-200"
          >
            <Plus size={15} /> Add to Queue
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        {[
          { label: 'Total Today', value: stats.total, icon: Users, color: '#7c3aed' },
          { label: 'Waiting', value: stats.waiting, icon: Clock, color: '#f59e0b' },
          { label: 'In Progress', value: stats.inProgress, icon: Play, color: '#3b82f6' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: '#10b981' },
          { label: 'Avg Wait', value: `${stats.avgWaitMinutes}m`, icon: Timer, color: '#8b5cf6' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/80 border border-slate-200/80 rounded-2xl p-3.5 md:p-4 flex items-center gap-3 backdrop-blur-md shadow-sm">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <stat.icon size={20} style={{ color: stat.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xl md:text-2xl font-black text-slate-800 truncate">{stat.value}</div>
              <div className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider truncate">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-2.5 mb-6 items-center">
        {/* Status tabs */}
        {[
          { key: 'active', label: 'Active', count: stats.waiting + stats.inProgress },
          { key: 'Waiting', label: 'Waiting', count: stats.waiting },
          { key: 'InProgress', label: 'In Progress', count: stats.inProgress },
          { key: 'Completed', label: 'Completed', count: stats.completed },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
              statusFilter === tab.key
                ? 'bg-purple-100 border-purple-300 text-purple-800 shadow-sm'
                : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-white'
            }`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
              statusFilter === tab.key ? 'bg-purple-200/80 text-purple-900' : 'bg-slate-100 text-slate-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}

        <div className="flex-1" />

        {/* Department filter */}
        <div className="flex items-center gap-2 bg-white/80 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
          <Building2 size={15} className="text-slate-400" />
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="bg-transparent text-slate-700 text-xs font-bold outline-none cursor-pointer pr-1"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search queue..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-white/80 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 text-xs font-semibold w-44 md:w-56 shadow-sm outline-none focus:ring-2 focus:ring-purple-200"
          />
        </div>
      </div>

      {/* Queue List */}
      <div className="flex flex-col gap-3">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-20 px-4 bg-white/60 border border-slate-200/80 rounded-3xl shadow-sm">
            <ListOrdered size={48} className="text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700 mb-1">No patients in queue</p>
            <p className="text-xs text-slate-400 font-medium">Click "Add to Queue" to check in a patient</p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={`p-4 md:px-5 md:py-4.5 rounded-2xl flex flex-col md:flex-row md:items-center gap-4 transition-all border shadow-sm ${
                entry.priority === 'Emergency'
                  ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
                  : entry.priority === 'Urgent'
                  ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                  : 'bg-white/80 border-slate-200/80 hover:border-purple-200 hover:shadow-md'
              } ${
                (entry.status === 'Completed' || entry.status === 'Cancelled' || entry.status === 'NoShow') ? 'opacity-50 bg-slate-50/70' : ''
              }`}
            >
              {/* Queue Number */}
              <div
                className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center border shadow-xs flex-shrink-0"
                style={{
                  background: `${statusColors[entry.status] || '#6b7280'}12`,
                  borderColor: `${statusColors[entry.status] || '#6b7280'}30`,
                }}
              >
                <span className="text-[10px] text-slate-400 font-extrabold leading-none">Q</span>
                <span className="text-xl font-black leading-tight" style={{ color: statusColors[entry.status] || '#6b7280' }}>
                  {String(entry.queueNumber).padStart(3, '0')}
                </span>
              </div>

              {/* Patient Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                  <span
                    onClick={() => onViewPatient(entry.patientId)}
                    className="font-extrabold text-slate-900 text-base cursor-pointer hover:text-purple-600 transition-colors"
                  >
                    {entry.patient?.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {entry.patient?.species}{entry.patient?.breed ? `, ${entry.patient.breed}` : ''}
                  </span>
                  {entry.priority !== 'Normal' && (
                    <span
                      className="text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider"
                      style={{
                        background: priorityConfig[entry.priority].bg,
                        color: priorityConfig[entry.priority].color,
                        border: `1px solid ${priorityConfig[entry.priority].color}30`
                      }}
                    >
                      {entry.priority === 'Emergency' ? '🔴 ' : '⚠ '}{entry.priority}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                  {entry.client && (
                    <span>Owner: <strong className="text-slate-700">{entry.client.firstName} {entry.client.lastName}</strong></span>
                  )}
                  {entry.reason && (
                    <span className="border-l border-slate-200 pl-3 text-slate-600 font-normal">
                      {entry.reason}
                    </span>
                  )}
                </div>
              </div>

              {/* Department badge & Status */}
              <div className="flex md:flex-col items-center md:items-end justify-between gap-2">
                <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-3 py-1 rounded-xl">
                  {entry.department?.name}
                </span>
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: statusColors[entry.status] }}>
                  {entry.status === 'Waiting' && <><Clock size={12} /> Waiting · {getWaitTime(entry.createdAt)}</>}
                  {entry.status === 'InProgress' && <><Play size={12} /> With {entry.assignedTo?.name || 'Doctor'}</>}
                  {entry.status === 'Completed' && <><CheckCircle2 size={12} /> Completed</>}
                  {entry.status === 'Cancelled' && <><XCircle size={12} /> Cancelled</>}
                  {entry.status === 'NoShow' && <><XCircle size={12} /> No-Show</>}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                {entry.status === 'Waiting' && (
                  <>
                    <button
                      onClick={() => handleCall(entry.id)}
                      title="Call patient"
                      className="bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 active:scale-95 transition-all rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Phone size={13} /> Call
                    </button>
                    <button
                      onClick={() => handleCancel(entry.id, 'NoShow')}
                      title="Mark as no-show"
                      className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1"
                    >
                      <XCircle size={13} /> Skip
                    </button>
                  </>
                )}
                {entry.status === 'InProgress' && (
                  <>
                    <button
                      onClick={() => handleComplete(entry.id)}
                      className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 active:scale-95 transition-all rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 size={13} /> Complete
                    </button>
                    <button
                      onClick={() => setTransferModal({ show: true, entryId: entry.id, currentDeptId: entry.departmentId })}
                      title="Transfer to another department"
                      className="bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 active:scale-95 transition-all rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5"
                    >
                      <ArrowRight size={13} /> Transfer
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Transfer Modal */}
      {transferModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md border border-slate-200 shadow-2xl">
            <h3 className="text-xl font-extrabold text-slate-900 mb-4">Transfer Patient</h3>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Select Department</label>
            <select
              id="transfer-dept-select"
              defaultValue=""
              className="w-full soft-input px-3.5 py-2.5 text-sm text-slate-800 rounded-xl border border-slate-200 mb-6 bg-slate-50 font-medium"
            >
              <option value="" disabled>Choose department...</option>
              {departments.filter(d => d.id !== transferModal.currentDeptId).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setTransferModal({ show: false, entryId: '', currentDeptId: '' })}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all"
              >Cancel</button>
              <button
                onClick={handleTransfer}
                className="px-5 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-bold shadow-md shadow-purple-200 transition-all"
              >Transfer</button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Queue Modal */}
      {addModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-slate-900 mb-5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <Plus size={18} />
              </div>
              Add to Queue
            </h3>

            {/* Patient Search */}
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Patient *</label>
            {addModal.selectedPatient ? (
              <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-2xl p-3.5 mb-4">
                <div>
                  <div className="text-purple-950 font-bold text-sm">{addModal.selectedPatient.name}</div>
                  <div className="text-purple-700 text-xs font-medium">
                    {addModal.selectedPatient.species}{addModal.selectedPatient.breed ? ` · ${addModal.selectedPatient.breed}` : ''}
                    {addModal.selectedPatient.owner && ` · Owner: ${addModal.selectedPatient.owner.firstName} ${addModal.selectedPatient.owner.lastName}`}
                  </div>
                </div>
                <button
                  onClick={() => setAddModal(m => ({ ...m, selectedPatient: null, searchQuery: '' }))}
                  className="w-7 h-7 rounded-lg hover:bg-purple-100 flex items-center justify-center text-rose-500 font-black text-lg transition-colors"
                >×</button>
              </div>
            ) : (
              <div className="mb-4">
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by patient or owner name..."
                    value={addModal.searchQuery}
                    onChange={e => handleSearchPatients(e.target.value)}
                    className="w-full soft-input pl-10 pr-3.5 py-2.5 text-sm text-slate-800 rounded-xl border border-slate-200 bg-slate-50"
                    autoFocus
                  />
                </div>
                {addModal.searchResults.length > 0 && (
                  <div className="bg-white border border-slate-200 shadow-xl rounded-2xl mt-1.5 max-h-48 overflow-y-auto divide-y divide-slate-100 z-10 relative">
                    {addModal.searchResults.map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => setAddModal(m => ({ ...m, selectedPatient: p, searchResults: [], searchQuery: '' }))}
                        className="p-3 cursor-pointer hover:bg-purple-50/80 transition-colors flex justify-between items-center"
                      >
                        <div>
                          <div className="text-slate-900 text-xs font-bold">{p.name}</div>
                          <div className="text-slate-500 text-[11px] font-medium">{p.species}{p.breed ? ` · ${p.breed}` : ''}</div>
                        </div>
                        {p.owner && (
                          <div className="text-slate-400 text-[11px] font-medium text-right">
                            {p.owner.firstName} {p.owner.lastName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Department */}
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Department</label>
            <select
              value={addModal.departmentId}
              onChange={e => setAddModal(m => ({ ...m, departmentId: e.target.value }))}
              className="w-full soft-input px-3.5 py-2.5 text-sm text-slate-800 rounded-xl border border-slate-200 mb-4 bg-slate-50 font-medium"
            >
              <option value="">Default (General Clinic)</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.isDefault ? ' (Default)' : ''}</option>
              ))}
            </select>

            {/* Reason */}
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Visit Reason</label>
            <input
              type="text"
              placeholder="e.g., Annual checkup, vaccination, skin issue..."
              value={addModal.reason}
              onChange={e => setAddModal(m => ({ ...m, reason: e.target.value }))}
              className="w-full soft-input px-3.5 py-2.5 text-sm text-slate-800 rounded-xl border border-slate-200 mb-4 bg-slate-50"
            />

            {/* Priority */}
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Priority</label>
            <div className="flex gap-2.5 mb-6">
              {(['Normal', 'Urgent', 'Emergency'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setAddModal(m => ({ ...m, priority: p }))}
                  type="button"
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    addModal.priority === p
                      ? p === 'Emergency'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm'
                        : p === 'Urgent'
                        ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                        : 'border-slate-800 bg-slate-800 text-white shadow-sm'
                      : 'border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  {p === 'Emergency' ? '🔴 ' : p === 'Urgent' ? '⚠ ' : ''}{p}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setAddModal({ show: false, searchQuery: '', searchResults: [], selectedPatient: null, departmentId: '', reason: '', priority: 'Normal' })}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all"
              >Cancel</button>
              <button
                onClick={handleAddToQueue}
                disabled={!addModal.selectedPatient}
                className="px-6 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-bold shadow-md shadow-purple-200 disabled:opacity-50 transition-all"
              >Add to Queue</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PatientQueue;
