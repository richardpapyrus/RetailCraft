"use client";

import { useAuth, formatCurrency } from '@/lib/useAuth';

// Multi-series chart palette from DESIGN_SYSTEM.md. The order matters: gold and
// clay are only distinguishable at ΔE 12.1 in normal vision (below the 15 floor),
// so they must never land in adjacent slots. Slate and sage sit between them.
const PALETTE = ['#235347', '#B8843A', '#3F5C8A', '#7BA396', '#B3574A'];

// The news feed's warm editorial palette. Validated to the same standard: worst
// adjacent pair is ΔE 26.7 in normal vision, 14.1 under simulated CVD.
const FEED_PALETTE = ['#2A4A3C', '#C05621', '#3A5FA8', '#8A6D3B'];

const TONES = {
    brand: { palette: PALETTE, total: 'text-gray-900', caption: 'text-mid-grey', name: 'text-charcoal', value: 'text-gray-900', pct: 'text-mid-grey', empty: 'text-gray-400' },
    feed: { palette: FEED_PALETTE, total: 'text-feed-ink', caption: 'text-feed-ink3', name: 'text-feed-ink2', value: 'text-feed-ink', pct: 'text-feed-ink3', empty: 'text-feed-ink3' },
};

export default function PaymentMixChart({ breakdown, tone = 'brand' }: {
    breakdown?: Record<string, number>;
    tone?: keyof typeof TONES;
}) {
    const { user } = useAuth();
    const t = TONES[tone] ?? TONES.brand;
    const colors = t.palette;

    const data = Object.entries(breakdown || {})
        .map(([method, amount]) => ({ method, amount: Number(amount) }))
        .filter(d => d.amount > 0)
        .sort((a, b) => b.amount - a.amount);

    const total = data.reduce((sum, d) => sum + d.amount, 0);

    if (data.length === 0) {
        return <div className={`text-center py-12 text-sm ${t.empty}`}>No payments in this period</div>;
    }

    const label = (method: string) => method.replace(/_/g, ' ').toLowerCase();

    return (
        <div className="flex flex-col gap-5">
            <div className={`text-sm font-semibold ${t.total}`}>
                {formatCurrency(total, user?.currency, user?.locale)}
                <span className={`text-xs font-medium ml-2 ${t.caption}`}>taken in this period</span>
            </div>

            {/* A single part-to-whole bar. The 2px gaps separate segments without
                drawing borders around them. */}
            <div className="flex gap-0.5 h-3.5">
                {data.map((d, i) => (
                    <span
                        key={d.method}
                        title={`${label(d.method)} · ${formatCurrency(d.amount, user?.currency, user?.locale)}`}
                        className="rounded-sm first:rounded-l-full last:rounded-r-full"
                        style={{
                            flexGrow: d.amount,
                            flexBasis: 0,
                            minWidth: '3px',
                            backgroundColor: colors[i % colors.length],
                        }}
                    />
                ))}
            </div>

            <div className="flex flex-col gap-3">
                {data.map((d, i) => (
                    <div key={d.method} className="flex items-center gap-2.5 text-sm min-w-0">
                        <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: colors[i % colors.length] }}
                        />
                        <span className={`font-medium capitalize truncate flex-1 ${t.name}`}>{label(d.method)}</span>
                        <span className={`font-semibold shrink-0 ${t.value}`}>
                            {formatCurrency(d.amount, user?.currency, user?.locale)}
                        </span>
                        <span className={`text-xs w-9 text-right shrink-0 tabular-nums ${t.pct}`}>
                            {total > 0 ? Math.round((d.amount / total) * 100) : 0}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
