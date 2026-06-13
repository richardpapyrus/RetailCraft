"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, useAuth } from '@/lib/useAuth';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { toast } from 'react-hot-toast';
import { FileText } from 'lucide-react';
import { TillReport } from '@/components/tills/TillReport';
import { confirmDialog, promptDialog } from '@/lib/dialog';

export default function TillsPage() {
    const router = useRouter();
    const { isHydrated, token, user, selectedStoreId, hasPermission } = useAuth();
    const [tills, setTills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTillName, setNewTillName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (isHydrated && token) {
            fetchTills();
        }
    }, [isHydrated, token, selectedStoreId]);

    const fetchTills = async () => {
        setLoading(true);
        try {
            // Fetch tills for selected store (or all if HQ/Global not enforced, but now backend enforces stricter logic)
            // If selectedStoreId is present, we MUST send it to filter.
            const res = await api.tills.list(selectedStoreId || '');
            setTills(Array.isArray(res) ? res : []);
        } catch (e) {
            console.error(e);
            setTills([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTillName) return;

        setCreating(true);
        try {
            // STRICT ISOLATION: Prioritize selectedStoreId (Context)
            // For Admins, this allows creating tills in specific stores.
            // For Non-Admins, backend will ignore this and use their assigned store (but sending it is harmless).

            let storeId = selectedStoreId;

            if (!storeId) {
                // Fallback for Non-Admins who might not have selectedStoreId context set yet?
                // But useAuth should provide it.
                // If Admin has no store selected, BLOCK creation to prevent "Global Tills"
                if (user?.role === 'Administrator' || user?.role === 'ADMIN') {
                    toast.error("Please select a store from the top bar before creating a Till.");
                    setCreating(false);
                    return;
                }
                // Fallback to assigned store
                storeId = user?.storeId || '';
            }

            if (!storeId) {
                toast.error("No valid store context found.");
                setCreating(false);
                return;
            }

            await api.tills.create({ name: newTillName, storeId: storeId || '' });
            setNewTillName('');
            fetchTills(); // Refresh
        } catch (e) {
            console.error(e);
            toast.error('Failed to create till');
        } finally {
            setCreating(false);
        }
    };

    const [historyTill, setHistoryTill] = useState<any>(null);
    const [historySessions, setHistorySessions] = useState<any[]>([]);
    const [reportSessionId, setReportSessionId] = useState<string | null>(null);

    const fetchHistory = async (till: any) => {
        setHistoryTill(till);
        try {
            const sessions = await api.tills.getSessions(till.id);
            setHistorySessions(sessions);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load history');
        }
    };

    if (!isHydrated) return null;

    return (
        <div className="max-w-7xl mx-auto p-8 lg:p-10 animate-fade-in-up">
            <div className="flex flex-wrap justify-between items-center mb-10 gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Tills</h1>
                    <span className="text-sm font-medium text-mid-grey">Registers and cash sessions</span>
                </div>
                {hasPermission('VIEW_TILL_REPORTS') && (
                    <button
                        onClick={() => router.push('/tills/reports')}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-50 border border-brand-200 text-brand-700 rounded-xl hover:bg-brand-100 font-semibold shadow-sm transition-colors"
                    >
                        <FileText className="w-5 h-5" />
                        Activity Dashboard
                    </button>
                )}
            </div>

            {/* Create Till Card */}
            <div className="bg-white p-6 rounded-2xl shadow-card border border-gray-100/80 mb-8">
                <h2 className="text-xl font-semibold tracking-tight mb-4">Add New Till</h2>
                <form onSubmit={handleCreate} className="flex gap-4">
                    <input
                        className="flex-1 px-4 py-3 border border-cool-grey rounded-xl text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                        placeholder="Till Name (e.g. Counter 1)"
                        value={newTillName}
                        onChange={e => setNewTillName(e.target.value)}
                        required
                    />
                    <button
                        type="submit"
                        disabled={creating}
                        className="bg-brand-500 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-brand-600 shadow-soft disabled:opacity-50"
                    >
                        {creating ? 'Creating...' : 'Create Till'}
                    </button>
                </form>
            </div>

            {/* Tills List */}
            <div className="bg-white rounded-2xl shadow-card border border-gray-100/80 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold tracking-tight">All Tills</h2>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-white border-b border-gray-100 text-mid-grey text-[11px] font-semibold uppercase tracking-widest">
                            <tr>
                                <th className="p-4 pl-6">Name</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Store</th>
                                <th className="p-4">Actions</th>
                                <th className="p-4">Active Session</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tills.map(till => (
                                <tr key={till.id} className="hover:bg-gray-50">
                                    <td className="p-4 pl-6 font-semibold">{till.name}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${till.status === 'OPEN' ? 'bg-green-50 text-green-700' : 'bg-surface-muted text-gray-500'
                                            }`}>
                                            {till.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">{till.store?.name || user?.store?.name || `${String(till.storeId).slice(0, 8)}…`}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <button onClick={() => fetchHistory(till)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-charcoal hover:bg-surface-muted transition-colors">History</button>
                                            <button onClick={async () => {
                                                const name = await promptDialog({ title: 'Rename Till', message: 'Enter a new name for this till.', defaultValue: till.name, placeholder: 'Till name' });
                                                if (name && name.trim()) api.tills.update(till.id, { name: name.trim() }).then(fetchTills);
                                            }} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors">Edit</button>
                                            <button onClick={async () => {
                                                if (await confirmDialog({ title: 'Delete Till', message: `Delete "${till.name}"? This cannot be undone.`, destructive: true })) {
                                                    try {
                                                        await api.tills.delete(till.id);
                                                        fetchTills();
                                                    } catch (err: any) {
                                                        toast.error('Cannot delete: ' + err.message);
                                                    }
                                                }
                                            }} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">Delete</button>

                                            {till.status === 'OPEN' && till.sessions?.[0] && (
                                                <button
                                                    onClick={async () => {
                                                        const cashStr = await promptDialog({
                                                            title: 'Close Session',
                                                            message: 'Count the cash in the drawer and enter the closing total.',
                                                            inputType: 'number',
                                                            placeholder: '0.00',
                                                            prefix: user?.currency || '',
                                                            confirmLabel: 'Close Session',
                                                        });
                                                        if (cashStr === null) return;
                                                        const closingCash = parseFloat(cashStr);
                                                        if (isNaN(closingCash)) return toast.error('Please enter a valid amount');

                                                        try {
                                                            await api.tills.closeSession(till.sessions[0].id, { closingCash });
                                                            toast.success('Session Closed');
                                                            fetchTills();
                                                        } catch (err: any) {
                                                            toast.error('Failed to close: ' + err.message);
                                                        }
                                                    }}
                                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-600 hover:bg-amber-50 transition-colors"
                                                >
                                                    Close Session
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {till.sessions && till.sessions.length > 0 ? (
                                            <div className="text-sm">
                                                <div className="font-semibold">Open since {new Date(till.sessions[0].openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                <div className="text-gray-400">Float: {formatCurrency(till.sessions[0].openingFloat, user?.currency, user?.locale)}</div>
                                            </div>
                                        ) : <span className="text-gray-400">-</span>}
                                    </td>
                                </tr>
                            ))}
                            {tills.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">No tills found. Create one above.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>



            {/* History Modal */}
            {
                historyTill && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-lifted w-full max-w-4xl max-h-[80vh] flex flex-col">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                                <div>
                                    <h3 className="text-xl font-semibold">Session History</h3>
                                    <p className="text-sm text-gray-500">{historyTill.name}</p>
                                </div>
                                <button onClick={() => setHistoryTill(null)} className="text-gray-400 hover:text-black font-semibold p-2">✕</button>
                            </div>
                            <div className="flex-1 overflow-auto p-0">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 sticky top-0">
                                        <tr>
                                            <th className="p-4">Opened</th>
                                            <th className="p-4">Closed</th>
                                            <th className="p-4">User</th>
                                            <th className="p-4 text-right">Float</th>
                                            <th className="p-4 text-right">Expected</th>
                                            <th className="p-4 text-right">Actual</th>
                                            <th className="p-4 text-right">Variance</th>
                                            <th className="p-4 text-right">Reports</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {historySessions.length === 0 && (
                                            <tr><td colSpan={7} className="p-8 text-center text-gray-400">No closed sessions found.</td></tr>
                                        )}
                                        {historySessions.map(session => (
                                            <tr key={session.id} className="hover:bg-gray-50">
                                                <td className="p-4">{new Date(session.openedAt).toLocaleString()}</td>
                                                <td className="p-4">{new Date(session.closedAt).toLocaleString()}</td>
                                                <td className="p-4 font-medium">{session.user?.name || session.user?.email || 'Unknown'}</td>
                                                <td className="p-4 text-right">{formatCurrency(session.openingFloat, user?.currency, user?.locale)}</td>
                                                <td className="p-4 text-right font-mono">{formatCurrency(session.expectedCash, user?.currency, user?.locale)}</td>
                                                <td className="p-4 text-right font-mono">{formatCurrency(session.closingCash, user?.currency, user?.locale)}</td>
                                                <td className={`p-4 text-right font-semibold ${Number(session.variance) < 0 ? 'text-red-500' : Number(session.variance) > 0 ? 'text-green-500' : 'text-gray-400'}`}>
                                                    {formatCurrency(session.variance, user?.currency, user?.locale)}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => setReportSessionId(session.id)}
                                                        className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline"
                                                    >
                                                        View Report
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end">
                                <button onClick={() => setHistoryTill(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-xl font-semibold hover:bg-gray-50">Close</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Report Modal */}
            {
                reportSessionId && (
                    <ReportResult
                        sessionId={reportSessionId}
                        onClose={() => setReportSessionId(null)}
                    />
                )
            }
        </div>
    );
}

function ReportResult({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.tills.getReport(sessionId)
            .then(setData)
            .catch(err => toast.error('Failed to load report'))
            .finally(() => setLoading(false));
    }, [sessionId]);

    if (loading) return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] text-white">Loading Report...</div>;
    if (!data) return null;

    return <TillReport data={data} onClose={onClose} />;
}
