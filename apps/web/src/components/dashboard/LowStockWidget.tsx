"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { AlertTriangle } from 'lucide-react';

export interface ProductStatsSummary {
    totalProducts: number;
    inventoryValue: string;
    lowStockCount: number;
}

// `stats`/`loading` are optional: pass both to render from data the parent has
// already fetched (the dashboard does this so opening the Inventory tab doesn't
// repeat a query the page ran on load). Omit them and the widget fetches for
// itself, which is the original behaviour.
export default function LowStockWidget({ storeId, stats: providedStats, loading: providedLoading }: {
    storeId?: string;
    stats?: ProductStatsSummary | null;
    loading?: boolean;
}) {
    const { user } = useAuth();
    const controlled = providedLoading !== undefined;
    const [ownStats, setOwnStats] = useState<ProductStatsSummary | null>(null);
    const [ownLoading, setOwnLoading] = useState(true);

    useEffect(() => {
        if (controlled) return;
        let cancelled = false;
        setOwnLoading(true);
        api.products.getStats(storeId)
            .then(res => { if (!cancelled) setOwnStats(res); })
            .catch(err => { console.error('Failed to load product stats', err); if (!cancelled) setOwnStats(null); })
            .finally(() => { if (!cancelled) setOwnLoading(false); });
        return () => { cancelled = true; };
    }, [storeId, controlled]);

    const stats = controlled ? (providedStats ?? null) : ownStats;
    const loading = controlled ? providedLoading : ownLoading;

    if (loading) return <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>;
    if (!stats) return <div className="text-center py-8 text-gray-400 text-sm">Unable to load inventory data</div>;

    const hasLowStock = stats.lowStockCount > 0;

    return (
        <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${hasLowStock ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'}`}>
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <div className="text-2xl font-semibold text-gray-900 tracking-tight leading-none">{stats.lowStockCount}</div>
                    <div className="text-xs font-medium text-mid-grey mt-1">item{stats.lowStockCount === 1 ? '' : 's'} below reorder point</div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{formatCurrency(Number(stats.inventoryValue), user?.currency, user?.locale)}</div>
                <div className="text-[10px] font-medium text-mid-grey mt-0.5">inventory value · {stats.totalProducts} SKUs</div>
                {hasLowStock && (
                    <Link href="/products?lowStock=true" className="text-xs font-semibold text-brand-600 hover:text-brand-700 mt-1 inline-block">
                        Review stock →
                    </Link>
                )}
            </div>
        </div>
    );
}
