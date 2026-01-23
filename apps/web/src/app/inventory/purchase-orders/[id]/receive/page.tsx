
"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ReceivePOPage() {
    const { id } = useParams();
    const { token, isHydrated, selectedStoreId, hasPermission } = useAuth();
    const router = useRouter();
    const [po, setPo] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        if (!isHydrated || !token) return;

        // Security Check
        if (!hasPermission('RECEIVE_GOODS')) {
            toast.error("Permission Denied");
            router.push('/inventory/purchase-orders');
            return;
        }

        loadPO();
    }, [id, token, isHydrated]);

    const loadPO = async () => {
        try {
            const data = await api.purchaseOrders.get(id as string);
            setPo(data);
            // Initialize items state with Ordered Quantity (as clear default)
            setItems(data.items.map((i: any) => ({
                id: i.id,
                productId: i.productId,
                productName: i.product.name,
                ordered: i.quantityOrdered, // Fixed: Schema is quantityOrdered
                receivedSoFar: i.quantityReceived,
                // User Request: Pre-populate with Actual Quantity Ordered
                toReceive: i.quantityOrdered, // Fixed
                costPrice: i.unitCost, // New: Purchase Unit Price
                sellingPrice: i.product.price, // New: Selling Price
                batchNumber: '',
                expiryDate: ''
            })));
        } catch (e) {
            toast.error("Failed to load PO");
            router.push('/inventory/purchase-orders');
        }
    };

    const handleUpdate = (id: string, field: string, value: any) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const handleSubmit = async () => {
        // Filter out 0 quantities? Or allow 0 if they want to skip?
        // Usually filtering > 0 is good.
        const itemsToReceive = items.filter(i => i.toReceive > 0);
        if (itemsToReceive.length === 0) {
            toast.error("No items to receive");
            return;
        }

        try {
            const payload = {
                poId: id,
                storeId: selectedStoreId,
                items: itemsToReceive.map(i => ({
                    productId: i.productId,
                    quantityReceived: Number(i.toReceive),
                    costPrice: Number(i.costPrice),
                    sellingPrice: Number(i.sellingPrice),
                    batchNumber: i.batchNumber || null,
                    expiryDate: i.expiryDate ? new Date(i.expiryDate).toISOString() : null
                }))
            };

            await api.grn.receive(payload as any);
            toast.success("Goods Received Successfully");
            router.push(`/inventory/purchase-orders/${id}`);
        } catch (e: any) {
            toast.error(e.message || "Failed to receive goods");
        }
    };

    if (!po) return <div className="p-8">Loading...</div>;

    return (
        <div className="flex flex-col h-full bg-gray-50 p-6 overflow-auto">
            <div className="max-w-6xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center mb-6">
                    <button onClick={() => router.back()} className="mr-4 p-2 hover:bg-gray-200 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Receive Goods (GRN)</h1>
                        <p className="text-sm text-gray-500">
                            PO #{po.poNumber} • {po.supplier?.name}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-4">Product</th>
                                <th className="p-4 text-center w-28 font-extrabold text-gray-900 border-l border-r">Qty Ordered</th>
                                <th className="p-4 text-center w-24">Prev. Recv</th>
                                <th className="p-4 w-32 border-l">Unit Cost</th>
                                <th className="p-4 w-32">Selling Price</th>
                                <th className="p-4 w-40 border-l bg-indigo-50 text-indigo-900 font-bold">Quantity Received</th>
                                <th className="p-4 w-40">Batch #</th>
                                <th className="p-4 w-40">Expiry Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {items.map(item => (
                                <tr key={item.id} className={item.toReceive > 0 ? 'bg-white' : 'bg-gray-50 opacity-50'}>
                                    <td className="p-4 font-bold">{item.productName}</td>
                                    <td className="p-4 text-center font-extrabold text-gray-900 text-lg border-l border-r bg-gray-50">{item.ordered}</td>
                                    <td className="p-4 text-center text-gray-600">{item.receivedSoFar}</td>
                                    <td className="p-4 border-l">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full p-2 border rounded text-right"
                                            value={item.costPrice}
                                            onChange={e => handleUpdate(item.id, 'costPrice', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-4">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full p-2 border rounded text-right"
                                            value={item.sellingPrice}
                                            onChange={e => handleUpdate(item.id, 'sellingPrice', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-4 border-l bg-indigo-50">
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full p-2 border border-indigo-300 rounded font-bold text-center text-lg focus:ring-2 focus:ring-indigo-500 text-indigo-900"
                                            value={item.toReceive}
                                            onChange={e => handleUpdate(item.id, 'toReceive', Number(e.target.value))}
                                        />
                                    </td>
                                    <td className="p-4">
                                        <input
                                            type="text"
                                            placeholder="Optional"
                                            className="w-full p-2 border rounded text-sm"
                                            value={item.batchNumber}
                                            onChange={e => handleUpdate(item.id, 'batchNumber', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-4">
                                        <input
                                            type="date"
                                            className="w-full p-2 border rounded text-sm"
                                            value={item.expiryDate}
                                            onChange={e => handleUpdate(item.id, 'expiryDate', e.target.value)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="p-6 bg-gray-50 border-t flex justify-end">
                        <button
                            onClick={handleSubmit}
                            className="flex items-center bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg"
                        >
                            <CheckCircle className="w-5 h-5 mr-2" /> Confirm Receipt (GRN)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
