'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { api } from '@/lib/api';

export function TopHeader() {
    const { user, selectedStoreId } = useAuth();
    const [storeName, setStoreName] = useState<string | null>(null);

    useEffect(() => {
        const fetchStoreName = async () => {
            if (!selectedStoreId) {
                setStoreName(null);
                return;
            }

            try {
                const stores = await api.stores.list(selectedStoreId);
                if (Array.isArray(stores) && stores.length > 0) {
                    setStoreName(stores[0].name);
                }
            } catch (err) {
                console.error("Failed to fetch store name for header", err);
            }
        };

        fetchStoreName();
    }, [selectedStoreId]);

    const contextLabel = storeName || 'Organization HQ';
    const isStoreContext = !!storeName;

    return (
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-10 sticky top-0 shadow-sm print:hidden">
            {/* Left: Business Branding */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    {user?.tenantLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={user.tenantLogo}
                            alt={user.tenantName}
                            className="h-10 object-contain rounded-md"
                        />
                    ) : (
                        <div className="h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 font-bold text-xl uppercase">
                            {user?.tenantName?.[0] || 'B'}
                        </div>
                    )}

                    <div className="flex flex-col">
                        <h1
                            className="font-bold text-lg leading-tight truncate max-w-[300px]"
                            style={{ color: user?.tenantBrandColor || '#111827' }}
                        >
                            {user?.tenantName || 'Business Name'}
                        </h1>
                        <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${isStoreContext ? 'text-indigo-600' : 'text-gray-400'}`}>
                            {isStoreContext ? (
                                <>
                                    <span>📍</span> {contextLabel}
                                </>
                            ) : (
                                "Organization HQ"
                            )}
                        </span>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
            </div>

            {/* Right: Product Branding & Global Actions */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Powered by</span>
                    <span className="font-bold text-gray-600 text-sm tracking-tight flex items-center gap-1">
                        RetailCraft
                    </span>
                </div>
            </div>
        </header>
    );
}
