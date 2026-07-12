"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import { BarChart, Bar, Cell, PieChart, Pie, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { api, API_URL } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';

// Chart palette per DESIGN_SYSTEM.md — green, gold, clay, slate blue, sage.
const PALETTE = ['#235347', '#B8843A', '#B3574A', '#3F5C8A', '#7BA396', '#A9B0B0'];

// NOTE ON PRINT STYLES: globals.css ships aggressive 80mm thermal-receipt
// print CSS that hides the body and any element carrying certain classes
// (.bg-white, .rounded, .rounded-lg, .shadow*, .absolute, header/nav/aside…)
// or inline styles containing "left"/"right"/"bottom"/"z-index"/"box-shadow".
// This page must coexist with that: everything inside #eod-report-root avoids
// those classes and inline-style substrings entirely, restores visibility via
// its own rule, and re-declares @page as A4 (later in document order wins).

function EODReportContent() {
    const router = useRouter();
    const search = useSearchParams();
    const { user, token, isHydrated } = useAuth();

    const today = new Date().toISOString().split('T')[0];
    const from = search.get('from') || today;
    const to = search.get('to') || from;
    const storeId = search.get('storeId') || undefined;
    const storeName = search.get('store') || undefined;
    const isSingleDay = from === to;

    const [stats, setStats] = useState<any>(null);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<{ name: string; revenue: number; quantity: number }[]>([]);
    const [hourly, setHourly] = useState<{ hour: number; revenue: number; count: number }[]>([]);
    const [staff, setStaff] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatedAt] = useState(() => new Date());
    const [logoError, setLogoError] = useState(false);

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) { router.push('/login'); return; }
        const hasAccess = user?.permissions?.includes('VIEW_DASHBOARD') || user?.permissions?.includes('*') || user?.role === 'ADMIN' || user?.role === 'Administrator';
        if (!hasAccess) router.replace('/pos');
    }, [token, isHydrated, router, user]);

    useEffect(() => {
        if (!isHydrated || !token) return;
        let cancelled = false;
        // Each fetch fails soft so a partial report still renders.
        Promise.all([
            api.sales.stats(from, to, storeId).catch(() => null),
            api.sales.topProducts({ from, to, sortBy: 'value', limit: 10, storeId }).catch(() => null),
            api.sales.categoryBreakdown(from, to, storeId).catch(() => null),
            api.sales.hourlyHeatmap(from, to, storeId).catch(() => null),
            api.sales.staffLeaderboard(from, to, storeId).catch(() => null),
        ]).then(([s, tp, cat, heat, sl]) => {
            if (cancelled) return;
            setStats(s);
            setTopProducts(tp?.data || []);
            setCategories(cat || []);
            // Collapse (day, hour) cells into a single hour-of-day series.
            const byHour = new Map<number, { revenue: number; count: number }>();
            (heat || []).forEach((c: any) => {
                const cur = byHour.get(c.hour) || { revenue: 0, count: 0 };
                byHour.set(c.hour, { revenue: cur.revenue + c.revenue, count: cur.count + c.count });
            });
            setHourly(Array.from({ length: 24 }, (_, h) => ({ hour: h, ...(byHour.get(h) || { revenue: 0, count: 0 }) })));
            setStaff(sl || []);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [isHydrated, token, from, to, storeId]);

    const fmt = (v: number) => formatCurrency(v || 0, user?.currency, user?.locale);
    const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const f = stats?.filtered;
    const c = stats?.comparison;
    const margin = f?.revenue > 0 ? (f.profit / f.revenue) * 100 : 0;
    const avgBasket = f?.count > 0 ? f.revenue / f.count : 0;

    const delta = (cur?: number, prev?: number) => {
        if (!prev || prev === 0 || cur === undefined) return null;
        return ((cur - prev) / Math.abs(prev)) * 100;
    };

    const payments = useMemo(() => {
        const entries = Object.entries(f?.paymentBreakdown || {}) as [string, number][];
        const total = entries.reduce((s, [, v]) => s + v, 0);
        return entries
            .map(([method, amount], i) => ({ method: method.replace(/_/g, ' '), amount, pct: total > 0 ? (amount / total) * 100 : 0, color: PALETTE[i % PALETTE.length] }))
            .sort((a, b) => b.amount - a.amount);
    }, [f]);

    const maxCategory = Math.max(1, ...categories.map(cat => cat.revenue));
    const hasHourlyData = hourly.some(h => h.revenue > 0);
    const logoSrc = user?.tenantLogo ? (user.tenantLogo.startsWith('http') ? user.tenantLogo : `${API_URL}${user.tenantLogo}`) : null;

    const kpis = f ? [
        { label: 'Gross Revenue', value: fmt(f.revenue), delta: delta(f.revenue, c?.revenue), accent: PALETTE[0] },
        { label: 'Est. Profit', value: fmt(f.profit), delta: delta(f.profit, c?.profit), accent: PALETTE[0] },
        { label: 'Margin', value: `${margin.toFixed(1)}%`, delta: null, accent: PALETTE[1] },
        { label: 'Transactions', value: String(f.count || 0), delta: delta(f.count, c?.count), accent: PALETTE[1] },
        { label: 'Avg. Basket', value: fmt(avgBasket), delta: null, accent: PALETTE[3] },
        { label: 'Tax Collected', value: fmt(f.tax), delta: null, accent: PALETTE[3] },
        { label: 'Discounts Given', value: fmt(f.totalDiscount), delta: null, accent: PALETTE[2] },
        { label: 'Refunds Processed', value: fmt(f.totalRefund), delta: null, accent: PALETTE[2] },
    ] : [];

    if (!isHydrated || loading) {
        return <div className="min-h-screen bg-canvas flex items-center justify-center text-sm text-gray-400">Preparing report…</div>;
    }

    return (
        <div className="min-h-screen bg-canvas">
            <style>{`
                #eod-report-root { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                @media print {
                    @page { size: A4 portrait; margin: 10mm 12mm; }
                    #eod-report-root, #eod-report-root * { visibility: visible !important; }
                    #eod-report-root { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
                    .eod-screen-only { display: none !important; }
                    .eod-avoid-break { break-inside: avoid; page-break-inside: avoid; }
                }
            `}</style>

            {/* Screen-only toolbar — lives outside #eod-report-root so the global print CSS hides it. */}
            <div className="eod-screen-only max-w-[840px] mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
                <button onClick={() => router.push('/dashboard')} className="btn-ghost">
                    <ArrowLeft size={16} /> Back to Dashboard
                </button>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-mid-grey font-medium hidden sm:block">Use “Save as PDF” in the print dialog to download</span>
                    <button onClick={() => window.print()} className="btn-primary">
                        <Printer size={16} /> Print / Save as PDF
                    </button>
                </div>
            </div>

            <div id="eod-report-root" className="max-w-[840px] mx-auto mb-16 rounded-2xl shadow-card overflow-hidden" style={{ background: '#FFFFFF' }}>
                {/* Masthead */}
                <div className="eod-avoid-break px-10 py-8" style={{ background: '#235347' }}>
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            {logoSrc && !logoError ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoSrc} alt={user?.tenantName || ''} onError={() => setLogoError(true)}
                                    className="h-14 w-14 object-contain rounded-xl" style={{ background: '#FFFFFF', padding: '6px' }} />
                            ) : (
                                <div className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl font-semibold uppercase" style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}>
                                    {user?.tenantName?.[0] || 'R'}
                                </div>
                            )}
                            <div>
                                <div className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>{user?.tenantName || 'RetailCraft'}</div>
                                <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>{storeName || 'All Locations'}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-semibold tracking-tight" style={{ color: '#FFFFFF' }}>
                                {isSingleDay ? 'End of Day Report' : 'Sales Performance Report'}
                            </div>
                            <div className="text-sm font-medium mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                {isSingleDay ? fmtDate(from) : `${fmtDate(from)} — ${fmtDate(to)}`}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-10 py-8">
                    {!f ? (
                        <div className="text-center py-20 text-gray-400 text-sm">Could not load sales data for this period.</div>
                    ) : (
                        <>
                            {/* KPI tiles */}
                            <div className="eod-avoid-break grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                                {kpis.map(kpi => (
                                    <div key={kpi.label} className="rounded-xl p-4" style={{ background: '#FAFAFA', border: '1px solid #ECEFEF' }}>
                                        <div className="h-1 w-8 rounded-full mb-3" style={{ background: kpi.accent }} />
                                        <div className="text-[10px] font-semibold text-mid-grey uppercase tracking-widest mb-1">{kpi.label}</div>
                                        <div className="text-lg font-semibold text-gray-900 tracking-tight">{kpi.value}</div>
                                        {kpi.delta !== null && Number.isFinite(kpi.delta) && (
                                            <div className={`flex items-center gap-1 text-[11px] font-semibold mt-1 ${kpi.delta >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                                                {kpi.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                {Math.abs(kpi.delta).toFixed(1)}% vs previous period
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Payment mix + categories */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                <div className="eod-avoid-break">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest mb-4" style={{ borderBottom: '2px solid #235347', paddingBottom: '8px' }}>Payment Mix</h3>
                                    {payments.length === 0 ? (
                                        <div className="text-sm text-gray-400 py-8 text-center">No payments recorded</div>
                                    ) : (
                                        <div className="flex items-center gap-6">
                                            <PieChart width={170} height={170}>
                                                <Pie data={payments} dataKey="amount" nameKey="method" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="none">
                                                    {payments.map((p, i) => <Cell key={i} fill={p.color} />)}
                                                </Pie>
                                            </PieChart>
                                            <div className="flex-1 flex flex-col gap-2.5">
                                                {payments.map(p => (
                                                    <div key={p.method} className="flex items-center gap-2 text-sm">
                                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                                                        <span className="text-charcoal font-medium capitalize flex-1">{p.method.toLowerCase()}</span>
                                                        <span className="text-gray-900 font-semibold">{fmt(p.amount)}</span>
                                                        <span className="text-mid-grey font-medium w-12 text-right">{p.pct.toFixed(0)}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="eod-avoid-break">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest mb-4" style={{ borderBottom: '2px solid #B8843A', paddingBottom: '8px' }}>Revenue by Category</h3>
                                    {categories.length === 0 ? (
                                        <div className="text-sm text-gray-400 py-8 text-center">No category data</div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {categories.slice(0, 8).map((cat, i) => (
                                                <div key={cat.name}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-charcoal font-medium">{cat.name}</span>
                                                        <span className="text-gray-900 font-semibold">{fmt(cat.revenue)}</span>
                                                    </div>
                                                    <div className="h-2 rounded-full" style={{ background: '#F3F3F3' }}>
                                                        <div className="h-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length], width: `${Math.max(2, (cat.revenue / maxCategory) * 100)}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Hourly revenue */}
                            {hasHourlyData && (
                                <div className="eod-avoid-break mb-10">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest mb-4" style={{ borderBottom: '2px solid #3F5C8A', paddingBottom: '8px' }}>
                                        Revenue by Hour{isSingleDay ? '' : ' (period total)'}
                                    </h3>
                                    <BarChart width={700} height={200} data={hourly} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEFEF" />
                                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#A9B0B0' }} tickLine={false} axisLine={{ stroke: '#DCE3E3' }} interval={1} />
                                        <YAxis tick={{ fontSize: 10, fill: '#A9B0B0' }} tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => new Intl.NumberFormat(user?.locale, { notation: 'compact' }).format(v)} />
                                        <Tooltip formatter={(v: any) => fmt(Number(v))} labelFormatter={(h: any) => `${h}:00 — ${h}:59`} />
                                        <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                                            {hourly.map((h, i) => <Cell key={i} fill={h.revenue > 0 ? '#235347' : '#F3F3F3'} />)}
                                        </Bar>
                                    </BarChart>
                                </div>
                            )}

                            {/* Top products */}
                            {topProducts.length > 0 && (
                                <div className="eod-avoid-break mb-10">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest mb-4" style={{ borderBottom: '2px solid #235347', paddingBottom: '8px' }}>Top Products</h3>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] uppercase tracking-widest text-mid-grey">
                                                <th className="text-left font-semibold py-2">#</th>
                                                <th className="text-left font-semibold py-2">Product</th>
                                                <th className="text-right font-semibold py-2">Qty Sold</th>
                                                <th className="text-right font-semibold py-2">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topProducts.map((p, i) => (
                                                <tr key={p.productId} style={{ borderTop: '1px solid #F3F3F3' }}>
                                                    <td className="py-2.5 text-mid-grey font-medium">{i + 1}</td>
                                                    <td className="py-2.5 text-charcoal font-medium">{p.name}{p.sku ? <span className="text-mid-grey font-normal"> · {p.sku}</span> : null}</td>
                                                    <td className="py-2.5 text-right text-charcoal">{p.quantity}</td>
                                                    <td className="py-2.5 text-right font-semibold text-gray-900">{fmt(p.value)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Staff performance */}
                            {staff.length > 0 && (
                                <div className="eod-avoid-break mb-4">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest mb-4" style={{ borderBottom: '2px solid #B3574A', paddingBottom: '8px' }}>Staff Performance</h3>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] uppercase tracking-widest text-mid-grey">
                                                <th className="text-left font-semibold py-2">Cashier</th>
                                                <th className="text-right font-semibold py-2">Transactions</th>
                                                <th className="text-right font-semibold py-2">Avg. Basket</th>
                                                <th className="text-right font-semibold py-2">Discount Rate</th>
                                                <th className="text-right font-semibold py-2">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {staff.map((s: any) => (
                                                <tr key={s.userId} style={{ borderTop: '1px solid #F3F3F3' }}>
                                                    <td className="py-2.5 text-charcoal font-medium">{s.name}</td>
                                                    <td className="py-2.5 text-right text-charcoal">{s.count}</td>
                                                    <td className="py-2.5 text-right text-charcoal">{fmt(s.avgBasket)}</td>
                                                    <td className="py-2.5 text-right text-charcoal">{(s.discountRate || 0).toFixed(1)}%</td>
                                                    <td className="py-2.5 text-right font-semibold text-gray-900">{fmt(s.revenue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-10 py-5 flex items-center justify-between text-[11px] font-medium text-mid-grey" style={{ background: '#FAFAFA', borderTop: '1px solid #ECEFEF' }}>
                    <span>Generated by {user?.name || user?.email} · {generatedAt.toLocaleString()}</span>
                    <span>Powered by RetailCraft</span>
                </div>
            </div>
        </div>
    );
}

export default function EODReportPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
            <EODReportContent />
        </Suspense>
    );
}
