"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';

const HOUR_LABELS = [0, 4, 8, 12, 16, 20];

// Diverging scale anchors: clay red below average, brand green above.
const RED = '179, 87, 74';    // #B3574A
const GREEN = '35, 83, 71';   // #235347

interface Cell { day: number; hour: number; revenue: number; count: number }
interface Baseline { avgHourlyRevenue: number; tradingHours: number; coverageDays: number; isFullYear: boolean }

// Renders the 7 full days preceding today plus a live "Today" row, regardless
// of the dashboard's selected date range. Today is fetched separately because
// the API buckets by weekday — an 8-day window would merge today with the same
// weekday one week ago.
//
// Every cell is coloured against a FIXED long-term benchmark: the average revenue
// per trading hour over the rolling 12 months ending last midnight (see
// GET /sales/hourly-baseline, computed once a day server-side). Because the
// benchmark doesn't move with the visible window, a given shade means the same
// thing today as it did last month. The scale is fixed at ±100%: full red at zero
// revenue, neutral at the benchmark, full green at 2× the benchmark or better.
// Hours with no sales stay neutral grey so closed hours don't read as
// underperformance; today's future hours render faint until they pass, and the
// in-progress hour is shown live (it will read low until the hour fills out).
//
// If the baseline is unavailable — API not yet deployed, or a tenant with no
// completed history before today — we fall back to averaging the visible window
// so the heatmap still renders something meaningful.
export default function HourlyHeatmap({ storeId }: { storeId?: string }) {
    const { user } = useAuth();
    const [pastCells, setPastCells] = useState<Cell[]>([]);
    const [todayCells, setTodayCells] = useState<Cell[]>([]);
    const [baseline, setBaseline] = useState<Baseline | null>(null);
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
                // Refetched on each tick so the benchmark rolls over correctly on a
                // dashboard left open past midnight; it's a cache hit server-side.
                api.sales.hourlyBaseline(storeId).catch(() => null),
            ])
                .then(([past, today, base]) => {
                    if (cancelled) return;
                    setPastCells(past || []);
                    setTodayCells(today || []);
                    setBaseline(base && base.avgHourlyRevenue > 0 ? base : null);
                })
                .catch(err => {
                    console.error('Failed to load hourly heatmap', err);
                    if (!cancelled) { setPastCells([]); setTodayCells([]); setBaseline(null); }
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

    // Fallback benchmark, used only when the 12-month baseline is unavailable:
    // completed hours with sales across the visible window (the in-progress hour is
    // excluded since it's partial).
    const completedToday = todayCells.filter(c => c.hour < currentHour && c.count > 0);
    const active = [...pastCells.filter(c => c.count > 0), ...completedToday];
    const hasAnyData = active.length > 0 || todayCells.some(c => c.count > 0);
    const windowAvg = active.length > 0 ? active.reduce((s, c) => s + c.revenue, 0) / active.length : 0;

    const avg = baseline ? baseline.avgHourlyRevenue : windowAvg;

    const cellAt = (cells: Cell[], day: number, hour: number) => cells.find(c => c.day === day && c.hour === hour);

    // Fixed ±100% diverging scale anchored on `avg`: 0 revenue is full red, exactly
    // the benchmark is neutral, 2× the benchmark or more is full green.
    const cellColor = (cell?: Cell) => {
        if (!cell || cell.count === 0) return 'var(--rc-surface-muted, #F3F3F3)';
        if (avg <= 0) return `rgba(${GREEN}, 0.5)`;
        const diff = cell.revenue - avg;
        const t = Math.min(1, Math.abs(diff) / avg);
        return `rgba(${diff >= 0 ? GREEN : RED}, ${0.2 + t * 0.75})`;
    };

    const benchmarkLabel = baseline
        ? `${formatCurrency(baseline.avgHourlyRevenue, user?.currency, user?.locale)}/hr avg · ${baseline.isFullYear
            ? 'last 12 months'
            : `last ${baseline.coverageDays < 60
                ? `${baseline.coverageDays} days`
                : `${Math.round(baseline.coverageDays / 30)} months`}`}`
        : `${formatCurrency(windowAvg, user?.currency, user?.locale)}/hr avg · last 8 days`;

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
                                                ? `${dayLabel}, ${hour}:00 — ${formatCurrency(cell.revenue, user?.currency, user?.locale)} (${cell.count} sale${cell.count === 1 ? '' : 's'}) · ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs ${baseline ? '12-month' : 'recent'} hourly average${isCurrent ? ' · in progress' : ''}`
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
                        <div className="flex items-center justify-between gap-4 mt-3 text-[10px] font-medium text-mid-grey flex-wrap">
                            <span
                                className="font-semibold text-gray-500"
                                title={baseline
                                    ? `Average revenue per trading hour across ${baseline.tradingHours.toLocaleString()} hours with sales in the rolling 12 months ending last midnight. Recalculated once a day.`
                                    : 'Long-term benchmark unavailable — falling back to the average of the hours shown.'}
                            >
                                Benchmark: {benchmarkLabel}
                            </span>
                            <span className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: `rgba(${RED}, 0.8)` }} />
                                Below benchmark
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: 'var(--rc-surface-muted, #F3F3F3)' }} />
                                No sales
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: `rgba(${GREEN}, 0.8)` }} />
                                Above benchmark
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-[3px] bg-white" style={{ boxShadow: `inset 0 0 0 1.5px rgba(${GREEN}, 0.55)` }} />
                                Current hour
                            </span>
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
