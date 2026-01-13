"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { ReturnModal } from '@/components/sales/ReturnModal';
import { SaleDetailModal } from '@/components/sales/SaleDetailModal';
import { toast } from 'react-hot-toast';

interface SaleItem {
    id: string;
    product: {
        name: string;
        sku: string;
    };
    quantity: number;
    priceAtSale: string;
    productId: string;
}

interface Sale {
    id: string;
    createdAt: string;
    total: string;
    paymentMethod: string;
    status: string;
    customer?: {
        name: string;
        code: string;
    };
    user?: {
        email: string;
    };
    items: SaleItem[];
}

export default function SalesHistoryPage() {
    const { user, token, isHydrated, selectedStoreId } = useAuth();
    const router = useRouter();
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [exporting, setExporting] = useState(false);
    const [returnModalOpen, setReturnModalOpen] = useState(false);

    const [totalSales, setTotalSales] = useState(0);
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const limit = 50;

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        loadSales();
        useEffect(() => {
            const timer = setTimeout(() => {
                setDebouncedSearch(searchTerm);
                setPage(1); // Reset page on search
            }, 500);
            return () => clearTimeout(timer);
        }, [searchTerm]);

        useEffect(() => {
            if (!isHydrated) return;
            if (!token) {
                router.push('/login');
                return;
            }
            loadSales();
        }, [token, router, isHydrated, selectedStoreId, page, debouncedSearch]);

        const loadSales = async () => {
            setLoading(true);
            try {
                const skip = (page - 1) * limit;
                const res: any = await api.sales.list(skip, limit, selectedStoreId || undefined, debouncedSearch);

                // Handle new response structure { data, total } or fallback
                if (res && res.data && Array.isArray(res.data)) {
                    setSales(res.data);
                    setTotalSales(res.total || res.data.length);
                } else if (Array.isArray(res)) {
                    // Legacy fallback (should ideally not happen if backend deployed)
                    setSales(res);
                    setTotalSales(res.length);
                } else {
                    setSales([]);
                    setTotalSales(0);
                }
            } catch (e) {
                console.error(e);
                toast.error("Failed to load sales");
            } finally {
                setLoading(false);
            }
        };

        const handleExport = async () => {
            setExporting(true);
            try {
                const blob = await api.sales.export(undefined, undefined, selectedStoreId || undefined);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sales_export_${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (e) {
                console.error('Export failed', e);
                toast.error('Export failed');
            } finally {
                setExporting(false);
            }
        };

        if (loading && sales.length === 0) return <div className="p-8">Loading...</div>;

        const formatDate = (dateStr: string) => {
            return new Date(dateStr).toLocaleString();
        };

        const totalPages = Math.ceil(totalSales / limit);

        return (
            <div className="h-full bg-gray-50 overflow-y-auto">
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold">Sales History</h1>
                            <p className="text-sm text-gray-500">Showing {sales.length} of {totalSales} records</p>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                        >
                            {exporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                    </div>

                    <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cashier</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {sales.map((sale) => (
                                        <tr key={sale.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSale(sale)}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(sale.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                                                #{sale.id.slice(0, 8)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                {sale.customer ? (
                                                    <div>
                                                        <div>{sale.customer.name}</div>
                                                        <div className="text-xs text-gray-400 font-mono">{sale.customer.code}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">Walk-In</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {sale.user?.email || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {sale.paymentMethod}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                ${Number(sale.total).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); }}
                                                    className="text-indigo-600 hover:text-indigo-900"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {sales.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-4 text-center text-gray-500">No sales found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination Controls */}
                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                Page {page} of {Math.max(1, totalPages)}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1 || loading}
                                    className="px-4 py-2 border rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= totalPages || loading}
                                    className="px-4 py-2 border rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RECEIPT DETAIL MODAL */}
                    {selectedSale && (
                        <SaleDetailModal
                            sale={selectedSale}
                            onClose={() => setSelectedSale(null)}
                            onReturn={() => setReturnModalOpen(true)}
                        />
                    )}

                    {selectedSale && (
                        <ReturnModal
                            isOpen={returnModalOpen}
                            onClose={() => setReturnModalOpen(false)}
                            sale={selectedSale}
                            onSuccess={() => {
                                loadSales();
                                setReturnModalOpen(false);
                                setSelectedSale(null); // Close detail view too? Maybe keep open but re-fetch.
                                // For simplicity, close both.
                            }}
                        />
                    )}
                </div>
            </div>
        );
    }
