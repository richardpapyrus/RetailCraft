
"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { Plus, Eye, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PurchaseOrdersPage() {
    const { token, isHydrated, selectedStoreId } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isHydrated || !token) return;
        loadOrders();
    }, [token, isHydrated, selectedStoreId]);

    const loadOrders = async () => {
        try {
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

    if (loading) return <div className="p-8">Loading Orders...</div>;

    return (
        <div className="flex flex-col h-full bg-gray-50 p-6 overflow-auto">
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
                        <p className="text-sm text-gray-500">Manage procurement and stock replenishment</p>
                    </div>
                    <button
                        onClick={() => router.push('/inventory/purchase-orders/new')}
                        className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                    >
                        <Plus className="w-5 h-5 mr-2" /> New Order
                    </button>
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
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        No active purchase orders.
                                    </td>
                                </tr>
                            ) : (
                                orders.map(po => (
                                    <tr key={po.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-mono font-medium text-indigo-600">{po.poNumber}</td>
                                        <td className="p-4">{po.supplier?.name}</td>
                                        <td className="p-4 text-gray-600">{new Date(po.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(po.status)}`}>
                                                {po.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono">
                                            {Number(po.totalAmount).toLocaleString('en-US', { style: 'currency', currency: po.supplier?.currency || 'USD' })}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button
                                                onClick={() => router.push(`/inventory/purchase-orders/${po.id}`)}
                                                className="text-gray-600 hover:text-indigo-600 p-1"
                                                title="View Details"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                            {['SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                                                <button
                                                    onClick={() => router.push(`/inventory/purchase-orders/${po.id}/receive`)}
                                                    className="text-indigo-600 hover:text-indigo-800 p-1"
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
                </div>
            </div>
        </div>
    );
}
