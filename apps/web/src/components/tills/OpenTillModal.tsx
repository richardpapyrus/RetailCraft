import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

interface OpenTillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (session: any) => void;
}

export default function OpenTillModal({ isOpen, onClose, onSuccess }: OpenTillModalProps) {
    const { user, selectedStoreId } = useAuth();
    const [openingFloat, setOpeningFloat] = useState('');
    const [selectedTillId, setSelectedTillId] = useState('');
    const [availableTills, setAvailableTills] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            fetchTills();
        }
    }, [isOpen, user, selectedStoreId]);
    const fetchTills = async () => {
        try {
            // Prioritize selectedStoreId (Context), fall back to user.storeId (Home)
            const storeId = selectedStoreId || user?.storeId || localStorage.getItem('pos_storeId');

            // If no storeId, we can't reliably filter, but let's try passing empty if admin? 
            // Better to be strict: if no store assigned, likely cannot open a till.
            if (!storeId) {
                // Fallback: Try list all (backend might restrict to tenant)
                // Or console.warn('No store ID found');
                return;
            }

            const res = await api.tills.list(storeId);
            // Show ALL tills so users see what's happening. Filter logic moved to Render.
            setAvailableTills(res);

            // Auto-select first AVAILABLE till (No active sessions)
            const firstAvailable = res.find((t: any) => !t.sessions || t.sessions.length === 0);
            if (firstAvailable) setSelectedTillId(firstAvailable.id);
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Failed to load tills');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTillId || !openingFloat) return;

        setLoading(true);
        setError('');

        try {
            const session = await api.tills.openSession({
                tillId: selectedTillId,
                openingFloat: parseFloat(openingFloat)
            });
            onSuccess(session);
        } catch (err: any) {
            setError(err.message || 'Failed to open till');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-96 transform transition-all scale-100">
                <div className="mb-6 flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-bold">Open Till Session</h3>
                        <p className="text-gray-500 text-sm">You must open a till to start selling.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold p-1">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Select Till</label>
                        <select
                            className="w-full p-3 border rounded-xl bg-gray-50"
                            value={selectedTillId}
                            onChange={(e) => setSelectedTillId(e.target.value)}
                            required
                        >
                            {availableTills.length === 0 && <option value="">No tills found for this store</option>}
                            {availableTills.length > 0 && availableTills.every(t => t.sessions && t.sessions.length > 0) && (
                                <option value="" disabled>All tills are currently in use</option>
                            )}

                            {availableTills.map(till => {
                                const isBusy = till.sessions && till.sessions.length > 0;
                                return (
                                    <option
                                        key={till.id}
                                        value={till.id}
                                        disabled={isBusy}
                                        className={isBusy ? 'text-gray-400 bg-gray-100' : 'font-bold'}
                                    >
                                        {till.name} {isBusy ? '(In Use)' : '(Available)'}
                                    </option>
                                );
                            })}
                        </select>
                        {availableTills.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">
                                No tills are assigned to this store location. Please contact your manager.
                            </p>
                        )}
                        {availableTills.length > 0 && availableTills.every(t => t.sessions && t.sessions.length > 0) && (
                            <p className="text-xs text-amber-600 mt-1">
                                All tills have active sessions. You must close them from the Manager Dashboard or asking the active cashier to sign out.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Opening Float</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3 text-gray-400">{user?.currency === 'NGN' ? '₦' : '$'}</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="w-full p-3 pl-8 border rounded-xl"
                                value={openingFloat}
                                onChange={(e) => setOpeningFloat(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || availableTills.length === 0}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 mt-4"
                    >
                        {loading ? 'Opening...' : 'Start Session'}
                    </button>
                </form>
            </div>
        </div>
    );
}
