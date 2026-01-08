import React from 'react';
import { formatCurrency } from '@/lib/useAuth';

interface ReceiptTemplateProps {
    sale: any;
    user: any;
}

export default function ReceiptTemplate({ sale, user }: ReceiptTemplateProps) {
    if (!sale) return null;


    const store = user?.store || {};
    // Fallback to tenant name if store name is missing, but prefer store name.
    const siteName = store.name || user?.tenantName || user?.tenant?.name || 'My Store';

    // Receipt width: 80mm is standard thermal paper width.
    // Tailwind 'print:block' ensures it only shows when printing.
    return (
        <div id="receipt-print-area" className="hidden print:block w-[78mm] bg-white text-black font-mono text-[12px] leading-tight p-2">

            {/* --- HEADER --- */}
            <div className="text-center mb-4">
                {store.logoUrl && (
                    <div className="flex justify-center mb-3">
                        {/* Ensure image is black/white friendly or good contrast */}
                        <img src={store.logoUrl} alt="Logo" className="max-h-12 object-contain" />
                    </div>
                )}

                <h1 className="text-lg font-bold uppercase tracking-wider mb-1">{siteName}</h1>

                <div className="text-[10px] text-gray-800 space-y-0.5">
                    {store.address && <p>{store.address}</p>}
                    {/* Basic fallback if no address data */}
                    {(!store.address && !store.phone) && (
                        <>
                            <p>123 Main Street</p>
                            <p>City, Country</p>
                        </>
                    )}
                    {store.phone && <p>Tel: {store.phone}</p>}
                    {store.email && <p>{store.email}</p>}
                    {store.website && <p>{store.website}</p>}
                </div>

                {store.receiptHeader && (
                    <div className="mt-3 text-[10px] italic border-t border-b border-black py-1 mx-2">
                        {store.receiptHeader}
                    </div>
                )}
            </div>

            {/* --- METADATA --- */}
            <div className="mb-4 text-[10px]">
                <div className="flex justify-between border-b border-black pb-1 mb-1">
                    <div className="text-left">
                        <p>{new Date(sale.date).toLocaleDateString()}</p>
                        <p>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="text-right">
                        <p>Rcpt: #{sale.id?.slice(-6).toUpperCase()}</p>
                        <p>Cashier: {user?.name?.split(' ')[0]}</p>
                    </div>
                </div>
                {sale.customerName && (
                    <p className="font-bold">Customer: {sale.customerName}</p>
                )}
            </div>

            {/* --- ITEMS --- */}
            <div className="mb-4 border-b-2 border-black pb-2">
                <table className="w-full text-left text-[10px]">
                    <thead>
                        <tr className="uppercase border-b border-black">
                            <th className="pb-1 w-[40%]">Item</th>
                            <th className="pb-1 text-right w-[20%]">Price</th>
                            <th className="pb-1 text-center w-[15%]">Qty</th>
                            <th className="pb-1 text-right w-[25%]">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dotted divide-gray-400">
                        {sale.items.map((item: any, idx: number) => (
                            <tr key={idx}>
                                <td className="py-1 pr-1 align-top">
                                    <span className="font-bold block">{item.name}</span>
                                    {item.sku && <span className="text-[9px] text-gray-600 block">{item.sku}</span>}
                                </td>
                                <td className="py-1 text-right align-top">
                                    {formatCurrency(Number(item.price), user?.currency, user?.locale)}
                                </td>
                                <td className="py-1 text-center align-top">{item.cartQty || item.quantity}</td>
                                <td className="py-1 text-right font-bold align-top">
                                    {formatCurrency(Number(item.price) * (item.cartQty || item.quantity), user?.currency, user?.locale)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- TOTALS --- */}
            <div className="mb-6 space-y-1 text-[11px] pr-1">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(sale.total - (sale.tax || 0), user?.currency, user?.locale)}</span>
                </div>

                {sale.discount > 0 && (
                    <div className="flex justify-between text-black">
                        <span>Discount</span>
                        <span>-{formatCurrency(sale.discount, user?.currency, user?.locale)}</span>
                    </div>
                )}

                {sale.tax > 0 && (
                    <div className="flex justify-between">
                        <span>Tax</span>
                        <span>{formatCurrency(sale.tax, user?.currency, user?.locale)}</span>
                    </div>
                )}

                <div className="border-t border-dashed border-black my-1"></div>

                <div className="flex justify-between font-black text-lg my-1">
                    <span>TOTAL</span>
                    <span>{formatCurrency(sale.total, user?.currency, user?.locale)}</span>
                </div>

                <div className="border-b border-black mb-2"></div>

                <div className="flex justify-between font-bold">
                    <span>{sale.paymentMethod || 'CASH'}</span>
                    <span>{formatCurrency(sale.tendered, user?.currency, user?.locale)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Change</span>
                    <span>{formatCurrency(sale.change, user?.currency, user?.locale)}</span>
                </div>

                {sale.redeemPoints > 0 && (
                    <div className="mt-2 text-center text-[10px] border border-black py-1 rounded">
                        Info: {sale.redeemPoints} Pts Redeemed
                    </div>
                )}
            </div>

            {/* --- FOOTER --- */}
            <div className="text-center space-y-3">
                {store.receiptFooter ? (
                    <div className="text-[10px] whitespace-pre-wrap">{store.receiptFooter}</div>
                ) : (
                    <div className="text-[10px] font-bold">Thank you for shopping with us!</div>
                )}

                <div className="mt-4 pt-2">
                    {/* Barcode Simulation */}
                    <div className="flex flex-col items-center">
                        <div className="h-8 w-4/5 bg-black mb-1 repeating-linear-gradient"></div>
                        <p className="text-[8px] font-mono">{sale.id}</p>
                    </div>
                </div>

                <div className="text-[8px] text-gray-500 mt-2 uppercase tracking-tighter">
                    RetaiLogic POS
                </div>
            </div>
        </div>
    );
}
