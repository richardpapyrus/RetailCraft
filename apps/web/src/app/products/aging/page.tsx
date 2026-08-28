"use client";

import { useEffect, useMemo, useState } from 'react';
import { api, InventoryAgingItem, InventoryAgingReport } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { formatAge } from '@/components/dashboard/InventoryAgingWidget';

const WINDOW_OPTIONS = [30, 60, 90];
const LIMIT = 50;

export default function InventoryAgingPage() {
    const { user, token, isHydrated, selectedStoreId } = useAuth();
    const router = useRouter();

    const [staleDays, setStaleDays] = useState(60);
    const [sortBy, setSortBy] = useState<'age' | 'value'>('age');
    const [page, setPage] = useState(1);
    const [report, setReport] = useState<InventoryAgingReport | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        let cancelled = false;
        setLoading(true);
        api.inventory.aging({ storeId: selectedStoreId || undefined, staleDays })
            .then(res => { if (!cancelled) { setReport(res); setPage(1); } })
            .catch(e => { console.error('Failed to load aging report', e); if (!cancelled) setReport(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [token, isHydrated, router, selectedStoreId, staleDays]);

    // API returns oldest-first; "value" re-sorts by capital tied up.
    const sortedItems = useMemo(() => {
        const items = report?.items ?? [];
        if (sortBy === 'age') return items;
        return [...items].sort((a, b) => b.valueTiedUp - a.valueTiedUp || b.ageDays - a.ageDays);
    }, [report, sortBy]);

    const totalPages = Math.max(1, Math.ceil(sortedItems.length / LIMIT));
    const pageItems = sortedItems.slice((page - 1) * LIMIT, page * LIMIT);
    const showStoreColumn = !selectedStoreId;

    const downloadCsv = () => {
        if (!report) return;
        const header = ['Product', 'SKU', 'Category', 'Store', 'Qty on Hand', 'Unit Cost', 'Value Tied Up', 'Age (days)', 'Stock Last Added', 'Last Sold'];
        const escape = (v: string | number | null) => {
            const s = v === null || v === undefined ? '' : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const rows = sortedItems.map(item => [
            item.name,
            item.sku,
            item.category ?? '',
            item.storeName,
            item.quantity,
            item.unitCost.toFixed(2),
            item.valueTiedUp.toFixed(2),
            item.ageDays,
            new Date(item.lastReceivedAt).toISOString().split('T')[0],
            item.lastSoldAt ? new Date(item.lastSoldAt).toISOString().split('T')[0] : 'Never',
        ].map(escape).join(','));
        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory-aging-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isHydrated) return null;

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                    <Link href="/products" className="text-sm text-gray-500 hover:text-gray-900">Products</Link>
                    <span className="text-gray-400">/</span>
                    <span className="text-sm font-medium text-gray-900">Inventory Aging</span>
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
                            Inventory Aging Report
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Stock on hand with no sales in the last {staleDays} days, oldest first.
                            Items still selling are excluded — they just haven't hit their reorder point yet.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                        {/* No-sale window */}
                        <div className="bg-gray-100 p-1 rounded-lg flex">
                            {WINDOW_OPTIONS.map(days => (
                                <button
                                    key={days}
                                    onClick={() => setStaleDays(days)}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${staleDays === days ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                    title={`Treat an item as sitting only if it hasn't sold in the last ${days} days`}
                                >
                                    No sales {days}d
                                </button>
                            ))}
                        </div>

                        {/* Sort Toggle */}
                        <div className="bg-gray-100 p-1 rounded-lg flex">
                            <button onClick={() => setSortBy('age')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${sortBy === 'age' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Oldest</button>
                            <button onClick={() => setSortBy('value')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${sortBy === 'value' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Most Value</button>
                        </div>

                        <button
                            onClick={downloadCsv}
                            disabled={!report || report.items.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={15} /> Download CSV
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Summary */}
                    {report && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Items Sitting</div>
                                <div className="text-2xl font-semibold text-gray-900">{report.summary.totalItems}</div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Units on Hand</div>
                                <div className="text-2xl font-semibold text-gray-900">{report.summary.totalQuantity}</div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Capital Tied Up</div>
                                <div className="text-2xl font-semibold text-gray-900">
                                    {formatCurrency(report.summary.totalValueTiedUp, user?.currency, user?.locale)}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                                        {showStoreColumn && (
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Store</th>
                                        )}
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Age</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Qty on Hand</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Value Tied Up</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Last Sold</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr><td colSpan={showStoreColumn ? 6 : 5} className="px-6 py-12 text-center text-gray-500">Loading Report...</td></tr>
                                    ) : pageItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={showStoreColumn ? 6 : 5} className="px-6 py-12 text-center text-gray-500">
                                                No stock is sitting idle — everything on hand has sold within the last {staleDays} days
                                            </td>
                                        </tr>
                                    ) : (
                                        pageItems.map((item: InventoryAgingItem) => (
                                            <tr key={`${item.productId}-${item.storeId}`} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <Link href={`/products/${item.productId}`} className="font-medium text-gray-900 hover:text-brand-700">
                                                        {item.name}
                                                    </Link>
                                                    <div className="text-xs text-gray-500">
                                                        {item.sku}{item.category ? ` · ${item.category}` : ''}
                                                    </div>
                                                </td>
                                                {showStoreColumn && (
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex px-2 py-1 rounded-md bg-brand-50 text-brand-700 text-xs font-semibold">
                                                            {item.storeName}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-right">
                                                    <div className={`font-semibold ${item.ageDays >= 180 ? 'text-red-600' : item.ageDays >= 90 ? 'text-amber-600' : 'text-gray-900'}`}>
                                                        {formatAge(item.ageDays)}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        added {new Date(item.lastReceivedAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-gray-700">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold text-gray-900">
                                                    {formatCurrency(item.valueTiedUp, user?.currency, user?.locale)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {item.lastSoldAt ? (
                                                        <span className="text-sm text-gray-700">{formatAge(item.daysSinceLastSale ?? 0)} ago</span>
                                                    ) : (
                                                        <span className="inline-flex px-2 py-1 rounded-md bg-red-50 text-red-600 text-xs font-semibold">Never</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-600">
                                    Page <span className="font-medium text-gray-900">{page}</span> of <span className="font-medium text-gray-900">{totalPages}</span>
                                </span>
                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
