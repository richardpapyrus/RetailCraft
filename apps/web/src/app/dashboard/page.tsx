"use client";

import { useEffect, useState } from 'react';
import { api, ExpenseMonthToDate } from '@/lib/api';
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
    DollarSign,
    TrendingUp,
    FileText,
    Calendar,
    Percent,
    Tag,
    RotateCcw,
    Download,
    RefreshCw,
    Wallet,
    TrendingDown
} from 'lucide-react';
import { SaleDetailModal } from '@/components/sales/SaleDetailModal';
import DateRangePresets from '@/components/dashboard/DateRangePresets';
import PaymentMixChart from '@/components/dashboard/PaymentMixChart';
import CategoryBreakdownChart from '@/components/dashboard/CategoryBreakdownChart';
import HourlyHeatmap from '@/components/dashboard/HourlyHeatmap';
import StaffLeaderboard from '@/components/dashboard/StaffLeaderboard';
import LowStockWidget from '@/components/dashboard/LowStockWidget';
import InventoryAgingWidget from '@/components/dashboard/InventoryAgingWidget';

export default function DashboardPage() {
    const { user, token, isHydrated, hasPermission } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    // Month-to-date expense figures. Fetched independently of `dateRange` so the
    // date picker below never changes them.
    const [mtdExpenses, setMtdExpenses] = useState<ExpenseMonthToDate | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState<any>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshNonce, setRefreshNonce] = useState(0);

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

    if (!isHydrated) return null;

    const storeName = selectedStoreId
        ? stores.find(s => s.id === selectedStoreId)?.name
        : (!isAdmin && user?.store?.name)
            ? user.store.name
            : undefined; // Falls back to Tenant Name/All Locations

    return (
        <div className="h-full bg-canvas overflow-y-auto font-sans">
            <div className="max-w-[1600px] mx-auto p-8 lg:p-12 animate-fade-in-up">
                {/* Header */}
                <div className="flex flex-col gap-6 mb-12">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-3xl lg:text-4xl font-semibold text-gray-900 tracking-tight leading-tight">
                                Dashboard
                            </h1>
                            <span className="text-sm font-medium text-mid-grey tracking-wide">
                                {selectedStoreId || (!isAdmin && user?.store) ? 'Store performance overview' : 'Organization performance overview'}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {/* Store Selector Removed - Moved to Sidebar */}

                            {/* EOD Report Buttons */}
                            <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-soft border border-gray-100">
                                <button
                                    onClick={() => {
                                        const q = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
                                        if (selectedStoreId) q.append('storeId', selectedStoreId);
                                        if (storeName) q.append('store', storeName);
                                        router.push(`/reports/eod?${q.toString()}`);
                                    }}
                                    className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center"
                                >
                                    <FileText size={16} className="mr-2" />
                                    EOD Report
                                </button>
                                <button
                                    onClick={() => {
                                        const q = new URLSearchParams({ from: dateRange.from, to: dateRange.to, download: '1' });
                                        if (selectedStoreId) q.append('storeId', selectedStoreId);
                                        if (storeName) q.append('store', storeName);
                                        router.push(`/reports/eod?${q.toString()}`);
                                    }}
                                    disabled={!stats}
                                    className="text-charcoal hover:bg-surface-muted px-4 py-2 rounded-lg font-semibold text-sm flex items-center disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Download the EOD report as a PDF"
                                >
                                    <Download size={16} className="mr-2" />
                                    Download PDF
                                </button>
                            </div>

                            {/* Date Picker Pill */}
                            <div className="flex items-center bg-white px-1 py-1 rounded-xl shadow-soft border border-gray-100">
                                <div className="flex items-center px-4 py-2 border-r border-gray-100">
                                    <span className="text-xs font-semibold text-mid-grey mr-2 uppercase tracking-wide">From</span>
                                    <input
                                        type="date"
                                        value={dateRange.from}
                                        className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 p-0"
                                        onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                    />
                                </div>
                                <div className="flex items-center px-4 py-2">
                                    <span className="text-xs font-semibold text-gray-400 mr-2 uppercase tracking-wide">To</span>
                                    <input
                                        type="date"
                                        value={dateRange.to}
                                        className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 p-0"
                                        onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <DateRangePresets dateRange={dateRange} onSelect={setDateRange} />
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
                    </div>
                </div>

                {loading && !stats ? (
                    <div className="animate-fade-in-up">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="bg-white rounded-2xl p-6 shadow-card border border-gray-100/80">
                                    <div className="skeleton h-3 w-20 mb-5"></div>
                                    <div className="skeleton h-8 w-28 mb-2"></div>
                                    <div className="skeleton h-3 w-24"></div>
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
                        {(() => {
                            const revenue = stats?.filtered?.revenue || 0;
                            const profit = stats?.filtered?.profit || 0;
                            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                            const count = stats?.filtered?.count || 0;
                            const avgBasket = count > 0 ? revenue / count : 0;
                            const prevRevenue = Number(stats?.comparison?.revenue) || 0;
                            const revenueDelta = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;
                            // Trim trailing ".00" for an executive-friendly dashboard read
                            const compact = (s: string) => s.replace(/([.,]00)(?=\s|$)/, '');

                            // The API compares against the immediately preceding equal-length
                            // window (and, for "today", up to the same time yesterday). Label it
                            // to match so the card states exactly what the delta is measured against.
                            const todayStr = new Date().toISOString().split('T')[0];
                            const isSingleDay = dateRange.from === dateRange.to;
                            const isTodayView = isSingleDay && dateRange.from === todayStr;
                            const comparisonLabel = isTodayView
                                ? 'vs same time yesterday'
                                : isSingleDay
                                    ? 'vs previous day'
                                    : 'vs previous period';

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
                                    <StatsCard
                                        title="Revenue"
                                        value={compact(formatCurrency(revenue, user?.currency, user?.locale))}
                                        icon={<DollarSign size={20} className="text-brand-600" />}
                                        bgColor="bg-brand-50"
                                        subtext={revenueDelta === null ? `No sales ${comparisonLabel.replace('vs ', '')}` : undefined}
                                        trend={revenueDelta !== null ? { value: revenueDelta, label: comparisonLabel } : undefined}
                                        sparkline={stats?.trendChartData?.filter((d: any) => d.current !== null && d.current !== undefined).map((d: any) => Number(d.current) || 0)}
                                    />
                                    <StatsCard
                                        title="Profit"
                                        value={compact(formatCurrency(profit, user?.currency, user?.locale))}
                                        icon={<TrendingUp size={20} className="text-brand-600" />}
                                        bgColor="bg-brand-50"
                                        subtext="Selected Period"
                                    />
                                    <StatsCard
                                        title="Margin"
                                        value={`${margin.toFixed(1)}%`}
                                        icon={<Percent size={20} className="text-brand-600" />}
                                        bgColor="bg-brand-50"
                                        subtext="Selected Period"
                                    />
                                    <StatsCard
                                        title="Transactions"
                                        value={count}
                                        icon={<FileText size={20} className="text-charcoal" />}
                                        bgColor="bg-surface-muted"
                                        subtext="Selected Period"
                                    />
                                    <StatsCard
                                        title="Avg. Basket"
                                        value={compact(formatCurrency(avgBasket, user?.currency, user?.locale))}
                                        icon={<Calendar size={20} className="text-charcoal" />}
                                        bgColor="bg-surface-muted"
                                        subtext="Revenue per sale"
                                    />
                                </div>
                            );
                        })()}
                        {/* End of Stats Grid */}

                        {/* Month-to-date financials. Kept in their own labelled row
                            because, unlike everything above, they ignore the date
                            filter and always cover the current calendar month. */}
                        {mtdExpenses && (
                            <div className="mb-10">
                                <div className="flex items-baseline gap-2 mb-4">
                                    <h2 className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest">
                                        Month to date
                                    </h2>
                                    <span className="text-[11px] text-mid-grey">
                                        · {mtdExpenses.monthLabel} · not affected by the date filter above
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <StatsCard
                                        title="Month-to-Date Expenses"
                                        value={formatCurrency(mtdExpenses.expenses.total, user?.currency, user?.locale).replace(/([.,]00)(?=\s|$)/, '')}
                                        icon={<Wallet size={20} className="text-brand-600" />}
                                        bgColor="bg-brand-50"
                                        subtext={`${mtdExpenses.expenses.count} expense${mtdExpenses.expenses.count === 1 ? '' : 's'} this month`}
                                    />
                                    <StatsCard
                                        title="Month-to-Date Net Profit"
                                        value={formatCurrency(mtdExpenses.netProfit.total, user?.currency, user?.locale).replace(/([.,]00)(?=\s|$)/, '')}
                                        icon={mtdExpenses.netProfit.total >= 0
                                            ? <TrendingUp size={20} className="text-brand-600" />
                                            : <TrendingDown size={20} className="text-red-500" />}
                                        bgColor={mtdExpenses.netProfit.total >= 0 ? 'bg-brand-50' : 'bg-red-50'}
                                        subtext="Gross profit less expenses"
                                    />
                                    <StatsCard
                                        title="Month-to-Date Gross Profit"
                                        value={formatCurrency(mtdExpenses.grossProfit.total, user?.currency, user?.locale).replace(/([.,]00)(?=\s|$)/, '')}
                                        icon={<Percent size={20} className="text-charcoal" />}
                                        bgColor="bg-surface-muted"
                                        subtext={mtdExpenses.expenseToSalesRatio !== null
                                            ? `Expenses are ${mtdExpenses.expenseToSalesRatio.toFixed(1)}% of sales`
                                            : 'Before expenses'}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                            {/* Left Column: Chart & Best Sellers */}
                            <div className="xl:col-span-2 flex flex-col gap-8">
                                {/* Chart Section */}
                                <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
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
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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

                                {/* Payment Mix & Category Breakdown */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">Payment Mix</h2>
                                        <PaymentMixChart breakdown={stats?.filtered?.paymentBreakdown} />
                                    </div>
                                    <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">Sales by Category</h2>
                                        <CategoryBreakdownChart from={dateRange.from} to={dateRange.to} storeId={selectedStoreId || undefined} />
                                    </div>
                                </div>

                                {/* Discounts & Refunds Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Link href="/sales?filter=discount" className="block cursor-pointer">
                                        <StatsCard
                                            title="Discounts Given"
                                            value={formatCurrency(stats?.filtered?.totalDiscount || 0, user?.currency, user?.locale)}
                                            icon={<Tag size={20} className="text-charcoal" />}
                                            bgColor="bg-surface-muted"
                                            subtext="View history →"
                                            isLink
                                        />
                                    </Link>
                                    <Link href="/sales?filter=refund" className="block cursor-pointer">
                                        <StatsCard
                                            title="Refunds Processed"
                                            value={formatCurrency(stats?.filtered?.totalRefund || 0, user?.currency, user?.locale)}
                                            icon={<RotateCcw size={20} className="text-red-500" />}
                                            bgColor="bg-red-50"
                                            subtext="View history →"
                                            isLink
                                        />
                                    </Link>
                                </div>

                                {/* Low Stock */}
                                <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">Inventory Health</h2>
                                    <LowStockWidget storeId={selectedStoreId || undefined} />
                                </div>

                                {/* Aging Inventory */}
                                <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                    <div className="mb-6">
                                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">Aging Inventory</h2>
                                        <p className="text-sm text-mid-grey font-medium">Oldest stock that isn't selling — capital sitting on the shelf</p>
                                    </div>
                                    <InventoryAgingWidget storeId={selectedStoreId || undefined} />
                                </div>

                                {/* Best Sellers & Staff Leaderboard */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80 flex flex-col">
                                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">Best Sellers</h2>
                                        <div className="flex-1">
                                            <BestSellersWidget from={dateRange.from} to={dateRange.to} storeId={selectedStoreId || undefined} />
                                        </div>
                                    </div>
                                    <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80 flex flex-col">
                                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">Staff Leaderboard</h2>
                                        <div className="flex-1">
                                            <StaffLeaderboard from={dateRange.from} to={dateRange.to} storeId={selectedStoreId || undefined} />
                                        </div>
                                    </div>
                                </div>

                                {/* Hourly Heatmap */}
                                <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80">
                                    <div className="mb-6">
                                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">When You're Busy</h2>
                                        <p className="text-sm text-mid-grey font-medium">Hourly sales vs the hourly average — last 7 days plus today, live</p>
                                    </div>
                                    <HourlyHeatmap storeId={selectedStoreId || undefined} />
                                </div>
                            </div>

                            {/* Right Column: Recent Sales */}
                            <div>
                                <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80 sticky top-8">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Recent Sales</h2>
                                        <Link href="/sales" className="text-sm text-brand-600 hover:text-brand-700 font-semibold">View all</Link>
                                    </div>
                                    <div className="space-y-6">
                                        {stats?.recentSales?.map((sale: any) => (
                                            <div
                                                key={sale.id}
                                                onClick={() => setSelectedSale(sale)}
                                                className="flex justify-between items-center group cursor-pointer hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-brand-50 text-brand-700">
                                                        {sale.customer?.name?.[0] || 'W'}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 text-sm">{sale.customer?.name || 'Walk-In Customer'}</div>
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
                                                            <span>{sale.user?.name?.split(' ')[0] || 'Staff'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {(() => {
                                                        const refundTotal = (sale as any).returns?.reduce((sum: number, ret: any) => sum + Number(ret.total), 0) || 0;
                                                        const originalTotal = Number(sale.total);
                                                        const netTotal = originalTotal - refundTotal;
                                                        const hasRefund = refundTotal > 0;

                                                        return hasRefund ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-gray-400 line-through text-xs">{formatCurrency(originalTotal, user?.currency, user?.locale)}</span>
                                                                <span className="font-semibold text-red-600 text-base">{formatCurrency(netTotal, user?.currency, user?.locale)}</span>
                                                                <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded uppercase tracking-wider mt-0.5">Refunded</span>
                                                            </div>
                                                        ) : (
                                                            <div className="font-semibold text-gray-900 text-base">{formatCurrency(originalTotal, user?.currency, user?.locale)}</div>
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
                        </div>

                        {selectedSale && (
                            <SaleDetailModal
                                sale={selectedSale}
                                onClose={() => setSelectedSale(null)}
                            />
                        )}
                    </>
                )}
            </div>
        </div >
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

function StatsCard({ title, value, icon, bgColor, subtext, trend, isLink, sparkline }: {
    title: string,
    value: string | number,
    icon: React.ReactNode,
    bgColor: string,
    subtext?: string,
    trend?: { value: number, label: string },
    isLink?: boolean,
    sparkline?: number[]
}) {
    const sparkData = (sparkline || []).filter(v => Number.isFinite(v));
    const gradientId = `spark-${title.replace(/[^a-zA-Z0-9]/g, '')}`;

    return (
        <div className={`bg-white rounded-2xl p-6 shadow-card border border-gray-100/80 transition-all duration-300 ${isLink ? 'hover:shadow-lifted hover:-translate-y-0.5' : 'hover:shadow-lifted'}`}>
            <div className="flex items-start justify-between gap-3 mb-5">
                <p className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest truncate pt-1.5">{title}</p>
                <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
                    {icon}
                </div>
            </div>
            <div className="min-w-0">
                <div className="text-xl xl:text-2xl 2xl:text-3xl font-semibold text-gray-900 tracking-tight mb-1">
                    <FitText>{value}</FitText>
                </div>
                {trend && (
                    <p className="text-xs font-medium flex items-center gap-1.5 truncate">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold ${trend.value >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value).toFixed(1)}%
                        </span>
                        <span className="text-mid-grey">{trend.label}</span>
                    </p>
                )}
                {!trend && subtext && (
                    <p className={`text-xs font-medium truncate ${isLink ? 'text-brand-600' : 'text-mid-grey'}`}>{subtext}</p>
                )}
                {sparkData.length > 1 && (
                    <div className="h-8 -mx-1 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sparkData.map(v => ({ v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#235347" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#235347" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="v" stroke="#235347" strokeWidth={1.5} fill={`url(#${gradientId})`} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
