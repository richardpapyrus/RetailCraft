
import React from 'react';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import ReceiptTemplate from '@/components/pos/ReceiptTemplate';

interface SaleDetailModalProps {
    sale: any;
    onClose: () => void;
    onReturn?: () => void; // Optional if Dashboard doesn't support return yet
}

export function SaleDetailModal({ sale, onClose, onReturn }: SaleDetailModalProps) {
    const { user } = useAuth();
    console.log('[SaleDetailModal] Sale Data:', sale);
    console.log('[SaleDetailModal] Returns:', sale?.returns);


    if (!sale) return null;

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    // Calculate Returns
    const returnsMap = new Map<string, number>();
    let totalRefunded = 0;

    if (sale.returns && Array.isArray(sale.returns)) {
        sale.returns.forEach((ret: any) => {
            totalRefunded += Number(ret.total || 0);
            if (ret.items && Array.isArray(ret.items)) {
                ret.items.forEach((item: any) => {
                    const current = returnsMap.get(item.productId) || 0;
                    returnsMap.set(item.productId, current + item.quantity);
                });
            }
        });
    }

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 print:hidden" onClick={onClose}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex justify-between items-start shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Receipt Details</h2>
                            <p className="text-sm text-gray-500 font-mono">#{sale.id}</p>
                        </div>
                        <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
                            ✕
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1">
                        <div className="mb-6 text-center">
                            <div className="text-sm text-gray-500">{formatDate(sale.createdAt)}</div>
                            <div className="font-bold text-lg mt-1">{sale.customer?.name || 'Walk-In Customer'}</div>
                            {sale.customer?.code && <div className="text-xs text-gray-400 font-mono">{sale.customer.code}</div>}
                        </div>

                        <div className="space-y-4">
                            {sale.items.map((item: any) => {
                                const returnedQty = returnsMap.get(item.productId) || 0;
                                const isReturned = returnedQty > 0;
                                const isFullyReturned = returnedQty >= item.quantity;

                                return (
                                    <div key={item.id} className={`flex justify-between text-sm ${isFullyReturned ? 'opacity-50' : ''}`}>
                                        <div>
                                            <div className={`font-medium text-gray-900 ${isFullyReturned ? 'line-through' : ''}`}>
                                                {item.product.name}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {item.quantity} x {formatCurrency(item.priceAtSale, user?.currency, user?.locale)}
                                            </div>
                                            {isReturned && (
                                                <div className="text-xs text-red-600 font-semibold">
                                                    Returned: {returnedQty}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-medium ${isFullyReturned ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                {formatCurrency(item.quantity * Number(item.priceAtSale), user?.currency, user?.locale)}
                                            </div>
                                            {isReturned && (
                                                <div className="text-xs text-red-600">
                                                    -{formatCurrency(returnedQty * Number(item.priceAtSale), user?.currency, user?.locale)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="border-t border-gray-200 mt-6 pt-4 space-y-2">
                            <div className="flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>{formatCurrency(sale.total, user?.currency, user?.locale)}</span>
                            </div>

                            {totalRefunded > 0 && (
                                <>
                                    <div className="flex justify-between text-sm text-red-600 font-medium">
                                        <span>Refunded</span>
                                        <span>-{formatCurrency(totalRefunded, user?.currency, user?.locale)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg border-t border-dashed pt-2">
                                        <span>Net Total</span>
                                        <span>{formatCurrency(Number(sale.total) - totalRefunded, user?.currency, user?.locale)}</span>
                                    </div>
                                </>
                            )}


                            <div className="flex justify-between text-sm text-gray-500 mt-4">
                                <span>Payment Method</span>
                                <span>{sale.paymentMethod}</span>
                            </div>
                            {sale.payments && sale.payments.length > 0 && (
                                <div className="mt-2 bg-gray-50 p-2 rounded text-xs space-y-1">
                                    {sale.payments.map((p: any, i: number) => (
                                        <div key={i} className="flex justify-between">
                                            <span className="font-bold">{p.method}</span>
                                            <span>{formatCurrency(p.amount, user?.currency, user?.locale)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Cashier</span>
                                <span>{sale.user?.email || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="bg-gray-50 px-6 py-4 flex justify-between shrink-0">
                        {onReturn ? (
                            <button
                                className="px-4 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded font-medium"
                                onClick={onReturn}
                            >
                                Return Items
                            </button>
                        ) : (
                            // Spacer if Return not available
                            <div></div>
                        )}
                        <button
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
                            onClick={() => window.print()}
                        >
                            Print Receipt
                        </button>
                    </div>
                </div>
            </div>

            {/* Hidden Receipt Template for Printing */}
            <ReceiptTemplate sale={sale} user={user} store={user?.store} />
        </>
    );
}
