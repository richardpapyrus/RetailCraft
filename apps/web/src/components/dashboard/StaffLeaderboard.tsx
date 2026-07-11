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

    if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>;
    if (rows.length === 0) return <div className="text-center py-12 text-gray-400 text-sm">No sales in this period</div>;

    return (
        <div className="space-y-1">
            {rows.map((r, idx) => (
                <div key={r.userId} className="flex items-center justify-between py-2 group">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-full shrink-0 ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-50 text-gray-500'}`}>
                            {idx + 1}
                        </span>
                        <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate">{r.name}</div>
                            <div className="text-[10px] font-medium text-gray-400">{r.count} sale{r.count === 1 ? '' : 's'} · avg {formatCurrency(r.avgBasket, user?.currency, user?.locale)}</div>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="font-semibold text-gray-900 text-sm">{formatCurrency(r.revenue, user?.currency, user?.locale)}</div>
                        {r.discountRate > 0 && (
                            <div className="text-[10px] font-medium text-amber-600">{(r.discountRate * 100).toFixed(1)}% discounted</div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
