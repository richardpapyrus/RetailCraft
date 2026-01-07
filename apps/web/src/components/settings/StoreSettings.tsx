
"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { toast } from 'react-hot-toast';

// Shared Form for Create/Edit
const StoreForm = ({ isEdit = false, onSave, onCancel, formData, setFormData }: any) => (
    <div className="mb-6 p-6 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="font-bold text-lg mb-4">{isEdit ? 'Edit Location' : 'New Location'}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Store Name</label>
                <input
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="e.g. Main Street Branch"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    autoFocus
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Address</label>
                <input
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="123 Main St, City"
                    value={formData.address || ''}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone</label>
                <input
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="+1 234 567 8900"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email</label>
                <input
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="store@example.com"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Website</label>
                <input
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    placeholder="www.example.com"
                    value={formData.website || ''}
                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                />
            </div>
        </div>

        <div className="border-t border-gray-200 pt-4 mt-4">
            <h4 className="font-bold text-indigo-700 mb-3 text-sm uppercase tracking-wide">Receipt Customization</h4>
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Logo URL</label>
                    <input
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        placeholder="https://example.com/logo.png"
                        value={formData.logoUrl || ''}
                        onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Direct link to an image (PNG/JPG).</p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Receipt Header Message</label>
                    <input
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        placeholder="Welcome to our store!"
                        value={formData.receiptHeader || ''}
                        onChange={e => setFormData({ ...formData, receiptHeader: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Receipt Footer Message</label>
                    <textarea
                        className="w-full p-2 border border-gray-300 rounded-lg h-20"
                        placeholder="Return Policy: 30 days..."
                        value={formData.receiptFooter || ''}
                        onChange={e => setFormData({ ...formData, receiptFooter: e.target.value })}
                    />
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
            <button onClick={onCancel} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={onSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                {isEdit ? 'Save Changes' : 'Create Location'}
            </button>
        </div>
    </div>
);

export default function StoreSettings() {
    const { selectedStoreId } = useAuth(); // Use reactive hook
    const [stores, setStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingStore, setEditingStore] = useState<any | null>(null);
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        fetchStores();
    }, [selectedStoreId]); // Re-fetch when store selection changes

    const fetchStores = async () => {
        try {
            setLoading(true);
            // Strict Isolation: Only show the currently selected store in the list
            // If selectedStoreId is present, we filter.
            const data = await api.stores.list(selectedStoreId || undefined);
            setStores(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };


    const handleCreate = async () => {
        if (!formData.name) return;
        try {
            await api.stores.create(formData);
            setFormData({});
            setIsCreating(false);
            fetchStores();
        } catch (e) {
            toast.error('Failed to create store');
        }
    };

    const handleUpdate = async () => {
        if (!editingStore || !formData.name) return;
        try {
            // Sanitize payload: valid Prisma StoreUpdateInput fields only
            const payload = {
                name: formData.name,
                address: formData.address,
                phone: formData.phone,
                email: formData.email,
                website: formData.website,
                logoUrl: formData.logoUrl,
                receiptHeader: formData.receiptHeader,
                receiptFooter: formData.receiptFooter,
            };

            await api.stores.update(editingStore.id, payload);
            setEditingStore(null);
            setFormData({});
            fetchStores();
        } catch (e) {
            console.error(e);
            toast.error('Failed to update store');
        }
    };

    const startEdit = (store: any) => {
        setEditingStore(store);
        setFormData({ ...store });
    };

    const openCreate = () => {
        setIsCreating(true);
        setEditingStore(null);
        setFormData({ name: '' });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Locations</h2>
                {!isCreating && !editingStore && (
                    <button
                        onClick={openCreate}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md shadow-indigo-200"
                    >
                        + Add Location
                    </button>
                )}
            </div>

            {isCreating && <StoreForm onSave={handleCreate} onCancel={() => setIsCreating(false)} formData={formData} setFormData={setFormData} />}

            {editingStore && <StoreForm isEdit={true} onSave={handleUpdate} onCancel={() => { setEditingStore(null); setFormData({}); }} formData={formData} setFormData={setFormData} />}

            {!isCreating && !editingStore && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="pb-3 font-bold">Name</th>
                                <th className="pb-3 font-bold">Contact</th>
                                <th className="pb-3 font-bold">Receipt Info</th>
                                <th className="pb-3 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={4} className="py-8 text-center text-gray-400 font-medium">Loading locations...</td></tr>
                            ) : stores.map(store => (
                                <tr key={store.id} className="group hover:bg-gray-50 transition-colors">
                                    <td className="py-4 font-bold text-gray-900">{store.name}</td>
                                    <td className="py-4 text-sm text-gray-600">
                                        {store.address && <div className="text-xs">{store.address}</div>}
                                        {store.phone && <div className="text-xs text-gray-400">{store.phone}</div>}
                                    </td>
                                    <td className="py-4">
                                        {store.logoUrl ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Has Logo</span>
                                        ) : (
                                            <span className="text-xs text-gray-400">Default</span>
                                        )}
                                    </td>
                                    <td className="py-4 text-right">
                                        <button onClick={() => startEdit(store)} className="text-indigo-600 font-bold hover:text-indigo-800 text-sm">Edit</button>
                                    </td>
                                </tr>
                            ))}
                            {stores.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-gray-500">No locations found. Add one to get started.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
