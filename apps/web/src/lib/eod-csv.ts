import { formatCurrency } from '@/lib/useAuth';

// Builds a CSV export of the End-of-Day summary and triggers a browser
// download. Client-side only — no network call, no email delivery.
export function downloadEODCsv(params: {
    stats: any;
    dateRange: { from: string; to: string };
    storeName?: string;
    user: any;
}) {
    const { stats, dateRange, storeName, user } = params;
    if (!stats?.filtered) return;

    const { revenue, count, tax, profit, totalDiscount, totalRefund, paymentBreakdown } = stats.filtered;
    const money = (v: number) => formatCurrency(v || 0, user?.currency, user?.locale);

    const rows: string[][] = [
        ['End of Day Report'],
        ['Location', storeName || user?.tenantName || 'All Locations'],
        ['From', dateRange.from],
        ['To', dateRange.to],
        ['Generated', new Date().toLocaleString()],
        ['By', user?.name || user?.email || ''],
        [],
        ['Sales Summary'],
        ['Gross Sales', money(revenue)],
        ['Transactions', String(count || 0)],
        ['Tax Collected', money(tax)],
        ['Discounts Given', money(totalDiscount)],
        ['Refunds Processed', money(totalRefund)],
        ['Est. Profit', money(profit)],
        [],
        ['Payment Breakdown'],
        ...Object.entries(paymentBreakdown || {}).map(([method, amount]) => [method, money(amount as number)]),
    ];

    const csv = rows
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eod-report_${dateRange.from}_to_${dateRange.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
