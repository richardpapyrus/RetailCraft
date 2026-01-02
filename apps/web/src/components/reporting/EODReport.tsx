import React from 'react';
import { formatCurrency } from '@/lib/useAuth';

interface EODReportProps {
    stats: any;
    user: any;
    dateRange: { from: string; to: string };
    storeName?: string;
}

export const EODReport = ({ stats, user, dateRange, storeName }: EODReportProps) => {
    if (!stats || !stats.filtered) return null;

    const { revenue, count, tax, profit, paymentBreakdown } = stats.filtered;

    return (
        <div id="receipt-print-area" className="hidden print:block fixed inset-0 bg-white p-0 m-0 z-[200] text-black font-mono">
            <div className="p-4 max-w-[80mm] mx-auto text-center"> {/* 80mm width simulation */}
                <h1 className="text-xl font-bold mb-1">END OF DAY REPORT</h1>
                <p className="text-xs mb-4">{storeName || user?.tenantName || 'All Locations'}</p>

                <div className="border-b border-black border-dashed my-2"></div>

                <div className="flex justify-between text-sm mb-1">
                    <span>From:</span>
                    <span>{dateRange.from}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                    <span>To:</span>
                    <span>{dateRange.to}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                    <span>Printed:</span>
                    <span>{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                    <span>By:</span>
                    <span>{user?.name || user?.email}</span>
                </div>

                <div className="border-b border-black border-dashed my-4"></div>

                <div className="text-left font-bold mb-2">SALES SUMMARY</div>
                <div className="flex justify-between text-sm mb-1">
                    <span>Gross Sales</span>
                    <span>{formatCurrency(revenue, user?.currency, user?.locale)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                    <span>Transactions</span>
                    <span>{count}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                    <span>Tax Collected</span>
                    <span>{formatCurrency(tax, user?.currency, user?.locale)}</span>
                </div>
                {/* Profit might be sensitive, maybe optional? Showing for now as requested by user owners usually */}
                <div className="flex justify-between text-sm mb-1">
                    <span>Est. Profit</span>
                    <span>{formatCurrency(profit, user?.currency, user?.locale)}</span>
                </div>

                <div className="border-b border-black border-dashed my-4"></div>

                <div className="text-left font-bold mb-2">PAYMENT DETAILS</div>
                {paymentBreakdown && Object.entries(paymentBreakdown).map(([method, amount]) => (
                    <div key={method} className="flex justify-between text-sm mb-1">
                        <span>{method}</span>
                        <span>{formatCurrency(amount as number, user?.currency, user?.locale)}</span>
                    </div>
                ))}

                <div className="border-b border-black border-dashed my-4"></div>

                <div className="text-center text-xs mt-4">
                    *** END OF REPORT ***
                </div>
            </div>
        </div>
    );
};
