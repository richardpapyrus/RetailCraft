"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';

interface Customer {
    id: string;
    name: string;
    code: string;
    phone: string;
    email: string;
    sales: Sale[];
}

interface Sale {
    id: string;
    createdAt: string;
    total: string;
    paymentMethod: string;
    status: string;
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
    const { user, token, isHydrated } = useAuth();
    const router = useRouter();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        loadCustomer();
    }, [token, router, isHydrated, params.id]);

    const loadCustomer = async () => {
        try {
            const data = await api.customers.get(params.id);
            setCustomer(data);
            if (data.sales) {
                setSales(data.sales);
                if (data.sales.length >= 50) setHasMore(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const [totalSales, setTotalSales] = useState(0);

    const loadMoreSales = async () => {
        if (!customer) return;
        setLoadingMore(true);
        try {
            const nextSkip = sales.length;
            const response = await api.customers.getSales(customer.id, nextSkip, 50);
            const { data, total } = response;

            // Append
            if (data.length > 0) {
                setSales(prev => [...prev, ...data]);
            }

            setTotalSales(total);
            // Check if we reached end
            if ((sales.length + data.length) >= total) {
                setHasMore(false);
            }
        } catch (e) {
            console.error("Failed to load more sales", e);
        } finally {
            setLoadingMore(false);
        }
    };

    if (loading || !isHydrated) return <div className="p-8">Loading...</div>;
    if (!customer) return <div className="p-8">Customer not found.</div>;

    return (
        <div className="h-full bg-gray-50 overflow-y-auto">
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6">
                    <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">← Back to Customers</button>
                    <div className="bg-white p-6 rounded-lg shadow flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
                            <div className="flex gap-4 mt-2 text-sm text-gray-500">
                                <span className="font-mono bg-gray-100 px-2 py-1 rounded">{customer.code}</span>
                                <span>{customer.phone || 'No Phone'}</span>
                                <span>{customer.email || 'No Email'}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500">Total Spent</div>
                            <div className="text-2xl font-bold text-indigo-600">
                                ${customer.sales?.reduce((acc, curr) => acc + Number(curr.total), 0).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sales History */}
                <h2 className="text-xl font-bold mb-4">Purchase History</h2>
                <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(sale.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                                            #{sale.id.slice(0, 8)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${sale.paymentMethod === 'CASH' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {sale.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                                            ${Number(sale.total).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                                {sales.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No purchase history.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {hasMore && (
                        <div className="p-4 border-t border-gray-100 bg-gray-50 text-center space-y-2">
                            <div className="text-gray-500 text-xs">
                                Viewing {sales.length} of {totalSales > 0 ? totalSales : 'many'} transactions
                            </div>
                            <button
                                onClick={loadMoreSales}
                                disabled={loadingMore}
                                className="px-4 py-2 bg-white border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loadingMore ? 'Loading...' : 'Load More Transactions'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
