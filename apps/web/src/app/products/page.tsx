"use client";

import { useEffect, useState } from 'react';
import { api, Product, API_URL } from '@/lib/api';
import { DataService } from '@/lib/db-service';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function ProductsPage() {
    const { user, token, isHydrated, hasPermission, selectedStoreId } = useAuth();
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalProducts, setTotalProducts] = useState(0);

    // Filters
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [showLowStock, setShowLowStock] = useState(false);

    // Stats
    const [stats, setStats] = useState<{ totalProducts: number; inventoryValue: string; lowStockCount: number } | null>(null);

    // Create/Edit State
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newProduct, setNewProduct] = useState({ name: '', sku: '', barcode: '', category: '', price: '', costPrice: '', minStockLevel: 0, supplierId: '' });

    // Inventory Modal States
    const [adjustModalOpen, setAdjustModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [adjustQty, setAdjustQty] = useState('');

    const [receiveModalOpen, setReceiveModalOpen] = useState(false);
    const [receiveQty, setReceiveQty] = useState('');
    const [receiveCost, setReceiveCost] = useState('');
    const [receivePrice, setReceivePrice] = useState('');
    const [receiveSupplier, setReceiveSupplier] = useState('');

    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<any>(null);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);

    // Debounce Search
    useEffect(() => {
        const timeout = setTimeout(() => {
            loadProducts(true);
        }, 800);
        return () => clearTimeout(timeout);
    }, [search, category, showLowStock]);

    useEffect(() => {
        if (!isHydrated) return;

        if (!token) {
            router.push('/login');
            return;
        }
        loadProducts(true);
        loadSuppliers();
        loadStats();
    }, [token, router, isHydrated, selectedStoreId]);

    const loadStats = async () => {
        try {
            const data = await DataService.getProductStats(selectedStoreId || undefined);
            setStats(data);
        } catch (e) {
            console.error("Failed to load stats", e);
        }
    };

    const loadSuppliers = async () => {
        try {
            const data = await api.suppliers.list(selectedStoreId || undefined);
            setSuppliers(data);
        } catch (e) {
            console.error("Failed to load suppliers", e);
        }
    };

    const loadProducts = async (reset = false) => {
        try {
            if (reset) setLoading(true);
            else setLoadingMore(true);

            const skip = reset ? 0 : products.length;
            const filters = { search, category, lowStock: showLowStock };
            const { data, total } = await DataService.getProducts(skip, 50, filters, selectedStoreId || undefined);

            if (reset) setProducts(data);
            else setProducts(prev => [...prev, ...data]);

            setTotalProducts(total);
            setHasMore(data.length > 0 && (reset ? data.length : products.length + data.length) < total);
            setError(null);
            setDebugInfo({ productsFetched: data.length, totalFromApi: total, tenantId: user?.tenantId });

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to load products");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStoreId) {
            toast.error("Please select a specific store to create a product.");
            return;
        }
        try {
            const payload = {
                ...newProduct,
                price: parseFloat(newProduct.price),
                costPrice: newProduct.costPrice ? parseFloat(newProduct.costPrice) : undefined,
                minStockLevel: newProduct.minStockLevel || 0,
                storeId: selectedStoreId || undefined
            };

            if (editingId) {
                await api.products.update(editingId, payload);
                toast.success('Product Updated');
            } else {
                await api.products.create(payload);
                toast.success('Product Created');
            }
            setShowCreate(false);
            setEditingId(null);
            loadProducts(true);
            setNewProduct({ name: '', sku: '', barcode: '', category: '', price: '', costPrice: '', minStockLevel: 0, supplierId: '' });
        } catch (err: any) {
            console.error(err);
            toast.error(`Failed to save product: ${err.message || 'Unknown error'}`);
        }
    };

    const startEdit = (product: Product) => {
        setNewProduct({
            name: product.name,
            sku: product.sku,
            barcode: product.barcode || '',
            category: product.category || '',
            price: product.price.toString(),
            costPrice: product.costPrice?.toString() || '',
            minStockLevel: product.minStockLevel || 0,
            supplierId: product.supplierId || ''
        });
        setEditingId(product.id);
        setShowCreate(true);
    };

    const openAdjustModal = (product: Product) => {
        setSelectedProduct(product);
        setAdjustQty('');
        setAdjustModalOpen(true);
    };

    const openReceiveModal = (product: Product) => {
        setSelectedProduct(product);
        setReceiveQty('');
        setReceiveCost('');
        setReceivePrice(product.price ? product.price.toString() : '');
        setReceiveSupplier('');
        setReceiveModalOpen(true);
    };

    const handleAdjustSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || !adjustQty) return;

        try {
            await api.inventory.adjust(selectedProduct.id, parseInt(adjustQty), "Manual Adjustment", selectedStoreId || undefined);
            setAdjustModalOpen(false);
            setSelectedProduct(null);
            loadProducts(true);
        } catch (err) {
            toast.error('Failed to update stock');
        }
    };

    const handleReceiveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || !receiveQty || !receiveCost) return;

        try {
            await api.inventory.restock({
                productId: selectedProduct.id,
                quantity: parseInt(receiveQty),
                unitCost: parseFloat(receiveCost),
                newPrice: receivePrice ? parseFloat(receivePrice) : undefined,
                supplierName: receiveSupplier || undefined,
                storeId: selectedStoreId || undefined
            });
            setReceiveModalOpen(false);
            setSelectedProduct(null);
            loadProducts(true);
            loadProducts(true);
            toast.success('Stock Received & Cost Averaged');
        } catch (err) {
            toast.error('Failed to receive stock');
        }
    };

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile) return;

        if (!selectedStoreId) {
            toast.error("Please select a specific store to import products into.");
            return;
        }

        try {
            setLoading(true);
            const res = await api.products.import(importFile, selectedStoreId || undefined);
            toast.success(`Import Complete!\nCreated: ${res.createdCount}\nUpdated: ${res.updatedCount}`, { duration: 6000 });
            if (res.errors) toast.error(`Some errors occurred:\n${res.errors}`, { duration: 8000 });
            setIsImportModalOpen(false);
            setImportFile(null);
            loadProducts(true);
        } catch (err: any) {
            toast.error('Import Failed: ' + err.message);
            setLoading(false);
        }
    };

    if (!isHydrated) return <div className="p-8">Loading...</div>;

    // Separate Initial Full Page Load from Filter Updates
    // We only block if we are loading AND have no products (initial empty state)
    if (loading && products.length === 0 && !search && !category) {
        return <div className="p-8">Loading Products...</div>;
    }

    return (
        <div className="h-full bg-gray-50 overflow-y-auto relative">
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm">
                        <p className="font-bold">Error loading data</p>
                        <p>{error}</p>
                    </div>
                )}
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Product Inventory</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                if (confirm("This will clear local cache and reload from server. Continue?")) {
                                    DataService.clearCache().then(() => window.location.reload());
                                }
                            }}
                            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
                        >
                            ↻ Refresh
                        </button>
                        {(hasPermission('MANAGE_PRODUCTS') || hasPermission('RAISE_PURCHASE_ORDER')) && (
                            <button
                                onClick={() => router.push('/inventory/purchase-orders')}
                                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm flex items-center gap-2"
                            >
                                <span className="text-lg leading-none">📋</span> Purchase Orders
                            </button>
                        )}
                        {hasPermission('MANAGE_PRODUCTS') && (
                            <>
                                <button
                                    onClick={() => {
                                        if (!selectedStoreId) {
                                            toast.error("Please select a specific store first.");
                                            return;
                                        }
                                        setIsImportModalOpen(true);
                                    }}
                                    className={`border border-gray-300 px-4 py-2 rounded-lg transition shadow-sm ${!selectedStoreId ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                >
                                    Import CSV
                                </button>
                                <button
                                    onClick={() => {
                                        if (!selectedStoreId) {
                                            toast.error("Please select a specific store first.");
                                            return;
                                        }
                                        setShowCreate(true);
                                    }}
                                    className={`px-4 py-2 rounded-lg transition shadow-sm ${!selectedStoreId ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                >
                                    + Add Product
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-gray-500 text-sm font-medium">Total Products</h3>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalProducts}</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-gray-500 text-sm font-medium">Inventory Value</h3>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(stats.inventoryValue, user?.currency)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h3 className="text-gray-500 text-sm font-medium">Low Stock Items</h3>
                            <p className={`text-3xl font-bold mt-2 ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {stats.lowStockCount}
                            </p>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Search products (Name, SKU, Barcode)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div className="w-[200px]">
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="">All Categories</option>
                            {/* Dedupe categories from existing products or fetch distinct? Simple approach: Dedupe visible or hardcode common for now if not fetched separately. 
                            Ideally, we fetch categories from API.
                        */}
                            {['Electronics', 'Apparel', 'Home', 'Food', 'Misc'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="lowStock"
                            checked={showLowStock}
                            onChange={(e) => setShowLowStock(e.target.checked)}
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="lowStock" className="text-gray-700 font-medium cursor-pointer">Low Stock Only</label>
                    </div>
                </div>

                {/* Create Modal */}
                {showCreate && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">{editingId ? 'Edit Product' : 'New Product'}</h2>
                                <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                            </div>
                            <div className="space-y-4 max-h-[80vh] overflow-y-auto">
                                <input
                                    placeholder="Product Name"
                                    className="w-full p-2 border rounded-lg"
                                    value={newProduct.name}
                                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                    required
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        placeholder="SKU"
                                        className="w-full p-2 border rounded-lg"
                                        value={newProduct.sku}
                                        onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                                        required
                                    />
                                    <input
                                        placeholder="Barcode"
                                        className="w-full p-2 border rounded-lg"
                                        value={newProduct.barcode}
                                        onChange={e => setNewProduct({ ...newProduct, barcode: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Price</label>
                                        <input
                                            type="number" step="0.01" required
                                            className="w-full p-2 border rounded-lg"
                                            value={newProduct.price}
                                            onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Cost Price</label>
                                        <input
                                            type="number" step="0.01"
                                            className="w-full p-2 border rounded-lg"
                                            value={newProduct.costPrice}
                                            onChange={e => setNewProduct({ ...newProduct, costPrice: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Min Stock Level</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded-lg"
                                            value={newProduct.minStockLevel}
                                            onChange={e => setNewProduct({ ...newProduct, minStockLevel: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Supplier</label>
                                        <select
                                            className="w-full p-2 border rounded-lg"
                                            value={newProduct.supplierId || ''}
                                            onChange={e => setNewProduct({ ...newProduct, supplierId: e.target.value })}
                                        >
                                            <option value="">None</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                        {editingId ? 'Update Product' : 'Save Product'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Adjust Modal */}
                {adjustModalOpen && selectedProduct && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
                            <h3 className="text-lg font-bold mb-4">Adjust Stock: {selectedProduct.name}</h3>
                            <form onSubmit={handleAdjustSubmit}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Adjustment</label>
                                    <input
                                        type="number"
                                        placeholder="+10 or -5"
                                        className="w-full p-2 border rounded-lg"
                                        value={adjustQty}
                                        onChange={e => setAdjustQty(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Use negative values to remove stock.</p>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    >
                                        Save Adjustment
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Receive Modal */}
                {receiveModalOpen && selectedProduct && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
                            <h3 className="text-xl font-bold mb-4">Receive Stock: {selectedProduct.name}</h3>
                            <form onSubmit={handleReceiveSubmit}>
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Received</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded-lg"
                                            value={receiveQty}
                                            onChange={e => setReceiveQty(e.target.value)}
                                            autoFocus
                                            required
                                            min="1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit Purchase Cost ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full p-2 border rounded-lg"
                                            value={receiveCost}
                                            onChange={e => setReceiveCost(e.target.value)}
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Current Weighted Avg: ${Number(selectedProduct.costPrice || 0).toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Update Selling Price (Optional)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full p-2 border rounded-lg"
                                            value={receivePrice}
                                            onChange={e => setReceivePrice(e.target.value)}
                                            placeholder={`Current: ${Number(selectedProduct.price).toFixed(2)}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (Optional)</label>
                                        <input
                                            className="w-full p-2 border rounded-lg"
                                            value={receiveSupplier}
                                            onChange={e => setReceiveSupplier(e.target.value)}
                                            placeholder="e.g. Acme Corp"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setReceiveModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
                                    >
                                        Receive Stock
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Import Modal */}
                {isImportModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
                            <h3 className="text-xl font-bold mb-4">Import Products</h3>
                            <form onSubmit={handleImport}>
                                <div className="mb-6 space-y-4">
                                    <div className="p-4 bg-gray-50 rounded border border-dashed border-gray-300 text-center">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                            className="block w-full text-sm text-gray-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-full file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-indigo-50 file:text-indigo-700
                                                hover:file:bg-indigo-100
                                            "
                                            required
                                        />
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        <p className="font-semibold">Required Columns:</p>
                                        <p>name, sku, price</p>
                                        <p className="font-semibold mt-1">Optional:</p>
                                        <p>description, category, barcode, costPrice, minStockLevel, quantity</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = `${API_URL}/products/template`;
                                            link.setAttribute('download', 'template.csv');
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                        }}
                                        className="block w-full text-center text-sm text-indigo-600 hover:underline bg-transparent border-0 cursor-pointer"
                                    >
                                        Download Template
                                    </button>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsImportModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!importFile}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        Upload & Import
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU / Barcode</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (Sell)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost (Buy)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                                {selectedStoreId && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={selectedStoreId ? 8 : 7} className="px-6 py-8 text-center text-gray-500">
                                        No products found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                products.map(p => {
                                    const stock = p.inventory?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
                                    const isLowStock = stock <= (p.minStockLevel || 0);
                                    return (
                                        <tr key={p.id} className={`hover:bg-gray-50 cursor-pointer ${isLowStock ? 'bg-red-50' : ''}`} onClick={() => router.push(`/products/${p.id}`)}>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate" title={p.name}>{p.name}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-500 max-w-[150px] truncate" title={p.sku}>{p.sku}</div>
                                                <div className="text-xs text-gray-400 max-w-[150px] truncate" title={p.barcode || ''}>{p.barcode}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatCurrency(p.price, user?.currency)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {(p as any).category || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {p.costPrice ? formatCurrency(p.costPrice, user?.currency) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {p.supplier ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                        {p.supplier.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic">None</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className={`font-bold ${stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {stock}
                                                </span>
                                                {isLowStock && (
                                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                        Low
                                                    </span>
                                                )}
                                            </td>
                                            {selectedStoreId && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {hasPermission('MANAGE_INVENTORY') && (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openAdjustModal(p); }}
                                                                className="text-indigo-600 hover:text-indigo-900"
                                                            >
                                                                Adjust
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openReceiveModal(p); }}
                                                                className="text-green-600 hover:text-green-900 ml-4 font-bold"
                                                            >
                                                                Receive
                                                            </button>
                                                        </>
                                                    )}
                                                    {hasPermission('MANAGE_PRODUCTS') && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                                                            className="text-blue-600 hover:text-blue-900 ml-4 font-medium"
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 text-center pb-8 space-y-2">
                    <div className="text-gray-500 text-sm">
                        Viewing {products.length} of {totalProducts} products
                    </div>
                    {hasMore && (
                        <button
                            onClick={() => loadProducts(false)}
                            disabled={loadingMore}
                            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loadingMore ? 'Loading...' : 'Load More Products'}
                        </button>
                    )}
                </div>
            </div>
        </div >
    );
}
