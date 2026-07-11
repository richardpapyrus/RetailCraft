"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';

const HOUR_LABELS = [0, 4, 8, 12, 16, 20];

// Diverging scale anchors: clay red below average, brand green above.
const RED = '179, 87, 74';    // #B3574A
const GREEN = '35, 83, 71';   // #235347

interface Cell { day: number; hour: number; revenue: number; count: number }

// Renders the 7 full days preceding today plus a live "Today" row, regardless
// of the dashboard's selected date range. Today is fetched separately because
// the API buckets by weekday — an 8-day window would merge today with the same
// weekday one week ago.
//
// Cells are benchmarked against the average hourly revenue of COMPLETED hours
// that had sales (the in-progress hour is shown live but excluded from the
// benchmark since it's partial): redder the further below average, greener the
// further above. Hours with no sales stay neutral grey so closed hours don't
// read as underperformance; today's future hours render faint until they pass.
export default function HourlyHeatmap({ storeId }: { storeId?: string }) {
    const { user } = useAuth();
    const [pastCells, setPastCells] = useState<Cell[]>([]);
    const [todayCells, setTodayCells] = useState<Cell[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const toISO = (d: Date) => d.toISOString().split('T')[0];

        const load = () => {
            const now = new Date();
            const from = new Date(now);
            from.setDate(now.getDate() - 7);
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);

            Promise.all([
                api.sales.hourlyHeatmap(toISO(from), toISO(yesterday), storeId),
                api.sales.hourlyHeatmap(toISO(now), toISO(now), storeId),
            ])
                .then(([past, today]) => {
                    if (cancelled) return;
                    setPastCells(past || []);
                    setTodayCells(today || []);
                })
                .catch(err => {
                    console.error('Failed to load hourly heatmap', err);
                    if (!cancelled) { setPastCells([]); setTodayCells([]); }
                })
                .finally(() => { if (!cancelled) setLoading(false); });
        };

        setLoading(true);
        load();
        // Refresh periodically so today's row fills in as each hour passes.
        const intervalId = setInterval(load, 5 * 60 * 1000);
        return () => { cancelled = true; clearInterval(intervalId); };
    }, [storeId]);

    if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>;

    const now = new Date();
    const currentHour = now.getHours();
    const todayWeekday = now.getDay();

    // The 7 previous calendar days (oldest first), then Today.
    const rows = Array.from({ length: 7 }, (_, idx) => {
        const d = new Date();
        d.setDate(d.getDate() - (7 - idx));
        return {
            weekday: d.getDay(),
            label: d.toLocaleDateString([], { weekday: 'short' }),
            dateLabel: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            isToday: false,
        };
    }).concat([{
        weekday: todayWeekday,
        label: 'Today',
        dateLabel: now.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        isToday: true,
    }]);

    // Benchmark: completed hours with sales — all of the past 7 days, plus
    // today's hours strictly before the current one.
    const completedToday = todayCells.filter(c => c.hour < currentHour && c.count > 0);
    const active = [...pastCells.filter(c => c.count > 0), ...completedToday];
    const hasAnyData = active.length > 0 || todayCells.some(c => c.count > 0);
    const avg = active.length > 0 ? active.reduce((s, c) => s + c.revenue, 0) / active.length : 0;
    const max = active.length > 0 ? Math.max(...active.map(c => c.revenue)) : 0;

    const cellAt = (cells: Cell[], day: number, hour: number) => cells.find(c => c.day === day && c.hour === hour);

    const cellColor = (cell?: Cell) => {
        if (!cell || cell.count === 0) return 'var(--rc-surface-muted, #F3F3F3)';
        if (avg <= 0) return `rgba(${GREEN}, 0.5)`;
        const diff = cell.revenue - avg;
        if (diff >= 0) {
            const t = max > avg ? diff / (max - avg) : 0;
            return `rgba(${GREEN}, ${0.2 + t * 0.75})`;
        }
        const t = Math.min(1, (avg - cell.revenue) / avg);
        return `rgba(${RED}, ${0.2 + t * 0.75})`;
    };

    return (
        <div>
            {!hasAnyData ? (
                <div className="text-center py-12 text-gray-400 text-sm">No sales in the last 7 days</div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-[560px]">
                        <div className="grid gap-[3px]" style={{ gridTemplateColumns: '64px repeat(24, 1fr)' }}>
                            <div />
                            {Array.from({ length: 24 }).map((_, h) => (
                                <div key={h} className="text-[9px] text-mid-grey text-center font-medium">
                                    {HOUR_LABELS.includes(h) ? h : ''}
                                </div>
                            ))}
                            {rows.map((row) => (
                                <div key={`${row.isToday ? 'today' : row.weekday}`} className="contents">
                                    <div className={`text-[10px] font-semibold flex items-center gap-1 pr-1 ${row.isToday ? 'text-brand-700' : 'text-gray-500'}`}>
                                        <span>{row.label}</span>
                                        <span className={`font-medium ${row.isToday ? 'text-brand-300' : 'text-gray-300'}`}>{row.dateLabel}</span>
                                    </div>
                                    {Array.from({ length: 24 }).map((_, hour) => {
                                        const isFuture = row.isToday && hour > currentHour;
                                        const isCurrent = row.isToday && hour === currentHour;
                                        const cell = cellAt(row.isToday ? todayCells : pastCells, row.weekday, hour);
                                        const pct = cell && cell.count > 0 && avg > 0 ? ((cell.revenue - avg) / avg) * 100 : 0;

                                        const dayLabel = `${row.label} ${row.dateLabel}`;
                                        const title = isFuture
                                            ? `${dayLabel}, ${hour}:00 — upcoming`
                                            : cell && cell.count > 0
                                                ? `${dayLabel}, ${hour}:00 — ${formatCurrency(cell.revenue, user?.currency, user?.locale)} (${cell.count} sale${cell.count === 1 ? '' : 's'}) · ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs avg${isCurrent ? ' · in progress' : ''}`
                                                : `${dayLabel}, ${hour}:00 — no sales${isCurrent ? ' yet · in progress' : ''}`;

                                        return (
                                            <div
                                                key={`${row.isToday ? 'today' : row.weekday}-${hour}`}
                                                title={title}
                                                className="aspect-square rounded-[3px]"
                                                style={{
                                                    backgroundColor: isFuture ? 'rgba(243, 243, 243, 0.4)' : cellColor(cell),
                                                    boxShadow: isCurrent ? `inset 0 0 0 1.5px rgba(${GREEN}, 0.55)` : undefined,
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-end gap-4 mt-3 text-[10px] font-medium text-mid-grey">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: `rgba(${RED}, 0.8)` }} />
                                Below hourly average
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: 'var(--rc-surface-muted, #F3F3F3)' }} />
                                No sales
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: `rgba(${GREEN}, 0.8)` }} />
                                Above hourly average
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-[3px] bg-white" style={{ boxShadow: `inset 0 0 0 1.5px rgba(${GREEN}, 0.55)` }} />
                                Current hour
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
