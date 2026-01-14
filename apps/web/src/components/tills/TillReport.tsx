"use client";

import { formatCurrency } from '@/lib/useAuth';
import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';

interface TillReportProps {
    data: any;
    onClose: () => void;
}

export function TillReport({ data, onClose }: TillReportProps) {
    const componentRef = useRef<HTMLDivElement>(null);
    const { session, summary, sales } = data;
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Lock body scroll
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
            // Cleanup stray iframes if any
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(f => {
                if (f.style.top === '-10000px') f.remove();
            });
        };
    }, []);

    const handlePrint = () => {
        window.print();
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="till-report-portal">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    /* Hide EVERYTHING in body */
                    body > * {
                        display: none !important;
                    }
                    /* Show ONLY our portal */
                    body > #till-report-portal {
                        display: flex !important;
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        background: white !important;
                        z-index: 99999 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* 
                       Default Visibility:
                       Ensure children of portal are visible.
                       Note: We do NOT force display:block here to allow flex/grid to work,
                       but we must ensure visibility is on.
                    */
                    body > #till-report-portal * {
                        visibility: visible !important;
                        color: black !important;
                    }
                    
                    /* Explicitly hide style/script tags */
                    body > #till-report-portal style,
                    body > #till-report-portal script {
                        display: none !important;
                    }

                    /* 
                       Header Hiding:
                       High Specificity Selector to override the visibility rule above.
                       (1 ID + 1 Class) > (1 ID + 1 Tag)
                    */
                    #till-report-portal .no-print {
                        display: none !important;
                        visibility: hidden !important;
                    }

                    /* 
                       Wrapper Layout:
                       Reset the max-height and overflow of the card wrapper.
                    */
                    #till-report-portal .print-content {
                        display: block !important;
                        width: 100% !important;
                        overflow: visible !important;
                        height: auto !important;
                        max-height: none !important;
                    }

                    /* 
                       Content Layout:
                       Target the scrollable body specifically to allow it to expand.
                    */
                    #till-report-portal .report-body {
                        display: block !important;
                        overflow: visible !important;
                        height: auto !important;
                        max-height: none !important;
                        flex: none !important;
                    }

                    /* Restore Grid/Flex logic for tables/cards */
                    #till-report-portal .grid {
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 1.5rem !important; /* gap-6 */
                    }
                    #till-report-portal .flex {
                        display: flex !important;
                    }
                    
                    /* Ensure tables print nicely */
                    table {
                        width: 100% !important;
                        display: table !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                    }

                    @page { 
                        margin: 0.5cm; 
                        size: auto;
                    }
                }
            `}} />
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col print-content">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl no-print">
                    <h3 className="text-xl font-bold">Session Report</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                        >
                            <Printer size={16} /> Print
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-black font-bold p-2">✕</button>
                    </div>
                </div>

                {/* Added report-body class for specific targeting */}
                <div className="flex-1 overflow-auto p-8 bg-white report-body" ref={componentRef}>
                    {/* Print Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold mb-1">Till Session Report</h1>
                        <div className="text-sm text-gray-500">
                            {new Date(session.openedAt).toLocaleString()} — {session.closedAt ? new Date(session.closedAt).toLocaleString() : 'Active'}
                        </div>
                        <div className="mt-2 text-sm font-medium">
                            Store: {session.till.storeId.substring(0, 8)}... | User: {session.user?.name || 'Unknown'}
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Cash Handling</h4>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Opening Float</span>
                                <span className="font-mono">{formatCurrency(summary.openingFloat)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-1 text-green-600">
                                <span>+ Cash In</span>
                                <span className="font-mono">{formatCurrency(summary.cashIn)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-1 text-blue-600">
                                <span>+ Cash Sales Collected</span>
                                <span className="font-mono">{formatCurrency(summary.paymentsByMethod?.['CASH'] || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-1 text-orange-600">
                                <span>- Change Given</span>
                                <span className="font-mono">{formatCurrency(summary.totalChangeGiven)}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-1 text-red-600">
                                <span>- Cash Out</span>
                                <span className="font-mono">{formatCurrency(summary.cashOut)}</span>
                            </div>
                            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold">
                                <span>Expected Cash</span>
                                <span className="font-mono">{formatCurrency(summary.closingBalance)}</span>
                            </div>
                            {session.status === 'CLOSED' && (
                                <>
                                    <div className="flex justify-between text-sm mt-1">
                                        <span>Actual Count</span>
                                        <span className="font-mono">{formatCurrency(summary.actualClosingCash)}</span>
                                    </div>
                                    <div className={`flex justify-between text-sm mt-1 font-bold ${summary.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        <span>Variance</span>
                                        <span className="font-mono">{summary.variance > 0 ? '+' : ''}{formatCurrency(summary.variance)}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Sales Summary</h4>
                            <div className="flex justify-between text-sm mb-1 font-bold">
                                <span>Gross Sales Total</span>
                                <span className="font-mono">{formatCurrency(summary.totalSalesValue)}</span>
                            </div>

                            <div className="mt-4">
                                <h5 className="text-xs font-bold text-gray-500 mb-1">Payment Methods</h5>
                                {Object.entries(summary.paymentsByMethod || {}).map(([method, amount]: [string, any]) => (
                                    <div key={method} className="flex justify-between text-sm mb-1">
                                        <span className="capitalize">{method.toLowerCase()}</span>
                                        <span className="font-mono">{formatCurrency(amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sales List */}
                    <h3 className="text-lg font-bold mb-4">Transaction History</h3>
                    <table className="w-full text-left text-sm mb-8">
                        <thead>
                            <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase">
                                <th className="py-2">Time</th>
                                <th className="py-2">Receipt</th>
                                <th className="py-2 text-right">Items</th>
                                <th className="py-2 text-right">Total</th>
                                <th className="py-2 text-right">Payment</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sales.map((sale: any) => (
                                <tr key={sale.id}>
                                    <td className="py-2 text-gray-600">{new Date(sale.createdAt).toLocaleTimeString()}</td>
                                    <td className="py-2 font-mono text-xs">#{sale.id.slice(0, 8)}</td>
                                    <td className="py-2 text-right">{sale.items.length}</td>
                                    <td className="py-2 text-right font-medium">{formatCurrency(sale.total)}</td>
                                    <td className="py-2 text-right text-gray-500">
                                        {sale.payments.map((p: any) => p.method).join(', ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="text-center text-xs text-gray-400 mt-8">
                        Generated by RetailCraft on {new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
