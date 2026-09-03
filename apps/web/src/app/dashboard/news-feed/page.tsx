"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { api, ExpenseMonthToDate, InventoryAgingReport } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { ArrowLeft, RefreshCw, FileText, Download } from 'lucide-react';
import DateRangePresets from '@/components/dashboard/DateRangePresets';
import PaymentMixChart from '@/components/dashboard/PaymentMixChart';
import HourlyHeatmap from '@/components/dashboard/HourlyHeatmap';
import { formatAge } from '@/components/dashboard/InventoryAgingWidget';

type ProductStats = { totalProducts: number; inventoryValue: string; lowStockCount: number };
type StaffRow = { userId: string; name: string; revenue: number; count: number; avgBasket: number; discountRate: number };
type TopProduct = { productId: string; name: string; sku: string; value: number; quantity: number };

// The serif is loaded per-route in layout.tsx; everything else stays on Inter.
const serif = { fontFamily: 'var(--font-newsreader), Georgia, "Times New Roman", serif' } as const;

const todayISO = () => new Date().toISOString().split('T')[0];

export default function NewsFeedPage() {
    const { user, token, isHydrated, hasPermission, selectedStoreId } = useAuth();
    const router = useRouter();

    const [stats, setStats] = useState<any>(null);
    const [mtd, setMtd] = useState<ExpenseMonthToDate | null>(null);
    const [productStats, setProductStats] = useState<ProductStats | null>(null);
    const [aging, setAging] = useState<InventoryAgingReport | null>(null);
    const [staff, setStaff] = useState<StaffRow[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [refreshNonce, setRefreshNonce] = useState(0);

    // Opens on whatever window the dashboard was showing (the button passes
    // from/to through the URL). Read once, on the first client render — the page
    // returns null until `isHydrated`, so there is no server/client mismatch.
    const [dateRange, setDateRange] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const from = params.get('from');
            const to = params.get('to');
            if (from && to) return { from, to };
        }
        return { from: todayISO(), to: todayISO() };
    });

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        const hasAccess = user?.permissions?.includes('VIEW_DASHBOARD') || user?.permissions?.includes('*') || user?.role === 'ADMIN' || user?.role === 'Administrator';
        if (!hasAccess) router.replace('/pos');
    }, [token, isHydrated, router, user]);

    // One pass, on open. Deliberately no polling: this is a briefing you sit
    // down with, and it pulls from six endpoints at once. The refresh control in
    // the masthead re-runs everything on demand.
    useEffect(() => {
        if (!isHydrated || !token) return;

        let cancelled = false;
        setLoading(true);
        const storeId = selectedStoreId || undefined;
        const { from, to } = dateRange;

        const settle = <T,>(p: Promise<T>, apply: (v: T) => void, fallback: T, label: string) =>
            p.then(v => { if (!cancelled) apply(v); })
                .catch(e => {
                    console.error(`News feed: failed to load ${label}`, e);
                    if (!cancelled) apply(fallback);
                });

        const jobs: Promise<unknown>[] = [
            settle(api.sales.stats(from, to, storeId), setStats, null, 'sales stats'),
            settle(api.products.getStats(storeId), setProductStats, null, 'product stats'),
            settle(api.inventory.aging({ storeId, take: 6 }), setAging, null, 'inventory aging'),
            settle(api.sales.staffLeaderboard(from, to, storeId), v => setStaff(v || []), [], 'staff leaderboard'),
            settle(
                api.sales.topProducts({ from, to, sortBy: 'value', limit: 5, storeId }).then((r: any) => (r?.data || []) as TopProduct[]),
                setTopProducts,
                [],
                'top products'
            ),
        ];

        if (hasPermission('VIEW_EXPENSES')) {
            jobs.push(settle(api.expenses.monthToDate(storeId), setMtd, null, 'month-to-date expenses'));
        }

        Promise.allSettled(jobs).then(() => {
            if (cancelled) return;
            setLoading(false);
            setLastUpdated(new Date());
        });

        return () => { cancelled = true; };
    }, [isHydrated, token, dateRange, selectedStoreId, refreshNonce, hasPermission]);

    const money = (v: number) => formatCurrency(v, user?.currency, user?.locale);
    const compact = (s: string) => s.replace(/([.,]00)(?=\s|$)/, '');

    const revenue = Number(stats?.filtered?.revenue) || 0;
    const profit = Number(stats?.filtered?.profit) || 0;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const count = Number(stats?.filtered?.count) || 0;
    const avgBasket = count > 0 ? revenue / count : 0;
    const prevRevenue = Number(stats?.comparison?.revenue) || 0;
    const revenueDelta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

    const isSingleDay = dateRange.from === dateRange.to;
    const isTodayView = isSingleDay && dateRange.from === todayISO();
    const comparisonLabel = isTodayView
        ? 'this time yesterday'
        : isSingleDay
            ? 'the previous day'
            : 'the previous period';

    const periodLabel = isTodayView
        ? 'today'
        : isSingleDay
            ? new Date(`${dateRange.from}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'long' })
            : 'in this period';

    // The standfirst. Every clause is dropped rather than guessed when the
    // figure behind it is missing, so the sentence never states more than the
    // data supports.
    const headline = useMemo(() => {
        const lead = count > 0
            ? `${compact(money(revenue))} through ${count.toLocaleString()} sale${count === 1 ? '' : 's'} ${periodLabel}`
            : `No sales recorded ${periodLabel}`;

        const gap = revenueDelta === null || revenue === prevRevenue
            ? null
            : {
                text: revenue < prevRevenue
                    ? `running ${compact(money(prevRevenue - revenue))} behind ${comparisonLabel}`
                    : `running ${compact(money(revenue - prevRevenue))} ahead of ${comparisonLabel}`,
                behind: revenue < prevRevenue,
            };

        const shelf = aging && aging.summary.totalValueTiedUp > 0
            ? `${compact(money(aging.summary.totalValueTiedUp))} of stock sitting unsold`
            : null;

        return { lead, gap, shelf };
    }, [count, revenue, prevRevenue, revenueDelta, periodLabel, comparisonLabel, aging, user?.currency, user?.locale]);

    const goToEod = (download?: boolean) => {
        const q = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
        if (download) q.append('download', '1');
        if (selectedStoreId) q.append('storeId', selectedStoreId);
        router.push(`/reports/eod?${q.toString()}`);
    };

    if (!isHydrated) return null;

    const staffMax = Math.max(...staff.map(s => s.revenue), 1);
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'Administrator' || user?.permissions?.includes('*');
    // The store list isn't fetched here, so a store name is only available for
    // non-admins (whose own store is on the session). Everything else falls back
    // to a scope description rather than naming the wrong place.
    const scopeLabel = !isAdmin && user?.store?.name
        ? user.store.name
        : selectedStoreId
            ? 'selected location'
            : 'all locations';

    return (
        <div className="max-w-[1280px] mx-auto px-8 lg:px-16 py-10 lg:py-14 animate-fade-in">

            {/* Masthead */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pb-3 border-b-2 border-feed-ink">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink">
                    {user?.tenantName || user?.tenant?.name || 'RetailCraft'} · {scopeLabel}
                </p>
                <div className="flex items-center gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink3">
                        {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                    <button
                        onClick={() => setRefreshNonce(n => n + 1)}
                        disabled={loading}
                        className="p-1 rounded-lg text-feed-ink3 hover:text-feed-ink2 hover:bg-feed-hair transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Standfirst + controls */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-10 xl:gap-14 pt-8 pb-7 border-b border-feed-rule">
                <div className="flex flex-col gap-4 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink3">The day so far</p>
                    {loading && !stats ? (
                        <div className="flex flex-col gap-3">
                            <div className="skeleton h-8 w-full"></div>
                            <div className="skeleton h-8 w-4/5"></div>
                        </div>
                    ) : (
                        <p style={serif} className="text-[30px] lg:text-[38px] leading-[1.22] font-normal tracking-[-0.015em] text-feed-ink text-pretty">
                            {headline.lead}
                            {headline.gap && (
                                <>
                                    {' — '}
                                    <span className={headline.gap.behind ? 'text-feed-clay' : 'text-feed-green'}>{headline.gap.text}</span>
                                </>
                            )}
                            {headline.shelf && <>, with {headline.shelf}</>}.
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-4 items-start">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink3">Showing</p>
                    <DateRangePresets dateRange={dateRange} onSelect={setDateRange} tone="feed" />
                    <div className="flex flex-wrap gap-2 mt-1">
                        <button
                            onClick={() => goToEod()}
                            className="bg-feed-green hover:opacity-90 text-feed-paper px-4 py-2 rounded-xl text-sm font-semibold flex items-center transition-colors"
                        >
                            <FileText size={15} className="mr-2" />
                            EOD report
                        </button>
                        <button
                            onClick={() => goToEod(true)}
                            disabled={!stats}
                            className="bg-transparent text-feed-ink border border-feed-tint hover:bg-feed-mute px-4 py-2 rounded-xl text-sm font-semibold flex items-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <Download size={15} className="mr-2" />
                            PDF
                        </button>
                    </div>
                    <Link href="/dashboard" className="text-xs font-semibold text-feed-green hover:text-feed-clay flex items-center gap-1.5 mt-1">
                        <ArrowLeft size={13} /> Back to dashboard
                    </Link>
                </div>
            </div>

            {/* 01 — Money in */}
            <Act number="01" kicker="Money in" standfirst={`Takings against ${comparisonLabel}, and where this month sits beside last.`}>
                <div className="flex flex-col gap-9">
                    <div className={`grid grid-cols-2 ${mtd ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-px bg-feed-rule border-t border-b border-feed-rule`}>
                        <Figure label="Revenue" value={compact(money(revenue))}
                            note={revenueDelta === null
                                ? `No sales ${comparisonLabel}`
                                : `${revenueDelta >= 0 ? '▲' : '▼'} ${Math.abs(revenueDelta).toFixed(1)}% vs ${comparisonLabel}`}
                            noteTone={revenueDelta === null ? 'muted' : revenueDelta >= 0 ? 'good' : 'bad'}
                        />
                        <Figure label="Gross profit" value={compact(money(profit))} note={`${margin.toFixed(1)}% margin`} />
                        <Figure label="Transactions" value={count.toLocaleString()} note={`${staff.length} on the counter`} />
                        <Figure label="Avg. basket" value={compact(money(avgBasket))} note="Revenue per sale" />
                        {mtd && (
                            <Figure
                                label={`Net profit · ${mtd.monthLabel}`}
                                value={compact(money(mtd.netProfit.total))}
                                note="Whole month, unfiltered"
                                tone={mtd.netProfit.total >= 0 ? 'brand' : 'bad'}
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_290px] gap-10 xl:gap-14">
                        <div className="flex flex-col gap-4 min-w-0">
                            <div className="flex flex-wrap items-baseline justify-between gap-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink">Daily revenue</p>
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1.5 text-xs font-medium text-feed-ink2">
                                        <span className="w-3 h-0.5 rounded-full bg-feed-green"></span>This month
                                    </span>
                                    <span className="flex items-center gap-1.5 text-xs font-medium text-feed-ink3">
                                        <span className="w-3 h-0.5 rounded-full bg-feed-tint"></span>Last month
                                    </span>
                                </div>
                            </div>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats?.trendChartData || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="feedTrend" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#2A4A3C" stopOpacity={0.14} />
                                                <stop offset="100%" stopColor="#2A4A3C" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} stroke="#EFEAE1" />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#948D84' }} dy={8} interval={4} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#948D84' }} width={56} />
                                        <Tooltip
                                            formatter={(value: any) => money(Number(value) || 0)}
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #E5DFD5', boxShadow: '0 8px 30px rgba(26,24,21,0.10)', background: '#FBF9F5', fontSize: '12px', padding: '10px 14px', color: '#1A1815' }}
                                        />
                                        <Area type="monotone" dataKey="previous" stroke="#C9C1B4" strokeWidth={1.5} strokeDasharray="4 4" fill="none" name="Last month" />
                                        <Area type="monotone" dataKey="current" stroke="#2A4A3C" strokeWidth={2.5} fillOpacity={1} fill="url(#feedTrend)" name="This month" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-xs font-medium text-feed-ink3">
                                This month is still running, so its line stops at today while last month covers its full length.
                            </p>
                        </div>

                        <div className="flex flex-col gap-7 min-w-0">
                            <div className="flex flex-col gap-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink">How they paid</p>
                                <PaymentMixChart breakdown={stats?.filtered?.paymentBreakdown} tone="feed" />
                            </div>

                            <div className="flex flex-col gap-3 border-t border-feed-rule pt-6">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink">Last five sales</p>
                                {(stats?.recentSales || []).slice(0, 5).map((sale: any) => (
                                    <div key={sale.id} className="flex justify-between items-baseline gap-3 text-[13px]">
                                        <span className="text-feed-ink3 truncate">
                                            {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {' · '}
                                            <span className="capitalize">{String(sale.paymentMethod || '').replace(/_/g, ' ').toLowerCase()}</span>
                                        </span>
                                        <span className="font-semibold text-feed-ink shrink-0">{money(Number(sale.total) || 0)}</span>
                                    </div>
                                ))}
                                {(!stats?.recentSales || stats.recentSales.length === 0) && (
                                    <p className="text-[13px] text-feed-ink3">No sales in this period.</p>
                                )}
                                <Link href="/sales" className="text-xs font-semibold text-feed-green hover:text-feed-clay mt-1">
                                    All sales →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </Act>

            {/* 02 — Money on the shelf */}
            <Act number="02" kicker="Money on the shelf" standfirst="What is tied up in stock, what needs reordering, and what has stopped moving.">
                <div className="flex flex-col gap-9">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-feed-rule border-t border-b border-feed-rule">
                        <Figure
                            label="Inventory value"
                            value={productStats ? compact(money(Number(productStats.inventoryValue) || 0)) : '—'}
                            note={productStats ? `${productStats.totalProducts.toLocaleString()} SKUs on hand` : 'Unavailable'}
                        />
                        <Figure
                            label="Below reorder point"
                            value={productStats ? productStats.lowStockCount.toLocaleString() : '—'}
                            note={productStats && productStats.totalProducts > 0
                                ? `${((productStats.lowStockCount / productStats.totalProducts) * 100).toFixed(0)}% of the catalogue`
                                : 'Unavailable'}
                            tone={productStats && productStats.lowStockCount > 0 ? 'bad' : undefined}
                            href="/products?lowStock=true"
                        />
                        <Figure
                            label={aging ? `Not sold in ${aging.summary.staleDays} days` : 'Ageing stock'}
                            value={aging ? compact(money(aging.summary.totalValueTiedUp)) : '—'}
                            note={aging ? `${aging.summary.totalItems.toLocaleString()} items` : 'Unavailable'}
                            tone={aging && aging.summary.totalValueTiedUp > 0 ? 'bad' : undefined}
                            href="/products/aging"
                        />
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="flex items-baseline justify-between gap-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink">Oldest stock on the shelf</p>
                            <Link href="/products/aging" className="text-xs font-semibold text-feed-green hover:text-feed-clay">Full ageing report →</Link>
                        </div>
                        {aging && aging.items.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                                {aging.items.map((item, idx) => (
                                    <div key={`${item.productId}-${item.storeId}`} className="flex items-baseline gap-4 py-2.5 border-b border-feed-hair min-w-0">
                                        <span style={serif} className="text-[15px] text-feed-tint w-5 shrink-0 tabular-nums">{idx + 1}</span>
                                        <span className="text-[13px] font-medium text-feed-ink flex-1 truncate">{item.name}</span>
                                        <span className="text-xs text-feed-ink3 shrink-0 tabular-nums">{formatAge(item.ageDays)}</span>
                                        <span className="text-[13px] font-semibold text-feed-ink shrink-0 tabular-nums w-[86px] text-right">
                                            {money(item.valueTiedUp)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[13px] text-feed-ink3">{loading ? 'Loading…' : 'Nothing is sitting idle — everything in stock has sold recently.'}</p>
                        )}
                    </div>
                </div>
            </Act>

            {/* 03 — Who and what sold */}
            <Act number="03" kicker="Who and what sold" standfirst="The counter, the products carrying it, and the hours worth staffing." last>
                <div className="flex flex-col gap-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 xl:gap-14">
                        <div className="flex flex-col gap-4 min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink">At the counter</p>
                            {staff.length > 0 ? (
                                <div className="flex flex-col gap-4">
                                    {staff.slice(0, 5).map(row => (
                                        <div key={row.userId} className="flex flex-col gap-1.5 min-w-0">
                                            <div className="flex justify-between items-baseline gap-3">
                                                <span className="text-[13.5px] font-medium text-feed-ink truncate">{row.name}</span>
                                                <span className="text-[13.5px] font-semibold text-feed-ink shrink-0 tabular-nums">{money(row.revenue)}</span>
                                            </div>
                                            <div className="h-2 bg-feed-hair">
                                                <div className="h-2 bg-feed-green" style={{ width: `${Math.max(2, (row.revenue / staffMax) * 100)}%` }} />
                                            </div>
                                            <span className="text-xs text-feed-ink3 tabular-nums">
                                                {row.count} sale{row.count === 1 ? '' : 's'} · avg {money(row.avgBasket)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[13px] text-feed-ink3">{loading ? 'Loading…' : 'No sales in this period.'}</p>
                            )}
                        </div>

                        <div className="flex flex-col gap-4 min-w-0">
                            <div className="flex items-baseline justify-between gap-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink">Carrying the day</p>
                                <Link href="/reports/top-products" className="text-xs font-semibold text-feed-green hover:text-feed-clay">Full report →</Link>
                            </div>
                            {topProducts.length > 0 ? (
                                <div className="flex flex-col">
                                    {topProducts.map((p, idx) => (
                                        <div key={p.productId} className="flex items-baseline gap-4 py-2.5 border-b border-feed-hair last:border-b-0 min-w-0">
                                            <span style={serif} className="text-[15px] text-feed-tint w-5 shrink-0 tabular-nums">{idx + 1}</span>
                                            <span className="text-[13px] font-medium text-feed-ink flex-1 truncate">{p.name}</span>
                                            <span className="text-xs text-feed-ink3 shrink-0 tabular-nums">{p.quantity} sold</span>
                                            <span className="text-[13px] font-semibold text-feed-ink shrink-0 tabular-nums w-[86px] text-right">{money(p.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[13px] text-feed-ink3">{loading ? 'Loading…' : 'No sales in this period.'}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 border-t border-feed-rule pt-8">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink">Hours worth staffing</p>
                            <span className="text-xs text-feed-ink3">against the rolling 12-month average revenue per trading hour</span>
                        </div>
                        <HourlyHeatmap storeId={selectedStoreId || undefined} tone="feed" />
                    </div>
                </div>
            </Act>
        </div>
    );
}

function Act({ number, kicker, standfirst, children, last }: {
    number: string;
    kicker: string;
    standfirst: string;
    children: React.ReactNode;
    last?: boolean;
}) {
    return (
        <div className={`grid grid-cols-1 xl:grid-cols-[180px_1fr] gap-8 xl:gap-14 py-11 ${last ? '' : 'border-b border-feed-rule'}`}>
            <div className="flex flex-col gap-3">
                <span style={serif} className="text-[46px] leading-[0.9] font-light text-feed-tint">{number}</span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink">{kicker}</p>
                <p style={serif} className="text-[15px] leading-relaxed text-feed-ink2">{standfirst}</p>
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function Figure({ label, value, note, tone, noteTone, href }: {
    label: string;
    value: string;
    note?: string;
    tone?: 'brand' | 'bad';
    noteTone?: 'good' | 'bad' | 'muted';
    href?: string;
}) {
    const valueClass = tone === 'bad' ? 'text-feed-clay' : tone === 'brand' ? 'text-feed-green' : 'text-feed-ink';
    const noteClass = noteTone === 'bad' ? 'text-feed-clay' : noteTone === 'good' ? 'text-feed-green' : 'text-feed-ink3';

    const body = (
        <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-feed-ink3 truncate">{label}</p>
            <span className={`text-[26px] font-semibold tracking-tight leading-none ${valueClass}`}>{value}</span>
            {note && <span className={`text-xs font-medium ${noteClass} truncate`}>{note}</span>}
        </>
    );

    const className = 'flex flex-col gap-2 py-5 px-5 first:pl-0 bg-feed-paper min-w-0';

    return href
        ? <Link href={href} className={`${className} hover:bg-feed-mute transition-colors`}>{body}</Link>
        : <div className={className}>{body}</div>;
}
