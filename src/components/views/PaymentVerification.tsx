import React, { useState, useEffect } from 'react';
import { api } from '../../services/apiService';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Upload, Eye, Clock, Search, Filter } from 'lucide-react';

interface PendingPayment {
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    receiptUrl: string | null;
    recordedBy: string | null;
    date: string;
    sale: {
        id: string;
        invoiceNumber: string;
        total: number;
        amountPaid: number;
        balanceDue: number;
        clientName: string | null;
        createdAt: string;
    };
}

const PaymentRow: React.FC<{
    payment: PendingPayment;
    onVerify: (id: string) => void;
    onReject: (id: string, reason: string) => void;
}> = ({ payment, onVerify, onReject }) => {
    const [showReceiptUpload, setShowReceiptUpload] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const handleRejectSubmit = () => {
        if (!rejectReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        onReject(payment.id, rejectReason);
        setShowRejectDialog(false);
        setRejectReason('');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            api.payments.uploadReceipt(payment.id, file)
                .then(() => {
                    toast.success('Receipt uploaded');
                    setShowReceiptUpload(false);
                })
                .catch((err) => toast.error(err?.message || 'Upload failed'));
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-slate-900">#{payment.sale.invoiceNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            payment.method === 'Bank Transfer' || payment.method === 'TRANSFER'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                        }`}>{payment.method}</span>
                        {payment.sale.clientName && (
                            <span className="text-sm text-slate-500">{payment.sale.clientName}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>Amount: <strong className="text-slate-900">₦{payment.amount.toLocaleString()}</strong></span>
                        <span>Balance: ₦{payment.sale.balanceDue.toLocaleString()}</span>
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(payment.date).toLocaleDateString()}
                        </span>
                    </div>
                    {payment.reference && (
                        <div className="mt-1 text-xs text-slate-400">Ref: {payment.reference}</div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!payment.receiptUrl && (
                        <button
                            onClick={() => setShowReceiptUpload(!showReceiptUpload)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Upload receipt"
                        >
                            <Upload size={18} />
                        </button>
                    )}
                    {payment.receiptUrl && (
                        <a
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View receipt"
                        >
                            <Eye size={18} />
                        </a>
                    )}
                    <button
                        onClick={() => onVerify(payment.id)}
                        className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Verify payment"
                    >
                        <CheckCircle size={18} />
                    </button>
                    <button
                        onClick={() => setShowRejectDialog(true)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Reject payment"
                    >
                        <XCircle size={18} />
                    </button>
                </div>
            </div>
            {showReceiptUpload && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.gif,.pdf"
                        onChange={handleFileUpload}
                        className="text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                    />
                </div>
            )}
            {showRejectDialog && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <textarea
                        placeholder="Reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
                        rows={2}
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            onClick={() => setShowRejectDialog(false)}
                            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRejectSubmit}
                            className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg"
                        >
                            Reject
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const PaymentVerification: React.FC = () => {
    const [payments, setPayments] = useState<PendingPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState('all');

    const fetchPayments = () => {
        setLoading(true);
        api.payments.getPending()
            .then(setPayments)
            .catch((err) => toast.error(err?.message || 'Failed to load pending payments'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchPayments(); }, []);

    const handleVerify = (paymentId: string) => {
        api.payments.verify(paymentId)
            .then(() => {
                toast.success('Payment verified successfully');
                fetchPayments();
            })
            .catch((err) => toast.error(err?.message || 'Verification failed'));
    };

    const handleReject = (paymentId: string, reason: string) => {
        api.payments.reject(paymentId, reason)
            .then(() => {
                toast.success('Payment rejected');
                fetchPayments();
            })
            .catch((err) => toast.error(err?.message || 'Rejection failed'));
    };

    const filtered = payments.filter(p => {
        const matchesSearch = !search ||
            p.sale.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
            (p.sale.clientName || '').toLowerCase().includes(search.toLowerCase());
        const matchesMethod = methodFilter === 'all' || p.method === methodFilter;
        return matchesSearch && matchesMethod;
    });

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Payment Verification</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {payments.length} pending payment{payments.length !== 1 ? 's' : ''} awaiting review
                    </p>
                </div>
                <button
                    onClick={fetchPayments}
                    className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                    Refresh
                </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by invoice or client..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                </div>
                <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                    <option value="all">All methods</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="TRANSFER">TRANSFER</option>
                    <option value="Check">Check</option>
                    <option value="Cash">Cash</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400">Loading pending payments...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    {payments.length === 0 ? 'No pending payments' : 'No matching payments'}
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(p => (
                        <PaymentRow
                            key={p.id}
                            payment={p}
                            onVerify={handleVerify}
                            onReject={handleReject}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
