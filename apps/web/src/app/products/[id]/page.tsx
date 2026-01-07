"use client";

import { useEffect, useState } from 'react';
import { api, Product } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

// ... interface
interface ProductWithHistory extends Product {
    inventoryEvents: any[];
}

export default function ProductDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const { user, token, isHydrated, hasPermission, selectedStoreId } = useAuth();
    const router = useRouter();
    const [product, setProduct] = useState<ProductWithHistory | null>(null);
    const [events, setEvents] = useState<ProductWithHistory['inventoryEvents']>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);

    // Modal States
    const [showEdit, setShowEdit] = useState(false);
    const [showReceive, setShowReceive] = useState(false);
    const [showAdjust, setShowAdjust] = useState(false);

    // Form States
    const [editForm, setEditForm] = useState<Partial<Product>>({});
    const [receiveForm, setReceiveForm] = useState({ qty: '', cost: '', price: '', supplier: '' });
    const [adjustForm, setAdjustForm] = useState({ qty: '', reason: 'Manual Adjustment' });

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        loadProduct();
        loadSuppliers();
    }, [token, router, isHydrated, id]);

    const loadProduct = async () => {
        try {
            const data = await api.products.get(id);
            setProduct(data as ProductWithHistory);
            if (data.inventoryEvents) {
                setEvents(data.inventoryEvents);
                if (data.inventoryEvents.length >= 50) setHasMore(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadSuppliers = async () => {
        try {
            const data = await api.suppliers.list();
            setSuppliers(data);
        } catch (e) {
            console.error(e);
        }
    };

    const [totalEvents, setTotalEvents] = useState(0);

    const loadMoreEvents = async () => {
        if (!product) return;
        setLoadingMore(true);
        try {
            const nextSkip = events.length;
            const response = await api.products.getEvents(product.id, nextSkip, 50);
            const { data, total } = response;

            // Append
            if (data.length > 0) {
                setEvents(prev => [...prev, ...data]);
            }

            setTotalEvents(total);
            // Check if we reached end
            if ((events.length + data.length) >= total) {
                setHasMore(false);
            }
        } catch (e) {
            console.error("Failed to load more events", e);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.products.update(id, {
                ...editForm,
                price: parseFloat(editForm.price as any),
                costPrice: editForm.costPrice ? parseFloat(editForm.costPrice as any) : undefined,
                minStockLevel: editForm.minStockLevel ? parseInt(editForm.minStockLevel as any) : 0,
                supplierId: editForm.supplierId || null,
            });
            toast.success('Product Updated');
            setShowEdit(false);
            loadProduct();
        } catch (err: any) {
            toast.error('Update Failed: ' + err.message);
        }
    };

    const handleReceiveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.inventory.restock({
                productId: id,
                quantity: parseInt(receiveForm.qty),
                unitCost: parseFloat(receiveForm.cost),
                newPrice: receiveForm.price ? parseFloat(receiveForm.price) : undefined,
                supplierName: receiveForm.supplier || undefined,
                storeId: selectedStoreId || undefined
            });
            toast.success('Stock Received');
            setShowReceive(false);
            loadProduct();
        } catch (err: any) {
            toast.error('Receive Failed: ' + err.message);
        }
    };

    const handleAdjustSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.inventory.adjust(id, parseInt(adjustForm.qty), adjustForm.reason, selectedStoreId || undefined);
            toast.success('Stock Adjusted');
            setShowAdjust(false);
            loadProduct();
        } catch (err: any) {
            toast.error('Adjustment Failed: ' + err.message);
        }
    };

    const openEdit = () => {
        if (!product) return;
        setEditForm({
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            category: product.category,
            price: product.price,
            costPrice: product.costPrice,
            minStockLevel: product.minStockLevel,
            supplierId: product.supplierId,
            description: product.description
        });
        setShowEdit(true);
    };

    const openReceive = () => {
        if (!product) return;
        setReceiveForm({
            qty: '',
            cost: '',
            price: product.price.toString(),
            supplier: product.supplier?.name || ''
        });
        setShowReceive(true);
    };

    if (loading || !isHydrated) return <div className="p-8">Loading...</div>;
    if (!product) return <div className="p-8">Product not found.</div>;

    const currentStock = product.inventory?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;

    return (
        <div className="h-full bg-gray-50 overflow-y-auto">
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6">
                    <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">← Back to Products</button>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
                                <div className="flex gap-4 mt-2 text-sm text-gray-500">
                                    <span className="font-mono bg-gray-100 px-2 py-1 rounded">SKU: {product.sku}</span>
                                    {product.barcode && <span className="font-mono bg-gray-100 px-2 py-1 rounded">Bar: {product.barcode}</span>}
                                    <span className="font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                        Supplier: {product.supplier?.name || 'None'}
                                    </span>
                                </div>
                                <p className="mt-2 text-gray-600">{product.description || 'No description'}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-500">Current Stock</div>
                                <div className={`text-4xl font-bold ${currentStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {currentStock}
                                </div>
                                <div className="mt-2 text-sm text-gray-400">Min Level: {product.minStockLevel || 0}</div>
                            </div>
                        </div>

                        {/* Pricing & Actions Bar */}
                        <div className="mt-6 pt-6 border-t flex flex-wrap justify-between items-center gap-4">
                            <div className="flex gap-8">
                                <div>
                                    <span className="text-gray-500 text-xs uppercase font-bold block mb-1">Selling Price</span>
                                    <span className="text-2xl font-bold text-gray-900">${Number(product.price).toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-xs uppercase font-bold block mb-1">Cost Price</span>
                                    <span className="text-xl font-medium text-gray-600">${Number(product.costPrice || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 text-xs uppercase font-bold block mb-1">Margin</span>
                                    <span className="text-xl font-medium text-green-600">
                                        {product.price && product.costPrice
                                            ? `${((Number(product.price) - Number(product.costPrice)) / Number(product.price) * 100).toFixed(1)}%`
                                            : '-'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                {hasPermission('MANAGE_INVENTORY') && (
                                    <>
                                        <button onClick={() => setShowAdjust(true)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                                            Adjust Stock
                                        </button>
                                        <button onClick={openReceive} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-sm">
                                            Receive Stock
                                        </button>
                                    </>
                                )}
                                {hasPermission('MANAGE_PRODUCTS') && (
                                    <button onClick={openEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                                        Edit Details
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stock History Table */}
                <h2 className="text-xl font-bold mb-4">Stock History</h2>
                <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier / Reason</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Change</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {events.map((event) => (
                                    <tr key={event.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(event.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                                            {event.type}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {event.supplier ? (
                                                <span className="text-indigo-600 font-medium">{event.supplier.name}</span>
                                            ) : (
                                                <span>{event.reason || '-'}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {event.user?.email || 'System'}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${event.quantity > 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {event.quantity > 0 ? '+' : ''}{event.quantity}
                                        </td>
                                    </tr>
                                ))}
                                {events.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No history found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {hasMore && (
                        <div className="p-4 border-t border-gray-100 bg-gray-50 text-center space-y-2">
                            <div className="text-gray-500 text-xs">
                                Viewing {events.length} of {totalEvents > 0 ? totalEvents : 'many'} events
                            </div>
                            <button
                                onClick={loadMoreEvents}
                                disabled={loadingMore}
                                className="px-4 py-2 bg-white border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loadingMore ? 'Loading...' : 'Load More History'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {showEdit && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Edit Product</h2>
                            <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-black">✕</button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Product Name</label>
                                    <input className="w-full p-2 border rounded-lg" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">SKU</label>
                                    <input className="w-full p-2 border rounded-lg" value={editForm.sku} onChange={e => setEditForm({ ...editForm, sku: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Barcode</label>
                                    <input className="w-full p-2 border rounded-lg" value={editForm.barcode || ''} onChange={e => setEditForm({ ...editForm, barcode: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Category</label>
                                    <input className="w-full p-2 border rounded-lg" value={editForm.category || ''} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Supplier</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={editForm.supplierId || ''}
                                        onChange={e => setEditForm({ ...editForm, supplierId: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Selling Price</label>
                                    <input type="number" step="0.01" className="w-full p-2 border rounded-lg" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Cost Price</label>
                                    <input type="number" step="0.01" className="w-full p-2 border rounded-lg" value={editForm.costPrice || ''} onChange={e => setEditForm({ ...editForm, costPrice: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Min Stock Level</label>
                                    <input type="number" className="w-full p-2 border rounded-lg" value={editForm.minStockLevel || 0} onChange={e => setEditForm({ ...editForm, minStockLevel: parseInt(e.target.value) })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Description</label>
                                    <textarea className="w-full p-2 border rounded-lg h-24" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Receive Modal */}
            {showReceive && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4">Receive Stock</h2>
                        <form onSubmit={handleReceiveSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Quantity Received</label>
                                <input type="number" className="w-full p-2 border rounded-lg" value={receiveForm.qty} onChange={e => setReceiveForm({ ...receiveForm, qty: e.target.value })} required min="1" autoFocus />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Unit Cost ($)</label>
                                <div className="relative">
                                    <input type="number" step="0.01" className="w-full p-2 border rounded-lg pl-6" value={receiveForm.cost} onChange={e => setReceiveForm({ ...receiveForm, cost: e.target.value })} required />
                                    <span className="absolute left-2 top-2 text-gray-500">$</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Current Avg Cost: ${Number(product.costPrice || 0).toFixed(2)}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Supplier</label>
                                <input className="w-full p-2 border rounded-lg" value={receiveForm.supplier} onChange={e => setReceiveForm({ ...receiveForm, supplier: e.target.value })} placeholder="Optional supplier name..." />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowReceive(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold">Receive Stock</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Adjust Modal */}
            {showAdjust && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                        <h2 className="text-xl font-bold mb-4">Adjust Stock</h2>
                        <form onSubmit={handleAdjustSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Quantity Adjustment</label>
                                <input type="number" className="w-full p-2 border rounded-lg" value={adjustForm.qty} onChange={e => setAdjustForm({ ...adjustForm, qty: e.target.value })} required placeholder="+10 or -5" autoFocus />
                                <p className="text-xs text-gray-500 mt-1">Positive to add, negative to remove.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Reason</label>
                                <input className="w-full p-2 border rounded-lg" value={adjustForm.reason} onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} required />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowAdjust(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
