"use client";

import { useState, useEffect } from 'react';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { api } from '@/lib/api';
import { Award, Gift, TrendingUp, Users, ArrowRight, Settings } from 'lucide-react';
import Link from 'next/link';

export default function LoyaltyPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalPoints: 0,
        enrolledCustomers: 0,
        topCustomers: [] as any[]
    });
    const [settings, setSettings] = useState({
        earnRate: 1.0,
        redeemRate: 0.10,
        expiryDays: 365
    });
    const [loading, setLoading] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editSettings, setEditSettings] = useState({ ...settings });

    useEffect(() => {
        loadData();
    }, [user?.tenant]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load Settings from User Context (if available) or refresh profile?
            // Since we updated schema, user object needs refresh to see new fields.
            // But api.auth.me returns tenant object potentially.
            // For now, assume user.tenant has them or fallback.
            if (user?.tenant) {
                setSettings({
                    earnRate: Number(user.tenant.loyaltyEarnRate) || 1.0,
                    redeemRate: Number(user.tenant.loyaltyRedeemRate) || 0.10,
                    expiryDays: Number(user.tenant.loyaltyExpiryDays) || 365
                });
            }

            // Load Stats
            const customers = await api.customers.list();

            const withPoints = customers.filter((c: any) => c.loyaltyPoints > 0);
            const totalPoints = withPoints.reduce((sum: number, c: any) => sum + c.loyaltyPoints, 0);
            const top = [...withPoints].sort((a: any, b: any) => b.loyaltyPoints - a.loyaltyPoints).slice(0, 5);

            setStats({
                totalPoints,
                enrolledCustomers: withPoints.length,
                topCustomers: top
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        try {
            if (!user?.tenantId) return;
            await api.tenants.update(user.tenantId, {
                loyaltyEarnRate: Number(editSettings.earnRate),
                loyaltyRedeemRate: Number(editSettings.redeemRate),
                loyaltyExpiryDays: Number(editSettings.expiryDays)
            });
            setSettings(editSettings);
            setIsSettingsOpen(false);
            // Ideally trigger a profile refresh here
        } catch (e) {
            console.error(e);
            alert('Failed to save settings');
        }
    };

    const openSettings = () => {
        setEditSettings({ ...settings });
        setIsSettingsOpen(true);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <Award className="w-8 h-8 text-indigo-600" />
                        Loyalty Program
                    </h1>
                    <p className="text-gray-500 mt-1">Manage rewards and view customer loyalty insights.</p>
                </div>
                <button
                    onClick={openSettings}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-bold transition-colors"
                >
                    <Settings size={18} />
                    Configure Rules
                </button>
            </div>

            {/* Program Rules Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-3xl p-8 text-white shadow-xl mb-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full transform translate-x-1/3 -translate-y-1/3"></div>

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Current Reward Configuration</h2>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                                <TrendingUp className="w-8 h-8 text-indigo-300" />
                                <div>
                                    <p className="text-xs text-indigo-200 uppercase font-bold tracking-widest">Earning</p>
                                    <p className="font-bold text-lg">{settings.earnRate} Point{settings.earnRate !== 1 ? 's' : ''} per {formatCurrency(1)} spent</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                                <Gift className="w-8 h-8 text-pink-300" />
                                <div>
                                    <p className="text-xs text-indigo-200 uppercase font-bold tracking-widest">Redemption</p>
                                    <p className="font-bold text-lg">1 Point = {formatCurrency(settings.redeemRate)} discount</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-md">
                        <h3 className="font-bold mb-4 border-b border-white/20 pb-2">Example Scenario</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span>Spend</span>
                                <span className="font-mono">{formatCurrency(100)}</span>
                            </div>
                            <div className="flex justify-between text-green-300">
                                <span>Earn</span>
                                <span className="font-bold">{100 * settings.earnRate} Points</span>
                            </div>
                            <div className="flex justify-between text-pink-300 pt-2 border-t border-white/10 mt-2">
                                <span>Redeem Value</span>
                                <span className="font-bold font-mono">{formatCurrency((100 * settings.earnRate) * settings.redeemRate)}</span>
                            </div>
                            <div className="mt-4 text-xs text-indigo-200">
                                * Points expire after {settings.expiryDays} days of inactivity
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-orange-100 p-3 rounded-xl text-orange-600">
                            <Users size={24} />
                        </div>
                        <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Active</span>
                    </div>
                    <div className="text-4xl font-black text-gray-900 mb-1">{stats.enrolledCustomers}</div>
                    <p className="text-gray-500 text-sm font-medium">Customers with Points Balance</p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                            <Award size={24} />
                        </div>
                    </div>
                    <div className="text-4xl font-black text-gray-900 mb-1">{stats.totalPoints.toLocaleString()}</div>
                    <p className="text-gray-500 text-sm font-medium">Total Points Outstanding</p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-green-100 p-3 rounded-xl text-green-600">
                            <span className="font-bold text-xl">$</span>
                        </div>
                    </div>
                    <div className="text-4xl font-black text-gray-900 mb-1">
                        {formatCurrency(stats.totalPoints * settings.redeemRate, user?.currency, user?.locale)}
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Potential Discount Value</p>
                </div>
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-900">Top Loyal Customers</h3>
                    <Link href="/customers" className="text-indigo-600 text-sm font-bold flex items-center hover:underline">
                        View All Customers <ArrowRight size={16} className="ml-1" />
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Ranking</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Points Balance</th>
                                <th className="px-6 py-4 text-right">Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats.topCustomers.map((c, i) => (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                            ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                i === 1 ? 'bg-gray-100 text-gray-700' :
                                                    i === 2 ? 'bg-orange-100 text-orange-800' : 'bg-white text-gray-500 border border-gray-200'}
                                        `}>
                                            {i + 1}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">{c.name}</div>
                                        <div className="text-xs text-gray-500">{c.email || c.phone || 'No contact info'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                            {c.loyaltyPoints} pts
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-green-600">
                                        {formatCurrency(c.loyaltyPoints * settings.redeemRate, user?.currency, user?.locale)}
                                    </td>
                                </tr>
                            ))}
                            {stats.topCustomers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                        No loyalty data available yet. Start making sales to earn points!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 w-[400px]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Settings className="text-indigo-600" />
                            Loyalty Configuration
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                    Points Earned per Currency Unit
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-lg"
                                        value={editSettings.earnRate}
                                        onChange={e => setEditSettings({ ...editSettings, earnRate: parseFloat(e.target.value) })}
                                    />
                                    <span className="absolute right-4 top-3 text-sm text-gray-400 font-bold">Pts / {user?.currency || '$'}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Example: 1.0 = 1 Point for every $1 spent</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                    Redemption Value per Point
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-lg font-bold text-gray-400">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full border-2 border-gray-200 rounded-xl pl-8 pr-4 py-2 font-bold text-lg"
                                        value={editSettings.redeemRate}
                                        onChange={e => setEditSettings({ ...editSettings, redeemRate: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Example: 0.10 = 10 Points is $1.00 Discount</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                    Points Expiry (Days)
                                </label>
                                <input
                                    type="number"
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-lg"
                                    value={editSettings.expiryDays}
                                    onChange={e => setEditSettings({ ...editSettings, expiryDays: parseInt(e.target.value) })}
                                />
                                <p className="text-xs text-gray-400 mt-1">Days after last purchase until points reset.</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveSettings}
                                className="flex-1 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200"
                            >
                                Save Rules
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
