"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
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
    RotateCcw
} from 'lucide-react';
import { EODReport } from '@/components/reporting/EODReport';
import { SaleDetailModal } from '@/components/sales/SaleDetailModal';

export default function DashboardPage() {
    const { user, token, isHydrated } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState<any>(null);

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

    useEffect(() => {
        if (!isHydrated || !token) return;

        const fetchData = async (isBackground = false) => {
            if (!isBackground) setLoading(true);
            try {
                // Determine endpoint (HQ vs Store Level)
                // Note: We use existing sales.stats method which works for both IF the backend supports filtering
                // Ideally we'd use separate endpoints but for minimal risk we stick to what works, 
                // just refreshed automatically.
                const s = await api.sales.stats(dateRange.from, dateRange.to, selectedStoreId || undefined);
                setStats(s);
            } catch (error) {
                console.error('Failed to fetch stats', error);
            } finally {
                if (!isBackground) setLoading(false);
            }
        };

        // Initial Load
        fetchData();

        // 5-Second Auto-Refresh (Simulates Real-time)
        const intervalId = setInterval(() => {
            fetchData(true);
        }, 5000);

        return () => clearInterval(intervalId);
    }, [dateRange, selectedStoreId, token, isHydrated]);

    if (!isHydrated) return null;

    return (
        <div className="h-full bg-canvas overflow-y-auto font-sans">
            <div className="max-w-[1600px] mx-auto p-8 lg:p-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
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

                        {/* EOD Report Button */}
                        <button
                            onClick={() => window.print()}
                            className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center shadow-soft"
                        >
                            <FileText size={16} className="mr-2" />
                            EOD Report
                        </button>

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

                {loading && !stats ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
                    </div>
                ) : (
                    <>
                        {(() => {
                            const revenue = stats?.filtered?.revenue || 0;
                            const profit = stats?.filtered?.profit || 0;
                            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
                                    <StatsCard
                                        title="Revenue"
                                        value={formatCurrency(revenue, user?.currency, user?.locale)}
                                        icon={<DollarSign size={20} className="text-brand-600" />}
                                        bgColor="bg-brand-50"
                                        subtext="Selected Period"
                                    />
                                    <StatsCard
                                        title="Profit"
                                        value={formatCurrency(profit, user?.currency, user?.locale)}
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
                                        value={stats?.filtered?.count || 0}
                                        icon={<FileText size={20} className="text-charcoal" />}
                                        bgColor="bg-surface-muted"
                                        subtext="Selected Period"
                                    />
                                    <StatsCard
                                        title="Comparison"
                                        value={formatCurrency(stats?.comparison?.revenue, user?.currency, user?.locale)}
                                        icon={<Calendar size={20} className="text-charcoal" />}
                                        bgColor="bg-surface-muted"
                                        subtext="Previous Period"
                                    />
                                </div>
                            );
                        })()}
                        {/* End of Stats Grid */}

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
                                                        <stop offset="5%" stopColor="#38C3B5" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#38C3B5" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="day"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                                                    dy={10}
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
                                                    stroke="#38C3B5"
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

                                {/* Discounts & Refunds Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Link href="/sales?filter=discount" className="block cursor-pointer">
                                        <StatsCard
                                            title="Discounts Given"
                                            value={formatCurrency(stats?.filtered?.totalDiscount || 0, user?.currency, user?.locale)}
                                            icon={<Tag size={20} className="text-charcoal" />}
                                            bgColor="bg-surface-muted"
                                            subtext="Click to view history"
                                        />
                                    </Link>
                                    <Link href="/sales?filter=refund" className="block cursor-pointer">
                                        <StatsCard
                                            title="Refunds Processed"
                                            value={formatCurrency(stats?.filtered?.totalRefund || 0, user?.currency, user?.locale)}
                                            icon={<RotateCcw size={20} className="text-red-500" />}
                                            bgColor="bg-red-50"
                                            subtext="Click to view history"
                                        />
                                    </Link>
                                </div>

                                {/* Best Sellers */}
                                <div className="bg-white p-8 rounded-2xl shadow-card border border-gray-100/80 flex-1 flex flex-col">
                                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">Best Sellers</h2>
                                    <div className="flex-1">
                                        <BestSellersWidget from={dateRange.from} to={dateRange.to} storeId={selectedStoreId || undefined} />
                                    </div>
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
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${sale.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                        }`}>
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
            {
                stats && !selectedSale && (
                    <EODReport
                        stats={stats}
                        user={user}
                        dateRange={dateRange}
                        storeName={selectedStoreId
                            ? stores.find(s => s.id === selectedStoreId)?.name
                            : (!isAdmin && user?.store?.name)
                                ? user.store.name
                                : undefined // Falls back to Tenant Name/All Locations in component
                        }
                    />
                )
            }
        </div >
    );
}

function StatsCard({ title, value, icon, bgColor, subtext }: { title: string, value: string | number, icon: React.ReactNode, bgColor: string, subtext?: string }) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-card border border-gray-100/80 hover:shadow-lifted transition-shadow duration-300">
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
                {subtext && <p className="text-xs font-medium text-mid-grey truncate">{subtext}</p>}
            </div>
        </div>
    );
}
