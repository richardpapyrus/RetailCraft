
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { api } from '@/lib/api';

const COUNTRIES = [
    { name: 'United States', currency: 'USD', locale: 'en-US' },
    { name: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
    { name: 'European Union', currency: 'EUR', locale: 'de-DE' },
    { name: 'Canada', currency: 'CAD', locale: 'en-CA' },
    { name: 'Australia', currency: 'AUD', locale: 'en-AU' },
    { name: 'Japan', currency: 'JPY', locale: 'ja-JP' },
    { name: 'India', currency: 'INR', locale: 'en-IN' },
    // Africa
    { name: 'Nigeria', currency: 'NGN', locale: 'en-NG' },
    { name: 'Ghana', currency: 'GHS', locale: 'en-GH' },
    { name: 'South Africa', currency: 'ZAR', locale: 'en-ZA' },
    { name: 'Kenya', currency: 'KES', locale: 'en-KE' },
    { name: 'Egypt', currency: 'EGP', locale: 'ar-EG' },
];

export default function GeneralSettings() {
    const { user, selectedStoreId } = useAuth();
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [saving, setSaving] = useState(false);
    const [locked, setLocked] = useState(false);

    // Store Context State
    const [storeName, setStoreName] = useState('');
    const [storeData, setStoreData] = useState<any>(null);

    useEffect(() => {
        if (user?.currency) {
            const match = COUNTRIES.find(c => c.currency === user.currency && c.locale === user.locale);
            if (match) setSelectedCountry(match);
        }

        if (selectedStoreId) {
            loadStoreDetails();
        } else {
            setStoreName(user?.tenantName || '');
        }

        checkLockState();
    }, [user, selectedStoreId]);

    const loadStoreDetails = async () => {
        try {
            // We reuse api.stores.list with filter, or we should have a get(id). 
            // api.stores.list(selectedStoreId) returns array.
            if (!selectedStoreId) return;
            const stores = await api.stores.list(selectedStoreId);
            if (stores && stores.length > 0) {
                setStoreData(stores[0]);
                setStoreName(stores[0].name);
            }
        } catch (e) {
            console.error("Failed to load store details", e);
        }
    }

    const checkLockState = async () => {
        try {
            const sales = await api.sales.list(0, 1, selectedStoreId || undefined) as any;
            // api.sales.list currently returns Response or JSON? api.ts says it returns fetchClient result. 
            // The signature is: list: (skip, take, storeId) => fetchClient(...)
            // We cast to any to safe access checking.
            // Wait, api.ts lines 140-149: returns fetchClient. 
            // And fetchClient returns json.
            // If it returns array likely.
            if (Array.isArray(sales) && sales.length > 0) {
                setLocked(true);
            }
        } catch (e) {
            console.error('Failed to check lock state', e);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (selectedStoreId && storeData) {
                // Update STORE Name
                await api.stores.update(selectedStoreId, {
                    name: storeName
                });
                // Potentially update Tenant currency/locale? Usually Tenant level.
                // For now, assume Currency is Tenant Global.
                alert('Store Name Updated');
            } else if (user?.tenantId) {
                // Update TENANT Name? We don't have an endpoint for simple tenant name update yet easily accessible here, 
                // but existing code updated currency/locale on tenant.
                await api.tenants.update(user.tenantId, {
                    currency: selectedCountry.currency,
                    locale: selectedCountry.locale
                });
                alert('Tenant Settings Saved');
            }
        } catch (e: any) {
            console.error('Settings Save Error:', e);
            alert(`Failed to save settings: ${e.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 max-w-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-6">
                {selectedStoreId ? 'Store Information' : 'General Information'}
            </h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {selectedStoreId ? 'Store Name' : 'Business Name'}
                    </label>
                    <input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        readOnly={!selectedStoreId} // Only editable if Store (for now, as tenant name might be locked)
                        className={`w-full p-2 border border-gray-300 rounded-lg ${!selectedStoreId ? 'bg-gray-50 text-gray-500' : ''}`}
                    />
                    {!selectedStoreId && <p className="text-xs text-gray-500 mt-1">Contact support to change business name.</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Regional Settings (Currency & Format)</label>
                    <p className="text-xs text-gray-500 mb-2">Currency is defined at the Organization level.</p>
                    <select
                        className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                        value={selectedCountry.name}
                        onChange={(e) => {
                            const c = COUNTRIES.find(x => x.name === e.target.value);
                            if (c) setSelectedCountry(c);
                        }}
                        disabled={locked || !!selectedStoreId} // Disable if store selected (forcing global config) or locked
                    >
                        {COUNTRIES.map(c => (
                            <option key={c.name} value={c.name}>{c.name} ({c.currency})</option>
                        ))}
                    </select>
                    {!!selectedStoreId && (
                        <p className="text-xs text-blue-600 mt-1">
                            Switch to "All Locations" (deselect store) to edit Currency settings.
                        </p>
                    )}
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
