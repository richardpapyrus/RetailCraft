"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { api, Product } from '@/lib/api';
import { printerService, PrinterService } from '@/lib/printer-service';
import { DataService } from '@/lib/db-service';
import { Customer } from '@/lib/db';
import OpenTillModal from '@/components/tills/OpenTillModal';
import CloseTillModal from '@/components/tills/CloseTillModal';
import { useDebounce } from '@/hooks/useDebounce';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import ReceiptTemplate from '@/components/pos/ReceiptTemplate';

interface CartItem extends Product {
    cartQty: number;
}


export default function POSPage() {
    const { user, token, logout, isHydrated, selectedStoreId } = useAuth();
    const router = useRouter();

    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [loading, setLoading] = useState(true);
    const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
    const [hasMoreProducts, setHasMoreProducts] = useState(true);

    // Till Session State
    const [activeSession, setActiveSession] = useState<any>(null);
    const [isTillModalOpen, setIsTillModalOpen] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [closeTillModalOpen, setCloseTillModalOpen] = useState(false);

    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [tendered, setTendered] = useState<string>('');
    const [lastSale, setLastSale] = useState<{ items: CartItem[], total: number, tendered: number, change: number, date: Date, id?: string, customerName?: string } | null>(null);
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);

    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH');
    const [printerConnected, setPrinterConnected] = useState(false);

    // Split Payment State
    const [splitPayments, setSplitPayments] = useState<{ id: string, method: string, amount: number }[]>([]);
    const [splitModalOpen, setSplitModalOpen] = useState(false);

    // Taxes and Discounts
    const [taxes, setTaxes] = useState<any[]>([]);
    const [discounts, setDiscounts] = useState<any[]>([]);
    const [appliedDiscount, setAppliedDiscount] = useState<{
        id?: string,
        name: string,
        type: 'PERCENTAGE' | 'FIXED' | 'MANUAL',
        value: number,
        targetType?: 'ALL' | 'PRODUCT' | 'CATEGORY',
        targetValues?: string[]
    } | null>(null);
    const [discountModalOpen, setDiscountModalOpen] = useState(false);

    // Receipt Extended Data
    const [lastSaleExt, setLastSaleExt] = useState<{ subtotal: number, tax: number, discount: number } | null>(null);

    // CRM State
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'products' | 'customers'>('products');
    const [loadingMoreCustomers, setLoadingMoreCustomers] = useState(false);
    const [hasMoreCustomers, setHasMoreCustomers] = useState(true);

    // Loyalty State
    const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
    const [usePoints, setUsePoints] = useState(false);

    useBarcodeScanner((barcode) => {
        console.log('Scanned:', barcode);
        const match = products.find(p =>
            p.sku === barcode ||
            p.barcode === barcode ||
            p.id === barcode
        );

        if (match) {
            addToCart(match);
            if (search === barcode) {
                setSearch('');
            }
        } else {
            toast.error(`Product not found: ${barcode}`);
        }
    });

    useEffect(() => {
        if (!isHydrated) return;

        if (!token) {
            router.push('/login');
        } else {
            // Context Change: Reset Cart to prevent leakage
            setCart([]);
            setAppliedDiscount(null);
            setSelectedCustomer(null);

            // Need to wait for selectedStoreId to be ready? It comes from useAuth which hydrates.
            // If selectedStoreId changes, we reload.
            loadProducts(true);
            loadCustomers(true);
            loadTaxesAndDiscounts();
            checkTillSession();
        }
    }, [token, router, isHydrated, selectedStoreId]);

    // Search Effect
    useEffect(() => {
        if (isHydrated && token) {
            loadProducts(true);
        }
    }, [debouncedSearch]);

    const checkTillSession = async () => {
        // If Admin is using POS, `req.user.storeId` is null.
        // I need to update TillsController to support query param `storeId` for getActiveSession too?
        // OR rely on POS passing it?
        // Let's assume for now we just load data.
        try {
            const session = await api.tills.getActiveSession(selectedStoreId || undefined);
            // ...
            if (session && session.status === 'OPEN') {
                // Check if session belongs to selected store
                if (selectedStoreId && session.till?.storeId && session.till.storeId !== selectedStoreId) {
                    toast.error(`Warning: You have an active till session in another store. You cannot open a new one here until you close it.`);
                    setActiveSession(null); // Don't attach remote session
                } else {
                    setActiveSession(session);
                    setIsTillModalOpen(false);
                }
            } else {
                setActiveSession(null);
                setIsTillModalOpen(true);
            }
        } catch (e) {
            // ... 
            console.error('Failed to check till session', e);
            setIsTillModalOpen(true);
        } finally {
            setCheckingSession(false);
        }
    };


    const loadTaxesAndDiscounts = async () => {
        try {
            const [t, d] = await Promise.all([api.taxes.list(), api.discounts.list()]);
            setTaxes(t || []);
            setDiscounts(d || []);
        } catch (e) { console.error('Failed active taxes/discounts', e); }
    };

    const loadCustomers = async (reset = false) => {
        if (!reset) setLoadingMoreCustomers(true);
        const skip = reset ? 0 : customers.length;
        const { data, total } = await DataService.getCustomers(skip, 50, selectedStoreId || undefined);

        if (reset) setCustomers(data);
        else setCustomers(prev => [...prev, ...data]);

        setHasMoreCustomers(data.length > 0 && (reset ? data.length : customers.length + data.length) < total);

        setLoadingMoreCustomers(false);
    };

    const loadProducts = async (reset = false) => {
        try {
            if (reset) setLoading(true);
            else setLoadingMoreProducts(true);

            const skip = reset ? 0 : products.length;
            const { data, total } = await DataService.getProducts(skip, 50, { search: debouncedSearch }, selectedStoreId || undefined);

            if (reset) setProducts(data);
            else setProducts(prev => [...prev, ...data]);

            setHasMoreProducts(data.length > 0 && (reset ? data.length : products.length + data.length) < total);

        } catch (error) {
            console.error('Failed to load products', error);
        } finally {
            setLoading(false);
            setLoadingMoreProducts(false);
        }
    };

    const addToCart = (product: Product) => {
        const stock = product.inventory?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;

        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            const currentQty = existing ? existing.cartQty : 0;

            if (currentQty + 1 > stock) {
                toast.error(`Insufficient stock. Only ${stock} unit(s) available.`);
                return prev;
            }

            if (existing) {
                return prev.map(p => p.id === product.id ? { ...p, cartQty: p.cartQty + 1 } : p);
            }
            return [...prev, { ...product, cartQty: 1 }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(p => p.id !== productId));
    };

    const updateQty = (productId: string, delta: number) => {
        setCart(prev => prev.map(p => {
            if (p.id === productId) {
                if (delta > 0) {
                    const stock = p.inventory?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
                    if (p.cartQty + delta > stock) {
                        toast.error(`Cannot add more. Max stock is ${stock}.`);
                        return p;
                    }
                }
                const newQty = Math.max(1, p.cartQty + delta);
                return { ...p, cartQty: newQty };
            }
            return p;
        }));
    };

    // Helper: Calculation
    const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.cartQty), 0);

    let discountAmount = 0;
    if (appliedDiscount) {
        let eligibleSubtotal = 0;

        if (!appliedDiscount.targetType || appliedDiscount.targetType === 'ALL') {
            eligibleSubtotal = subtotal;
        } else {
            // Filter eligible items
            cart.forEach(item => {
                let isEligible = false;
                if (appliedDiscount.targetType === 'PRODUCT') {
                    if (appliedDiscount.targetValues?.includes(item.id)) isEligible = true;
                } else if (appliedDiscount.targetType === 'CATEGORY') {
                    if (item.category && appliedDiscount.targetValues?.includes(item.category)) isEligible = true;
                }

                if (isEligible) {
                    eligibleSubtotal += Number(item.price) * item.cartQty;
                }
            });
        }

        if (appliedDiscount.type === 'PERCENTAGE') {
            discountAmount = eligibleSubtotal * (appliedDiscount.value / 100);
        } else {
            discountAmount = Math.min(appliedDiscount.value, eligibleSubtotal);
        }
    }

    // Loyalty Discount (Client-side estimate)
    if (usePoints && pointsToRedeem > 0) {
        // 1 Point = $0.10
        const loyaltyDiscount = pointsToRedeem * 0.10;
        discountAmount += loyaltyDiscount;
    }

    // Ensure discount doesn't exceed subtotal
    if (discountAmount > subtotal) discountAmount = subtotal;

    const taxableAmount = subtotal - discountAmount;

    // Calculate Tax (Sum of all active rates applied to taxable amount)
    // Assumption: Taxes are exclusive and additive
    const totalTaxRate = taxes.reduce((sum, t) => sum + Number(t.rate), 0);
    const taxAmount = taxableAmount * totalTaxRate;

    const cartTotal = taxableAmount + taxAmount;

    const handleCheckout = async () => {
        if (!activeSession) {
            toast.error('Please open a till session first.');
            setIsTillModalOpen(true);
            return;
        }
        if (cart.length === 0) return;

        const tenderedVal = parseFloat(tendered) || 0;
        const change = tenderedVal - cartTotal;

        try {
            const result = await DataService.saveSale({
                items: cart.map(i => ({ productId: i.id, quantity: i.cartQty })),
                paymentMethod: selectedPaymentMethod,
                total: cartTotal,
                customerId: selectedCustomer?.id,
                tillSessionId: activeSession?.id,
                redeemPoints: usePoints ? pointsToRedeem : 0,
                storeId: selectedStoreId || undefined
            });

            // Store Sale Info for Receipt
            setLastSale({
                items: [...cart],
                tendered: tenderedVal,
                change: change,
                date: new Date(),
                ...result.data, // Merge ID
                total: Number(cartTotal),
                customerName: selectedCustomer?.name,
                payments: isSplit ? splitPayments.map(p => ({ method: p.method, amount: p.amount })) : undefined
            });
            setLastSaleExt({ subtotal, tax: taxAmount, discount: discountAmount });

            if (result.offline) {
                toast.loading('Offline Mode: Sale saved to local queue.', { duration: 4000 });
            } else {
                toast.success('Sale completed!');
            }

            // Reset UI
            setCart([]);
            setAppliedDiscount(null);
            setTendered('');
            setUsePoints(false);
            setPointsToRedeem(0);
            setCheckoutModalOpen(false);
            setSelectedPaymentMethod('CASH'); // Reset to default
            setReceiptModalOpen(true); // Show Receipt
            loadProducts(true);
        } catch (e) {
            console.error(e);
            toast.error('Checkout Failed');
        }
    };

    const handlePrint = async () => {
        if (printerService.isConnected()) {
            console.log('Attempting USB Print...');
            try {
                const businessName = user?.tenant?.name || user?.tenantName || 'My Store';
                const receipt = PrinterService.createReceipt(
                    businessName,
                    lastSale?.items || [],
                    formatCurrency(lastSale?.total, user?.currency, user?.locale)
                );
                await printerService.print(receipt);
            } catch (e) {
                console.error('Thermal print failed', e);
                toast.error('Printer error. Falling back to browser print.');
                window.print();
            }
        } else {
            window.print();
        }
    };



    // Verify Store Selection (Global View Lock)
    if (isHydrated && !selectedStoreId) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-md">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2H7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Select a Store</h2>
                    <p className="text-gray-500 mb-6">POS and Sales features are disabled in Global View. Please select a specific location from the sidebar to continue.</p>
                </div>
            </div>
        )
    }

    if (!user || !isHydrated) return <div className="p-8">Loading POS...</div>;

    // Receipt Context: Get ACTUAL store object via API (safer than relying on user object)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [activeStore, setActiveStore] = useState<any>(user?.store);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        if (selectedStoreId) {
            api.stores.list(selectedStoreId).then((res: any) => {
                if (Array.isArray(res) && res.length > 0) setActiveStore(res[0]);
                else setActiveStore(user?.store);
            }).catch(() => setActiveStore(user?.store));
        } else {
            setActiveStore(user?.store);
        }
    }, [selectedStoreId, user?.store]);


    const filteredProducts = products;

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.includes(customerSearch) ||
        c.code?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    return (
        <div className="h-full w-full">
            <div className="flex h-full w-full bg-[#f8f9fc] font-sans overflow-hidden print:hidden">
                {/* CENTER: INVOICE / CART */}
                <div className="flex-1 flex flex-col min-w-[500px] max-w-4xl mx-auto my-6 bg-white rounded-3xl shadow-xl overflow-hidden ml-6 mb-6">
                    {/* Header Card */}
                    <div className="p-8 border-b-4 border-indigo-600">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                                        {selectedCustomer ? selectedCustomer.name : 'Walk-In Customer'}
                                    </h1>
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                                        <span>{selectedCustomer ? (selectedCustomer.phone || selectedCustomer.email) : 'General Sales'}</span>
                                        <span className="text-indigo-400">•</span>
                                        <span className="text-indigo-600 font-bold">In-Store</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded text-xs uppercase tracking-wider">
                                New Sale
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-xs font-bold text-gray-400 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2">
                                {/* PRINTER CONNECT BUTTON */}
                                <button
                                    onClick={async () => {
                                        if (printerConnected) return;
                                        try {
                                            await printerService.connect();
                                            setPrinterConnected(true);
                                            toast.success('Printer Connected! Silent printing enabled.');
                                        } catch (e: any) {
                                            toast.error('Connection failed: ' + e.message);
                                        }
                                    }}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${printerConnected
                                        ? 'bg-green-100 text-green-700 cursor-default'
                                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'
                                        }`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    {printerConnected ? 'Printer Ready' : 'Connect Printer'}
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                Cashier: {user?.name || 'Admin'}
                                {activeSession && (
                                    <button
                                        onClick={() => setCloseTillModalOpen(true)}
                                        className="ml-3 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] rounded hover:bg-red-100 transition-colors uppercase tracking-wider"
                                    >
                                        End Session
                                    </button>
                                )}
                                {selectedCustomer && (
                                    <span className="text-gray-300 ml-2">#{selectedCustomer.code}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cart Items Table */}
                    <div className="flex-1 overflow-auto bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-white sticky top-0 z-10">
                                <tr className="text-gray-400 text-[10px] font-bold uppercase tracking-widest border-b border-gray-100">
                                    <th className="py-4 pl-8 w-[40%]">Item Details</th>
                                    <th className="py-4 text-center w-[20%]">Qty</th>
                                    <th className="py-4 text-right w-[20%]">Price</th>
                                    <th className="py-4 text-right pr-8 w-[20%]">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {cart.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-32 text-gray-300">
                                            <div className="text-6xl mb-4 opacity-20">🧾</div>
                                            <p className="font-medium text-gray-400">Your cart is empty</p>
                                        </td>
                                    </tr>
                                ) : (
                                    cart.map(item => {
                                        const stock = item.inventory?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
                                        const isMaxed = item.cartQty >= stock;

                                        return (
                                            <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                                                <td className="py-6 pl-8">
                                                    <div className="font-bold text-gray-900 text-base">{item.name}</div>
                                                    <div className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">{item.sku}</div>
                                                </td>
                                                <td className="py-6 text-center">
                                                    <div className="inline-flex items-center border border-gray-200 rounded-lg p-1 bg-white shadow-sm">
                                                        <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded font-bold transition-colors">-</button>
                                                        <span className="w-8 text-center font-bold text-gray-900 text-sm">{item.cartQty}</span>
                                                        <button
                                                            onClick={() => updateQty(item.id, 1)}
                                                            disabled={isMaxed}
                                                            className={`w-7 h-7 flex items-center justify-center rounded font-bold transition-colors ${isMaxed ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    {isMaxed && <div className="text-[9px] text-red-500 font-bold mt-1 uppercase tracking-wide">Max Reached</div>}
                                                </td>
                                                <td className="py-6 text-right text-gray-500 font-medium">{formatCurrency(item.price, user?.currency, user?.locale)}</td>
                                                <td className="py-6 pr-8 text-right">
                                                    <div className="font-bold text-gray-900">{formatCurrency(Number(item.price) * item.cartQty, user?.currency, user?.locale)}</div>
                                                    <button onClick={() => removeFromCart(item.id)} className="text-[10px] font-bold text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1 uppercase tracking-wider">Remove</button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Payment */}
                    <div className="p-8 bg-gray-50 border-t-2 border-dashed border-gray-200">
                        <div className="space-y-3 mb-8">
                            <div className="flex justify-between text-sm font-medium text-gray-500">
                                <span>Subtotal</span>
                                <span className="text-gray-900 font-bold">{formatCurrency(subtotal, user?.currency, user?.locale)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-gray-500 items-center">
                                <div className="flex items-center gap-2">
                                    <span>Discount</span>
                                    {appliedDiscount && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase">{appliedDiscount.name}</span>}
                                    <button onClick={() => setDiscountModalOpen(true)} className="text-[10px] text-indigo-600 font-bold hover:underline uppercase tracking-wider">
                                        {appliedDiscount ? 'Edit' : 'Add'}
                                    </button>
                                </div>
                                <span className={discountAmount > 0 ? "text-green-600 font-bold" : "text-gray-900 font-bold"}>-{formatCurrency(discountAmount, user?.currency, user?.locale)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-gray-500">
                                <span>Tax ({(totalTaxRate * 100).toFixed(0)}%)</span>
                                <span className="text-gray-900 font-bold">{formatCurrency(taxAmount, user?.currency, user?.locale)}</span>
                            </div>
                            <div className="pt-4 mt-4 border-t border-gray-200">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Due</span>
                                        <div className="text-4xl font-black text-gray-900">{formatCurrency(cartTotal, user?.currency, user?.locale)}</div>
                                        <div className="text-xs text-gray-400 mt-1 font-medium">{cart.reduce((a, b) => a + b.cartQty, 0)} Items</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setCheckoutModalOpen(true);
                                setSelectedPaymentMethod('CASH');
                            }}
                            disabled={cart.length === 0}
                            className="group w-full bg-black hover:bg-gray-900 text-white py-5 rounded-xl font-bold text-lg shadow-xl shadow-gray-200 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-3"
                        >
                            <span>Proceed to Payment</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {!activeSession && (
                            <button onClick={() => setCloseTillModalOpen(true)} className="w-full mt-4 text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest">
                                Manager Options
                            </button>
                        )}
                    </div>
                </div>

                {/* RIGHT: RESOURCES */}
                <div className="w-[420px] bg-white border-l border-gray-100 flex flex-col z-10 m-6 rounded-3xl shadow-sm overflow-hidden">
                    {/* Tabs */}
                    <div className="flex p-4 gap-2 bg-white">
                        <button
                            onClick={() => setActiveTab('products')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'products' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            Products
                        </button>
                        <button
                            onClick={() => setActiveTab('customers')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'customers' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            Customers
                        </button>
                    </div>

                    {/* CONTENT AREA */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        {activeTab === 'products' ? (
                            <>
                                <div className="px-4 pb-4">
                                    <div className="relative group">
                                        <span className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </span>
                                        <input
                                            className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-100 rounded-xl py-3 pl-11 pr-4 text-gray-800 placeholder-gray-400 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                                            placeholder="Search by Name, SKU..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-2">
                                    {filteredProducts.map(product => {
                                        const stock = product.inventory?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
                                        const isLowStock = stock <= (product.minStockLevel || 0);
                                        const hasStock = stock > 0;
                                        return (
                                            <div
                                                key={product.id}
                                                onClick={() => addToCart(product)}
                                                className="bg-white border border-gray-100 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group relative overflow-hidden"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex-1">
                                                        <div className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors text-sm">{product.name}</div>
                                                        <div className="text-xs text-gray-500 font-medium mb-2">{product.sku}</div>
                                                        <div className="flex justify-between items-center">
                                                            <div className="text-lg font-black text-indigo-600">{formatCurrency(product.price, user?.currency, user?.locale)}</div>
                                                            {hasStock ? (
                                                                <div className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${stock < (product.minStockLevel || 5) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                                    }`}>
                                                                    {stock} In Stock
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] font-bold bg-gray-100 text-gray-400 px-2 py-1 rounded-full uppercase tracking-wide">
                                                                    Out of Stock
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {hasMoreProducts && (
                                        <div className="text-center pt-2 pb-4">
                                            <button
                                                onClick={() => loadProducts(false)}
                                                disabled={loadingMoreProducts}
                                                className="text-indigo-600 text-xs font-bold uppercase tracking-widest hover:underline disabled:opacity-50"
                                            >
                                                {loadingMoreProducts ? 'Loading...' : 'Load More'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="px-4 pb-4">
                                    <div className="relative group">
                                        <span className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </span>
                                        <input
                                            className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-100 rounded-xl py-3 pl-11 pr-4 text-gray-800 placeholder-gray-400 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                                            placeholder="Search customers..."
                                            value={customerSearch}
                                            onChange={e => setCustomerSearch(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        onClick={() => setSelectedCustomer(null)}
                                        className={`w-full py-3 mt-3 text-xs font-bold rounded-xl border border-dashed border-gray-300 hover:border-indigo-500 hover:text-indigo-600 transition uppercase tracking-wide ${!selectedCustomer ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'text-gray-400'}`}
                                    >
                                        Reset to Walk-In Default
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
                                    {filteredCustomers.map(customer => (
                                        <div
                                            key={customer.id}
                                            onClick={() => setSelectedCustomer(customer)}
                                            className={`p-4 rounded-2xl cursor-pointer transition border-2 ${selectedCustomer?.id === customer.id
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 transform scale-[1.02]'
                                                : 'bg-white border-transparent hover:border-gray-100 hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className={`font-bold ${selectedCustomer?.id === customer.id ? 'text-white' : 'text-gray-900'}`}>{customer.name}</div>
                                                    <div className={`text-xs font-medium mt-1 ${selectedCustomer?.id === customer.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                        {customer.code} • {customer.phone || 'No Phone'}
                                                    </div>
                                                </div>
                                                {selectedCustomer?.id === customer.id && (
                                                    <div className="bg-white text-indigo-600 p-1 rounded-full w-6 h-6 flex items-center justify-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {hasMoreCustomers && (
                                        <div className="text-center pt-2 pb-4">
                                            <button
                                                onClick={() => loadCustomers(false)}
                                                disabled={loadingMoreCustomers}
                                                className="text-indigo-600 text-xs font-bold uppercase tracking-widest hover:underline disabled:opacity-50"
                                            >
                                                {loadingMoreCustomers ? 'Loading...' : 'Load More'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* MODALS */}

                {/* Checkout Modal */}
                {checkoutModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-white p-8 rounded-2xl shadow-2xl w-96 transform transition-all scale-100">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold">Payment Method</h3>
                                <button onClick={() => setCheckoutModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 w-8 h-8 rounded-full">✕</button>
                            </div>

                            <div className="text-center mb-8">
                                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Total to Pay</p>
                                <div className="text-5xl font-bold text-gray-800">
                                    ${cartTotal.toFixed(2)}
                                </div>
                            </div>

                            {/* Payment Methods */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <button
                                    onClick={() => setSelectedPaymentMethod('CASH')}
                                    className={`p-4 border-2 rounded-2xl flex flex-col items-center relative transition-all ${selectedPaymentMethod === 'CASH' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'}`}>
                                    {selectedPaymentMethod === 'CASH' && <div className="absolute -top-3 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">SELECTED</div>}
                                    <div className="text-3xl mb-2">💵</div>
                                    <span className={`font-bold ${selectedPaymentMethod === 'CASH' ? 'text-indigo-800' : 'text-gray-600'}`}>Cash</span>
                                </button>
                                <button
                                    onClick={() => setSelectedPaymentMethod('CARD')}
                                    className={`p-4 border-2 rounded-2xl flex flex-col items-center relative transition-all ${selectedPaymentMethod === 'CARD' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'}`}>
                                    {selectedPaymentMethod === 'CARD' && <div className="absolute -top-3 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">SELECTED</div>}
                                    <div className="text-3xl mb-2">💳</div>
                                    <span className={`font-bold ${selectedPaymentMethod === 'CARD' ? 'text-indigo-800' : 'text-gray-600'}`}>Card</span>
                                </button>
                                <button
                                    onClick={() => setSelectedPaymentMethod('BANK_TRANSFER')}
                                    className={`p-4 border-2 rounded-2xl flex flex-col items-center relative transition-all ${selectedPaymentMethod === 'BANK_TRANSFER' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'}`}>
                                    {selectedPaymentMethod === 'BANK_TRANSFER' && <div className="absolute -top-3 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">SELECTED</div>}
                                    <div className="text-3xl mb-2">🏦</div>
                                    <span className={`font-bold ${selectedPaymentMethod === 'BANK_TRANSFER' ? 'text-indigo-800' : 'text-gray-600'}`}>Transfer</span>
                                </button>
                                <button
                                    onClick={() => setSplitModalOpen(true)}
                                    className={`p-4 border-2 rounded-2xl flex flex-col items-center relative transition-all border-dashed border-indigo-300 hover:bg-indigo-50`}>
                                    <div className="text-3xl mb-2">✂️</div>
                                    <span className="font-bold text-indigo-600">Split / Multi</span>
                                </button>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    {splitPayments.length > 0 ? 'Split Payment Configured' : (selectedPaymentMethod === 'CASH' ? 'Amount Tendered' : 'Transaction Amount')}
                                </label>
                                {splitPayments.length > 0 ? (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-green-100" onClick={() => setSplitModalOpen(true)}>
                                        <div className="font-bold text-green-800">
                                            {splitPayments.length} Payments Added
                                        </div>
                                        <div className="font-mono font-bold text-green-700">
                                            ${splitPayments.reduce((s, p) => s + p.amount, 0).toFixed(2)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <span className="absolute left-4 top-4 text-gray-400 text-lg">$</span>
                                        <input
                                            type="number"
                                            autoFocus
                                            className="w-full text-3xl py-3 pl-8 pr-4 border-2 border-gray-200 rounded-xl text-right font-bold focus:border-indigo-500 focus:outline-none text-gray-800"
                                            placeholder="0.00"
                                            value={tendered}
                                            onChange={e => setTendered(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Loyalty Redemption UI */}
                            {selectedCustomer && (selectedCustomer.loyaltyPoints > 0) && (
                                <div className="mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-indigo-900">Loyalty Points</span>
                                        <span className="text-xs font-medium text-indigo-600 px-2 py-0.5 bg-white rounded-full border border-indigo-200">
                                            Balance: {selectedCustomer.loyaltyPoints}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                            <input
                                                type="checkbox"
                                                name="toggle"
                                                id="loyalty-toggle"
                                                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 checked:right-0 checked:border-green-400 transition-all duration-300 ease-in-out"
                                                checked={usePoints}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setUsePoints(checked);
                                                    if (checked) {
                                                        // Max Redeem: Balance OR enough to cover subtotal??? 
                                                        // For now max is Balance.
                                                        // Wait, we need to know the max useful points (Subtotal / 0.10)
                                                        const maxUseful = Math.ceil(subtotal / 0.10);
                                                        setPointsToRedeem(Math.min(selectedCustomer.loyaltyPoints, maxUseful));
                                                    } else {
                                                        setPointsToRedeem(0);
                                                    }
                                                }}
                                                style={usePoints ? { right: 0, borderColor: '#68D391' } : { right: 'auto', left: 0 }}
                                            />
                                            <label
                                                htmlFor="loyalty-toggle"
                                                className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${usePoints ? 'bg-green-400' : 'bg-gray-300'}`}
                                            ></label>
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">Redeem Points</span>
                                    </div>

                                    {usePoints && (
                                        <div className="mt-3">
                                            <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                                                <span>Points to Redeem</span>
                                                <span className="font-bold text-green-600">-${(pointsToRedeem * 0.10).toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max={Math.min(selectedCustomer.loyaltyPoints, Math.ceil(subtotal / 0.10))}
                                                value={pointsToRedeem}
                                                onChange={(e) => setPointsToRedeem(parseInt(e.target.value))}
                                                className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                            <div className="text-right text-xs font-bold text-indigo-700 mt-1">{pointsToRedeem} Points</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(() => {
                                const tendVal = parseFloat(tendered) || 0;
                                const change = tendVal - cartTotal;
                                const remaining = cartTotal - tendVal;

                                return (
                                    <div className="space-y-4">
                                        {tendVal > 0 && (
                                            <div className={`p-4 rounded-xl flex justify-between items-center ${change >= 0 ? 'bg-green-100 text-green-900' : 'bg-red-50 text-red-900'
                                                }`}>
                                                <span className="font-bold text-sm uppercase">{change >= 0 ? 'Change Due' : 'Remaining'}</span>
                                                <span className="text-2xl font-bold font-mono">
                                                    {formatCurrency(Math.abs(change >= 0 ? change : remaining), user?.currency, user?.locale)}
                                                </span>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => handleCheckout()}
                                            disabled={change < 0 && tendVal > 0}
                                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98] ${change < 0 && tendVal > 0 ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-green-600 hover:bg-green-500 shadow-green-600/30'
                                                }`}
                                        >
                                            Verify Cash Payment
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}




                {/* Split Payment Modal */}
                {splitModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl w-[450px]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold">Split Payment</h3>
                                <button onClick={() => { setSplitPayments([]); setSplitModalOpen(false); }} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl mb-6 flex justify-between items-center">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase font-bold">Total Due</div>
                                    <div className="text-2xl font-bold text-gray-900">${cartTotal.toFixed(2)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Remaining</div>
                                    <div className={`text-2xl font-bold ${cartTotal - splitPayments.reduce((s, p) => s + p.amount, 0) <= 0.01 ? 'text-green-600' : 'text-orange-600'}`}>
                                        ${Math.max(0, cartTotal - splitPayments.reduce((s, p) => s + p.amount, 0)).toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6 max-h-[200px] overflow-y-auto">
                                {splitPayments.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white border p-3 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{p.method === 'CASH' ? '💵' : p.method === 'CARD' ? '💳' : '🏦'}</span>
                                            <span className="font-bold text-gray-700">{p.method}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold">${p.amount.toFixed(2)}</span>
                                            <button onClick={() => setSplitPayments(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">✕</button>
                                        </div>
                                    </div>
                                ))}
                                {splitPayments.length === 0 && <div className="text-center text-gray-400 py-4 italic">No payments added yet</div>}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                {(['CASH', 'CARD', 'BANK_TRANSFER'] as const).map(method => (
                                    <button
                                        key={method}
                                        onClick={() => {
                                            const remaining = cartTotal - splitPayments.reduce((s, p) => s + p.amount, 0);
                                            if (remaining <= 0) return toast.error('Total already covered');
                                            setSplitPayments([...splitPayments, { method, amount: parseFloat(remaining.toFixed(2)) }]); // Default to remaining
                                        }}
                                        className="p-3 border rounded-xl hover:bg-indigo-50 hover:border-indigo-500 text-sm font-bold text-gray-600 transition-colors"
                                    >
                                        Add {method}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => handleCheckout()}
                                disabled={cartTotal - splitPayments.reduce((s, p) => s + p.amount, 0) > 0.01}
                                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${cartTotal - splitPayments.reduce((s, p) => s + p.amount, 0) > 0.01
                                    ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                    : 'bg-green-600 hover:bg-green-500 shadow-green-600/30'}`}
                            >
                                Complete Sale
                            </button>
                        </div>
                    </div>
                )}

                {/* Discount Modal */}
                {discountModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl w-96">
                            <h3 className="text-xl font-bold mb-4">Apply Discount</h3>

                            <div className="space-y-3 mb-6">
                                <h4 className="text-sm font-bold text-gray-500 uppercase">System Discounts</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {discounts.map(d => (
                                        <button
                                            key={d.id}
                                            onClick={() => {
                                                setAppliedDiscount({
                                                    id: d.id,
                                                    name: d.name,
                                                    type: d.type as any,
                                                    value: Number(d.value),
                                                    targetType: d.targetType,
                                                    targetValues: d.targetValues
                                                });
                                                setDiscountModalOpen(false);
                                            }}
                                            className="p-3 border rounded-lg text-sm hover:bg-indigo-50 hover:border-indigo-500 text-left"
                                        >
                                            <div className="font-bold text-indigo-700">{d.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {d.type === 'PERCENTAGE' ? `${d.value}% Off` : `-$${d.value}`}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="relative flex py-2 items-center my-4">
                                    <div className="flex-grow border-t border-gray-300"></div>
                                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Or Manual</span>
                                    <div className="flex-grow border-t border-gray-300"></div>
                                </div>

                                <button onClick={() => {
                                    setAppliedDiscount({ name: 'Manual Discount', type: 'MANUAL', value: 0 }); // Todo: Add manual input logic
                                    setDiscountModalOpen(false);
                                }} className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                                    Enter Manual Amount
                                </button>
                            </div>
                            <button onClick={() => setDiscountModalOpen(false)} className="w-full py-3 bg-gray-100 rounded-xl font-bold text-gray-600">Cancel</button>
                        </div>
                    </div>
                )}

                {/* Receipt Modal (Success) */}
                {receiptModalOpen && lastSale && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-2xl w-[400px] overflow-hidden">
                            <div className="bg-green-500 p-6 text-center text-white">
                                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h2 className="text-2xl font-black uppercase tracking-wide">Sale Complete!</h2>
                                <p className="opacity-90 font-medium">Receipt #{lastSale.id?.slice(-6).toUpperCase()}</p>
                            </div>
                            <div className="p-8">
                                <div className="space-y-4 mb-8">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-bold uppercase tracking-wider">Total</span>
                                        <span className="text-xl font-black text-gray-900">{formatCurrency(lastSale.total, user?.currency, user?.locale)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-bold uppercase tracking-wider">Change</span>
                                        <span className="text-xl font-bold text-green-600">{formatCurrency(lastSale.change, user?.currency, user?.locale)}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 grid grid-cols-2 gap-2">
                                        <button onClick={() => {
                                            toast.promise(handlePrint(), {
                                                loading: 'Sending to printer...',
                                                success: 'Sent!',
                                                error: 'Print failed'
                                            });
                                        }} className="py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            <span>USB Print</span>
                                        </button>
                                        <button onClick={() => window.print()} className="py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            <span>Browser Print</span>
                                        </button>
                                    </div>
                                    <button onClick={() => setReceiptModalOpen(false)} className="py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors">
                                        New Sale
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <OpenTillModal
                    isOpen={isTillModalOpen && !activeSession && !checkingSession}
                    onClose={() => setIsTillModalOpen(false)}
                    onSuccess={(session) => {
                        setActiveSession(session);
                        setIsTillModalOpen(false);
                    }}
                />
                <CloseTillModal
                    isOpen={closeTillModalOpen}
                    sessionId={activeSession?.id}
                    onClose={() => setCloseTillModalOpen(false)}
                    onSuccess={() => {
                        setCloseTillModalOpen(false);
                        setActiveSession(null);
                        setIsTillModalOpen(true);
                    }}
                />
            </div>

            <ReceiptTemplate sale={lastSale} user={user} store={activeStore} />
        </div>
    );
}
