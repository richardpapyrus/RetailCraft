"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function BestSellersWidget({ from, to, storeId }: { from?: string, to?: string, storeId?: string }) {
    const [products, setProducts] = useState<any[]>([]);
    const [sortBy, setSortBy] = useState<'value' | 'count'>('value');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [from, to, sortBy, storeId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res: any = await api.sales.topProducts({ from, to, sortBy, limit: 10, storeId: storeId || undefined });
            setProducts(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-end items-center mb-6">
                {/* Title handles by parent, or we can add it here if needed, but per previous file parent has title. 
                     Actually, parent has title 'Best Sellers', this widget has toggle.
                     Let's alignment: Parent has title. Widget just provides content? 
                     BUT widget has the toggle state. 
                     Let's put the toggle aligned to the right.
                 */}
                <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-bold">
                    <button
                        onClick={() => setSortBy('value')}
                        className={`px-3 py-1.5 rounded-md transition-all ${sortBy === 'value' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Value
                    </button>
                    <button
                        onClick={() => setSortBy('count')}
                        className={`px-3 py-1.5 rounded-md transition-all ${sortBy === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Qty
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading...</div>
                ) : (
                    <>
                        {products.map((p, idx) => (
                            <div key={p.productId} className="flex items-center justify-between group">
                                <div className="flex items-center gap-5">
                                    <span className={`w-10 h-10 flex items-center justify-center text-sm font-bold rounded-full shrink-0 ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-50 text-gray-500'}`}>
                                        {idx + 1}
                                    </span>
                                    <div>
                                        <div className="font-bold text-gray-900 text-base mb-0.5">{p.name}</div>
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">{p.sku}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-gray-900 text-lg">
                                        {sortBy === 'value' ? `$${p.value.toFixed(2)}` : p.quantity}
                                    </div>
                                    <div className="text-xs font-medium text-gray-400">
                                        {sortBy === 'value' ? `${p.quantity} sold` : `$${p.value.toFixed(2)}`}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {products.length === 0 && (
                            <div className="text-center py-12 text-gray-400">No sales in this period</div>
                        )}
                    </>
                )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-50 text-center">
                <Link href="/reports/top-products" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                    View Full Report
                </Link>
            </div>
        </div>
    );
}
