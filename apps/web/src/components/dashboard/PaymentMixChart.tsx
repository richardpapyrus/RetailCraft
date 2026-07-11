"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth, formatCurrency } from '@/lib/useAuth';

// Multi-series chart palette from DESIGN_SYSTEM.md — used whenever a chart has
// more than one series so it doesn't collapse into shades of the brand green.
const PALETTE = ['#235347', '#B8843A', '#B3574A', '#3F5C8A', '#7BA396'];

export default function PaymentMixChart({ breakdown }: { breakdown?: Record<string, number> }) {
    const { user } = useAuth();

    const data = Object.entries(breakdown || {})
        .map(([method, amount]) => ({ method, amount: Number(amount) }))
        .filter(d => d.amount > 0)
        .sort((a, b) => b.amount - a.amount);

    const total = data.reduce((sum, d) => sum + d.amount, 0);

    if (data.length === 0) {
        return <div className="text-center py-12 text-gray-400 text-sm">No payments in this period</div>;
    }

    return (
        <div className="flex items-center gap-6">
            <div className="w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="amount"
                            nameKey="method"
                            innerRadius={38}
                            outerRadius={58}
                            paddingAngle={data.length > 1 ? 2 : 0}
                            strokeWidth={0}
                        >
                            {data.map((_, i) => (
                                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: any) => formatCurrency(Number(value) || 0, user?.currency, user?.locale)}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '12px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5 min-w-0">
                {data.map((d, i) => (
                    <div key={d.method} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                            <span className="font-medium text-gray-600 capitalize truncate">{d.method.replace('_', ' ').toLowerCase()}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="font-semibold text-gray-900">{formatCurrency(d.amount, user?.currency, user?.locale)}</span>
                            <span className="text-xs text-mid-grey w-10 text-right">{total > 0 ? Math.round((d.amount / total) * 100) : 0}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
