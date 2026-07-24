"use client";

import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { ExpenseCategoryBreakdown } from '@/lib/api';

/** Supporting palette from DESIGN_SYSTEM.md, for categories without a colour. */
const CHART_PALETTE = ['#235347', '#B8843A', '#B3574A', '#3F5C8A', '#7BA396', '#6B7280', '#8A6BA8', '#2F7A8C'];

const axisTick = { fontSize: 12, fill: '#94a3b8' };

const tooltipStyle = {
    borderRadius: '16px',
    border: 'none',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
    padding: '12px 20px',
};

function shortDate(iso: string) {
    const date = new Date(`${iso}T00:00:00.000Z`);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Daily spend across a period, drawn cumulatively so the line reads as
 * "how much have we spent so far" rather than a noisy per-day sawtooth.
 */
export function ExpenseTrendChart({
    series,
    height = 300,
    cumulative = true,
}: {
    series: { date: string; amount: number }[];
    height?: number;
    cumulative?: boolean;
}) {
    const { user } = useAuth();

    let running = 0;
    const data = (series || []).map(point => {
        running += point.amount;
        return {
            date: point.date,
            label: shortDate(point.date),
            daily: point.amount,
            value: cumulative ? running : point.amount,
        };
    });

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center text-sm text-mid-grey" style={{ height }}>
                No expenses recorded for this period
            </div>
        );
    }

    // With many points, thin the axis labels so they stay legible.
    const tickInterval = Math.max(0, Math.floor(data.length / 8));

    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#235347" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#235347" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={axisTick}
                        dy={10}
                        interval={tickInterval}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={axisTick}
                        width={70}
                        tickFormatter={(value: number) =>
                            formatCurrency(value, user?.currency, user?.locale).replace(/[.,]00$/, '')
                        }
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [
                            formatCurrency(Number(value) || 0, user?.currency, user?.locale),
                            cumulative ? 'Running total' : 'Spent',
                        ]}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#235347"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#expenseGradient)"
                        name="value"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Spend split by category, largest first. */
export function CategoryDonut({
    categories,
    height = 300,
}: {
    categories: ExpenseCategoryBreakdown[];
    height?: number;
}) {
    const { user } = useAuth();
    const data = (categories || []).filter(c => c.amount > 0);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center text-sm text-mid-grey" style={{ height }}>
                No expenses to break down yet
            </div>
        );
    }

    const total = data.reduce((sum, c) => sum + c.amount, 0);

    return (
        <div className="flex flex-col lg:flex-row items-center gap-6">
            <div style={{ height, width: height }} className="shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data as unknown as Record<string, unknown>[]}
                            dataKey="amount"
                            nameKey="name"
                            innerRadius="62%"
                            outerRadius="90%"
                            paddingAngle={2}
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={entry.categoryId}
                                    fill={entry.color || CHART_PALETTE[index % CHART_PALETTE.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value, name) => [
                                formatCurrency(Number(value) || 0, user?.currency, user?.locale),
                                String(name),
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-semibold text-mid-grey uppercase tracking-widest">Total</span>
                    <span className="text-lg font-semibold text-gray-900 tracking-tight">
                        {formatCurrency(total, user?.currency, user?.locale).replace(/[.,]00$/, '')}
                    </span>
                </div>
            </div>

            <ul className="flex-1 w-full space-y-2.5 min-w-0">
                {data.slice(0, 8).map((category, index) => (
                    <li key={category.categoryId} className="flex items-center gap-3">
                        <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: category.color || CHART_PALETTE[index % CHART_PALETTE.length] }}
                        />
                        <span className="text-sm text-charcoal truncate flex-1">{category.name}</span>
                        <span className="text-sm font-semibold text-gray-900 shrink-0">
                            {formatCurrency(category.amount, user?.currency, user?.locale)}
                        </span>
                        <span className="text-xs text-mid-grey w-12 text-right shrink-0">
                            {category.percentage.toFixed(1)}%
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
