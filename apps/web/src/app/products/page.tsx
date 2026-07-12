"use client";

import { useEffect, useState, useRef } from 'react';
import { confirmDialog } from "@/lib/dialog";
import { api, Product, API_URL } from '@/lib/api';
import { DataService } from '@/lib/db-service';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import CategoryManager from '@/components/products/CategoryManager';
import { RefreshCw, ClipboardList, SlidersHorizontal, ArrowDownToLine, Pencil, Archive, ArchiveRestore, X } from 'lucide-react';

export default function ProductsPage() {
    const { user, token, isHydrated, hasPermission, selectedStoreId } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalProducts, setTotalProducts] = useState(0);

    // Initial State from URL
    const initialPage = Number(searchParams.get('page')) || 1;
    const initialSearch = searchParams.get('search') || '';
    const initialCategory = searchParams.get('category') || '';
    const initialLowStock = searchParams.get('lowStock') === 'true';
    const initialArchived = searchParams.get('showArchived') === 'true';

    const [page, setPage] = useState(initialPage);
    const limit = 50;

    // Filters - Local State (initialized from URL)
    const [search, setSearch] = useState(initialSearch);
    const [category, setCategory] = useState(initialCategory);
    const [showLowStock, setShowLowStock] = useState(initialLowStock);
    const [showArchived, setShowArchived] = useState(initialArchived);

    // Categories
    const [categories, setCategories] = useState<any[]>([]);
    const [showCategoryManager, setShowCategoryManager] = useState(false);

    // Stats
    const [stats, setStats] = useState<{ totalProducts: number; inventoryValue: string; lowStockCount: number } | null>(null);

    // Create/Edit State
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newProduct, setNewProduct] = useState({ name: '', sku: '', barcode: '', categoryId: '', price: '', costPrice: '', minStockLevel: 0, supplierId: '' });

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

    // Bulk selection & actions. Keyed by product id and persists across
    // pages/searches/filters so large selections can be accumulated; stores the
    // full product so the action bar can count and partition items that are no
    // longer on the visible page. Cleared on apply, explicit Clear, or store switch.
    const [selectedMap, setSelectedMap] = useState<Map<string, Product>>(new Map());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
    const [bulkCategoryId, setBulkCategoryId] = useState('');
    const [bulkSupplierId, setBulkSupplierId] = useState('');

    // Debounce Search
    // Sync State -> URL
    useEffect(() => {
        const timeout = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());

            if (search) params.set('search', search); else params.delete('search');
            if (category) params.set('category', category); else params.delete('category');
            if (showLowStock) params.set('lowStock', 'true'); else params.delete('lowStock');
            if (showArchived) params.set('showArchived', 'true'); else params.delete('showArchived');

            // Check if filters changed to reset page
            const currentSearch = searchParams.get('search') || '';
            const currentCategory = searchParams.get('category') || '';
            const currentLowStock = searchParams.get('lowStock') === 'true';
            const currentArchived = searchParams.get('showArchived') === 'true';

            const filtersChanged = search !== currentSearch || category !== currentCategory || showLowStock !== currentLowStock || showArchived !== currentArchived;

            if (filtersChanged) {
                params.set('page', '1');
                setPage(1); // Keep local state in sync
            } else {
                params.set('page', page.toString());
            }

            if (params.toString() !== searchParams.toString()) {
                router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            }
        }, 500); // Reduced debounce slightly
        return () => clearTimeout(timeout);
    }, [search, category, showLowStock, showArchived, page]);

    // Focus state to prevent external updates while typing
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sync URL -> Local State & Fetch
    useEffect(() => {
        if (!isHydrated || !token) return;

        const p = Number(searchParams.get('page')) || 1;
        const s = searchParams.get('search') || '';
        const c = searchParams.get('category') || '';
        const ls = searchParams.get('lowStock') === 'true';
        const sa = searchParams.get('showArchived') === 'true';

        // Sync local state if different (e.g. Back button)
        if (p !== page) setPage(p);

        // Only sync search from URL if we are NOT focused on the input
        // This prevents the "lock out" / overwriting issue while typing
        if (s !== search && !isSearchFocused) {
            setSearch(s);
        }

        if (c !== category) setCategory(c);
        if (ls !== showLowStock) setShowLowStock(ls);
        if (sa !== showArchived) setShowArchived(sa);

        fetchProducts(p, s, c, ls, sa);
    }, [searchParams, token, isHydrated, selectedStoreId, isSearchFocused]);

    useEffect(() => {
        if (!isHydrated) return;

        if (!token) {
            router.push('/login');
            return;
        }
        // Initial data loads
        loadSuppliers();
        loadStats();
        loadCategories();
    }, [token, router, isHydrated, selectedStoreId]);

    const loadCategories = async () => {
        try {
            const data = await api.categories.list();
            setCategories(data);
        } catch (e) {
            console.error("Failed to load categories");
        }
    };

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

    const fetchProducts = async (p: number, s: string, c: string, ls: boolean, sa: boolean) => {
        try {
            // Only show full loading state if we don't have products (initial load)
            // If we are just filtering/searching, we want to keep the UI stable.
            if (products.length === 0) {
                setLoading(true);
            }

            const skip = (p - 1) * limit;
            const filters = { search: s, category: c, lowStock: ls };

            const { data, total } = await api.products.list(skip, limit, filters, selectedStoreId || undefined, sa);

            setProducts(data);
            setTotalProducts(total);
            setError(null);
            setDebugInfo({ productsFetched: data.length, totalFromApi: total, tenantId: user?.tenantId });

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to load products");
        } finally {
            setLoading(false);
        }
    };

    // Helper to reload using current state
    const reloadCurrentPage = () => fetchProducts(page, search, category, showLowStock, showArchived);

    // Selection deliberately survives page turns and search/filter changes so
    // large selections can be built up across pages; a store-context switch is
    // the one navigation where carrying it over would be confusing.
    useEffect(() => {
        setSelectedMap(new Map());
    }, [selectedStoreId]);

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
            reloadCurrentPage();
            setNewProduct({ name: '', sku: '', barcode: '', categoryId: '', price: '', costPrice: '', minStockLevel: 0, supplierId: '' });
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
            categoryId: (product as any).categoryId || product.category?.id || '',
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
            reloadCurrentPage();
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
            reloadCurrentPage();
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
            reloadCurrentPage();
        } catch (err: any) {
            toast.error('Import Failed: ' + err.message);
            setLoading(false);
        }
    };

    // Archive Action
    const handleArchiveToggle = async (product: Product, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!(await confirmDialog({
            title: product.isArchived ? 'Restore Product' : 'Archive Product',
            message: product.isArchived ? `Restore "${product.name}" to your active catalogue?` : `Archive "${product.name}"? It will be hidden from sales but its history is kept.`,
            confirmLabel: product.isArchived ? 'Restore' : 'Archive',
            destructive: !product.isArchived,
        }))) return;

        try {
            if (product.isArchived) {
                await api.products.unarchive(product.id);
                toast.success('Product Restored');
            } else {
                await api.products.archive(product.id);
                toast.success('Product Archived');
            }
            reloadCurrentPage();
        } catch (err: any) {
            toast.error('Operation failed');
        }
    };

    // ---- Bulk actions ----
    // All bulk operations reuse the same single-product endpoints the Edit
    // form and per-row Archive button already call — one request per product,
    // sequential, with progress and per-item failure reporting.
    const selectedProducts = Array.from(selectedMap.values());
    const allOnPageSelected = products.length > 0 && products.every(p => selectedMap.has(p.id));

    const toggleSelect = (product: Product) => {
        setSelectedMap(prev => {
            const next = new Map(prev);
            if (next.has(product.id)) next.delete(product.id); else next.set(product.id, product);
            return next;
        });
    };

    // Header checkbox scopes to the visible page: checking adds this page's
    // rows to the running selection, unchecking removes only this page's rows.
    const toggleSelectAll = () => {
        setSelectedMap(prev => {
            const next = new Map(prev);
            if (allOnPageSelected) {
                products.forEach(p => next.delete(p.id));
            } else {
                products.forEach(p => next.set(p.id, p));
            }
            return next;
        });
    };

    const runBulk = async (label: string, targets: Product[], exec: (p: Product) => Promise<any>) => {
        setBulkBusy(true);
        setBulkProgress({ done: 0, total: targets.length });
        const failures: string[] = [];
        for (let i = 0; i < targets.length; i++) {
            try {
                await exec(targets[i]);
            } catch {
                failures.push(targets[i].name);
            }
            setBulkProgress({ done: i + 1, total: targets.length });
        }
        setBulkBusy(false);
        setBulkProgress(null);
        if (failures.length === 0) {
            toast.success(`${label}: ${targets.length} product${targets.length === 1 ? '' : 's'} updated`);
        } else {
            toast.error(`${label}: ${failures.length} of ${targets.length} failed — ${failures.slice(0, 3).join(', ')}${failures.length > 3 ? '…' : ''}`, { duration: 6000 });
        }
        setSelectedMap(new Map());
        reloadCurrentPage();
    };

    const applyBulkCategory = async () => {
        if (!bulkCategoryId || selectedProducts.length === 0) return;
        const clearing = bulkCategoryId === '__clear__';
        const catName = categories.find(c => c.id === bulkCategoryId)?.name;
        if (!(await confirmDialog({
            title: 'Bulk Category Assignment',
            message: clearing
                ? `Remove the category from ${selectedProducts.length} selected product${selectedProducts.length === 1 ? '' : 's'}?`
                : `Set category "${catName}" on ${selectedProducts.length} selected product${selectedProducts.length === 1 ? '' : 's'}?`,
            confirmLabel: clearing ? 'Remove Category' : 'Assign Category',
        }))) return;
        await runBulk('Category assignment', selectedProducts,
            p => api.products.update(p.id, { categoryId: clearing ? '' : bulkCategoryId } as any));
        setBulkCategoryId('');
    };

    const applyBulkSupplier = async () => {
        if (!bulkSupplierId || selectedProducts.length === 0) return;
        const clearing = bulkSupplierId === '__clear__';
        const supName = suppliers.find(s => s.id === bulkSupplierId)?.name;
        if (!(await confirmDialog({
            title: 'Bulk Supplier Assignment',
            message: clearing
                ? `Remove the supplier from ${selectedProducts.length} selected product${selectedProducts.length === 1 ? '' : 's'}?`
                : `Set supplier "${supName}" on ${selectedProducts.length} selected product${selectedProducts.length === 1 ? '' : 's'}?`,
            confirmLabel: clearing ? 'Remove Supplier' : 'Assign Supplier',
        }))) return;
        await runBulk('Supplier assignment', selectedProducts,
            p => api.products.update(p.id, { supplierId: clearing ? '' : bulkSupplierId } as any));
        setBulkSupplierId('');
    };

    const applyBulkArchive = async () => {
        const targets = selectedProducts.filter(p => !p.isArchived);
        if (targets.length === 0) return;
        if (!(await confirmDialog({
            title: 'Bulk Archive',
            message: `Archive ${targets.length} product${targets.length === 1 ? '' : 's'}? They will be hidden from sales but their history is kept.`,
            confirmLabel: 'Archive All',
            destructive: true,
        }))) return;
        await runBulk('Archive', targets, p => api.products.archive(p.id));
    };

    const applyBulkRestore = async () => {
        const targets = selectedProducts.filter(p => p.isArchived);
        if (targets.length === 0) return;
        if (!(await confirmDialog({
            title: 'Bulk Restore',
            message: `Restore ${targets.length} archived product${targets.length === 1 ? '' : 's'} to the active catalogue?`,
            confirmLabel: 'Restore All',
        }))) return;
        await runBulk('Restore', targets, p => api.products.unarchive(p.id));
    };

    if (!isHydrated) return <div className="p-8">Loading...</div>;

    // Separate Initial Full Page Load from Filter Updates
    // We only block if we are loading AND have no products (initial empty state)
    if (loading && products.length === 0 && !search && !category) {
        return <div className="p-8">Loading Products...</div>;
    }

    return (
        <div className="h-full bg-canvas overflow-y-auto relative">
            <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-10 animate-fade-in-up">
                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm">
                        <p className="font-semibold">Error loading data</p>
                        <p>{error}</p>
                    </div>
                )}
                {/* Header */}
                <div className="flex flex-wrap justify-between items-center mb-10 gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Products</h1>
                        <span className="text-sm font-medium text-mid-grey">Inventory across your catalogue</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                if (await confirmDialog({ title: 'Refresh Data', message: 'This will clear the local cache and reload everything from the server. Continue?', confirmLabel: 'Refresh' })) {
                                    DataService.clearCache().then(() => window.location.reload());
                                }
                            }}
                            className="bg-white border border-cool-grey text-charcoal text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-surface-muted transition flex items-center gap-2"
                        >
                            <RefreshCw size={15} /> Refresh
                        </button>
                        {(hasPermission('MANAGE_PRODUCTS') || hasPermission('RAISE_PURCHASE_ORDER')) && (
                            <button
                                onClick={() => router.push('/inventory/purchase-orders')}
                                className="bg-white border border-cool-grey text-charcoal text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-surface-muted transition flex items-center gap-2"
                            >
                                <ClipboardList size={15} /> Purchase Orders
                            </button>
                        )}
                        {hasPermission('MANAGE_PRODUCTS') && (
                            <>
                                <button
                                    onClick={() => setShowCategoryManager(true)}
                                    className="bg-white border border-cool-grey text-charcoal text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-surface-muted transition"
                                >
                                    Manage Categories
                                </button>
                                <button
                                    onClick={() => {
                                        if (!selectedStoreId) {
                                            toast.error("Please select a specific store first.");
                                            return;
                                        }
                                        setIsImportModalOpen(true);
                                    }}
                                    className={`border border-cool-grey text-sm font-semibold px-4 py-2.5 rounded-xl transition ${!selectedStoreId ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-charcoal hover:bg-surface-muted'}`}
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
                                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-soft ${!selectedStoreId ? 'bg-gray-300 cursor-not-allowed text-gray-500 shadow-none' : 'bg-brand-500 text-white hover:bg-brand-600'}`}
                                >
                                    + Add Product
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        <div className="bg-white p-6 rounded-2xl shadow-card border border-gray-100/80">
                            <h3 className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Total Products</h3>
                            <p className="text-3xl font-semibold text-gray-900 tracking-tight mt-3">{stats.totalProducts}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-card border border-gray-100/80">
                            <h3 className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Inventory Value</h3>
                            <p className="text-3xl font-semibold text-gray-900 tracking-tight mt-3">{formatCurrency(stats.inventoryValue, user?.currency)}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-card border border-gray-100/80">
                            <h3 className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Low Stock Items</h3>
                            <p className={`text-3xl font-semibold tracking-tight mt-3 ${stats.lowStockCount > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                                {stats.lowStockCount}
                            </p>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white p-5 rounded-2xl shadow-card border border-gray-100/80 mb-8 flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            ref={searchInputRef}
                            type="text"
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            placeholder="Search products (Name, SKU, Barcode)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                    <div className="w-[200px]">
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        >
                            <option value="">All Categories</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="lowStock"
                            checked={showLowStock}
                            onChange={(e) => setShowLowStock(e.target.checked)}
                            className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                        />
                        <label htmlFor="lowStock" className="text-gray-700 font-medium cursor-pointer">Low Stock Only</label>
                    </div>
                    {(hasPermission('MANAGE_PRODUCTS') || hasPermission('admin')) && (
                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
                            <input
                                type="checkbox"
                                id="showArchived"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <label htmlFor="showArchived" className="text-gray-700 font-medium cursor-pointer">Show Archived</label>
                        </div>
                    )}
                </div>

                {/* Create Modal */}
                {showCreate && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-semibold">{editingId ? 'Edit Product' : 'New Product'}</h2>
                                <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
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
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={newProduct.categoryId || ''}
                                        onChange={e => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowCategoryManager(true)}
                                        className="text-brand-600 font-medium text-sm hover:underline"
                                    >
                                        Manage
                                    </button>
                                </div>
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
                                    <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600">
                                        {editingId ? 'Update Product' : 'Save Product'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Adjust Modal */}
                {adjustModalOpen && selectedProduct && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-lifted">
                            <h3 className="text-lg font-semibold mb-4">Adjust Stock: {selectedProduct.name}</h3>
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
                                        className="px-4 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600"
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
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-lifted">
                            <h3 className="text-xl font-semibold mb-4">Receive Stock: {selectedProduct.name}</h3>
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
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
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
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-lifted">
                            <h3 className="text-xl font-semibold mb-4">Import Products</h3>
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
                                                file:bg-brand-50 file:text-brand-700
                                                hover:file:bg-brand-100
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
                                        className="block w-full text-center text-sm text-brand-600 hover:underline bg-transparent border-0 cursor-pointer"
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
                                        className="px-4 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50"
                                    >
                                        Upload & Import
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Bulk action bar — appears when rows are selected */}
                {selectedMap.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fade-in-up">
                        <div className="bg-white rounded-2xl shadow-lifted border border-gray-100 px-5 py-3 flex items-center gap-3 flex-wrap max-w-[92vw]">
                            <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                {selectedMap.size} selected{selectedMap.size > products.filter(p => selectedMap.has(p.id)).length ? ' (across pages)' : ''}
                            </span>
                            <button
                                onClick={() => setSelectedMap(new Map())}
                                disabled={bulkBusy}
                                className="text-xs font-semibold text-gray-500 hover:text-charcoal px-2 py-1 rounded-lg hover:bg-surface-muted transition-colors"
                            >
                                Clear
                            </button>

                            <div className="h-6 w-px bg-cool-grey" />

                            {bulkBusy && bulkProgress ? (
                                <span className="text-sm font-medium text-charcoal flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                    Updating {bulkProgress.done}/{bulkProgress.total}…
                                </span>
                            ) : (
                                <>
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={bulkCategoryId}
                                            onChange={e => setBulkCategoryId(e.target.value)}
                                            className="border border-cool-grey rounded-xl px-2.5 py-1.5 text-sm text-charcoal bg-white focus:border-brand-500 outline-none max-w-[180px]"
                                        >
                                            <option value="">Category…</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            <option value="__clear__">— Remove category —</option>
                                        </select>
                                        <button
                                            onClick={applyBulkCategory}
                                            disabled={!bulkCategoryId}
                                            className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Apply
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={bulkSupplierId}
                                            onChange={e => setBulkSupplierId(e.target.value)}
                                            className="border border-cool-grey rounded-xl px-2.5 py-1.5 text-sm text-charcoal bg-white focus:border-brand-500 outline-none max-w-[180px]"
                                        >
                                            <option value="">Supplier…</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            <option value="__clear__">— Remove supplier —</option>
                                        </select>
                                        <button
                                            onClick={applyBulkSupplier}
                                            disabled={!bulkSupplierId}
                                            className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Apply
                                        </button>
                                    </div>

                                    <div className="h-6 w-px bg-cool-grey" />

                                    {selectedProducts.some(p => !p.isArchived) && (
                                        <button
                                            onClick={applyBulkArchive}
                                            className="text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                                        >
                                            Archive ({selectedProducts.filter(p => !p.isArchived).length})
                                        </button>
                                    )}
                                    {selectedProducts.some(p => p.isArchived) && (
                                        <button
                                            onClick={applyBulkRestore}
                                            className="text-charcoal hover:bg-surface-muted border border-cool-grey px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                                        >
                                            Restore ({selectedProducts.filter(p => p.isArchived).length})
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white shadow-card rounded-2xl overflow-hidden border border-gray-100/80">
                    <table className="w-full divide-y divide-gray-100 table-fixed">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="w-12 px-4 py-4">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all products on this page"
                                        checked={allOnPageSelected}
                                        onChange={toggleSelectAll}
                                        disabled={bulkBusy}
                                        className="w-4 h-4 accent-brand-500 cursor-pointer"
                                    />
                                </th>
                                <th className="w-[18%] px-4 py-4 text-left text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Name</th>
                                <th className="w-[15%] px-4 py-4 text-left text-[11px] font-semibold text-mid-grey uppercase tracking-widest">SKU / Barcode</th>
                                <th className="w-[10%] px-4 py-4 text-left text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Price (Sell)</th>
                                <th className="w-[12%] px-4 py-4 text-left text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Category</th>
                                <th className="w-[10%] px-4 py-4 text-left text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Cost (Buy)</th>
                                <th className="w-[13%] px-4 py-4 text-left text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Supplier</th>
                                <th className="w-[10%] px-4 py-4 text-left text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Current Stock</th>
                                {selectedStoreId && <th className="w-[10%] px-4 py-4 text-right text-[11px] font-semibold text-mid-grey uppercase tracking-widest">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={selectedStoreId ? 9 : 8} className="px-6 py-8 text-center text-gray-500">
                                        No products found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                products.map(p => {
                                    const stock = p.inventory?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
                                    const isLowStock = stock <= (p.minStockLevel || 0);
                                    return (
                                        <tr key={p.id} className={`hover:bg-gray-50 cursor-pointer ${p.isArchived ? 'opacity-60 bg-gray-100' : ''} ${selectedMap.has(p.id) ? 'bg-brand-50/60' : ''}`} onClick={() => router.push(`/products/${p.id}`)}>
                                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${p.name}`}
                                                    checked={selectedMap.has(p.id)}
                                                    onChange={() => toggleSelect(p)}
                                                    disabled={bulkBusy}
                                                    className="w-4 h-4 accent-brand-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-4 truncate" title={p.name}>
                                                <div className="text-sm font-medium text-gray-900 truncate">
                                                    {p.name} {p.isArchived && <span className="ml-2 text-xs bg-gray-500 text-white px-2 py-0.5 rounded">Archived</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 truncate">
                                                <div className="text-sm text-gray-500 truncate" title={p.sku}>{p.sku}</div>
                                                <div className="text-xs text-gray-400 truncate" title={p.barcode || ''}>{p.barcode}</div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-500 truncate">
                                                {formatCurrency(p.price, user?.currency)}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-500 truncate" title={p.category?.name || (p as any).category}>
                                                {p.category?.name || (p as any).category || '-'}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-500 truncate">
                                                {p.costPrice ? formatCurrency(p.costPrice, user?.currency) : '-'}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-500 truncate" title={p.supplier?.name}>
                                                {p.supplier ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-muted text-charcoal truncate max-w-full">
                                                        {p.supplier.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic">None</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-500 truncate">
                                                <span className={`font-semibold ${stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {stock}
                                                </span>
                                                {isLowStock && (
                                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                        Low
                                                    </span>
                                                )}
                                            </td>
                                            {selectedStoreId && (
                                                <td className="px-4 py-4 text-right text-sm font-medium w-[10%]">
                                                    <div className="flex justify-end gap-2">
                                                        {hasPermission('MANAGE_INVENTORY') && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openAdjustModal(p);
                                                                    }}
                                                                    className="text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 p-2 rounded-lg transition"
                                                                    title="Adjust Stock"
                                                                >
                                                                    <SlidersHorizontal size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openReceiveModal(p);
                                                                    }}
                                                                    className="text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 p-2 rounded-lg transition"
                                                                    title="Receive Stock"
                                                                >
                                                                    <ArrowDownToLine size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {hasPermission('MANAGE_PRODUCTS') && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startEdit(p);
                                                                    }}
                                                                    className="text-charcoal hover:text-gray-900 bg-surface-muted hover:bg-cool-grey p-2 rounded-lg transition"
                                                                    title="Edit Product"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                {(hasPermission('MANAGE_PRODUCTS') || hasPermission('admin')) && (
                                                                    <button
                                                                        onClick={(e) => handleArchiveToggle(p, e)}
                                                                        className={`${p.isArchived ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'} hover:bg-opacity-80 p-2 rounded-lg transition`}
                                                                        title={p.isArchived ? "Restore" : "Archive"}
                                                                    >
                                                                        {p.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between rounded-b-xl border-x border-b">
                    <div className="text-sm text-gray-500">
                        Page {page} of {Math.max(1, Math.ceil(totalProducts / limit))}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const newPage = Math.max(1, page - 1);
                                setPage(newPage);
                            }}
                            disabled={page === 1 || loading}
                            className="px-4 py-2 border rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => {
                                const newPage = page + 1;
                                setPage(newPage);
                            }}
                            disabled={page >= Math.ceil(totalProducts / limit) || loading}
                            className="px-4 py-2 border rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            <CategoryManager
                isOpen={showCategoryManager}
                onClose={() => setShowCategoryManager(false)}
                onUpdate={loadCategories}
            />
        </div >
    );
}
