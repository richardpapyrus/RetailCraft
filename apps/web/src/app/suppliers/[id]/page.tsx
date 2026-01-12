
"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Save, Plus, Trash } from 'lucide-react';

export default function SupplierDetailsPage() {
    const { id } = useParams();
    const { token, isHydrated, selectedStoreId } = useAuth();
    const router = useRouter();

    const [supplier, setSupplier] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'details' | 'products' | 'orders'>('details');

    // Products Tab State
    const [products, setProducts] = useState<any[]>([]);
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [newProductData, setNewProductData] = useState({ productId: '', supplierSku: '', lastCost: 0, isPreferred: false });

    useEffect(() => {
        if (!isHydrated || !token) return;
        loadData();
    }, [id, token, isHydrated]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.suppliers.get(id as string);
            setSupplier(data);
            if (data.supplierProducts) {
                setProducts(data.supplierProducts);
            }
        } catch (e) {
            toast.error("Failed to load supplier");
            router.push('/suppliers');
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableProducts = async () => {
        try {
            const res = await api.products.list(0, 100, {}, selectedStoreId || undefined);
            setAvailableProducts(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { supplierProducts, products, ...updateData } = supplier;
            await api.suppliers.update(id as string, updateData);
            toast.success("Details Updated");
        } catch (e) {
            toast.error("Update failed");
        }
    };

    const handleAddProduct = async () => {
        try {
            await api.suppliers.addProduct(id as string, newProductData);
            toast.success("Product Linked");
            setIsAddProductOpen(false);
            setNewProductData({ productId: '', supplierSku: '', lastCost: 0, isPreferred: false });
            loadData(); // Refresh list
        } catch (e) {
            toast.error("Failed to link product");
        }
    };

    const handleRemoveProduct = async (productId: string) => {
        if (!confirm("Unlink this product?")) return;
        try {
            await api.suppliers.removeProduct(id as string, productId);
            toast.success("Unlinked");
            loadData();
        } catch (e) {
            toast.error("Failed");
        }
    };

    if (loading) return <div className="p-8">Loading Supplier...</div>;

    return (
        <div className="flex flex-col h-full bg-gray-50 p-6 overflow-auto">
            <div className="max-w-5xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center mb-6">
                    <button onClick={() => router.back()} className="mr-4 p-2 hover:bg-gray-200 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{supplier?.name}</h1>
                        <p className="text-sm text-gray-500">Manage Supplier Details & Products</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`px-4 py-2 font-medium text-sm ${activeTab === 'details' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Details
                    </button>
                    <button
                        onClick={() => { setActiveTab('products'); loadAvailableProducts(); }}
                        className={`px-4 py-2 font-medium text-sm ${activeTab === 'products' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Products ({products.length})
                    </button>
                </div>

                {/* Content */}
                <div className="bg-white rounded-lg shadow p-6">
                    {activeTab === 'details' && (
                        <>
                            <form onSubmit={handleUpdateDetails} className="space-y-4 max-w-lg">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Supplier Name</label>
                                    <input
                                        className="w-full p-2 border rounded"
                                        value={supplier.name}
                                        onChange={e => setSupplier({ ...supplier, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Contact Person</label>
                                        <input
                                            className="w-full p-2 border rounded"
                                            value={supplier.contact || ''}
                                            onChange={e => setSupplier({ ...supplier, contact: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Phone</label>
                                        <input
                                            className="w-full p-2 border rounded"
                                            value={supplier.phone || ''}
                                            onChange={e => setSupplier({ ...supplier, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Email</label>
                                    <input
                                        className="w-full p-2 border rounded"
                                        value={supplier.email || ''}
                                        onChange={e => setSupplier({ ...supplier, email: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Currency</label>
                                        <select
                                            className="w-full p-2 border rounded"
                                            value={supplier.currency || 'USD'}
                                            onChange={e => setSupplier({ ...supplier, currency: e.target.value })}
                                        >
                                            <option value="USD">USD ($)</option>
                                            <option value="NGN">NGN (₦)</option>
                                            <option value="EUR">EUR (€)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Payment Terms (Days)</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded"
                                            value={supplier.termDays || 30}
                                            onChange={e => setSupplier({ ...supplier, termDays: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button type="submit" className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                                        <Save className="w-4 h-4 mr-2" /> Save Changes
                                    </button>
                                </div>
                            </form>

                            {/* Transaction History Section */}
                            <div className="mt-12 pt-8 border-t border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Transaction History</h3>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="p-3 font-medium text-gray-500">Date</th>
                                                <th className="p-3 font-medium text-gray-500">PO Number</th>
                                                <th className="p-3 font-medium text-gray-500">Status</th>
                                                <th className="p-3 font-medium text-gray-500 text-right">Items</th>
                                                <th className="p-3 font-medium text-gray-500 text-right">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {supplier.purchaseOrders && supplier.purchaseOrders.length > 0 ? (
                                                supplier.purchaseOrders.map((po: any) => (
                                                    <tr
                                                        key={po.id}
                                                        onClick={() => router.push(`/inventory/purchase-orders/${po.id}`)}
                                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                    >
                                                        <td className="p-3 text-gray-900">{new Date(po.createdAt).toLocaleDateString()}</td>
                                                        <td className="p-3 font-mono text-indigo-600">#{po.poNumber || po.id.slice(0, 8)}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide
                                                            ${po.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' : ''}
                                                            ${po.status === 'ISSUED' ? 'bg-blue-100 text-blue-600' : ''}
                                                            ${po.status === 'RECEIVED' ? 'bg-green-100 text-green-600' : ''}
                                                        `}>
                                                                {po.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right text-gray-600">{po.items?.length || 0}</td>
                                                        <td className="p-3 text-right font-bold text-gray-900">
                                                            {po.items?.reduce((sum: number, item: any) => sum + (item.quantityOrdered * item.unitCost), 0).toLocaleString(undefined, { style: 'currency', currency: supplier.currency || 'USD' })}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-gray-400 bg-gray-50/50">
                                                        No transactions found for this supplier.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'products' && (
                        <div>
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => setIsAddProductOpen(true)}
                                    className="flex items-center bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700"
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Link Product
                                </button>
                            </div>

                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-3">Product Name</th>
                                        <th className="p-3">Supplier SKU</th>
                                        <th className="p-3 text-right">Current Stock</th>
                                        <th className="p-3 text-right">Last Cost</th>
                                        <th className="p-3 text-center">Preferred</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y result-list">
                                    {products.map((p: any) => (
                                        <tr key={p.id}>
                                            <td className="p-3 font-medium">{p.product.name}</td>
                                            <td className="p-3 text-gray-500">{p.supplierSku || '-'}</td>
                                            <td className="p-3 text-right font-medium">
                                                {p.product.inventory?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0}
                                            </td>
                                            <td className="p-3 text-right font-mono">{p.lastCost?.toLocaleString()}</td>
                                            <td className="p-3 text-center">
                                                {p.isPreferred ? <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">Yes</span> : '-'}
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => handleRemoveProduct(p.productId)}
                                                    className="text-red-600 hover:text-red-800 p-1"
                                                >
                                                    <Trash className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {products.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">No products linked to this supplier.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Product Modal */}
            {isAddProductOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
                        <h3 className="font-bold mb-4">Link Product</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium mb-1">Select Product</label>
                                <select
                                    className="w-full p-2 border rounded"
                                    value={newProductData.productId}
                                    onChange={e => setNewProductData({ ...newProductData, productId: e.target.value })}
                                >
                                    <option value="">-- Choose --</option>
                                    {availableProducts.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Supplier SKU</label>
                                <input
                                    className="w-full p-2 border rounded"
                                    placeholder="e.g. SUP-101"
                                    value={newProductData.supplierSku}
                                    onChange={e => setNewProductData({ ...newProductData, supplierSku: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1">Cost Price</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded"
                                    value={newProductData.lastCost}
                                    onChange={e => setNewProductData({ ...newProductData, lastCost: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={newProductData.isPreferred}
                                    onChange={e => setNewProductData({ ...newProductData, isPreferred: e.target.checked })}
                                    className="mr-2"
                                />
                                <span className="text-sm">Preferred Supplier?</span>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsAddProductOpen(false)} className="px-3 py-1 text-gray-600">Cancel</button>
                                <button
                                    onClick={handleAddProduct}
                                    disabled={!newProductData.productId}
                                    className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-50"
                                >
                                    Link
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
