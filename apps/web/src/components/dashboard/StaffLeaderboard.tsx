"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';

interface StaffRow { userId: string; name: string; revenue: number; count: number; avgBasket: number; discountRate: number }

export default function StaffLeaderboard({ from, to, storeId }: { from?: string, to?: string, storeId?: string }) {
    const { user } = useAuth();
    const [rows, setRows] = useState<StaffRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.sales.staffLeaderboard(from, to, storeId)
            .then(res => { if (!cancelled) setRows((res || []).slice(0, 6)); })
            .catch(err => { console.error('Failed to load staff leaderboard', err); if (!cancelled) setRows([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [from, to, storeId]);

    if (loading) return <div className="text-center py-12 text-mid-grey text-sm">Loading...</div>;
    if (rows.length === 0) return <div className="text-center py-12 text-mid-grey text-sm">No sales in this period</div>;

    return (
        // Hairline-separated rows, no zebra striping — the table pattern from
        // DESIGN_SYSTEM.md. Green is earned: only the top seller's rank chip
        // carries the brand colour, everyone else sits on a neutral chip.
        <div className="divide-y divide-gray-100">
            {rows.map((r, idx) => (
                <div key={r.userId} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-full shrink-0 ${idx === 0 ? 'bg-brand-500 text-white' : 'bg-surface-muted text-charcoal'}`}>
                            {idx + 1}
                        </span>
                        <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate">{r.name}</div>
                            <div className="text-xs font-medium text-mid-grey truncate">{r.count} sale{r.count === 1 ? '' : 's'} · avg {formatCurrency(r.avgBasket, user?.currency, user?.locale)}</div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="font-semibold text-gray-900 text-sm">{formatCurrency(r.revenue, user?.currency, user?.locale)}</div>
                        {r.discountRate > 0 && (
                            <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md">
                                {(r.discountRate * 100).toFixed(1)}% discounted
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
