"use client";
import { useRouter } from 'next/navigation';
import { Award } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DataService } from '@/lib/db-service';
import { Customer } from '@/lib/db';
import { useAuth } from '@/lib/useAuth';
import { toast } from 'react-hot-toast';

export default function CustomersPage() {
    const { user, token, isHydrated, selectedStoreId } = useAuth(); // Assuming token and isHydrated are also from useAuth
    const router = useRouter();
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', isLoyaltyMember: false });

    useEffect(() => {
        if (!isHydrated) return;

        if (!token) {
            router.push('/login');
            return;
        }
        loadCustomers(true);
    }, [token, router, isHydrated, selectedStoreId]);

    const loadCustomers = async (reset = false) => {
        try {
            if (reset) setLoading(true);
            else setLoadingMore(true);

            const skip = reset ? 0 : customers.length;
            const { data, total } = await DataService.getCustomers(skip, 50, selectedStoreId || undefined);

            if (reset) setCustomers(data);
            else setCustomers(prev => [...prev, ...data]);

            setTotalCustomers(total);
            setHasMore(data.length > 0 && (reset ? data.length : customers.length + data.length) < total);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await DataService.updateCustomer(editingId, { ...formData });
                toast.success("Customer Updated");
            } else {
                await DataService.saveCustomer({ ...formData, storeId: selectedStoreId || undefined });
                toast.success("Customer Saved");
            }
            setIsModalOpen(false);
            setEditingId(null);
            setFormData({ name: '', phone: '', email: '', isLoyaltyMember: false } as any);
            loadCustomers(true);
        } catch (error) {
            toast.error("Failed to save customer");
        }
    };

    const handleEdit = (customer: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setFormData({
            name: customer.name,
            phone: customer.phone || '',
            email: customer.email || '',
            isLoyaltyMember: customer.isLoyaltyMember || false
        } as any);
        setEditingId(customer.id);
        setIsModalOpen(true);
    };

    if (!user) return <div>Loading...</div>;

    if (!user) return <div>Loading...</div>;

    return (
        <div className="flex flex-col h-full bg-gray-100">

            <div className="flex-1 p-8 overflow-auto">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push('/loyalty')}
                                className="px-4 py-2 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2 shadow-sm font-medium"
                            >
                                <Award size={18} className="text-indigo-600" />
                                Loyalty Program
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedStoreId) {
                                        toast.error("Please select a store to create a customer.");
                                        return;
                                    }
                                    setIsModalOpen(true);
                                }}
                                className={`px-4 py-2 rounded transition shadow-sm ${!selectedStoreId ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            >
                                + Add Customer
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-3 text-left">Code</th>
                                    <th className="p-3 text-left">Name</th>
                                    <th className="p-3 text-left">Phone</th>
                                    <th className="p-3 text-left">Email</th>
                                    <th className="p-3 text-left">Loyalty Points</th>
                                    <th className="p-4 font-medium text-gray-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {customers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-500">
                                            No customers found.
                                        </td>
                                    </tr>
                                ) : (
                                    customers.map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/customers/${c.id}`)} >
                                            <td className="p-3">
                                                <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm font-bold text-gray-600">
                                                    {c.code || 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold">{c.name}</td>
                                            <td className="p-3">{c.phone || '-'}</td>
                                            <td className="p-4 text-gray-600">{c.email || '-'}</td>
                                            <td className="p-3">
                                                <span className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-indigo-100 text-indigo-800">
                                                    {c.loyaltyPoints || 0} pts
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-between">
                                                    {c.id.startsWith('OFFLINE') ? (
                                                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Unsynced</span>
                                                    ) : (
                                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Synced</span>
                                                    )}
                                                    <button
                                                        onClick={(e) => handleEdit(c, e)}
                                                        className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 text-center pb-8 space-y-2">
                        <div className="text-gray-500 text-sm">
                            Viewing {customers.length} of {totalCustomers} customers
                        </div>
                        {hasMore && (
                            <button
                                onClick={() => loadCustomers(false)}
                                disabled={loadingMore}
                                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loadingMore ? 'Loading...' : 'Load More Customers'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Customer Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                        <h2 className="text-xl font-bold mb-4">New Customer</h2>
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
                                <label className="block text-sm font-medium mb-1">Phone</label>
                                <input
                                    className="w-full p-2 border rounded"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="mb-6 flex items-center">
                                <input
                                    type="checkbox"
                                    id="loyalty"
                                    className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    checked={(formData as any).isLoyaltyMember || false}
                                    onChange={e => setFormData({ ...formData, isLoyaltyMember: e.target.checked } as any)}
                                />
                                <label htmlFor="loyalty" className="ml-2 block text-sm font-bold text-gray-700">
                                    Enroll in Loyalty Program
                                </label>
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
                                    Save Customer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
