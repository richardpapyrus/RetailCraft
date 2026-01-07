
"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function TaxesDiscountsSettings() {
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
    const [targetValues, setTargetValues] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [allProducts, setAllProducts] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            const [t, d, p] = await Promise.all([
                api.taxes.list(),
                api.discounts.list(),
                api.products.list(0, 1000).then(res => res.data) // Fetch all products for dropdown
            ]);
            setTaxes(t || []);
            setDiscounts(d || []);
            setAllProducts(p || []);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
        if (!discName || !discValue) return;
        try {
            await api.discounts.create({
                name: discName,
                type: discType,
                value: parseFloat(discValue),
                targetType,
                targetValues,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });
            setDiscName('');
            setDiscValue('');
            setTargetType('ALL');
            setTargetValues([]);
            setStartDate('');
            setEndDate('');
            fetchData();
        } catch (e) { toast.error('Error creating discount'); }
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
                    className={`pb-2 px-1 font-medium ${activeSection === 'taxes' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}
                >
                    Taxes
                </button>
                <button
                    onClick={() => setActiveSection('discounts')}
                    className={`pb-2 px-1 font-medium ${activeSection === 'discounts' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}
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
                                <select className="w-full p-2 border rounded-lg" value={targetType} onChange={e => { setTargetType(e.target.value); setTargetValues([]); }}>
                                    <option value="ALL">Entire Order</option>
                                    <option value="PRODUCT">Specific Products</option>
                                    <option value="CATEGORY">Specific Categories</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <button onClick={handleCreateDiscount} className="w-full bg-green-600 text-white py-2 rounded-lg font-bold">Add</button>
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
                            <div className="mb-4 p-3 bg-white border rounded">
                                <label className="text-xs font-bold text-gray-500 block mb-2">Select Products:</label>
                                <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-2">
                                    {allProducts.map(p => (
                                        <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={targetValues.includes(p.id)}
                                                onChange={e => {
                                                    if (e.target.checked) setTargetValues([...targetValues, p.id]);
                                                    else setTargetValues(targetValues.filter(id => id !== p.id));
                                                }}
                                            />
                                            <span className="truncate">{p.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {targetType === 'CATEGORY' && (
                            <div className="mb-4">
                                <label className="text-xs font-bold text-gray-500 block mb-2">Enter Categories (comma separated):</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded"
                                    placeholder="e.g. Drinks, Snacks"
                                    value={targetValues.join(', ')}
                                    onChange={e => setTargetValues(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                />
                                <p className="text-xs text-gray-400 mt-1">Found categories: {[...new Set(allProducts.map(p => p.category).filter(Boolean))].join(', ')}</p>
                            </div>
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
                                            <div className="text-xs text-gray-400">
                                                Restricted to {d.targetType}: {d.targetValues?.join(', ')}
                                            </div>
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
