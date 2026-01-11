"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, AlertCircle, ShoppingCart, Trash2, Box, Store } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ProductPicker } from '@/components/inventory/ProductPicker';

export default function CreatePOPage() {
    const { token, isHydrated, selectedStoreId, user, hasPermission } = useAuth();
    const router = useRouter();

    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [supplierId, setSupplierId] = useState('');
    const [cart, setCart] = useState<any[]>([]);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    useEffect(() => {
        if (!isHydrated || !token) return;

        // Security Check
        if (!hasPermission('RAISE_PURCHASE_ORDER')) {
            toast.error("Permission Denied");
            router.push('/inventory/purchase-orders');
            return;
        }

        loadSuppliers();
    }, [token, isHydrated, selectedStoreId]);

    const loadSuppliers = async () => {
        try {
            const data = await api.suppliers.list(selectedStoreId || undefined);
            setSuppliers(data);
        } catch (e) {
            console.error(e);
        }
    };

    // Auto-Populate Logic
    const handleSupplierChange = async (newSupplierId: string) => {
        // Reset cart logic:
        // 1. If switching FROM 'unassigned' TO a real supplier -> KEEP CART (We are assigning these items)
        // 2. If switching FROM 'real' TO 'real' -> RESET CART (Different vendor context)
        // 3. If switching TO 'unassigned' -> RESET CART (Fresh search for unassigned)
        if (supplierId !== 'unassigned' && newSupplierId !== 'unassigned') {
            setCart([]);
        } else if (newSupplierId === 'unassigned') {
            setCart([]);
        }

        setSupplierId(newSupplierId);

        if (!newSupplierId || !selectedStoreId) return;

        setIsLoadingSuggestions(true);
        try {
            const suggestions = await api.suppliers.getReorderItems(newSupplierId, selectedStoreId);

            if (suggestions && suggestions.length > 0) {
                const newItems = suggestions.map((s: any) => ({
                    productId: s.productId,
                    quantity: s.suggestedQty || 1,
                    unitCost: Number(s.lastCost || s.product?.costPrice || 0),
                    product: s.product
                }));

                setCart(newItems);
                toast.success(`Populated ${newItems.length} low-stock items`, { icon: '📦' });
            } else {
                toast("No low stock items found for this supplier", { icon: 'check' });
            }
        } catch (e) {
            console.warn("Auto-populate failed", e);
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    const addToCart = (product: any) => {
        if (cart.find(c => c.productId === product.id)) {
            toast.error("Item already in cart", { icon: '⚠️' });
            return;
        }
        setCart([...cart, {
            productId: product.id,
            quantity: 1,
            unitCost: Number(product.costPrice || 0),
            product: product
        }]);
        toast.success("Added to Order");
    };

    const updateQuantity = (idx: number, change: number) => {
        const newCart = [...cart];
        newCart[idx].quantity = Math.max(1, newCart[idx].quantity + change);
        setCart(newCart);
    };

    const updateQuantityDirect = (idx: number, val: number) => {
        const newCart = [...cart];
        newCart[idx].quantity = Math.max(1, val);
        setCart(newCart);
    };

    const updateCost = (idx: number, val: number) => {
        const newCart = [...cart];
        newCart[idx].unitCost = Math.max(0, val);
        setCart(newCart);
    };

    const removeFromCart = (idx: number) => {
        const newCart = [...cart];
        newCart.splice(idx, 1);
        setCart(newCart);
    };

    const handleSave = async () => {
        if (!selectedStoreId) {
            toast.error("Please select a store first");
            return;
        }
        if (!supplierId) {
            toast.error("Please select a supplier");
            return;
        }
        setIsSaving(true);
        try {
            await api.purchaseOrders.create({
                supplierId,
                storeId: selectedStoreId,
                items: cart.map(c => ({
                    productId: c.productId,
                    quantity: c.quantity,
                    unitCost: c.unitCost
                })),
                notes
            });
            toast.success("Purchase Order Created!");
            router.push('/inventory/purchase-orders');
        } catch (e) {
            toast.error("Failed to create order");
        } finally {
            setIsSaving(false);
        }
    };

    const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    return (
        <div className="h-[calc(100vh-64px)] flex overflow-hidden bg-white">
            {/* Left Panel: Product Picker (40%) */}
            <div className="w-[450px] flex-shrink-0 h-full border-r border-gray-200 bg-white z-20 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                {selectedStoreId ? (
                    <ProductPicker
                        storeId={selectedStoreId}
                        onSelect={addToCart}
                        className="h-full border-none"
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50/50">
                        <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 border border-gray-100">
                            <Store className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Select a Store</h3>
                        <p className="text-sm text-gray-500 mt-2 max-w-[200px]">Please select a store from the top bar to browse inventory.</p>
                    </div>
                )}
            </div>

            {/* Right Panel: Content (60%) */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/30 relative">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 bg-white flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">Draft Mode</span>
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">New Purchase Order</h1>
                    </div>

                    <div className="w-72">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">Select Supplier</label>
                        <select
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all cursor-pointer hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            value={supplierId}
                            onChange={(e) => handleSupplierChange(e.target.value)}
                            disabled={isLoadingSuggestions}
                        >
                            <option value="">
                                {isLoadingSuggestions ? 'Finding Low Stock Items...' : 'Choose Supplier...'}
                            </option>
                            <option value="unassigned">⚠️ Unassigned Products (No Preferred Supplier)</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto px-8 py-6 pb-40 custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 m-4">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                                <ShoppingCart className="w-10 h-10 text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Your cart is empty</h3>
                            <p className="text-gray-500 text-sm mt-2 max-w-sm text-center">
                                Use the inventory browser on the left to add items to this order.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-50">
                                <thead className="bg-gray-50/80">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Item Details</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-32">Qty</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider w-32">Unit Cost</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider w-32">Line Total</th>
                                        <th className="px-6 py-4 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 bg-white">
                                    {cart.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{item.product.name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 rounded">{item.product.sku}</span>
                                                    {item.product.currentStock <= item.product.minStock && (
                                                        <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                                                            <AlertCircle size={10} /> Low Stock
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden w-28 mx-auto hover:border-indigo-300 transition-colors">
                                                    <button
                                                        onClick={() => updateQuantity(idx, -1)}
                                                        className="px-3 py-1.5 hover:bg-gray-50 text-gray-500 transition-colors active:bg-gray-100"
                                                    >-</button>
                                                    <input
                                                        className="w-full text-center text-sm font-bold focus:outline-none text-gray-800"
                                                        value={item.quantity}
                                                        onChange={(e) => updateQuantityDirect(idx, parseInt(e.target.value) || 0)}
                                                    />
                                                    <button
                                                        onClick={() => updateQuantity(idx, 1)}
                                                        className="px-3 py-1.5 hover:bg-gray-50 text-gray-500 transition-colors active:bg-gray-100"
                                                    >+</button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="relative group/input">
                                                    <span className="absolute left-3 top-1.5 text-xs text-gray-400 font-medium">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.unitCost}
                                                        onChange={(e) => updateCost(idx, parseFloat(e.target.value))}
                                                        className="w-24 text-right py-1.5 pl-6 pr-2 border border-transparent hover:border-gray-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white focus:shadow-sm outline-none font-mono text-sm font-medium transition-all"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900 font-mono">
                                                {formatCurrency((item.unitCost || 0) * item.quantity, user?.currency)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => removeFromCart(idx)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="mt-8">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Internal Notes</label>
                        <textarea
                            className="w-full p-4 border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none text-sm bg-white transition-all"
                            rows={3}
                            placeholder="Add reference numbers, delivery instructions, or approvals..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200/60 p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] z-30">
                    <div className="flex justify-between items-center max-w-none mx-auto">
                        <div className="flex gap-12 text-sm pl-4">
                            <div>
                                <span className="block text-gray-400 text-[10px] uppercase tracking-wider font-bold">Total Items</span>
                                <span className="font-bold text-gray-900 text-xl">{cart.length}</span>
                            </div>
                            <div>
                                <span className="block text-gray-400 text-[10px] uppercase tracking-wider font-bold">Total Qty</span>
                                <span className="font-bold text-gray-900 text-xl">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-right">
                                <span className="block text-gray-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">Estimated Total</span>
                                <span className="font-black text-3xl text-gray-900 leading-none tracking-tight">
                                    {formatCurrency(totalAmount, user?.currency)}
                                </span>
                            </div>
                            <div className="h-12 w-px bg-gray-200 mx-2"></div>
                            <button
                                onClick={handleSave}
                                disabled={cart.length === 0 || isSaving}
                                className={`
                                    px-8 py-3.5 rounded-xl font-bold text-white shadow-xl shadow-indigo-200/50 hover:shadow-indigo-300 text-sm tracking-wide transform hover:-translate-y-0.5 transition-all
                                    ${cart.length === 0 || isSaving ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-tr from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700'}
                                `}
                            >
                                {isSaving ? 'Creating...' : 'Create Purchase Order'}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
