
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { api } from '@/lib/api';
import { ArrowLeft, Download, FileText, AlertTriangle, Activity, Package, CreditCard } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function TillReportsPage() {
    const router = useRouter();
    const { user, hasPermission, selectedStoreId } = useAuth();
    const [loading, setLoading] = useState(true);

    // Filters
    const [dateRange, setDateRange] = useState('today'); // today, yesterday, week, month
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [selectedTillId, setSelectedTillId] = useState('');
    const [availableTills, setAvailableTills] = useState<any[]>([]);

    // Data
    const [overview, setOverview] = useState<any>(null);
    const [exceptions, setExceptions] = useState<any>(null);
    const [inventory, setInventory] = useState<any>(null);

    useEffect(() => {
        if (!user) return;
        if (!hasPermission('VIEW_TILL_REPORTS')) {
            toast.error('Access Denied: You do not have permission to view Till Reports.');
            router.push('/tills');
            return;
        }
        loadTills();
    }, [user]);

    useEffect(() => {
        if (user && hasPermission('VIEW_TILL_REPORTS')) {
            loadReportData();
        }
    }, [dateRange, customFrom, customTo, selectedTillId, user]);

    const loadTills = async () => {
        try {
            const storeId = selectedStoreId || user?.storeId;
            if (storeId) {
                const data = await api.tills.list(storeId);
                setAvailableTills(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error('Failed to load tills filter', e);
        }
    };

    const getDateParams = () => {
        const now = new Date();
        let from = new Date();
        let to = new Date();

        if (dateRange === 'today') {
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
        } else if (dateRange === 'yesterday') {
            from.setDate(from.getDate() - 1);
            from.setHours(0, 0, 0, 0);
            to.setDate(to.getDate() - 1);
            to.setHours(23, 59, 59, 999);
        } else if (dateRange === 'week') {
            from.setDate(from.getDate() - 7);
        } else if (dateRange === 'month') {
            from.setDate(from.getDate() - 30);
        } else if (dateRange === 'custom') {
            from = new Date(customFrom);
            to = new Date(customTo);
        }

        return { from: from.toISOString(), to: to.toISOString() };
    };

    const loadReportData = async () => {
        try {
            setLoading(true);
            const { from, to } = getDateParams();

            const [dashData, excData, invData] = await Promise.all([
                api.tillReports.getDashboard(from, to, selectedTillId),
                api.tillReports.getExceptions(from, to, selectedTillId),
                api.tillReports.getInventory(from, to, selectedTillId)
            ]);

            setOverview(dashData);
            setExceptions(excData);
            setInventory(invData);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || 'Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !overview) {
        return <div className="p-8 flex items-center justify-center">Loading Report Dashboard...</div>;
    }

    if (!overview) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/tills')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-500" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Till Activity Dashboard</h1>
                            <p className="text-sm text-gray-500">Strictly Confidential - Authorized Personnel Only</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                            <FileText className="w-4 h-4" />
                            Audit PDF
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 py-2 overflow-x-auto">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="custom">Custom Range</option>
                    </select>

                    {dateRange === 'custom' && (
                        <>
                            <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </>
                    )}

                    <div className="h-6 w-px bg-gray-300 mx-2"></div>

                    <select
                        value={selectedTillId}
                        onChange={(e) => setSelectedTillId(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[150px]"
                    >
                        <option value="">All Tills</option>
                        {availableTills.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">

                {/* 1. Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500">Gross Sales</h3>
                            <Activity className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(overview.sales.grossSales)}</p>
                        <p className="text-xs text-gray-500 mt-1">{overview.sales.transactionCount} transactions</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500">Discounts</h3>
                            <Activity className="w-4 h-4 text-orange-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(overview.sales.totalDiscount)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500">Refunds</h3>
                            <Activity className="w-4 h-4 text-red-500" />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(overview.sales.refundTotal)}</p>
                        <p className="text-xs text-gray-500 mt-1">{overview.sales.refundCount} refunds</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500">Net Collected</h3>
                            <Activity className="w-4 h-4 text-indigo-500" />
                        </div>
                        <p className="text-2xl font-bold text-indigo-600">{formatCurrency(overview.sales.totalCollected)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 2. Payment Breakdown */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            Payment Methods
                        </h2>
                        <div className="space-y-4">
                            {overview.payments.map((p: any) => (
                                <div key={p.method} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-bold text-gray-700">{p.method}</p>
                                        <p className="text-xs text-gray-500">{p.count} txns</p>
                                    </div>
                                    <p className="font-bold text-gray-900">{formatCurrency(p.amount)}</p>
                                </div>
                            ))}
                            {overview.payments.length === 0 && <p className="text-gray-400 italic">No payments recorded</p>}
                        </div>
                    </div>

                    {/* 3. Cash Reconciliation (Variance) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Cash Reconciliation
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Till</th>
                                        <th className="px-4 py-2 text-left">Status</th>
                                        <th className="px-4 py-2 text-right">Variance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {overview.overview.sessions.map((s: any) => (
                                        <tr key={s.id}>
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {s.tillName}<br />
                                                <span className="text-xs text-gray-400">{s.staffName}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold ${s.variance < 0 ? 'text-red-500' : s.variance > 0 ? 'text-green-500' : 'text-gray-400'
                                                }`}>
                                                {s.variance !== null ? formatCurrency(s.variance) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 4. Exceptions & Audit */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Exceptions & Audit Log
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left">Type</th>
                                    <th className="px-4 py-3 text-left">Staff</th>
                                    <th className="px-4 py-3 text-left">Time</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {exceptions.refunds.map((r: any) => (
                                    <tr key={r.id} className="hover:bg-red-50">
                                        <td className="px-4 py-3 text-red-600 font-bold">REFUND</td>
                                        <td className="px-4 py-3">{r.user.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleTimeString()}</td>
                                        <td className="px-4 py-3 text-right font-bold text-red-600">-{formatCurrency(r.total)}</td>
                                    </tr>
                                ))}
                                {exceptions.voids.map((v: any) => (
                                    <tr key={v.id} className="hover:bg-orange-50">
                                        <td className="px-4 py-3 text-orange-600 font-bold">VOID</td>
                                        <td className="px-4 py-3">{v.user.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(v.createdAt).toLocaleTimeString()}</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-400">-</td>
                                    </tr>
                                ))}
                                {exceptions.cashEvents.map((c: any) => (
                                    <tr key={c.id}>
                                        <td className="px-4 py-3 font-bold">{c.type}</td>
                                        <td className="px-4 py-3">-</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleTimeString()}</td>
                                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(c.amount)}</td>
                                    </tr>
                                ))}
                                {exceptions.refunds.length === 0 && exceptions.voids.length === 0 && exceptions.cashEvents.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">No exceptions recorded for this period</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 5. Inventory Impact */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Inventory Impact
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left">Product</th>
                                    <th className="px-4 py-3 text-left">SKU</th>
                                    <th className="px-4 py-3 text-right">Quantity Sold</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {inventory.map((i: any) => (
                                    <tr key={i.productId} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{i.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{i.sku}</td>
                                        <td className="px-4 py-3 text-right font-bold">{i.quantitySold}</td>
                                    </tr>
                                ))}
                                {inventory.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">No inventory movement recorded</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
