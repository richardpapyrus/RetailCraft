"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';


export default function TopProductsPage() {
    const { user, token, isHydrated } = useAuth();
    const router = useRouter();

    // Filters
    const [dateRange, setDateRange] = useState({
        from: new Date().toISOString().split('T')[0].substring(0, 8) + '01', // Start of month
        to: new Date().toISOString().split('T')[0]
    });
    const [sortBy, setSortBy] = useState<'value' | 'count'>('value');

    // Pagination
    const [page, setPage] = useState(1);
    const LIMIT = 50;
    const [total, setTotal] = useState(0);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        loadData();
    }, [token, isHydrated, router, dateRange, sortBy, page]);

    const loadData = async () => {
        setLoading(true);
        try {
            const skip = (page - 1) * LIMIT;
            const res: any = await api.sales.topProducts({
                from: dateRange.from,
                to: dateRange.to,
                sortBy,
                limit: LIMIT,
                skip
            });
            setProducts(res.data || []);
            setTotal(res.total || 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!isHydrated) return null;

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                    <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">Dashboard</Link>
                    <span className="text-gray-400">/</span>
                    <span className="text-sm font-medium text-gray-900">Reports</span>
                </div>
                <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">Best Selling Products</h1>

                    <div className="flex flex-wrap gap-4 items-center">
                        {/* Sort Toggle */}
                        <div className="bg-gray-100 p-1 rounded-lg flex">
                            <button onClick={() => setSortBy('value')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${sortBy === 'value' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>By Value</button>
                            <button onClick={() => setSortBy('count')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${sortBy === 'count' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>By Count</button>
                        </div>

                        {/* Date Picker */}
                        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
                            <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} className="px-3 py-2 text-sm border-r border-gray-200 outline-none" />
                            <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} className="px-3 py-2 text-sm outline-none" />
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Table */}
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Rank</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Qty Sold</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">Loading Report...</td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No data for selected period</td></tr>
                            ) : (
                                products.map((p, idx) => (
                                    <tr key={p.productId} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${(idx + (page - 1) * LIMIT) < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {idx + 1 + (page - 1) * LIMIT}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{p.name}</div>
                                            <div className="text-xs text-gray-500">{p.sku}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-700">
                                            {p.quantity}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                                            ${p.value.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
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
    );
}
