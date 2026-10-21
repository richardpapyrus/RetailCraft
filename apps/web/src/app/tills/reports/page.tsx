
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { api } from '@/lib/api';
import { ArrowLeft, Download, FileText, AlertTriangle, Activity, Package, CreditCard } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { TillAuditDocument, TillAuditData, AUDIT_PDF_MARGIN_MM } from '@/components/tills/TillAuditDocument';

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
    const [exporting, setExporting] = useState(false);
    const [auditStamp, setAuditStamp] = useState(() => new Date());

    useEffect(() => {
        if (!user) return;
        if (!hasPermission('VIEW_TILL_REPORTS')) {
            toast.error('Access Denied: You do not have permission to view Till Reports.');
            router.push('/tills');
            return;
        }
        setSelectedTillId('');
        loadTills();
    }, [user, selectedStoreId]);

    useEffect(() => {
        if (user && hasPermission('VIEW_TILL_REPORTS')) {
            loadReportData();
        }
    }, [dateRange, customFrom, customTo, selectedTillId, user, selectedStoreId]);

    // Same store scope as the Tills page: the store picked in the top bar, or every store when
    // Organization HQ is selected (the API holds non-admins to their own store either way).
    const reportStoreId = selectedStoreId || undefined;
    const allStores = !selectedStoreId;

    const loadTills = async () => {
        try {
            const data = await api.tills.list(selectedStoreId || '');
            setAvailableTills(Array.isArray(data) ? data : []);
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
            from.setHours(0, 0, 0, 0);
        } else if (dateRange === 'month') {
            from.setDate(from.getDate() - 30);
            from.setHours(0, 0, 0, 0);
        } else if (dateRange === 'custom') {
            // new Date('YYYY-MM-DD') is UTC midnight, which dropped the whole last day and
            // the first hour of the first; read the picked dates as whole local days instead.
            const [fy, fm, fd] = customFrom.split('-').map(Number);
            const [ty, tm, td] = customTo.split('-').map(Number);
            from = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
            to = new Date(ty, tm - 1, td, 23, 59, 59, 999);
        }

        return { from: from.toISOString(), to: to.toISOString() };
    };

    const loadReportData = async () => {
        try {
            setLoading(true);
            // A custom range does nothing until both dates are picked.
            if (dateRange === 'custom' && (!customFrom || !customTo)) return;
            const { from, to } = getDateParams();

            const [dashData, excData, invData] = await Promise.all([
                api.tillReports.getDashboard(from, to, selectedTillId, reportStoreId),
                api.tillReports.getExceptions(from, to, selectedTillId, reportStoreId),
                api.tillReports.getInventory(from, to, selectedTillId, reportStoreId)
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

    // What the current filters cover, written into both exports.
    const periodLabel = () => {
        const { from, to } = getDateParams();
        const f = new Date(from).toLocaleDateString();
        const t = new Date(to).toLocaleDateString();
        return f === t ? f : `${f} – ${t}`;
    };
    const scopeLabel = () => allStores
        ? 'All stores'
        : (availableTills[0]?.store?.name || user?.store?.name || 'Selected store');
    const tillLabel = () => {
        const till = availableTills.find(t => t.id === selectedTillId);
        return till ? till.name : 'All tills';
    };
    const fileStem = () => {
        const { from, to } = getDateParams();
        const f = from.slice(0, 10), t = to.slice(0, 10);
        const scope = allStores ? 'all-stores' : scopeLabel();
        return `till-activity-${scope}-${f === t ? f : `${f}_${t}`}`.replace(/[^\w-]+/g, '_');
    };

    // One CSV with a block per dashboard section, plain numbers so spreadsheets can total them.
    const exportCsv = () => {
        if (!overview || !exceptions || !inventory) return;
        const esc = (v: unknown) => {
            const str = v === null || v === undefined ? '' : String(v);
            return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const amt = (v: number | null | undefined) => (v === null || v === undefined ? '' : Number(v).toFixed(2));
        const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString() : '');
        const rows: unknown[][] = [];
        const block = (title: string, header: string[], body: unknown[][]) => {
            rows.push([title], header, ...body, []);
        };
        const sales = overview.sales;

        rows.push(['Till Activity Report'], ['Business', user?.tenantName || ''], ['Store', scopeLabel()], ['Till', tillLabel()],
            ['Period', periodLabel()], ['Generated', new Date().toLocaleString()], ['Currency', user?.currency || ''], []);
        block('Summary', ['Measure', 'Value'], [
            ['Gross sales', amt(sales.grossSales)], ['Discounts', amt(sales.totalDiscount)], ['Tax', amt(sales.totalTax)],
            ['Refunds', amt(sales.refundTotal)], ['Net collected', amt(sales.totalCollected)],
            ['Transactions', sales.transactionCount], ['Refund count', sales.refundCount],
            ['Sessions', overview.overview.sessionCount], ['Open sessions', overview.overview.openSessions],
        ]);
        block('Payment Methods', ['Method', 'Transactions', 'Amount'],
            overview.payments.map((p: any) => [p.method, p.count, amt(p.amount)]));
        block('Cash Reconciliation', ['Till', 'Store', 'Staff', 'Opened', 'Closed', 'Status', 'Float', 'Expected', 'Counted', 'Variance'],
            overview.overview.sessions.map((s: any) => [s.tillName, s.storeName || '', s.staffName, when(s.openedAt), when(s.closedAt), s.status,
                amt(s.openingFloat), amt(s.expectedCash), amt(s.closingCash), amt(s.variance)]));
        block('Exceptions & Audit Log', ['Date & time', 'Type', 'Staff', 'Reason', 'Amount'], [
            ...exceptions.refunds.map((r: any) => [when(r.createdAt), 'REFUND', r.user?.name || '', r.reason || '', amt(-Number(r.total))]),
            ...exceptions.voids.map((v: any) => [when(v.createdAt), 'VOID', v.user?.name || '', '', '']),
            ...exceptions.cashEvents.map((c: any) => [when(c.createdAt), c.type, '', c.reason || c.description || '', amt(c.amount)]),
        ]);
        block('Inventory Impact', ['Product', 'SKU', 'Quantity sold'],
            inventory.map((i: any) => [i.name, i.sku, i.quantitySold]));

        // BOM so Excel reads the naira sign and other non-ASCII text correctly.
        const csv = '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileStem()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const auditData = (): TillAuditData | null => (overview && exceptions && inventory ? {
        businessName: user?.tenantName || '',
        scopeLabel: scopeLabel(),
        tillLabel: tillLabel(),
        periodLabel: periodLabel(),
        generatedAt: auditStamp,
        generatedBy: user?.name || user?.email || '',
        currency: user?.currency,
        locale: user?.locale,
        overview,
        exceptions,
        inventory,
    } : null);

    const downloadAuditPdf = async () => {
        const el = document.getElementById('till-audit-root');
        if (!el || exporting) return;
        setExporting(true);
        // Stamp the document with the moment of download, and let it re-render before capture.
        setAuditStamp(new Date());
        await new Promise(resolve => setTimeout(resolve, 50));
        try {
            // Client-only library, loaded on demand (same approach as the EOD report).
            const html2pdf = (await import('html2pdf.js')).default;
            await html2pdf()
                .set({
                    margin: AUDIT_PDF_MARGIN_MM,
                    filename: `${fileStem()}-audit.pdf`,
                    image: { type: 'jpeg', quality: 0.95 },
                    html2canvas: { scale: 2, backgroundColor: '#FFFFFF' },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
                })
                .from(el)
                .save();
        } catch (err) {
            console.error('Audit PDF failed', err);
            toast.error('Could not generate the audit PDF. Please try again.');
        } finally {
            setExporting(false);
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
                            <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Till Activity Dashboard</h1>
                            <p className="text-sm text-gray-500">Strictly Confidential - Authorized Personnel Only</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exportCsv} disabled={loading} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                        <button onClick={downloadAuditPdf} disabled={loading || exporting} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                            <FileText className="w-4 h-4" />
                            {exporting ? 'Generating…' : 'Audit PDF'}
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 py-2 overflow-x-auto">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
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
                            <option key={t.id} value={t.id}>{allStores && t.store?.name ? `${t.name} — ${t.store.name}` : t.name}</option>
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
                        <p className="text-3xl font-semibold text-gray-900 tracking-tight">{formatCurrency(overview.sales.grossSales, user?.currency, user?.locale)}</p>
                        <p className="text-xs text-gray-500 mt-1">{overview.sales.transactionCount} transactions</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500">Discounts</h3>
                            <Activity className="w-4 h-4 text-orange-500" />
                        </div>
                        <p className="text-3xl font-semibold text-gray-900 tracking-tight">{formatCurrency(overview.sales.totalDiscount, user?.currency, user?.locale)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500">Refunds</h3>
                            <Activity className="w-4 h-4 text-red-500" />
                        </div>
                        <p className="text-3xl font-semibold text-gray-900 tracking-tight">{formatCurrency(overview.sales.refundTotal, user?.currency, user?.locale)}</p>
                        <p className="text-xs text-gray-500 mt-1">{overview.sales.refundCount} refunds</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-500">Net Collected</h3>
                            <Activity className="w-4 h-4 text-brand-500" />
                        </div>
                        <p className="text-2xl font-semibold text-brand-600">{formatCurrency(overview.sales.totalCollected, user?.currency, user?.locale)}</p>
                        <p className="text-xs text-gray-500 mt-1">Gross − discounts + {formatCurrency(overview.sales.totalTax, user?.currency, user?.locale)} tax − refunds</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 2. Payment Breakdown */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            Payment Methods
                        </h2>
                        <div className="space-y-4">
                            {overview.payments.map((p: any) => (
                                <div key={p.method} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-gray-700">{p.method}</p>
                                        <p className="text-xs text-gray-500">{p.count} txns</p>
                                    </div>
                                    <p className="font-semibold text-gray-900">{formatCurrency(p.amount, user?.currency, user?.locale)}</p>
                                </div>
                            ))}
                            {overview.payments.length === 0 && <p className="text-gray-400 italic">No payments recorded</p>}
                        </div>
                    </div>

                    {/* 3. Cash Reconciliation (Variance) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Cash Reconciliation
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-white border-b border-gray-100">
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
                                                <span className="text-xs text-gray-400">{allStores && s.storeName ? `${s.storeName} · ${s.staffName}` : s.staffName}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 text-right font-semibold ${s.variance < 0 ? 'text-red-500' : s.variance > 0 ? 'text-green-500' : 'text-gray-400'
                                                }`}>
                                                {s.variance !== null ? formatCurrency(s.variance, user?.currency, user?.locale) : '-'}
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
                    <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Exceptions & Audit Log
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white border-b border-gray-100">
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
                                        <td className="px-4 py-3 text-red-600 font-semibold">REFUND</td>
                                        <td className="px-4 py-3">{r.user.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-red-600">-{formatCurrency(r.total, user?.currency, user?.locale)}</td>
                                    </tr>
                                ))}
                                {exceptions.voids.map((v: any) => (
                                    <tr key={v.id} className="hover:bg-orange-50">
                                        <td className="px-4 py-3 text-orange-600 font-semibold">VOID</td>
                                        <td className="px-4 py-3">{v.user.name}</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(v.createdAt).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-gray-400">-</td>
                                    </tr>
                                ))}
                                {exceptions.cashEvents.map((c: any) => (
                                    <tr key={c.id}>
                                        <td className="px-4 py-3 font-semibold">{c.type}</td>
                                        <td className="px-4 py-3">-</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(c.amount, user?.currency, user?.locale)}</td>
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
                    <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Inventory Impact
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white border-b border-gray-100">
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
                                        <td className="px-4 py-3 text-right font-semibold">{i.quantitySold}</td>
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

            {/* Source for the Audit PDF: rendered out of sight; html2pdf captures a clone of it. */}
            <div aria-hidden style={{ height: 0, overflow: 'hidden' }}>
                {(() => { const d = auditData(); return d ? <TillAuditDocument data={d} /> : null; })()}
            </div>
        </div>
    );
}
