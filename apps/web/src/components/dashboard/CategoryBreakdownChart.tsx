"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';

const PALETTE = ['#235347', '#B8843A', '#B3574A', '#3F5C8A', '#7BA396'];

export default function CategoryBreakdownChart({ from, to, storeId }: { from?: string, to?: string, storeId?: string }) {
    const { user } = useAuth();
    const [data, setData] = useState<{ name: string; revenue: number; quantity: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.sales.categoryBreakdown(from, to, storeId)
            .then(res => { if (!cancelled) setData(res || []); })
            .catch(err => { console.error('Failed to load category breakdown', err); if (!cancelled) setData([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [from, to, storeId]);

    if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>;
    if (data.length === 0) return <div className="text-center py-12 text-gray-400 text-sm">No category sales in this period</div>;

    const top = data.slice(0, 6);
    const max = Math.max(...top.map(d => d.revenue), 1);

    return (
        <div className="space-y-3">
            {top.map((d, i) => (
                <div key={d.name}>
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-medium text-gray-700 truncate">{d.name}</span>
                        <span className="text-sm font-semibold text-gray-900 shrink-0 ml-2">{formatCurrency(d.revenue, user?.currency, user?.locale)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max(4, (d.revenue / max) * 100)}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
