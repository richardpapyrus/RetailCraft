"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function SuppliersPage() {
    const { user, token, isHydrated, selectedStoreId } = useAuth();
    const router = useRouter();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ id: '', name: '', contact: '', phone: '', email: '' });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        loadSuppliers();
    }, [token, router, isHydrated, selectedStoreId]);

    const loadSuppliers = async () => {
        try {
            const data = await api.suppliers.list(selectedStoreId || undefined);
            setSuppliers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await api.suppliers.update(formData.id, formData);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, ...data } = formData;
                await api.suppliers.create({ ...data, storeId: selectedStoreId || undefined });
            }
            setIsModalOpen(false);
            setFormData({ id: '', name: '', contact: '', phone: '', email: '' });
            setIsEditing(false);
            loadSuppliers();
            toast.success(isEditing ? 'Supplier Updated' : 'Supplier Created');
        } catch (error) {
            toast.error("Failed to save supplier");
        }
    };

    const handleEdit = (supplier: any) => {
        setFormData({
            ...supplier,
            phone: supplier.phone || '', // Ensure phone is not null
            contact: supplier.contact || '',
            email: supplier.email || ''
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this supplier?')) {
            try {
                await api.suppliers.delete(id);
                loadSuppliers();
                toast.success('Supplier Deleted');
            } catch (e) {
                toast.error('Failed to delete');
            }
        }
    };

    const openCreate = () => {
        setFormData({ id: '', name: '', contact: '', phone: '', email: '' });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    if (loading || !isHydrated) return <div className="p-8">Loading...</div>;

    return (
        <div className="flex flex-col h-full bg-gray-100">
            <div className="flex-1 p-8 overflow-auto">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-gray-800">Suppliers</h1>
                        <button
                            onClick={openCreate}
                            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                        >
                            + Add Supplier
                        </button>
                    </div>

                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-3 text-left">Name</th>
                                    <th className="p-3 text-left">Contact</th>
                                    <th className="p-3 text-left">Phone</th>
                                    <th className="p-3 text-left">Email</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {suppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-500">
                                            No suppliers found.
                                        </td>
                                    </tr>
                                ) : (
                                    suppliers.map(s => (
                                        <tr key={s.id} className="hover:bg-gray-50">
                                            <td className="p-3 font-bold">{s.name}</td>
                                            <td className="p-3">{s.contact || '-'}</td>
                                            <td className="p-3">{s.phone || '-'}</td>
                                            <td className="p-3 text-gray-600">{s.email || '-'}</td>
                                            <td className="p-3 text-right space-x-2">
                                                <button onClick={() => handleEdit(s)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                                                <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800">Delete</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                        <h2 className="text-xl font-bold mb-4">{isEditing ? 'Edit Supplier' : 'New Supplier'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    required
                                    className="w-full p-2 border rounded"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Contact Person</label>
                                <input
                                    className="w-full p-2 border rounded"
                                    value={formData.contact}
                                    onChange={e => setFormData({ ...formData, contact: e.target.value })}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full p-2 border rounded"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Phone</label>
                                <input
                                    type="tel"
                                    className="w-full p-2 border rounded"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
