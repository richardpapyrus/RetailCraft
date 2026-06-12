'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { api, API_URL } from '@/lib/api';
import { ChevronDown } from 'lucide-react';

export function TopHeader() {
    const { user, selectedStoreId, setSelectedStoreId } = useAuth();
    const [stores, setStores] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        loadStores();
    }, [user?.tenantId]);

    const loadStores = async () => {
        try {
            setError(null);
            // If user is restricted, we might fail to list all stores.
            // We should try to use user.store if list fails or is empty.
            let data = [];
            try {
                data = await api.stores.list();
            } catch (listErr) {
                console.warn("Could not list all stores (likely permission), using assigned store only.");
            }

            const storeList = Array.isArray(data) ? data : [];

            // Fallback: If list is empty but user is assigned a store, use it.
            if (storeList.length === 0 && user?.store) {
                storeList.push(user.store);
            }

            setStores(storeList);
        } catch (err: any) {
            console.error("Store Fetch Error:", err);
            // Only show error if we heavily failed and have no fallback
            if (!user?.store) {
                setError(err.message || "Failed to load stores");
            }
        }
    };


    const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedStoreId(val === '' ? null : val);
        window.location.reload(); // Reload to ensure all context refreshes clean
    };

    const currentStore = stores.find(s => s.id === selectedStoreId);

    return (
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 shrink-0 z-10 sticky top-0 print:hidden">
            {/* Left: Business Branding & Store Selector */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    {user?.tenantLogo && !imgError ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={user.tenantLogo.startsWith('http') ? user.tenantLogo : `${API_URL}${user.tenantLogo}`}
                            alt={user.tenantName}
                            className="h-10 object-contain rounded-md"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 font-semibold text-xl uppercase">
                            {user?.tenantName?.[0] || 'B'}
                        </div>
                    )}

                    <div className="flex flex-col">
                        <h1
                            className="font-semibold text-lg leading-tight truncate max-w-[200px] tracking-tight"
                            style={{ color: user?.tenantBrandColor || '#2E3232' }}
                        >
                            {user?.tenantName || 'Business Name'}
                        </h1>
                        <div className="flex items-center gap-1 mt-0.5">
                            <div className="relative group">
                                <select
                                    className="appearance-none bg-transparent text-[10px] font-semibold uppercase tracking-widest text-brand-600 hover:text-brand-700 cursor-pointer outline-none w-full pr-4"
                                    value={selectedStoreId || ''}
                                    onChange={handleStoreChange}
                                >
                                    <option value="">Organization HQ (Global)</option>
                                    {stores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={10} className="absolute right-0 top-0.5 pointer-events-none text-gray-400" />
                            </div>
                            {error && <span className="text-[10px] text-red-500 font-semibold ml-2">⚠️ {error}</span>}
                        </div>
                    </div>
                </div>

            </div>

            {/* Right: reserved for page-level actions */}
            <div className="flex items-center gap-4"></div>
        </header>
    );
}
