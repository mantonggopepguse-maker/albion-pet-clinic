import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';
import { Wallet, CheckCircle, RefreshCw, Plus, X } from 'lucide-react';

interface CashEntry {
    id: string;
    amount: number;
    method: string;
    source: string;
    status: string;
    notes: string | null;
    recordedBy: string;
    date: string;
}

const RecordCashModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        try {
            await api.cashReconciliation.record({
                amount: parsed,
                method,
                notes: notes || undefined,
            });
            toast.success('Cash entry recorded');
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to record cash entry');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Record Cash Entry</h2>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200"
                            placeholder="0.00"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200"
                        >
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Card">Card</option>
                            <option value="Check">Check</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-200"
                            rows={2}
                            placeholder="Any notes..."
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors"
                    >
                        Record Entry
                    </button>
                </form>
            </div>
        </div>
    );
};

export const CashReconciliationView: React.FC = () => {
    const [entries, setEntries] = useState<CashEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const fetchEntries = () => {
        setLoading(true);
        api.cashReconciliation.getAll()
            .then(setEntries)
            .catch((err) => toast.error(err?.message || 'Failed to load cash entries'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchEntries(); }, []);

    const handleReconcile = (id: string) => {
        api.cashReconciliation.reconcile(id)
            .then(() => {
                toast.success('Cash entry reconciled');
                fetchEntries();
            })
            .catch((err) => toast.error(err?.message || 'Reconciliation failed'));
    };

    const pendingTotal = entries
        .filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + e.amount, 0);

    const reconciledTotal = entries
        .filter(e => e.status !== 'pending')
        .reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Cash Reconciliation</h1>
                    <p className="text-sm text-slate-500 mt-1">Track and reconcile cash collected at POS</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchEntries}
                        className="px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700 flex items-center gap-2"
                    >
                        <Plus size={16} /> Record Cash
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                    <div className="flex items-center gap-2 text-amber-700 mb-1">
                        <Wallet size={16} />
                        <span className="text-sm font-medium">Pending Reconciliation</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-900">₦{pendingTotal.toLocaleString()}</div>
                </div>
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                    <div className="flex items-center gap-2 text-emerald-700 mb-1">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">Reconciled</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-900">₦{reconciledTotal.toLocaleString()}</div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400">Loading cash entries...</div>
            ) : entries.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No cash entries recorded yet</div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Method</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Amount</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Notes</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => (
                                <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                        {new Date(entry.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{entry.method}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900 font-medium text-right">
                                        ₦{entry.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                            entry.status === 'pending'
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                            {entry.status === 'pending' ? 'Pending' : 'Reconciled'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-500">{entry.notes || '-'}</td>
                                    <td className="px-4 py-3 text-right">
                                        {entry.status === 'pending' && (
                                            <button
                                                onClick={() => handleReconcile(entry.id)}
                                                className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                                            >
                                                Reconcile
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && <RecordCashModal onClose={() => setShowModal(false)} onSuccess={fetchEntries} />}
        </div>
    );
};
