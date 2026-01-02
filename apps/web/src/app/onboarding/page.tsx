'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

export default function OnboardingWizard() {
    const router = useRouter();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form States
    const [business, setBusiness] = useState({ name: '', currency: 'USD', locale: 'en-US' });
    const [store, setStore] = useState<{ name: string; address: string; phone: string }>({ name: '', address: '', phone: '' });
    const [tax, setTax] = useState({ name: 'Sales Tax', rate: '0.05' }); // Rate as string for input


    const nextStep = () => setStep(s => s + 1);

    const handleBusinessSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.onboarding.updateBusiness(business);
            // Pre-fill store name with business name if empty
            if (!store.name) setStore(prev => ({ ...prev, name: business.name }));
            nextStep();
        } catch (err: any) {
            setError(err.message || 'Failed to update business');
        } finally { setLoading(false); }
    };

    const handleStoreSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.onboarding.updateStore(store);
            nextStep();
        } catch (err: any) {
            setError(err.message || 'Failed to update store');
        } finally { setLoading(false); }
    };

    const handleTaxSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.onboarding.createTax({ name: tax.name, rate: parseFloat(tax.rate) });
            nextStep();
        } catch (err: any) {
            setError(err.message || 'Failed to create tax');
        } finally { setLoading(false); }
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            await api.onboarding.complete();
            // Force a hard reload to ensure all local data (Stores, Products) is synced from server
            // and avoiding any stale client-side state issues.
            window.location.href = '/dashboard';
        } catch (err: any) {
            setError(err.message || 'Failed to complete onboarding');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Setup your Store
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Step {step} of 4
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <form onSubmit={handleBusinessSubmit} className="space-y-6">
                            <h3 className="text-lg font-medium text-gray-900">Business Profile</h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Business Name</label>
                                <input
                                    type="text" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={business.name}
                                    onChange={e => setBusiness({ ...business, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Currency</label>
                                    <select
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        value={business.currency}
                                        onChange={e => setBusiness({ ...business, currency: e.target.value })}
                                    >
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="GBP">GBP (£)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Locale</label>
                                    <select
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        value={business.locale}
                                        onChange={e => setBusiness({ ...business, locale: e.target.value })}
                                    >
                                        <option value="en-US">en-US</option>
                                        <option value="en-GB">en-GB</option>
                                        <option value="fr-FR">fr-FR</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                type="submit" disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Next
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleStoreSubmit} className="space-y-6">
                            <h3 className="text-lg font-medium text-gray-900">Store Details</h3>
                            <p className="text-sm text-gray-500">This will appear on your receipts.</p>

                            {/* NEW: Store Name Input (Optional: derived from business name usually) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Store Name</label>
                                <input
                                    type="text" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={store.name || ''}
                                    onChange={e => setStore({ ...store, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Address</label>
                                <textarea
                                    required rows={3}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={store.address}
                                    onChange={e => setStore({ ...store, address: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phone</label>
                                <input
                                    type="tel" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={store.phone}
                                    onChange={e => setStore({ ...store, phone: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit" disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Next
                            </button>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleTaxSubmit} className="space-y-6">
                            <h3 className="text-lg font-medium text-gray-900">Tax Setup</h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Tax Name (e.g. VAT, Sales Tax)</label>
                                <input
                                    type="text" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={tax.name}
                                    onChange={e => setTax({ ...tax, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Rate (Decimal, e.g. 0.05 for 5%)</label>
                                <input
                                    type="number" step="0.01" min="0" max="1" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={tax.rate}
                                    onChange={e => setTax({ ...tax, rate: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit" disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Next
                            </button>
                        </form>
                    )}



                    {step === 4 && (
                        <div className="space-y-6 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">All Set!</h3>
                            <p className="text-sm text-gray-500">
                                Your store is configured and ready for the first sale.
                            </p>
                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                {loading ? 'Finalizing...' : 'Go to Dashboard'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
