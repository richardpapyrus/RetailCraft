
"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { Plus, Eye, Truck, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

export default function PurchaseOrdersPage() {
    const { token, isHydrated, selectedStoreId, hasPermission } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (!isHydrated || !token) return;
        setCurrentPage(1); // Reset to first page when store changes
        loadOrders();
    }, [token, isHydrated, selectedStoreId]);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const data = await api.purchaseOrders.list(undefined, selectedStoreId || undefined);
            setOrders(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'bg-gray-100 text-gray-800';
            case 'SENT': return 'bg-blue-100 text-blue-800';
            case 'PARTIALLY_RECEIVED': return 'bg-yellow-100 text-yellow-800';
            case 'FULLY_RECEIVED': return 'bg-green-100 text-green-800';
            case 'CLOSED': return 'bg-gray-800 text-white';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, orders.length);
    const paginatedOrders = orders.slice(startIndex, endIndex);

    if (loading) return <div className="p-8">Loading Orders...</div>;

    return (
        <div className="flex flex-col h-full bg-gray-50 p-6 overflow-auto">
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Purchase Orders</h1>
                        <p className="text-sm text-gray-500">Manage procurement and stock replenishment</p>
                    </div>
                    {hasPermission('RAISE_PURCHASE_ORDER') && (
                        <button
                            onClick={() => router.push('/inventory/purchase-orders/new')}
                            className="flex items-center bg-brand-500 text-white px-4 py-2 rounded-xl hover:bg-brand-600"
                        >
                            <Plus className="w-5 h-5 mr-2" /> New Order
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-4">PO #</th>
                                <th className="p-4">Supplier</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Total</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {paginatedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        No active purchase orders.
                                    </td>
                                </tr>
                            ) : (
                                paginatedOrders.map(po => (
                                    <tr key={po.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-mono font-medium text-brand-600">{po.poNumber}</td>
                                        <td className="p-4">{po.supplier?.name}</td>
                                        <td className="p-4 text-gray-600">{new Date(po.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(po.status)}`}>
                                                {po.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono">
                                            {Number(po.totalAmount).toLocaleString('en-US', { style: 'currency', currency: po.supplier?.currency || 'USD' })}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button
                                                onClick={() => router.push(`/inventory/purchase-orders/${po.id}`)}
                                                className="text-gray-600 hover:text-brand-600 p-1"
                                                title="View Details"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                            {['SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && hasPermission('RECEIVE_GOODS') && (
                                                <button
                                                    onClick={() => router.push(`/inventory/purchase-orders/${po.id}/receive`)}
                                                    className="text-brand-600 hover:text-brand-800 p-1"
                                                    title="Receive Goods (GRN)"
                                                >
                                                    <Truck className="w-5 h-5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Footer */}
                    {orders.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                            <p className="text-sm text-gray-600">
                                Showing <span className="font-semibold">{startIndex + 1}</span>–<span className="font-semibold">{endIndex}</span> of{' '}
                                <span className="font-semibold">{orders.length}</span> orders
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Previous
                                </button>
                                <span className="text-sm text-gray-600 font-medium px-2">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
