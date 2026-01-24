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

    // Existing State
    const [totalSales, setTotalSales] = useState(0);
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const limit = 50;

    // Daily Summary State
    const [activeTab, setActiveTab] = useState<'receipts' | 'summary'>('receipts');
    const [dailySummary, setDailySummary] = useState<any[]>([]);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        if (activeTab === 'receipts') {
            loadSales();
        } else {
            loadSummary();
        }
    }, [token, router, isHydrated, selectedStoreId, page, debouncedSearch, activeTab, startDate, endDate]);

    const loadSummary = async () => {
        setLoadingSummary(true);
        try {
            const res: any = await api.sales.getProductSummary(selectedStoreId || undefined, startDate, endDate);
            setDailySummary(res || []);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load summary");
        } finally {
            setLoadingSummary(false);
        }
    }

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

    if (loading && sales.length === 0 && activeTab === 'receipts') return <div className="p-8">Loading...</div>;

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
                        {activeTab === 'receipts' && <p className="text-sm text-gray-500">Showing {sales.length} of {totalSales} records</p>}
                        {activeTab === 'summary' && <p className="text-sm text-gray-500">Sales Summary for Period</p>}
                    </div>
                    <div className="flex gap-2">
                        {activeTab === 'summary' && (
                            <div className="flex gap-2 items-center">
                                <input
                                    type="date"
                                    className="px-3 py-2 border rounded-lg text-sm"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    className="px-3 py-2 border rounded-lg text-sm"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                        )}
                        {activeTab === 'receipts' && (
                            <>
                                <input
                                    type="text"
                                    placeholder="Search receipts, customers..."
                                    className="px-4 py-2 border rounded-lg"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                <button
                                    onClick={handleExport}
                                    disabled={exporting}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                                >
                                    {exporting ? 'Exporting...' : 'Export CSV'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* TABS */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('receipts')}
                            className={`${activeTab === 'receipts'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Sales Receipts
                        </button>
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`${activeTab === 'summary'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Daily Product Summary (Today)
                        </button>
                    </nav>
                </div>

                {/* RECEIPTS VIEW */}
                {activeTab === 'receipts' && (
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
                                                {sale.user?.name || sale.user?.email || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {sale.paymentMethod}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                {(() => {
                                                    // Calculate Refund
                                                    const refundTotal = (sale as any).returns?.reduce((sum: number, ret: any) => sum + Number(ret.total), 0) || 0;
                                                    const originalTotal = Number(sale.total);
                                                    const netTotal = originalTotal - refundTotal;
                                                    const hasRefund = refundTotal > 0;

                                                    return (
                                                        <div className="flex flex-col items-end">
                                                            {hasRefund ? (
                                                                <>
                                                                    <span className="text-gray-400 line-through text-xs">{formatCurrency(originalTotal, user?.currency, user?.locale)}</span>
                                                                    <span className="text-red-600">{formatCurrency(netTotal, user?.currency, user?.locale)}</span>
                                                                    <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">Refunded</span>
                                                                </>
                                                            ) : (
                                                                <span>{formatCurrency(originalTotal, user?.currency, user?.locale)}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
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
                )}


                {/* SUMMARY VIEW */}
                {activeTab === 'summary' && (
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        {loadingSummary ? (
                            <div className="p-8 text-center text-gray-500">Loading Summary...</div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Sold Today</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50 text-yellow-900 border-l">Current Stock (On Hand)</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {dailySummary.map((item, idx) => (
                                        <tr key={item.productId || idx} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                {item.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                                {item.sku}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold text-right">
                                                {item.quantitySold}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {formatCurrency(item.totalValue, user?.currency, user?.locale)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold text-right bg-yellow-50 border-l">
                                                {item.currentStock}
                                            </td>
                                        </tr>
                                    ))}
                                    {dailySummary.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                No sales found for today.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* RECEIPT DETAIL MODAL */}
                {selectedSale && !returnModalOpen && (
                    <SaleDetailModal
                        sale={selectedSale}
                        onClose={() => setSelectedSale(null)}
                        onReturn={() => setReturnModalOpen(true)}
                    />
                )}

                {/* RETURN MODAL */}
                {selectedSale && (
                    <ReturnModal
                        isOpen={returnModalOpen}
                        onClose={() => setReturnModalOpen(false)}
                        sale={selectedSale}
                        onSuccess={() => {
                            if (activeTab === 'receipts') loadSales();
                            else loadSummary(); // Reload summary if return happens? (Actually returns might affect summary in future, but for now simple reload)
                            setReturnModalOpen(false);
                            setSelectedSale(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
