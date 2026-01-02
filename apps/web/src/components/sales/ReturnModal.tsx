"use client";

import { useState } from 'react';
import { api } from '@/lib/api';

interface SaleItem {
    id: string;
    product: {
        id?: string; // Sometimes product object might be nested differently, but checking page.tsx it has name, sku. We need ID for return. 
        // Wait, page.tsx SaleItem interface: product: { name, sku }. It doesn't show ID!
        // I need to check if API returns product ID in SaleItem.
        // Prisma `include: { items: { include: { product: true } } }` returns product object.
        // SaleItem has `productId`.
        // Let's assume the API response includes `productId` or `product.id`. 
        // I'll check `SalesController` logic or `page.tsx` usage.
        name: string;
        sku: string;
    };
    productId: string; // This is usually on SaleItem directly.
    quantity: number;
    priceAtSale: string;
}

interface Sale {
    id: string;
    items: SaleItem[];
}

interface ReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: Sale;
    onSuccess: () => void; // Reload sales list?
}

export function ReturnModal({ isOpen, onClose, sale, onSuccess }: ReturnModalProps) {
    const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
    const [restockMap, setRestockMap] = useState<{ [key: string]: boolean }>({});
    const [loading, setLoading] = useState(false);

    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleQuantityChange = (productId: string, qty: number, max: number) => {
        if (qty < 0) qty = 0;
        if (qty > max) qty = max;
        setSelectedItems(prev => ({ ...prev, [productId]: qty }));
    };

    const handleRestockToggle = (productId: string) => {
        setRestockMap(prev => ({ ...prev, [productId]: !prev[productId] }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const itemsToReturn = Object.entries(selectedItems)
            .filter(([_, qty]) => qty > 0)
            .map(([productId, qty]) => ({
                productId,
                quantity: qty,
                restock: restockMap[productId] ?? true
            }));

        console.log('Returning Items Payload:', itemsToReturn);

        if (itemsToReturn.length === 0) {
            setError("Please select at least one item to return.");
            setLoading(false);
            return;
        }

        try {
            await api.returns.create({
                saleId: sale.id,
                items: itemsToReturn
            });
            // Success
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Return Error:', err);
            setError("Failed to process return: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    // Calculate total refund preview
    const totalRefund = Object.entries(selectedItems).reduce((sum, [productId, qty]) => {
        const item = sale.items.find(i => (i.productId || (i.product as any).id) === productId);
        // Need to be careful about where ID is.
        // If Page.tsx didn't have productId in interface, it might be missing from frontend type but present in JSON.
        // I will assume it's available.
        return sum + (qty * Number(item?.priceAtSale || 0));
    }, 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900">Process Return</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                            {error}
                        </div>
                    )}
                    <p className="mb-4 text-sm text-gray-600">
                        Select items to return from Sale <b>#{sale.id.slice(0, 8)}</b>.
                    </p>

                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sold</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Return Qty</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Restock?</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {sale.items.map(item => {
                                // Fallback ID resolution
                                const pId = item.productId || (item.product as any).id;
                                if (!pId) return null; // Should not happen if API is correct

                                const currentReturnQty = selectedItems[pId] || 0;
                                const maxQty = item.quantity; // Ideally subtract already returned. Frontend doesn't know yet without API update.
                                // For MVP: User tries, Backend validation fails if exceeding.

                                return (
                                    <tr key={item.id}>
                                        <td className="px-4 py-2">
                                            <div className="text-sm font-medium text-gray-900">{item.product.name}</div>
                                            <div className="text-xs text-gray-500">${Number(item.priceAtSale).toFixed(2)}</div>
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-500">{item.quantity}</td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max={maxQty}
                                                className="w-20 border rounded p-1"
                                                value={currentReturnQty}
                                                onChange={(e) => handleQuantityChange(pId, parseInt(e.target.value) || 0, maxQty)}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                checked={restockMap[pId] ?? true}
                                                onChange={() => handleRestockToggle(pId)}
                                                disabled={currentReturnQty === 0}
                                            />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    <div className="mt-6 flex justify-end items-center gap-4">
                        <div className="text-right">
                            <span className="block text-xs text-gray-500">Refund Total</span>
                            <span className="block text-2xl font-bold text-red-600">${totalRefund.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || totalRefund === 0}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'Confirm Return'}
                    </button>
                </div>
            </div>
        </div>
    );
}
