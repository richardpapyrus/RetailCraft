
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
    const { user, selectedStoreId, refreshProfile } = useAuth();
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [saving, setSaving] = useState(false);
    const [locked, setLocked] = useState(false);

    // Store Context State
    const [storeName, setStoreName] = useState('');
    const [storeData, setStoreData] = useState<any>(null);

    // Branding State
    const [logoUrl, setLogoUrl] = useState('');
    const [brandColor, setBrandColor] = useState('#1F2937'); // Default gray-900

    useEffect(() => {
        if (user?.currency) {
            const match = COUNTRIES.find(c => c.currency === user.currency && c.locale === user.locale);
            if (match) setSelectedCountry(match);
        }

        // Init Branding derived from user session
        setLogoUrl(user?.tenantLogo || '');
        setBrandColor(user?.tenantBrandColor || '#1F2937');

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
                // Update TENANT Name and Branding
                await api.tenants.update(user.tenantId, {
                    currency: selectedCountry.currency,
                    locale: selectedCountry.locale,
                    logoUrl: logoUrl || null,
                    brandColor: brandColor || null
                });
                await refreshProfile();
                alert('Organization Settings Saved');
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

                <div className="pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Branding</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Business Logo</label>

                            <div className="flex flex-col gap-2">
                                {/* File Upload Input */}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file && user?.tenantId) {
                                            try {
                                                setSaving(true);
                                                const res = await api.tenants.uploadLogo(user.tenantId, file);
                                                setLogoUrl(res.logoUrl);
                                                await refreshProfile();
                                                alert('Logo Uploaded Successfully');
                                            } catch (err) {
                                                console.error(err);
                                                alert('Failed to upload logo');
                                            } finally {
                                                setSaving(false);
                                            }
                                        }
                                    }}
                                    className="block w-full text-sm text-gray-500
                                      file:mr-4 file:py-2 file:px-4
                                      file:rounded-full file:border-0
                                      file:text-sm file:font-semibold
                                      file:bg-indigo-50 file:text-indigo-700
                                      hover:file:bg-indigo-100
                                    "
                                />

                                {logoUrl && (
                                    <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200 flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] uppercase text-gray-400 block mb-1">Current Logo</span>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={logoUrl} alt="Preview" className="h-10 object-contain" />
                                        </div>
                                        <button
                                            onClick={() => setLogoUrl('')}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={brandColor}
                                    onChange={(e) => setBrandColor(e.target.value)}
                                    className="h-10 w-10 p-1 rounded border border-gray-300 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={brandColor}
                                    onChange={(e) => setBrandColor(e.target.value)}
                                    className="flex-1 p-2 border border-gray-300 rounded-lg text-sm uppercase"
                                    maxLength={7}
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Used for sidebar headers and accents.</p>
                        </div>
                    </div>
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
