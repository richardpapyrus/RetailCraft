"use client";

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { ChevronDown, Check, Building2, MapPin } from 'lucide-react';

export function StoreSelector() {
    const { user, selectedStoreId, setSelectedStoreId, hasPermission } = useAuth();
    const [stores, setStores] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Only show selection for admins (and only after hydration to match server)
    const isAdmin = mounted && (hasPermission('*') || user?.role === 'Administrator' || user?.role === 'ADMIN');

    // Use displayUser for rendering to match server output (null) until mounted
    const displayUser = mounted ? user : null;

    // Fetch stores
    useEffect(() => {
        if (isAdmin && user?.tenantId) {
            api.stores.list().then(setStores).catch(console.error);
        }
    }, [isAdmin, user?.tenantId]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Locked View for non-admins
    if (!isAdmin) {
        return (
            <div className="w-full p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <MapPin size={16} />
                </div>
                <div className="overflow-hidden">
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">Current Location</p>
                    <p className="text-sm font-semibold text-indigo-900 truncate">
                        {displayUser?.store?.name || 'Assigned Store'}
                    </p>
                </div>
            </div>
        );
    }

    const selectedStore = stores.find(s => s.id === selectedStoreId);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between p-2 rounded-xl border transition-all duration-200 group bg-white
                    ${isOpen
                        ? 'border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                        : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                    }
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`
                        w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors
                        ${selectedStoreId
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'bg-gray-100 text-gray-500'
                        }
                    `}>
                        {selectedStoreId ? <MapPin size={16} /> : <Building2 size={16} />}
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">
                            {selectedStoreId ? 'Store' : 'Organization'}
                        </span>
                        <span className="text-sm font-bold text-gray-700 truncate w-full text-left">
                            {selectedStore ? selectedStore.name : 'Headquarters'}
                        </span>
                    </div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">

                        {/* HQ Option */}
                        <button
                            onClick={() => { setSelectedStoreId(null); setIsOpen(false); }}
                            className={`
                                w-full flex items-center gap-3 p-2 rounded-lg transition-colors group
                                ${!selectedStoreId ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                            `}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${!selectedStoreId ? 'bg-white text-indigo-600 shadow-sm' : 'bg-gray-100 text-gray-400 group-hover:bg-white group-hover:shadow-sm'}`}>
                                <Building2 size={16} />
                            </div>
                            <div className="flex-1 text-left">
                                <p className={`text-sm font-semibold ${!selectedStoreId ? 'text-indigo-900' : 'text-gray-700'}`}>Headquarters</p>
                                <p className="text-[10px] text-gray-400">View All Data</p>
                            </div>
                            {!selectedStoreId && <Check size={16} className="text-indigo-600" />}
                        </button>

                        <div className="h-px bg-gray-100 my-1 mx-2" />

                        {/* Stores List */}
                        {stores.map(store => {
                            const isSelected = selectedStoreId === store.id;
                            return (
                                <button
                                    key={store.id}
                                    onClick={() => { setSelectedStoreId(store.id); setIsOpen(false); }}
                                    className={`
                                        w-full flex items-center gap-3 p-2 rounded-lg transition-colors group
                                        ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                                    `}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-white text-indigo-600 shadow-sm' : 'bg-gray-100 text-gray-400 group-hover:bg-white group-hover:shadow-sm'}`}>
                                        <MapPin size={16} />
                                    </div>
                                    <div className="flex-1 text-left overflow-hidden">
                                        <p className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>{store.name}</p>
                                    </div>
                                    {isSelected && <Check size={16} className="text-indigo-600" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
