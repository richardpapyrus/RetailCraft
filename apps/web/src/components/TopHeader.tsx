'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { api, API_URL } from '@/lib/api';

export function TopHeader() {
    const { user, selectedStoreId, setSelectedStoreId } = useAuth();
    const [stores, setStores] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStores();
    }, [user?.tenantId]);

    const loadStores = async () => {
        try {
            setError(null);
            console.log("Fetching stores for tenant:", user?.tenantId);
            const data = await api.stores.list();
            console.log("Stores fetched:", data);
            setStores(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error("Store Fetch Error:", err);
            setError(err.message || "Failed to load stores");
        }
    };


    const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedStoreId(val === '' ? null : val);
        window.location.reload(); // Reload to ensure all context refreshes clean
    };

    const currentStore = stores.find(s => s.id === selectedStoreId);

    return (
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-10 sticky top-0 shadow-sm print:hidden">
            {/* Left: Business Branding & Store Selector */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    {user?.tenantLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={user.tenantLogo.startsWith('http') ? user.tenantLogo : `${API_URL}${user.tenantLogo}`}
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
                            className="font-bold text-lg leading-tight truncate max-w-[200px]"
                            style={{ color: user?.tenantBrandColor || '#111827' }}
                        >
                            {user?.tenantName || 'Business Name'}
                        </h1>
                        <div className="flex items-center gap-1 mt-0.5">
                            <div className="relative group">
                                <select
                                    className="appearance-none bg-transparent text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 cursor-pointer outline-none w-full pr-4"
                                    value={selectedStoreId || ''}
                                    onChange={handleStoreChange}
                                >
                                    <option value="">📍 Organization HQ (Global)</option>
                                    {stores.map(s => (
                                        <option key={s.id} value={s.id}>📍 {s.name}</option>
                                    ))}
                                </select>
                                <span className="absolute right-0 top-0.5 pointer-events-none text-[8px] text-gray-400">▼</span>
                            </div>
                            {error && <span className="text-[10px] text-red-500 font-bold ml-2">⚠️ {error}</span>}
                        </div>
                    </div>
                </div>

                <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

                {/* Quick Info (Optional) */}
                {selectedStoreId && (
                    <div className="hidden lg:flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Current Store</span>
                        <span className="text-sm font-bold text-gray-700">{currentStore?.name}</span>
                    </div>
                )}
            </div>

            {/* Right: User / Logout usually goes here but for now just powered by */}
            <div className="flex items-center gap-4">
                {/* ... existing right content ... */}
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
