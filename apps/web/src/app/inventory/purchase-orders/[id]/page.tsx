
"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { ArrowLeft, Truck, CheckCircle, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PODetailPage() {
    const { id } = useParams();
    const { user, token, isHydrated } = useAuth();
    const router = useRouter();
    const [po, setPo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isHydrated || !token) return;
        loadPO();
    }, [id, token, isHydrated]);

    const loadPO = async () => {
        try {
            const data = await api.purchaseOrders.get(id as string);
            setPo(data);
        } catch (e) {
            toast.error("Failed to load PO");
            router.push('/inventory/purchase-orders');
        } finally {
            setLoading(false);
        }
    };

    const [confirmAction, setConfirmAction] = useState<string | null>(null);

    const handleStatusUpdate = (status: string) => {
        setConfirmAction(status);
    };

    const executeStatusUpdate = async () => {
        if (!confirmAction) return;
        const status = confirmAction;
        setConfirmAction(null); // Close modal immediately to prevent double click

        try {
            await api.purchaseOrders.updateStatus(id as string, status);
            toast.success("Status Updated");
            loadPO();
        } catch (e) {
            console.error(e);
            toast.error("Update failed");
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!po) return <div className="p-8">PO Not Found</div>;

    const isReceivable = ['SENT', 'PARTIALLY_RECEIVED'].includes(po.status);
    const isDraft = po.status === 'DRAFT';

    return (
        <div className="flex flex-col h-full bg-gray-50 p-6 overflow-auto">
            <div className="max-w-5xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <button onClick={() => router.push('/inventory/purchase-orders')} className="mr-4 p-2 hover:bg-gray-200 rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{po.poNumber}</h1>
                            <p className="text-sm text-gray-500">
                                {po.supplier?.name} • {new Date(po.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isDraft && (
                            <button
                                onClick={() => handleStatusUpdate('SENT')}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                            >
                                Mark as Sent
                            </button>
                        )}
                        {isReceivable && (
                            <button
                                onClick={() => router.push(`/inventory/purchase-orders/${id}/receive`)}
                                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                            >
                                <Truck className="w-5 h-5 mr-2" /> Receive Goods
                            </button>
                        )}
                        <span className="px-4 py-2 bg-gray-200 rounded font-bold text-gray-700">
                            {po.status.replace('_', ' ')}
                        </span>
                    </div>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Supplier Info */}
                    <div className="bg-white p-6 rounded shadow">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Supplier Details</h3>
                        <div className="font-bold text-lg mb-1">{po.supplier?.name}</div>
                        <div className="text-sm text-gray-600 space-y-1">
                            <div>{po.supplier?.contact}</div>
                            <div>{po.supplier?.email}</div>
                            <div>{po.supplier?.phone}</div>
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div className="bg-white p-6 rounded shadow">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Financials</h3>
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Total Amount</span>
                            <span className="font-bold text-lg">{formatCurrency(po.totalAmount, po.supplier?.currency || user?.currency, user?.locale)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Items</span>
                            <span>{po.items?.length || 0}</span>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="bg-white p-6 rounded shadow">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Receiving Progress</h3>
                        {/* Simple Progress Bar logic */}
                        {(() => {
                            const totalOrdered = po.items.reduce((s: number, i: any) => s + i.quantityOrdered, 0);
                            const totalReceived = po.items.reduce((s: number, i: any) => s + i.quantityReceived, 0);
                            const pct = totalOrdered ? Math.round((totalReceived / totalOrdered) * 100) : 0;

                            return (
                                <div>
                                    <div className="flex justify-between mb-2 font-bold">
                                        <span>{pct}% Received</span>
                                        <span>{totalReceived} / {totalOrdered}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${pct}%` }}></div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded shadow overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-4">Product</th>
                                <th className="p-4 text-center">Ordered</th>
                                <th className="p-4 text-center">Received</th>
                                <th className="p-4 text-center">Pending</th>
                                <th className="p-4 text-right">Unit Cost</th>
                                <th className="p-4 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {po.items.map((item: any) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="font-bold">{item.product.name}</div>
                                        <div className="text-xs text-gray-500">{item.product.sku}</div>
                                    </td>
                                    <td className="p-4 text-center font-medium">{item.quantityOrdered}</td>
                                    <td className="p-4 text-center text-green-600 font-bold">{item.quantityReceived}</td>
                                    <td className="p-4 text-center text-red-500 font-bold">
                                        {Math.max(0, item.quantityOrdered - item.quantityReceived)}
                                    </td>
                                    <td className="p-4 text-right font-mono">
                                        {formatCurrency(item.unitCost, po.supplier?.currency || user?.currency, user?.locale)}
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold">
                                        {formatCurrency(Number(item.unitCost) * item.quantityOrdered, po.supplier?.currency || user?.currency, user?.locale)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* GRN History Section (If any) */}
                {po.grns && po.grns.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-xl font-bold mb-4">Receipt History (GRNs)</h2>
                        <div className="space-y-4">
                            {po.grns.map((grn: any) => (
                                <div key={grn.id} className="bg-white p-4 rounded shadow border-l-4 border-indigo-500">
                                    <div className="flex justify-between">
                                        <div className="font-bold">{grn.grnNumber}</div>
                                        <div className="text-sm text-gray-500">{new Date(grn.receivedDate).toLocaleString()}</div>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-2">
                                        Received by: {grn.receivedBy?.firstName}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {confirmAction && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
                        <h3 className="text-lg font-bold mb-4">Confirm Action</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to mark this PO as <strong>{confirmAction}</strong>?
                            {confirmAction === 'SENT' && " This will verify stock availability."}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeStatusUpdate}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
