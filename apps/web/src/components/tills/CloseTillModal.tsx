import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';

interface CloseTillModalProps {
    isOpen: boolean;
    sessionId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CloseTillModal({ isOpen, sessionId, onClose, onSuccess }: CloseTillModalProps) {
    const { user } = useAuth();
    const [closingCash, setClosingCash] = useState('');
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && sessionId) {
            fetchSummary();
        }
    }, [isOpen, sessionId]);

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await api.tills.getSessionSummary(sessionId);
            setSummary(res);
        } catch (e) {
            console.error(e);
            setError('Failed to load session summary');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!closingCash) return;

        setSubmitting(true);
        setError('');

        try {
            await api.tills.closeSession(sessionId, {
                closingCash: parseFloat(closingCash)
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to close till');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const expectedCash = summary?.totals?.expectedCash || 0;
    const variance = parseFloat(closingCash || '0') - expectedCash;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-96 transform transition-all scale-100">
                <div className="mb-6 flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-bold">Close Till</h3>
                        <p className="text-gray-500 text-sm">End current till session</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold p-1">✕</button>
                </div>

                {loading ? (
                    <div className="py-8 text-center text-gray-500">Loading summary...</div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">
                                {error}
                            </div>
                        )}

                        <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm text-gray-600">
                            <div className="flex justify-between">
                                <span>Opening Float</span>
                                <span className="font-bold">{formatCurrency(summary?.openingFloat || 0, user?.currency)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Cash Sales</span>
                                <span className="font-bold">{formatCurrency(summary?.totals?.sales || 0, user?.currency)}</span>
                            </div>
                            {/* Can add cash in/out display here */}
                            <div className="border-t pt-2 flex justify-between text-base font-bold text-gray-800">
                                <span>Expected Cash</span>
                                <span>{formatCurrency(expectedCash, user?.currency)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Counted Cash</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3 text-gray-400">{user?.currency === 'NGN' ? '₦' : '$'}</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="w-full p-3 pl-8 border rounded-xl font-bold text-lg"
                                    value={closingCash}
                                    onChange={(e) => setClosingCash(e.target.value)}
                                    required
                                />
                            </div>
                            {closingCash && (
                                <div className={`text-sm text-right font-bold ${Math.abs(variance) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>
                                    Variance: {formatCurrency(variance, user?.currency)}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 mt-4"
                        >
                            {submitting ? 'Closing...' : 'Confirm Close'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
