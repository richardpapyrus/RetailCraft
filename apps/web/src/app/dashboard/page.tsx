"use client";

import { useEffect, useMemo, useState } from 'react';
import { api, ExpenseMonthToDate, InventoryAgingReport } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import BestSellersWidget from '@/components/BestSellersWidget';
import { FitText } from '@/components/FitText';
import Link from 'next/link';
import {
    FileText,
    Download,
    RefreshCw,
    Newspaper,
    AlertTriangle,
    Hourglass,
    TrendingDown,
    Calendar,
    Check
} from 'lucide-react';
import { SaleDetailModal } from '@/components/sales/SaleDetailModal';
import DateRangePresets from '@/components/dashboard/DateRangePresets';
import PaymentMixChart from '@/components/dashboard/PaymentMixChart';
import CategoryBreakdownChart from '@/components/dashboard/CategoryBreakdownChart';
import HourlyHeatmap from '@/components/dashboard/HourlyHeatmap';
import StaffLeaderboard from '@/components/dashboard/StaffLeaderboard';
import LowStockWidget from '@/components/dashboard/LowStockWidget';
import InventoryAgingWidget from '@/components/dashboard/InventoryAgingWidget';

type ProductStats = { totalProducts: number; inventoryValue: string; lowStockCount: number };
type TabKey = 'sales' | 'inventory' | 'team' | 'rhythm';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'sales', label: 'Sales' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'team', label: 'Team & products' },
    { key: 'rhythm', label: "When you're busy" },
];

export default function DashboardPage() {
    const { user, token, isHydrated, hasPermission } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    // Month-to-date expense figures. Fetched independently of `dateRange` so the
    // date picker below never changes them.
    const [mtdExpenses, setMtdExpenses] = useState<ExpenseMonthToDate | null>(null);
    // Inventory figures backing the "Needs attention" strip. Fetched once at page
    // level and handed down to the Inventory tab's widgets so opening that tab
    // doesn't re-run the same two queries.
    const [productStats, setProductStats] = useState<ProductStats | null>(null);
    const [aging, setAging] = useState<InventoryAgingReport | null>(null);
    const [inventoryLoading, setInventoryLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshNonce, setRefreshNonce] = useState(0);
    const [activeTab, setActiveTab] = useState<TabKey>('sales');

    // Global Store Filtering
    const { selectedStoreId } = useAuth();
    const [stores, setStores] = useState<any[]>([]);

    // Improved Admin Check
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'Administrator' || user?.permissions?.includes('*');

    // Default to Today
    const [dateRange, setDateRange] = useState({
        from: new Date().toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const isSingleDay = dateRange.from === dateRange.to;
    const isTodayView = isSingleDay && dateRange.from === todayStr;

    // Cumulative intraday curve for the hero, today against the same hours
    // yesterday. Only meaningful on the "today" view, so it's only fetched
    // there; every other range falls back to the month-to-date sparkline.
    const [intraday, setIntraday] = useState<{ today: number[]; yesterday: number[] } | null>(null);

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }

        // Access Control
        const hasAccess = user?.permissions?.includes('VIEW_DASHBOARD') || user?.permissions?.includes('*') || user?.role === 'ADMIN' || user?.role === 'Administrator';
        if (!hasAccess) {
            router.replace('/pos');
        }
    }, [token, isHydrated, router, user]);

    useEffect(() => {
        if (isAdmin) {
            api.stores.list().then(setStores).catch(console.error);
        }
    }, [isAdmin]);

    // Month-to-date expenses / net profit. Deliberately excludes `dateRange`
    // from its dependencies: these cards always report the current calendar
    // month regardless of the dashboard filter. A failure here leaves the cards
    // hidden rather than breaking the rest of the dashboard.
    useEffect(() => {
        if (!isHydrated || !token) return;
        if (!hasPermission('VIEW_EXPENSES')) return;

        let cancelled = false;
        api.expenses.monthToDate(selectedStoreId || undefined)
            .then(data => { if (!cancelled) setMtdExpenses(data); })
            .catch(e => {
                if (!cancelled) {
                    console.error('Failed to load month-to-date expenses', e);
                    setMtdExpenses(null);
                }
            });

        return () => { cancelled = true; };
    }, [isHydrated, token, selectedStoreId, refreshNonce, hasPermission]);

    // Inventory health + aging. Like the month-to-date row these describe stock
    // on hand rather than the selected window, so they ignore `dateRange`. Each
    // failure is swallowed independently — a missing figure hides its card.
    useEffect(() => {
        if (!isHydrated || !token) return;

        let cancelled = false;
        setInventoryLoading(true);

        const stockPromise = api.products.getStats(selectedStoreId || undefined)
            .then(res => { if (!cancelled) setProductStats(res); })
            .catch(e => {
                if (!cancelled) {
                    console.error('Failed to load product stats', e);
                    setProductStats(null);
                }
            });
        const agingPromise = api.inventory.aging({ storeId: selectedStoreId || undefined, take: 10 })
            .then(res => { if (!cancelled) setAging(res); })
            .catch(e => {
                if (!cancelled) {
                    console.error('Failed to load inventory aging', e);
                    setAging(null);
                }
            });

        Promise.allSettled([stockPromise, agingPromise])
            .then(() => { if (!cancelled) setInventoryLoading(false); });

        return () => { cancelled = true; };
    }, [isHydrated, token, selectedStoreId, refreshNonce]);

    useEffect(() => {
        if (!isHydrated || !token) return;

        const fetchData = async (isBackground = false) => {
            if (!isBackground) setLoading(true);
            setRefreshing(true);
            try {
                // Determine endpoint (HQ vs Store Level)
                // Note: We use existing sales.stats method which works for both IF the backend supports filtering
                // Ideally we'd use separate endpoints but for minimal risk we stick to what works,
                // just refreshed automatically.
                const s = await api.sales.stats(dateRange.from, dateRange.to, selectedStoreId || undefined);
                setStats(s);
                setLastUpdated(new Date());
            } catch (error) {
                console.error('Failed to fetch stats', error);
            } finally {
                if (!isBackground) setLoading(false);
                setRefreshing(false);
            }
        };

        // Initial Load
        fetchData();

        // Auto-refresh on an interval, but only while the tab is visible — avoids
        // hammering the API/DB with the heavy stats query when the dashboard is
        // sitting in a background tab.
        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchData(true);
            }
        }, 15000);

        // Refresh immediately when the user returns to the tab so data isn't stale.
        const onVisible = () => {
            if (document.visibilityState === 'visible') fetchData(true);
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [dateRange, selectedStoreId, token, isHydrated, refreshNonce]);

    // Intraday comparison for the hero. The heatmap endpoint buckets by weekday,
    // so today and yesterday must be fetched as separate single-day windows.
    // Purely decorative: any failure just leaves `intraday` null.
    useEffect(() => {
        if (!isHydrated || !token || !isTodayView) {
            setIntraday(null);
            return;
        }

        let cancelled = false;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        const cutoff = new Date().getHours();

        const cumulative = (cells: any[] | null | undefined) => {
            const byHour = new Array(24).fill(0);
            (cells || []).forEach((c: any) => {
                const h = Number(c?.hour);
                if (Number.isFinite(h) && h >= 0 && h < 24) byHour[h] += Number(c?.revenue) || 0;
            });
            const out: number[] = [];
            let running = 0;
            for (let h = 0; h <= cutoff; h++) {
                running += byHour[h];
                out.push(running);
            }
            return out;
        };

        Promise.all([
            api.sales.hourlyHeatmap(todayStr, todayStr, selectedStoreId || undefined),
            api.sales.hourlyHeatmap(yStr, yStr, selectedStoreId || undefined),
        ])
            .then(([t, y]: any[]) => {
                if (cancelled) return;
                setIntraday({ today: cumulative(t), yesterday: cumulative(y) });
            })
            .catch(e => {
                if (!cancelled) {
                    console.error('Failed to load intraday comparison', e);
                    setIntraday(null);
                }
            });

        return () => { cancelled = true; };
    }, [isHydrated, token, isTodayView, todayStr, selectedStoreId, refreshNonce]);

    const storeName = selectedStoreId
        ? stores.find(s => s.id === selectedStoreId)?.name
        : (!isAdmin && user?.store?.name)
            ? user.store.name
            : undefined; // Falls back to Tenant Name/All Locations

    const revenue = Number(stats?.filtered?.revenue) || 0;
    const profit = Number(stats?.filtered?.profit) || 0;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const count = Number(stats?.filtered?.count) || 0;
    const avgBasket = count > 0 ? revenue / count : 0;
    const prevRevenue = Number(stats?.comparison?.revenue) || 0;
    const revenueDelta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

    // Trim trailing ".00" for an executive-friendly dashboard read
    const compact = (s: string) => s.replace(/([.,]00)(?=\s|$)/, '');
    const money = (v: number) => formatCurrency(v, user?.currency, user?.locale);

    // The API compares against the immediately preceding equal-length window
    // (and, for "today", up to the same time yesterday). Label it to match so
    // the hero states exactly what the delta is measured against.
    const comparisonLabel = isTodayView
        ? 'vs same time yesterday'
        : isSingleDay
            ? 'vs previous day'
            : 'vs previous period';

    const fallbackSpark = useMemo(
        () => (stats?.trendChartData || [])
            .filter((d: any) => d.current !== null && d.current !== undefined)
            .map((d: any) => Number(d.current) || 0),
        [stats]
    );

    // Things that want the manager's attention right now, most urgent first.
    // Every entry is derived from data already on this page — nothing here
    // triggers an extra query.
    const attention = useMemo(() => {
        const items: { key: string; icon: 'stock' | 'age' | 'trend'; title: string; detail: string; href: string; cta: string }[] = [];

        if (productStats && productStats.lowStockCount > 0) {
            items.push({
                key: 'low-stock',
                icon: 'stock',
                title: `${productStats.lowStockCount.toLocaleString()} item${productStats.lowStockCount === 1 ? '' : 's'} below reorder point`,
                detail: `Across ${productStats.totalProducts.toLocaleString()} SKUs · ${money(Number(productStats.inventoryValue) || 0)} inventory value`,
                href: '/products?lowStock=true',
                cta: 'Review stock',
            });
        }

        if (aging && aging.summary.totalValueTiedUp > 0) {
            items.push({
                key: 'aging',
                icon: 'age',
                title: `${money(aging.summary.totalValueTiedUp)} sitting in ageing stock`,
                detail: `${aging.summary.totalItems.toLocaleString()} item${aging.summary.totalItems === 1 ? '' : 's'} unsold for ${aging.summary.staleDays} days or more`,
                href: '/products/aging',
                cta: 'Full ageing report',
            });
        }

        if (revenueDelta !== null && revenueDelta < 0) {
            items.push({
                key: 'behind',
                icon: 'trend',
                title: `Trading ${Math.abs(revenueDelta).toFixed(1)}% behind`,
                detail: `${money(prevRevenue - revenue)} short ${comparisonLabel.replace('vs ', '')}`,
                href: '/sales',
                cta: 'See sales',
            });
        }

        return items;
    }, [productStats, aging, revenueDelta, prevRevenue, revenue, comparisonLabel, user?.currency, user?.locale]);

    if (!isHydrated) return null;

    const goToEod = (download?: boolean) => {
        const q = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
        if (download) q.append('download', '1');
        if (selectedStoreId) q.append('storeId', selectedStoreId);
        if (storeName) q.append('store', storeName);
        router.push(`/reports/eod?${q.toString()}`);
    };

    return (
        <div className="h-full bg-canvas overflow-y-auto font-sans">
            <div className="max-w-[1600px] mx-auto p-8 lg:p-12 animate-fade-in-up">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-5">
                    <div className="flex flex-col gap-1 min-w-0">
                        <h1 className="text-3xl lg:text-4xl font-semibold text-gray-900 tracking-tight leading-tight">
                            Dashboard
                        </h1>
                        <span className="text-sm font-medium text-mid-grey tracking-wide truncate">
                            {selectedStoreId || (!isAdmin && user?.store) ? 'Store performance overview' : 'Organization performance overview'}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2 text-xs font-medium text-mid-grey">
                            <SyncStatus lastUpdated={lastUpdated} refreshing={refreshing} />
                            <button
                                onClick={() => setRefreshNonce(n => n + 1)}
                                disabled={refreshing}
                                className="p-1.5 rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-50"
                                title="Refresh now"
                            >
                                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        <button
                            onClick={() => {
                                const q = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
                                router.push(`/dashboard/news-feed?${q.toString()}`);
                            }}
                            className="bg-white text-charcoal border border-cool-grey hover:bg-surface-muted px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center transition-colors"
                            title="The same figures, read as a briefing"
                        >
                            <Newspaper size={16} className="mr-2" />
                            News Feed
                        </button>
                        <button
                            onClick={() => goToEod()}
                            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center shadow-soft transition-colors"
                        >
                            <FileText size={16} className="mr-2" />
                            EOD Report
                        </button>
                        <button
                            onClick={() => goToEod(true)}
                            disabled={!stats}
                            className="bg-white text-charcoal border border-cool-grey hover:bg-surface-muted px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="Download the EOD report as a PDF"
                        >
                            <Download size={16} className="mr-2" />
                            Download PDF
                        </button>
                    </div>
                </div>

                {/* One filter row, scoping everything below it */}
                <div className="bg-white rounded-2xl shadow-soft border border-gray-100 px-4 py-3 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <DateRangePresets dateRange={dateRange} onSelect={setDateRange} />
                    <div className="flex items-center gap-2 shrink-0">
                        <Calendar size={15} className="text-mid-grey shrink-0" />
                        <input
                            type="date"
                            value={dateRange.from}
                            aria-label="From date"
                            className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 p-0"
                            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        />
                        <span className="text-mid-grey text-sm">–</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            aria-label="To date"
                            className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 p-0"
                            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        />
                    </div>
                </div>

                {loading && !stats ? (
                    <div className="animate-fade-in-up">
                        <div className="bg-white rounded-2xl p-8 shadow-card border border-gray-100/80 mb-8">
                            <div className="skeleton h-3 w-28 mb-5"></div>
                            <div className="skeleton h-12 w-64 mb-4"></div>
                            <div className="skeleton h-3 w-48"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="bg-white rounded-2xl p-6 shadow-card border border-gray-100/80">
                                    <div className="skeleton h-4 w-40 mb-3"></div>
                                    <div className="skeleton h-3 w-52"></div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            <div className="xl:col-span-2 bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                <div className="skeleton h-5 w-48 mb-3"></div>
                                <div className="skeleton h-3 w-72 mb-8"></div>
                                <div className="skeleton h-[360px] w-full"></div>
                            </div>
                            <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                <div className="skeleton h-5 w-32 mb-8"></div>
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-4 mb-6">
                                        <div className="skeleton h-10 w-10 rounded-full"></div>
                                        <div className="flex-1">
                                            <div className="skeleton h-3.5 w-32 mb-2"></div>
                                            <div className="skeleton h-3 w-24"></div>
                                        </div>
                                        <div className="skeleton h-4 w-16"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Hero band — the headline number, the supporting figures,
                            and (on its own surface) the month-to-date financials. */}
                        <div className={`bg-white rounded-2xl shadow-card border border-gray-100/80 grid grid-cols-1 mb-8 ${mtdExpenses ? 'lg:grid-cols-2 2xl:grid-cols-[1.2fr_1fr_0.95fr]' : 'lg:grid-cols-[1.2fr_1fr]'}`}>

                            {/* Headline */}
                            <div className="p-7 lg:p-8 flex flex-col gap-3 min-w-0">
                                <p className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest">
                                    Revenue{isTodayView ? ' · today' : ''}
                                </p>
                                <div className="flex items-baseline gap-3 min-w-0">
                                    <div className="text-4xl lg:text-5xl font-semibold text-gray-900 tracking-tight min-w-0">
                                        <FitText>{compact(money(revenue))}</FitText>
                                    </div>
                                    {revenueDelta !== null && (
                                        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] font-semibold ${revenueDelta >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                            {revenueDelta >= 0 ? '▲' : '▼'} {Math.abs(revenueDelta).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                                <p className="text-[13px] font-medium text-mid-grey truncate">
                                    {revenueDelta === null
                                        ? `No sales ${comparisonLabel.replace('vs ', '')}`
                                        : revenue >= prevRevenue
                                            ? `${money(revenue - prevRevenue)} ahead ${comparisonLabel.replace('vs ', '')} (${money(prevRevenue)})`
                                            : `${money(prevRevenue - revenue)} behind ${comparisonLabel.replace('vs ', '')} (${money(prevRevenue)})`}
                                </p>
                                <HeroSparkline intraday={intraday} fallback={fallbackSpark} />
                            </div>

                            {/* Supporting figures */}
                            <div className="p-7 lg:p-8 grid grid-cols-2 gap-x-6 gap-y-6 content-center border-t lg:border-t-0 lg:border-l border-gray-100 min-w-0">
                                <MiniStat label="Gross profit" value={compact(money(profit))} />
                                <MiniStat label="Margin" value={`${margin.toFixed(1)}%`} />
                                <MiniStat label="Transactions" value={count.toLocaleString()} />
                                <MiniStat label="Avg. basket" value={compact(money(avgBasket))} />
                                <div className="col-span-2 border-t border-gray-100 pt-4 flex items-center flex-wrap gap-x-5 gap-y-2">
                                    <Link href="/sales?filter=discount" className="flex items-baseline gap-2 group">
                                        <span className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Discounts</span>
                                        <span className="text-sm font-semibold text-charcoal group-hover:text-brand-600 transition-colors">
                                            {money(Number(stats?.filtered?.totalDiscount) || 0)}
                                        </span>
                                    </Link>
                                    <Link href="/sales?filter=refund" className="flex items-baseline gap-2 group">
                                        <span className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Refunds</span>
                                        <span className={`text-sm font-semibold transition-colors ${Number(stats?.filtered?.totalRefund) > 0 ? 'text-red-600' : 'text-charcoal group-hover:text-brand-600'}`}>
                                            {money(Number(stats?.filtered?.totalRefund) || 0)}
                                        </span>
                                    </Link>
                                </div>
                            </div>

                            {/* Month to date — deliberately on its own surface, because
                                unlike everything else here it ignores the date filter. */}
                            {mtdExpenses && (
                                <div className="p-5 border-t 2xl:border-t-0 2xl:border-l border-gray-100 min-w-0 lg:col-span-2 2xl:col-span-1">
                                    <div className="bg-surface-muted rounded-xl p-5 h-full flex flex-col gap-4">
                                        <div className="flex flex-col gap-0.5">
                                            <p className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest">
                                                Month to date · {mtdExpenses.monthLabel}
                                            </p>
                                            <p className="text-[11px] font-medium text-mid-grey">Whole month — ignores the filter above</p>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex justify-between items-baseline gap-3">
                                                <span className="text-[13px] font-medium text-charcoal">Gross profit</span>
                                                <span className="text-sm font-semibold text-charcoal truncate">{compact(money(mtdExpenses.grossProfit.total))}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-3">
                                                <span className="text-[13px] font-medium text-charcoal">
                                                    Expenses <span className="text-mid-grey">({mtdExpenses.expenses.count})</span>
                                                </span>
                                                <span className="text-sm font-semibold text-charcoal truncate">−{compact(money(mtdExpenses.expenses.total))}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-3 border-t border-cool-grey pt-3">
                                                <span className="text-[13px] font-semibold text-gray-900">Net profit</span>
                                                <span className={`text-xl font-semibold tracking-tight truncate ${mtdExpenses.netProfit.total >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                                                    {compact(money(mtdExpenses.netProfit.total))}
                                                </span>
                                            </div>
                                        </div>
                                        {mtdExpenses.expenseToSalesRatio !== null && (
                                            <div className="mt-auto flex flex-col gap-1.5">
                                                <div className="h-1.5 rounded-full bg-cool-grey overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-brand-400"
                                                        style={{ width: `${Math.min(100, Math.max(1, mtdExpenses.expenseToSalesRatio))}%` }}
                                                    />
                                                </div>
                                                <p className="text-[11px] font-medium text-mid-grey">
                                                    Expenses are {mtdExpenses.expenseToSalesRatio.toFixed(1)}% of sales this month
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Needs attention */}
                        <div className="mb-9">
                            <div className="flex items-baseline gap-2.5 mb-4">
                                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Needs attention</h2>
                                {attention.length > 0 && (
                                    <span className="bg-surface-muted text-charcoal rounded-full px-2.5 py-0.5 text-xs font-semibold">
                                        {attention.length}
                                    </span>
                                )}
                            </div>

                            {attention.length === 0 ? (
                                <div className="bg-white rounded-2xl shadow-card border border-gray-100/80 px-6 py-5 flex items-center gap-3">
                                    <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                                        <Check size={18} />
                                    </span>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900">Nothing needs attention</div>
                                        <div className="text-xs font-medium text-mid-grey">Stock levels, ageing stock and trading are all healthy.</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                    {attention.map(item => (
                                        <div
                                            key={item.key}
                                            className="bg-white rounded-2xl shadow-card border border-gray-100/80 p-5 flex gap-3.5 hover:shadow-lifted transition-shadow min-w-0"
                                        >
                                            <span className="shrink-0 mt-0.5">
                                                {item.icon === 'stock' && <AlertTriangle size={20} className="text-red-500" />}
                                                {item.icon === 'age' && <Hourglass size={20} className="text-amber-600" />}
                                                {item.icon === 'trend' && <TrendingDown size={20} className="text-red-500" />}
                                            </span>
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <span className="text-[15px] font-semibold text-gray-900 tracking-tight">{item.title}</span>
                                                <span className="text-xs font-medium text-mid-grey">{item.detail}</span>
                                                <Link href={item.href} className="text-xs font-semibold text-brand-600 hover:text-brand-700 mt-1.5">
                                                    {item.cta} →
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Detail tabs */}
                        <div className="border-b border-cool-grey mb-7 overflow-x-auto">
                            <div className="flex items-center gap-7 min-w-max">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`text-[15px] pb-3.5 -mb-px border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key
                                            ? 'font-semibold text-gray-900 border-brand-500'
                                            : 'font-medium text-mid-grey border-transparent hover:text-charcoal'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {activeTab === 'sales' && (
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start animate-fade-in">
                                <div className="xl:col-span-2 flex flex-col gap-8 min-w-0">
                                    <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-card border border-gray-100/80">
                                        <div className="mb-8">
                                            <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">Month to Date Trend</h2>
                                            <p className="text-sm text-mid-grey font-medium">Daily sales comparison: current month vs previous month</p>
                                        </div>
                                        <div className="h-[400px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={stats?.trendChartData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#235347" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#235347" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                                    <XAxis
                                                        dataKey="day"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                                                        dy={10}
                                                        interval={4}
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                                                    />
                                                    <Tooltip
                                                        formatter={(value: any) => money(Number(value) || 0)}
                                                        contentStyle={{
                                                            borderRadius: '16px',
                                                            border: 'none',
                                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                                            padding: '12px 20px'
                                                        }}
                                                    />
                                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="current"
                                                        stroke="#235347"
                                                        strokeWidth={3}
                                                        fillOpacity={1}
                                                        fill="url(#colorCurrent)"
                                                        name="Current Month"
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="previous"
                                                        stroke="#cbd5e1"
                                                        strokeWidth={2}
                                                        strokeDasharray="4 4"
                                                        fill="none"
                                                        name="Previous Month"
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-card border border-gray-100/80 min-w-0">
                                            <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-6">Payment Mix</h2>
                                            <PaymentMixChart breakdown={stats?.filtered?.paymentBreakdown} />
                                        </div>
                                        <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-card border border-gray-100/80 min-w-0">
                                            <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-6">Sales by Category</h2>
                                            <CategoryBreakdownChart from={dateRange.from} to={dateRange.to} storeId={selectedStoreId || undefined} />
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Sales */}
                                <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-card border border-gray-100/80 xl:sticky xl:top-8 min-w-0">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Recent Sales</h2>
                                        <Link href="/sales" className="text-sm text-brand-600 hover:text-brand-700 font-semibold">View all</Link>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {stats?.recentSales?.map((sale: any) => (
                                            <div
                                                key={sale.id}
                                                onClick={() => setSelectedSale(sale)}
                                                className="flex justify-between items-center gap-3 group cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2 py-3 transition-colors"
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0">
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-brand-50 text-brand-700">
                                                        {sale.customer?.name?.[0] || 'W'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-gray-900 text-sm truncate">{sale.customer?.name || 'Walk-In Customer'}</div>
                                                        <div className="text-xs font-medium text-gray-400 flex items-center gap-2">
                                                            <span>
                                                                {(() => {
                                                                    const date = new Date(sale.createdAt);
                                                                    const today = new Date();
                                                                    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
                                                                    return isToday
                                                                        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                        : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                                                })()}
                                                            </span>
                                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                            <span className="truncate">{sale.user?.name?.split(' ')[0] || 'Staff'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    {(() => {
                                                        const refundTotal = (sale as any).returns?.reduce((sum: number, ret: any) => sum + Number(ret.total), 0) || 0;
                                                        const originalTotal = Number(sale.total);
                                                        const netTotal = originalTotal - refundTotal;
                                                        const hasRefund = refundTotal > 0;

                                                        return hasRefund ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-gray-400 line-through text-xs">{money(originalTotal)}</span>
                                                                <span className="font-semibold text-red-600 text-base">{money(netTotal)}</span>
                                                                <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded uppercase tracking-wider mt-0.5">Refunded</span>
                                                            </div>
                                                        ) : (
                                                            <div className="font-semibold text-gray-900 text-base">{money(originalTotal)}</div>
                                                        );
                                                    })()}
                                                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">
                                                        {sale.paymentMethod}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(!stats?.recentSales || stats.recentSales.length === 0) && (
                                            <div className="text-center text-gray-400 py-12">No recent sales</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'inventory' && (
                            <div className="flex flex-col gap-8 animate-fade-in">
                                <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-card border border-gray-100/80">
                                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">Inventory Health</h2>
                                    <LowStockWidget storeId={selectedStoreId || undefined} stats={productStats} loading={inventoryLoading} />
                                </div>
                                <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-card border border-gray-100/80">
                                    <div className="mb-6">
                                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">Aging Inventory</h2>
                                        <p className="text-sm text-mid-grey font-medium">Oldest stock that isn&apos;t selling — capital sitting on the shelf</p>
                                    </div>
                                    <InventoryAgingWidget storeId={selectedStoreId || undefined} report={aging} loading={inventoryLoading} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'team' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-fade-in">
                                <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-card border border-gray-100/80 flex flex-col min-w-0">
                                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">Best Sellers</h2>
                                    <div className="flex-1">
                                        <BestSellersWidget from={dateRange.from} to={dateRange.to} storeId={selectedStoreId || undefined} />
                                    </div>
                                </div>
                                <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-card border border-gray-100/80 flex flex-col min-w-0">
                                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">Staff Leaderboard</h2>
                                    <div className="flex-1">
                                        <StaffLeaderboard from={dateRange.from} to={dateRange.to} storeId={selectedStoreId || undefined} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rhythm' && (
                            <div className="bg-white p-6 lg:p-8 rounded-2xl shadow-card border border-gray-100/80 animate-fade-in">
                                <div className="mb-6">
                                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">When You&apos;re Busy</h2>
                                    <p className="text-sm text-mid-grey font-medium">Hourly sales vs the hourly average — last 7 days plus today, live</p>
                                </div>
                                <HourlyHeatmap storeId={selectedStoreId || undefined} />
                            </div>
                        )}

                        {selectedSale && (
                            <SaleDetailModal
                                sale={selectedSale}
                                onClose={() => setSelectedSale(null)}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1.5 min-w-0">
            <p className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest truncate">{label}</p>
            <div className="text-xl 2xl:text-2xl font-semibold text-gray-900 tracking-tight">
                <FitText>{value}</FitText>
            </div>
        </div>
    );
}

// Cumulative revenue curve for the hero. Prefers today-vs-yesterday when the
// intraday series are available, otherwise falls back to the month-to-date
// daily series so the hero is never empty.
function HeroSparkline({ intraday, fallback }: { intraday: { today: number[]; yesterday: number[] } | null; fallback: number[] }) {
    const W = 300;
    const H = 64;

    const series = intraday && intraday.today.length > 1
        ? [intraday.yesterday, intraday.today]
        : fallback.length > 1 ? [null, fallback] : null;

    if (!series) return <div className="h-[64px]" />;

    const [prev, curr] = series;
    const all = [...(prev || []), ...(curr || [])].filter(v => Number.isFinite(v));
    const max = Math.max(...all, 1);

    const path = (vals: number[] | null) => {
        if (!vals || vals.length < 2) return '';
        const step = W / (vals.length - 1);
        return vals.map((v, i) => `${(i * step).toFixed(1)},${(H - 4 - (v / max) * (H - 10)).toFixed(1)}`).join(' ');
    };

    const currPts = path(curr);
    const prevPts = path(prev);
    const lastX = W;
    const lastY = curr && curr.length > 1 ? H - 4 - ((curr[curr.length - 1] || 0) / max) * (H - 10) : H - 4;

    return (
        <div className="flex items-end gap-4 mt-1">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-full min-w-0 overflow-visible" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#235347" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#235347" stopOpacity={0} />
                    </linearGradient>
                </defs>
                {currPts && <polygon points={`0,${H} ${currPts} ${lastX},${H}`} fill="url(#heroSpark)" />}
                {prevPts && (
                    <polyline points={prevPts} fill="none" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                )}
                {currPts && (
                    <polyline points={currPts} fill="none" stroke="#235347" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                )}
                {currPts && <circle cx={lastX} cy={lastY} r={4} fill="#235347" stroke="#ffffff" strokeWidth={2} />}
            </svg>
            {prevPts && (
                <div className="flex flex-col gap-1.5 pb-1 shrink-0">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-charcoal">
                        <span className="w-2.5 h-0.5 rounded-full bg-brand-500"></span>Today
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-mid-grey">
                        <span className="w-2.5 h-0.5 rounded-full bg-cool-grey"></span>Yesterday
                    </span>
                </div>
            )}
        </div>
    );
}

function SyncStatus({ lastUpdated, refreshing }: { lastUpdated: Date | null, refreshing: boolean }) {
    const [, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    if (refreshing) return <span>Updating…</span>;
    if (!lastUpdated) return null;

    const seconds = Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    const label = seconds < 5
        ? 'Updated just now'
        : seconds < 60
            ? `Updated ${seconds}s ago`
            : `Updated ${Math.floor(seconds / 60)}m ago`;

    return <span>{label}</span>;
}
