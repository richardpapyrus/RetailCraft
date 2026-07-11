"use client";

import { Fragment, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = [0, 4, 8, 12, 16, 20];

export default function HourlyHeatmap({ from, to, storeId }: { from?: string, to?: string, storeId?: string }) {
    const { user } = useAuth();
    const [cells, setCells] = useState<{ day: number; hour: number; revenue: number; count: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.sales.hourlyHeatmap(from, to, storeId)
            .then(res => { if (!cancelled) setCells(res || []); })
            .catch(err => { console.error('Failed to load hourly heatmap', err); if (!cancelled) setCells([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [from, to, storeId]);

    if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>;

    const max = Math.max(...cells.map(c => c.revenue), 1);
    const cellAt = (day: number, hour: number) => cells.find(c => c.day === day && c.hour === hour);
    const hasAnyData = cells.some(c => c.count > 0);

    return (
        <div>
            {!hasAnyData ? (
                <div className="text-center py-12 text-gray-400 text-sm">No sales in this period</div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-[560px]">
                        <div className="grid gap-[3px]" style={{ gridTemplateColumns: '32px repeat(24, 1fr)' }}>
                            <div />
                            {Array.from({ length: 24 }).map((_, h) => (
                                <div key={h} className="text-[9px] text-mid-grey text-center font-medium">
                                    {HOUR_LABELS.includes(h) ? h : ''}
                                </div>
                            ))}
                            {DAYS.map((label, day) => (
                                <Fragment key={day}>
                                    <div className="text-[10px] font-semibold text-gray-500 flex items-center">{label}</div>
                                    {Array.from({ length: 24 }).map((_, hour) => {
                                        const cell = cellAt(day, hour);
                                        const intensity = cell ? cell.revenue / max : 0;
                                        return (
                                            <div
                                                key={`${day}-${hour}`}
                                                title={cell ? `${label} ${hour}:00 — ${formatCurrency(cell.revenue, user?.currency, user?.locale)} (${cell.count} sale${cell.count === 1 ? '' : 's'})` : `${label} ${hour}:00 — no sales`}
                                                className="aspect-square rounded-[3px]"
                                                style={{
                                                    backgroundColor: intensity > 0 ? `rgba(35, 83, 71, ${0.12 + intensity * 0.88})` : 'var(--rc-surface-muted, #F3F3F3)',
                                                }}
                                            />
                                        );
                                    })}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
