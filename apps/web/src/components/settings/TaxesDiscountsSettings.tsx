
"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

import { useAuth } from '@/lib/useAuth';

export default function TaxesDiscountsSettings() {
    const { selectedStoreId } = useAuth();
    const [taxes, setTaxes] = useState<any[]>([]);
    const [discounts, setDiscounts] = useState<any[]>([]);
    const [activeSection, setActiveSection] = useState<'taxes' | 'discounts'>('taxes');

    // Tax Form
    const [taxName, setTaxName] = useState('');
    const [taxRate, setTaxRate] = useState(''); // e.g. 0.05

    // Discount Form
    const [discName, setDiscName] = useState('');
    const [discType, setDiscType] = useState('PERCENTAGE');
    const [discValue, setDiscValue] = useState('');
    const [targetType, setTargetType] = useState('ALL'); // ALL, PRODUCT, CATEGORY
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Selected targets are held separately per mode so switching back and forth
    // doesn't silently carry product ids into a category discount.
    // Products are stored by id and categories by NAME — that is what
    // sales.service.ts matches on when it prices the actual sale, so changing
    // either would make the POS and the server disagree on the total.
    const [productTargets, setProductTargets] = useState<{ id: string; name: string }[]>([]);
    const [categoryTargets, setCategoryTargets] = useState<string[]>([]);

    const [allCategories, setAllCategories] = useState<any[]>([]);
    const [categoriesError, setCategoriesError] = useState('');

    const fetchData = async () => {
        // Each lookup is settled independently: previously a single failing
        // request rejected the whole Promise.all, which left every list on this
        // page empty with nothing but a console error — the reason the discount
        // target selector appeared to have no options at all.
        const [t, d, c] = await Promise.allSettled([
            api.taxes.list(),
            api.discounts.list(selectedStoreId || undefined), // Pass storeId
            api.categories.list()
        ]);

        if (t.status === 'fulfilled') setTaxes(t.value || []);
        else console.error('Failed to load taxes', t.reason);

        if (d.status === 'fulfilled') setDiscounts(d.value || []);
        else console.error('Failed to load discounts', d.reason);

        if (c.status === 'fulfilled') {
            setAllCategories(c.value || []);
            setCategoriesError('');
        } else {
            console.error('Failed to load categories', c.reason);
            setCategoriesError((c.reason as any)?.message || 'Could not load categories.');
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedStoreId]); // Refetch when store changes

    const handleCreateTax = async () => {
        if (!taxName || !taxRate) return;
        try {
            await api.taxes.create({ name: taxName, rate: parseFloat(taxRate) });
            setTaxName('');
            setTaxRate('');
            fetchData();
        } catch (e) { toast.error('Error creating tax'); }
    };

    const handleCreateDiscount = async () => {
        if (!discName || !discValue) {
            toast.error('Enter a name and a value for the discount.');
            return;
        }

        const targetValues =
            targetType === 'PRODUCT' ? productTargets.map(p => p.id)
                : targetType === 'CATEGORY' ? categoryTargets
                    : [];

        // A targeted discount with nothing selected would save happily and then
        // apply to nothing at the till, which looks like a broken discount.
        if (targetType !== 'ALL' && targetValues.length === 0) {
            toast.error(
                targetType === 'PRODUCT'
                    ? 'Choose at least one product for this discount.'
                    : 'Choose at least one category for this discount.'
            );
            return;
        }

        try {
            await api.discounts.create({
                name: discName,
                type: discType,
                value: parseFloat(discValue),
                targetType,
                targetValues,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                storeId: selectedStoreId || undefined
            });
            setDiscName('');
            setDiscValue('');
            setTargetType('ALL');
            setProductTargets([]);
            setCategoryTargets([]);
            setStartDate('');
            setEndDate('');
            toast.success('Discount created');
            fetchData();
        } catch (e: any) { toast.error(e?.message || 'Error creating discount'); }
    };

    const handleDelete = async (type: 'taxes' | 'discounts', id: string) => {
        try {
            if (type === 'taxes') await api.taxes.delete(id);
            else await api.discounts.delete(id);
            fetchData();
        } catch (e) { toast.error('Error deleting item'); }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex gap-4 mb-6 border-b border-gray-200 pb-2">
                <button
                    onClick={() => setActiveSection('taxes')}
                    className={`pb-2 px-1 font-medium ${activeSection === 'taxes' ? 'border-b-2 border-brand-500 text-brand-600' : 'text-gray-500'}`}
                >
                    Taxes
                </button>
                <button
                    onClick={() => setActiveSection('discounts')}
                    className={`pb-2 px-1 font-medium ${activeSection === 'discounts' ? 'border-b-2 border-brand-500 text-brand-600' : 'text-gray-500'}`}
                >
                    Discounts
                </button>
            </div>

            {activeSection === 'taxes' && (
                <div className="space-y-6">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="font-medium mb-2">Add New Tax</h3>
                        <div className="flex gap-2 items-end">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Name</label>
                                <input
                                    type="text"
                                    className="p-2 border rounded-lg"
                                    placeholder="e.g. VAT"
                                    value={taxName}
                                    onChange={e => setTaxName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Rate (0.10 = 10%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="p-2 border rounded-lg w-32"
                                    placeholder="0.00"
                                    value={taxRate}
                                    onChange={e => setTaxRate(e.target.value)}
                                />
                            </div>
                            <button onClick={handleCreateTax} className="bg-green-600 text-white px-4 py-2 rounded-lg">Add</button>
                        </div>
                    </div>

                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-200 text-gray-500 text-sm"><th className="pb-2">Name</th><th className="pb-2">Rate</th><th className="pb-2 text-right">Actions</th></tr>
                        </thead>
                        <tbody>
                            {taxes.map(t => (
                                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                    <td className="py-3">{t.name}</td>
                                    <td className="py-3">{(Number(t.rate) * 100).toFixed(1)}%</td>
                                    <td className="py-3 text-right"><button onClick={() => handleDelete('taxes', t.id)} className="text-red-500 hover:text-red-700 text-sm">Remove</button></td>
                                </tr>
                            ))}
                            {taxes.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-gray-400">No taxes defined</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {activeSection === 'discounts' && (
                <div className="space-y-6">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="font-medium mb-4">Add New Discount</h3>
                        <div className="grid grid-cols-12 gap-4 items-end mb-4">
                            <div className="col-span-3">
                                <label className="text-xs text-gray-500 block mb-1">Name</label>
                                <input type="text" className="w-full p-2 border rounded-lg" placeholder="e.g. Summer Sale" value={discName} onChange={e => setDiscName(e.target.value)} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-gray-500 block mb-1">Type</label>
                                <select className="w-full p-2 border rounded-lg" value={discType} onChange={e => setDiscType(e.target.value)}>
                                    <option value="PERCENTAGE">Percentage (%)</option>
                                    <option value="FIXED">Fixed Amount ($)</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-gray-500 block mb-1">Value</label>
                                <input type="number" step="0.01" className="w-full p-2 border rounded-lg" placeholder="0.00" value={discValue} onChange={e => setDiscValue(e.target.value)} />
                            </div>
                            <div className="col-span-3">
                                <label className="text-xs text-gray-500 block mb-1">Applies To</label>
                                <select className="w-full p-2 border rounded-lg" value={targetType} onChange={e => setTargetType(e.target.value)}>
                                    <option value="ALL">Entire Order</option>
                                    <option value="PRODUCT">Specific Products</option>
                                    <option value="CATEGORY">Specific Categories</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <button onClick={handleCreateDiscount} className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold">Add</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Start Date (Optional)</label>
                                <input type="date" className="w-full p-2 border rounded-lg" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">End Date (Optional)</label>
                                <input type="date" className="w-full p-2 border rounded-lg" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        {/* Target Selection UI */}
                        {targetType === 'PRODUCT' && (
                            <ProductTargetPicker
                                selected={productTargets}
                                onChange={setProductTargets}
                                storeId={selectedStoreId || undefined}
                            />
                        )}

                        {targetType === 'CATEGORY' && (
                            <CategoryTargetPicker
                                categories={allCategories}
                                selected={categoryTargets}
                                onChange={setCategoryTargets}
                                error={categoriesError}
                                onRetry={fetchData}
                            />
                        )}
                    </div>
                    {/* ... Table ... */}

                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-200 text-gray-500 text-sm"><th className="pb-2">Name</th><th className="pb-2">Value</th><th className="pb-2">Validity</th><th className="pb-2 text-right">Actions</th></tr>
                        </thead>
                        <tbody>
                            {discounts.map(d => (
                                <tr key={d.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                    <td className="py-3">{d.name}</td>
                                    <td className="py-3">
                                        {d.type === 'PERCENTAGE' ? `${d.value}%` : `$${Number(d.value).toFixed(2)}`}
                                        {d.targetType !== 'ALL' && (
                                            // A targeted discount with nothing selected can never apply at
                                            // the till. Saving one used to be possible, so flag any that
                                            // already exist instead of leaving them looking healthy.
                                            (d.targetValues?.length ?? 0) === 0 ? (
                                                <div className="text-xs text-red-600 mt-0.5">
                                                    No {d.targetType === 'CATEGORY' ? 'categories' : 'products'} selected —
                                                    this discount will never apply. Remove it and add it again.
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-400">
                                                    Restricted to {d.targetType}: {d.targetValues.join(', ')}
                                                </div>
                                            )
                                        )}
                                    </td>
                                    <td className="py-3 text-sm text-gray-600">
                                        {d.startDate ? new Date(d.startDate).toLocaleDateString() : 'Now'} - {d.endDate ? new Date(d.endDate).toLocaleDateString() : 'Forever'}
                                    </td>
                                    <td className="py-3 text-right"><button onClick={() => handleDelete('discounts', d.id)} className="text-red-500 hover:text-red-700 text-sm">Remove</button></td>
                                </tr>
                            ))}
                            {discounts.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-gray-400">No discounts defined</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/** Chip shown for each chosen target, with a remove button. */
function TargetChip({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-brand-50 text-brand-800 text-xs font-medium">
            <span className="truncate max-w-[14rem]">{label}</span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${label}`}
                className="w-4 h-4 flex items-center justify-center rounded-full text-brand-600 hover:bg-brand-100"
            >
                ×
            </button>
        </span>
    );
}

/**
 * Product picker for targeted discounts.
 *
 * Searches server-side and loads a page at a time. The previous version bulk
 * fetched 1,000 products (each with inventory, supplier and category joined)
 * just to render checkboxes; on a real catalogue that request could exceed
 * fetchClient's 20s abort, which took the whole settings page's data down with
 * it and left this selector with nothing to choose from.
 *
 * Emits product IDs, which is what sales.service.ts matches against.
 */
function ProductTargetPicker({
    selected,
    onChange,
    storeId,
}: {
    selected: { id: string; name: string }[];
    onChange: (next: { id: string; name: string }[]) => void;
    storeId?: string;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Bumped by "Try again" — re-running the search needs a dependency that
    // actually changes, which re-setting the same query string would not.
    const [retryNonce, setRetryNonce] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const timer = setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const res = await api.products.list(
                    0,
                    20,
                    { search: query.trim() || undefined },
                    storeId
                );
                if (!cancelled) setResults(res.data || []);
            } catch (e: any) {
                if (!cancelled) setError(e?.message || 'Could not load products.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 300);

        return () => { cancelled = true; clearTimeout(timer); };
    }, [query, storeId, retryNonce]);

    const toggle = (product: { id: string; name: string }) => {
        const exists = selected.some(p => p.id === product.id);
        onChange(
            exists
                ? selected.filter(p => p.id !== product.id)
                : [...selected, { id: product.id, name: product.name }]
        );
    };

    return (
        <div className="mb-4 p-3 bg-white border rounded-lg">
            <label htmlFor="discount-product-search" className="text-xs font-semibold text-gray-500 block mb-2">
                Select Products
            </label>

            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {selected.map(p => (
                        <TargetChip
                            key={p.id}
                            label={p.name}
                            onRemove={() => onChange(selected.filter(x => x.id !== p.id))}
                        />
                    ))}
                </div>
            )}

            <input
                id="discount-product-search"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search products by name, SKU or barcode"
                className="w-full p-2 border rounded-lg mb-2"
                autoComplete="off"
            />

            <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                {loading && (
                    <p className="text-sm text-gray-400 p-3">Searching…</p>
                )}

                {!loading && error && (
                    <div className="p-3">
                        <p className="text-sm text-red-600 mb-1">{error}</p>
                        <button
                            type="button"
                            onClick={() => setRetryNonce(n => n + 1)}
                            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {!loading && !error && results.length === 0 && (
                    <p className="text-sm text-gray-400 p-3">
                        {query.trim() ? `No products match “${query.trim()}”.` : 'No products found.'}
                    </p>
                )}

                {!loading && !error && results.map(p => {
                    const isSelected = selected.some(s => s.id === p.id);
                    return (
                        <label
                            key={p.id}
                            className="flex items-center gap-2.5 text-sm cursor-pointer hover:bg-gray-50 px-3 py-2"
                        >
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggle(p)}
                            />
                            <span className="truncate flex-1">{p.name}</span>
                            {p.sku && <span className="text-xs text-gray-400 shrink-0">{p.sku}</span>}
                        </label>
                    );
                })}
            </div>

            <p className="text-[11px] text-gray-400 mt-2">
                {selected.length} product{selected.length === 1 ? '' : 's'} selected.
                Search to find more — selections are kept.
            </p>
        </div>
    );
}

/**
 * Category picker for targeted discounts.
 *
 * Emits category NAMES, not ids: sales.service.ts compares against
 * product.category.name when pricing a sale, so storing ids here would make the
 * till quietly ignore the discount.
 */
function CategoryTargetPicker({
    categories,
    selected,
    onChange,
    error,
    onRetry,
}: {
    categories: any[];
    selected: string[];
    onChange: (next: string[]) => void;
    error?: string;
    onRetry?: () => void;
}) {
    const [query, setQuery] = useState('');

    const matches = categories.filter(c =>
        c.name?.toLowerCase().includes(query.trim().toLowerCase())
    );

    const toggle = (name: string) =>
        onChange(
            selected.includes(name)
                ? selected.filter(v => v !== name)
                : [...selected, name]
        );

    return (
        <div className="mb-4 p-3 bg-white border rounded-lg">
            <label htmlFor="discount-category-search" className="text-xs font-semibold text-gray-500 block mb-2">
                Select Categories
            </label>

            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {selected.map(name => (
                        <TargetChip
                            key={name}
                            label={name}
                            onRemove={() => onChange(selected.filter(v => v !== name))}
                        />
                    ))}
                </div>
            )}

            {error ? (
                <div className="py-2">
                    <p className="text-sm text-red-600 mb-1">{error}</p>
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                        >
                            Try again
                        </button>
                    )}
                </div>
            ) : categories.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">
                    No product categories exist yet. Add one on the Products page first.
                </p>
            ) : (
                <>
                    {categories.length > 8 && (
                        <input
                            id="discount-category-search"
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search categories"
                            className="w-full p-2 border rounded-lg mb-2"
                            autoComplete="off"
                        />
                    )}

                    <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                        {matches.length === 0 ? (
                            <p className="text-sm text-gray-400 p-3">
                                No categories match “{query.trim()}”.
                            </p>
                        ) : matches.map(c => (
                            <label
                                key={c.id}
                                className="flex items-center gap-2.5 text-sm cursor-pointer hover:bg-gray-50 px-3 py-2"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.includes(c.name)}
                                    onChange={() => toggle(c.name)}
                                />
                                <span className="truncate">{c.name}</span>
                            </label>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
