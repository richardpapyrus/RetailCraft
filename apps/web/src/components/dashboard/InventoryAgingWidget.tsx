"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, InventoryAgingReport } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { Hourglass } from 'lucide-react';

export function formatAge(days: number) {
    if (days < 30) return `${days}d`;
    if (days < 365) {
        const months = Math.floor(days / 30);
        const rem = days % 30;
        return rem > 0 ? `${months}mo ${rem}d` : `${months}mo`;
    }
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years}y ${months}mo` : `${years}y`;
}

// Top-10 slice of the aging (dead stock) report. When no store filter is
// active (all-locations view) each row shows which store the stock sits in.
export default function InventoryAgingWidget({ storeId }: { storeId?: string }) {
    const { user } = useAuth();
    const [report, setReport] = useState<InventoryAgingReport | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.inventory.aging({ storeId: storeId || undefined, take: 10 })
            .then(res => { if (!cancelled) setReport(res); })
            .catch(err => { console.error('Failed to load inventory aging', err); if (!cancelled) setReport(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [storeId]);

    if (loading) return <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>;
    if (!report) return <div className="text-center py-8 text-gray-400 text-sm">Unable to load aging data</div>;

    if (report.items.length === 0) {
        return (
            <div className="text-center py-10">
                <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Hourglass size={20} />
                </div>
                <div className="text-sm font-semibold text-gray-900">No stock is sitting idle</div>
                <div className="text-xs font-medium text-mid-grey mt-1">
                    Everything in stock has sold within the last {report.summary.staleDays} days
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <div className="space-y-4">
                {report.items.map((item, idx) => (
                    <div key={`${item.productId}-${item.storeId}`} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-full shrink-0 ${idx < 3 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                                {idx + 1}
                            </span>
                            <div className="min-w-0">
                                <div className="font-semibold text-gray-900 text-sm truncate">{item.name}</div>
                                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                                    <span>{item.sku}</span>
                                    {!storeId && (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            <span className="text-brand-600 normal-case">{item.storeName}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="font-semibold text-gray-900 text-sm">{formatAge(item.ageDays)} old</div>
                            <div className="text-[10px] font-medium text-gray-400">
                                {item.quantity} on hand · {formatCurrency(item.valueTiedUp, user?.currency, user?.locale)} tied up
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between">
                <div className="text-xs font-medium text-mid-grey">
                    {report.summary.totalItems} item{report.summary.totalItems === 1 ? '' : 's'} sitting ·{' '}
                    <span className="font-semibold text-gray-700">
                        {formatCurrency(report.summary.totalValueTiedUp, user?.currency, user?.locale)}
                    </span>{' '}
                    tied up
                </div>
                <Link
                    href="/products/aging"
                    className="text-sm font-semibold text-brand-600 hover:text-brand-800 transition-colors"
                >
                    Full report →
                </Link>
            </div>
        </div>
    );
}
