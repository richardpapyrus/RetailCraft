"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

export function StoreSelector() {
    const { user, selectedStoreId, setSelectedStoreId, hasPermission } = useAuth();
    const [stores, setStores] = useState<any[]>([]);

    // Only show for admins
    const isAdmin = hasPermission('*') || user?.role === 'Administrator' || user?.role === 'ADMIN';

    useEffect(() => {
        if (isAdmin && user?.tenantId) {
            api.stores.list().then(setStores).catch(console.error);
        }
    }, [isAdmin, user?.tenantId]);

    if (!isAdmin) return null;

    return (
        <div className="px-3 mb-4 w-full">
            <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block px-1">
                Store Context
            </label>
            <select
                value={selectedStoreId || ''}
                onChange={(e) => setSelectedStoreId(e.target.value || null)}
                className="w-full text-sm border-gray-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50/50"
            >
                <option value="">All Locations (HQ)</option>
                {stores.map(store => (
                    <option key={store.id} value={store.id}>
                        {store.name}
                    </option>
                ))}
            </select>
        </div>
    );
}
