'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import ReceiptTemplate from '@/components/pos/ReceiptTemplate';
import { X, Printer, RotateCcw } from 'lucide-react';

interface SaleDetailModalProps {
    sale: any;
    onClose: () => void;
    onReturn?: () => void; // Optional if Dashboard doesn't support return yet
}

export function SaleDetailModal({ sale, onClose, onReturn }: SaleDetailModalProps) {
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Close on Escape for quick keyboard dismissal
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

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

    const panel = (
        <div className="fixed inset-0 z-[60] print:hidden">
            {/* Subtle backdrop — dims context without a heavy grey-out */}
            <div
                className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Right-side slide-in panel — anchored to the viewport, always in view */}
            <div
                role="dialog"
                aria-modal="true"
                className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-lifted rounded-l-2xl flex flex-col animate-slide-in-right"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-start shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Receipt Details</h2>
                        <p className="text-xs text-mid-grey font-mono truncate mt-0.5">#{sale.id}</p>
                    </div>
                    <button
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors shrink-0"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-6 text-center">
                        <div className="text-sm text-mid-grey">{formatDate(sale.createdAt)}</div>
                        <div className="font-semibold text-lg text-gray-900 mt-1">{sale.customer?.name || 'Walk-In Customer'}</div>
                        {sale.customer?.code && <div className="text-xs text-mid-grey font-mono">{sale.customer.code}</div>}
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

                    <div className="border-t border-gray-100 mt-6 pt-4 space-y-2">
                        <div className="flex justify-between font-semibold text-lg text-gray-900">
                            <span>Total</span>
                            <span>{formatCurrency(sale.total, user?.currency, user?.locale)}</span>
                        </div>

                        {totalRefunded > 0 && (
                            <>
                                <div className="flex justify-between text-sm text-red-600 font-medium">
                                    <span>Refunded</span>
                                    <span>-{formatCurrency(totalRefunded, user?.currency, user?.locale)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-lg border-t border-dashed border-gray-200 pt-2 text-gray-900">
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
                            <div className="mt-2 bg-surface-muted p-3 rounded-xl text-xs space-y-1">
                                {sale.payments.map((p: any, i: number) => (
                                    <div key={i} className="flex justify-between">
                                        <span className="font-semibold">{p.method}</span>
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
                <div className="bg-canvas px-6 py-4 flex justify-between items-center gap-3 shrink-0 border-t border-gray-100">
                    {onReturn ? (
                        <button
                            className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-semibold transition-colors"
                            onClick={onReturn}
                        >
                            <RotateCcw size={16} />
                            Return Items
                        </button>
                    ) : (
                        // Spacer if Return not available
                        <div></div>
                    )}
                    <button
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 text-sm font-semibold shadow-soft transition-colors"
                        onClick={() => window.print()}
                    >
                        <Printer size={16} />
                        Print Receipt
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Portal to body so the panel is anchored to the viewport, not the
                scrolling page (ancestor transforms would otherwise trap it). */}
            {mounted ? createPortal(panel, document.body) : null}

            {/* Hidden Receipt Template for Printing */}
            <ReceiptTemplate sale={sale} user={user} store={user?.store} />
        </>
    );
}
