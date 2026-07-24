"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, Expense, ExpenseCategory } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { toast } from 'react-hot-toast';
import { X, Paperclip, Loader2, FileText, Trash2 } from 'lucide-react';
import { CategorySelect } from './CategorySelect';

interface ExpenseFormModalProps {
    /** Null for a new expense, otherwise the expense being edited. */
    expense: Expense | null;
    categories: ExpenseCategory[];
    stores: { id: string; name: string }[];
    /** Store pre-selected from the sidebar; null means "Headquarters" view. */
    activeStoreId: string | null;
    onClose: () => void;
    onSaved: () => void;
    onCategoryCreated?: (category: ExpenseCategory) => void;
}

const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Cheque', 'Direct Debit', 'Other'];

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_RECEIPTS = ['application/pdf', 'image/jpeg', 'image/png'];

export function ExpenseFormModal({
    expense,
    categories,
    stores,
    activeStoreId,
    onClose,
    onSaved,
    onCategoryCreated,
}: ExpenseFormModalProps) {
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isEdit = Boolean(expense);

    const today = new Date().toISOString().split('T')[0];

    const [form, setForm] = useState({
        expenseDate: expense?.expenseDate ? expense.expenseDate.split('T')[0] : today,
        amount: expense ? String(expense.amount) : '',
        categoryId: expense?.categoryId || '',
        description: expense?.description || '',
        notes: expense?.notes || '',
        vendor: expense?.vendor || '',
        reference: expense?.reference || '',
        paymentMethod: expense?.paymentMethod || '',
        storeId: expense?.storeId || activeStoreId || '',
    });

    // Receipt chosen before the expense exists is uploaded straight after creation.
    const [pendingReceipt, setPendingReceipt] = useState<File | null>(null);
    const [existingAttachment, setExistingAttachment] = useState({
        url: expense?.attachmentUrl || null,
        name: expense?.attachmentName || null,
    });

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const setField = (field: keyof typeof form, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const handleFilePick = (file: File | null) => {
        if (!file) return;
        if (!ACCEPTED_RECEIPTS.includes(file.type)) {
            toast.error('Receipts must be a PDF, JPG or PNG file.');
            return;
        }
        if (file.size > MAX_RECEIPT_BYTES) {
            toast.error('Receipts must be smaller than 10 MB.');
            return;
        }
        setPendingReceipt(file);
    };

    const handleRemoveExisting = async () => {
        if (!expense) return;
        try {
            await api.expenses.removeReceipt(expense.id);
            setExistingAttachment({ url: null, name: null });
            toast.success('Receipt removed');
        } catch (e: any) {
            toast.error(e?.message || 'Could not remove the receipt');
        }
    };

    const validate = () => {
        if (!form.expenseDate) return 'Pick a date for this expense.';
        const amount = Number(form.amount);
        if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount greater than zero.';
        if (!form.categoryId) return 'Choose a category.';
        if (!form.description.trim()) return 'Add a short description.';
        if (!form.storeId) return 'Choose the store this expense belongs to.';
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const error = validate();
        if (error) {
            toast.error(error);
            return;
        }

        setSaving(true);
        try {
            const payload = {
                expenseDate: form.expenseDate,
                amount: Number(form.amount),
                categoryId: form.categoryId,
                description: form.description.trim(),
                notes: form.notes.trim() || undefined,
                vendor: form.vendor.trim() || undefined,
                reference: form.reference.trim() || undefined,
                paymentMethod: form.paymentMethod || undefined,
                storeId: form.storeId,
            };

            const saved = isEdit
                ? await api.expenses.update(expense!.id, payload)
                : await api.expenses.create(payload);

            if (pendingReceipt) {
                try {
                    await api.expenses.uploadReceipt(saved.id, pendingReceipt);
                } catch (uploadError: any) {
                    // The expense itself saved — say so rather than implying it failed.
                    toast.error(
                        `Expense saved, but the receipt did not upload: ${uploadError?.message || 'unknown error'}`
                    );
                    onSaved();
                    onClose();
                    return;
                }
            }

            toast.success(isEdit ? 'Expense updated' : 'Expense recorded');
            onSaved();
            onClose();
        } catch (e: any) {
            toast.error(e?.message || 'Could not save the expense');
        } finally {
            setSaving(false);
        }
    };

    const currencySymbol = (() => {
        try {
            return (0)
                .toLocaleString(user?.locale || 'en-US', {
                    style: 'currency',
                    currency: user?.currency || 'USD',
                    currencyDisplay: 'narrowSymbol',
                })
                .replace(/[\d.,\s]/g, '');
        } catch {
            return '';
        }
    })();

    const panel = (
        <div className="fixed inset-0 z-[60]">
            <div
                className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-label={isEdit ? 'Edit expense' : 'Record expense'}
                className="absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-lifted flex flex-col animate-slide-in-right"
            >
                <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
                            {isEdit ? 'Edit expense' : 'Record an expense'}
                        </h2>
                        <p className="text-sm text-mid-grey font-medium mt-1">
                            {isEdit
                                ? 'Changes are recorded in this expense’s history.'
                                : 'Operating costs only — stock purchases stay in Inventory.'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 -mt-1 rounded-lg text-gray-400 hover:bg-surface-muted hover:text-charcoal transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="expense-date" className="block text-xs font-semibold text-charcoal mb-2">
                                Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="expense-date"
                                type="date"
                                value={form.expenseDate}
                                onChange={e => setField('expenseDate', e.target.value)}
                                className="input-field w-full"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="expense-amount" className="block text-xs font-semibold text-charcoal mb-2">
                                Amount <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                {currencySymbol && (
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-mid-grey font-medium pointer-events-none">
                                        {currencySymbol}
                                    </span>
                                )}
                                <input
                                    id="expense-amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    inputMode="decimal"
                                    value={form.amount}
                                    onChange={e => setField('amount', e.target.value)}
                                    placeholder="0.00"
                                    className={`input-field w-full ${currencySymbol ? 'pl-9' : ''}`}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-charcoal mb-2">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <CategorySelect
                            categories={categories}
                            value={form.categoryId}
                            onChange={id => setField('categoryId', id)}
                            onCategoryCreated={onCategoryCreated}
                        />
                    </div>

                    <div>
                        <label htmlFor="expense-description" className="block text-xs font-semibold text-charcoal mb-2">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="expense-description"
                            type="text"
                            value={form.description}
                            onChange={e => setField('description', e.target.value)}
                            placeholder="e.g. October shop rent"
                            className="input-field w-full"
                            required
                        />
                    </div>

                    {/* Store is fixed for store-level users; only shown when there is a choice. */}
                    {stores.length > 1 && (
                        <div>
                            <label htmlFor="expense-store" className="block text-xs font-semibold text-charcoal mb-2">
                                Store <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="expense-store"
                                value={form.storeId}
                                onChange={e => setField('storeId', e.target.value)}
                                className="input-field w-full"
                                required
                            >
                                <option value="">Select a store…</option>
                                {stores.map(store => (
                                    <option key={store.id} value={store.id}>{store.name}</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-mid-grey mt-1.5">
                                Every expense belongs to exactly one location.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="expense-vendor" className="block text-xs font-semibold text-charcoal mb-2">
                                Paid to <span className="text-mid-grey font-normal">(optional)</span>
                            </label>
                            <input
                                id="expense-vendor"
                                type="text"
                                value={form.vendor}
                                onChange={e => setField('vendor', e.target.value)}
                                placeholder="Supplier or landlord"
                                className="input-field w-full"
                            />
                        </div>
                        <div>
                            <label htmlFor="expense-payment" className="block text-xs font-semibold text-charcoal mb-2">
                                Paid by <span className="text-mid-grey font-normal">(optional)</span>
                            </label>
                            <select
                                id="expense-payment"
                                value={form.paymentMethod}
                                onChange={e => setField('paymentMethod', e.target.value)}
                                className="input-field w-full"
                            >
                                <option value="">Not specified</option>
                                {PAYMENT_METHODS.map(method => (
                                    <option key={method} value={method}>{method}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="expense-reference" className="block text-xs font-semibold text-charcoal mb-2">
                            Reference <span className="text-mid-grey font-normal">(optional)</span>
                        </label>
                        <input
                            id="expense-reference"
                            type="text"
                            value={form.reference}
                            onChange={e => setField('reference', e.target.value)}
                            placeholder="Invoice or receipt number"
                            className="input-field w-full"
                        />
                    </div>

                    <div>
                        <label htmlFor="expense-notes" className="block text-xs font-semibold text-charcoal mb-2">
                            Notes <span className="text-mid-grey font-normal">(optional)</span>
                        </label>
                        <textarea
                            id="expense-notes"
                            value={form.notes}
                            onChange={e => setField('notes', e.target.value)}
                            rows={3}
                            placeholder="Anything worth remembering about this cost"
                            className="input-field w-full resize-none"
                        />
                    </div>

                    {/* Receipt */}
                    <div>
                        <label className="block text-xs font-semibold text-charcoal mb-2">
                            Receipt <span className="text-mid-grey font-normal">(PDF, JPG or PNG)</span>
                        </label>

                        {existingAttachment.url && !pendingReceipt ? (
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-surface-muted/50">
                                <FileText size={18} className="text-brand-600 shrink-0" />
                                <span className="text-sm text-charcoal truncate flex-1">
                                    {existingAttachment.name || 'Attached receipt'}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleRemoveExisting}
                                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                    aria-label="Remove receipt"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ) : pendingReceipt ? (
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-brand-200 bg-brand-50/50">
                                <Paperclip size={18} className="text-brand-600 shrink-0" />
                                <span className="text-sm text-charcoal truncate flex-1">{pendingReceipt.name}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPendingReceipt(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                    aria-label="Remove selected file"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-300 text-mid-grey hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/40 transition-colors"
                            >
                                <Paperclip size={16} />
                                <span className="text-sm font-medium">Attach a receipt</span>
                            </button>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            className="hidden"
                            onChange={e => handleFilePick(e.target.files?.[0] || null)}
                        />
                    </div>
                </form>

                <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-secondary">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="btn-primary min-w-[9rem] flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {saving && <Loader2 size={16} className="animate-spin" />}
                        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Record expense'}
                    </button>
                </div>
            </div>
        </div>
    );

    if (!mounted) return null;
    return createPortal(panel, document.body);
}
