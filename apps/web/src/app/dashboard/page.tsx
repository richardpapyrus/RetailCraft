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
import Link from 'next/link';
import {
    DollarSign,
    TrendingUp,
    FileText,
    Calendar,
    ChevronDown,
    MapPin
} from 'lucide-react';
import { EODReport } from '@/components/reporting/EODReport';

export default function DashboardPage() {
    const { user, token, isHydrated } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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
    }, [token, isHydrated, router]);

    useEffect(() => {
        if (isAdmin) {
            api.stores.list().then(setStores).catch(console.error);
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!isHydrated || !token) return;

        setLoading(true);
        const fetchData = async () => {
            try {
                const s = await api.sales.stats(dateRange.from, dateRange.to, selectedStoreId || undefined);
                setStats(s);
            } catch (error) {
                console.error('Failed to fetch stats', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [dateRange, selectedStoreId, token, isHydrated]);

    if (!isHydrated) return null;

    return (
        <div className="h-full bg-[#f8f9fc] overflow-y-auto font-sans">
            <div className="max-w-[1600px] mx-auto p-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                    <div className="flex flex-col">
                        <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight leading-tight">
                            {selectedStoreId
                                ? stores.find(s => s.id === selectedStoreId)?.name
                                : (!isAdmin && user?.store?.name)
                                    ? user.store.name
                                    : (user?.tenantName || 'RetailCraft')}
                        </h1>
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                            {selectedStoreId || (!isAdmin && user?.store) ? 'Store Dashboard' : 'HQ Dashboard'}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Store Selector Removed - Moved to Sidebar */}

                        {/* EOD Report Button */}
                        <button
                            onClick={() => window.print()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center shadow-sm"
                        >
                            <FileText size={16} className="mr-2" />
                            EOD Report
                        </button>

                        {/* Date Picker Pill */}
                        <div className="flex items-center bg-white px-1 py-1 rounded-full shadow-sm border border-gray-100">
                            <div className="flex items-center px-4 py-2 border-r border-gray-100">
                                <span className="text-xs font-bold text-gray-400 mr-2 uppercase tracking-wide">From</span>
                                <input
                                    type="date"
                                    value={dateRange.from}
                                    className="text-sm font-semibold text-gray-700 bg-transparent border-none focus:ring-0 p-0"
                                    onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                />
                            </div>
                            <div className="flex items-center px-4 py-2">
                                <span className="text-xs font-bold text-gray-400 mr-2 uppercase tracking-wide">To</span>
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
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            <StatsCard
                                title="Revenue"
                                value={formatCurrency(stats?.filtered?.revenue, user?.currency, user?.locale)}
                                icon={<DollarSign size={24} className="text-yellow-600" />}
                                bgColor="bg-yellow-50"
                                subtext="Selected Period"
                            />
                            <StatsCard
                                title="Profit"
                                value={formatCurrency(stats?.filtered?.profit, user?.currency, user?.locale)}
                                icon={<TrendingUp size={24} className="text-rose-500" />}
                                bgColor="bg-rose-50"
                                subtext="Selected Period"
                            />
                            <StatsCard
                                title="Transactions"
                                value={stats?.filtered?.count || 0}
                                icon={<FileText size={24} className="text-blue-500" />}
                                bgColor="bg-blue-50"
                                subtext="Selected Period"
                            />
                            <StatsCard
                                title="Comparison"
                                value={formatCurrency(stats?.comparison?.revenue, user?.currency, user?.locale)}
                                icon={<Calendar size={24} className="text-orange-500" />}
                                bgColor="bg-orange-50"
                                subtext="Previous Period"
                            />
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                            {/* Left Column: Chart & Best Sellers */}
                            <div className="xl:col-span-2 space-y-8">
                                {/* Chart Section */}
                                <div className="bg-white p-8 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)]">
                                    <div className="mb-8">
                                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Month to Date Trend</h2>
                                        <p className="text-sm text-gray-500 font-medium">Daily sales comparison: Current Month vs Previous Month</p>
                                    </div>
                                    <div className="h-[400px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={stats?.trendChartData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
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
                                                    stroke="#6366f1"
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

                                {/* Best Sellers */}
                                <div className="bg-white p-8 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)]">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Best Sellers</h2>
                                    <BestSellersWidget from={dateRange.from} to={dateRange.to} storeId={selectedStoreId || undefined} />
                                </div>
                            </div>

                            {/* Right Column: Recent Sales */}
                            <div>
                                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] sticky top-8">
                                    <div className="flex justify-between items-center mb-6 pl-2 pr-2 pt-2">
                                        <h2 className="text-xl font-bold text-gray-900">Recent Sales</h2>
                                        <Link href="/sales" className="text-sm text-indigo-600 hover:text-indigo-800 font-bold">View All</Link>
                                    </div>
                                    <div className="space-y-1">
                                        {stats?.recentSales?.map((sale: any) => (
                                            <div key={sale.id} className="group flex justify-between items-center p-4 hover:bg-gray-50 rounded-2xl transition-all duration-200">
                                                <div>
                                                    <div className="font-bold text-gray-900 mb-1">{sale.customer?.name || 'Walk-In Customer'}</div>
                                                    <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                                                        <span>{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                        <span className="text-indigo-500">{sale.user?.name || sale.user?.email}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-gray-900 text-lg">{formatCurrency(sale.total, user?.currency, user?.locale)}</div>
                                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded-lg inline-block mt-1">
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
                    </>
                )}
            </div>
            {stats && (
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
            )}
        </div>
    );
}

function StatsCard({ title, value, icon, bgColor, subtext }: { title: string, value: string | number, icon: React.ReactNode, bgColor: string, subtext?: string }) {
    return (
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 flex items-center gap-6 hover:-translate-y-1 transition-transform duration-300">
            <div className={`w-16 h-16 rounded-2xl ${bgColor} flex items-center justify-center shrink-0`}>
                {icon}
            </div>
            <div>
                <p className="text-sm font-bold text-gray-400 mb-1 uppercase tracking-wide">{title}</p>
                <p className="text-3xl font-extrabold text-[#111827] mb-1">{value}</p>
                {subtext && <p className="text-xs font-medium text-gray-400">{subtext}</p>}
            </div>
        </div>
    );
}
