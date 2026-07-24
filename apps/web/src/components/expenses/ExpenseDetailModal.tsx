"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, API_URL, Expense, ExpenseAuditEntry } from '@/lib/api';
import { useAuth, formatCurrency } from '@/lib/useAuth';
import { X, Download, FileText, History, Pencil, Loader2 } from 'lucide-react';

interface ExpenseDetailModalProps {
    expense: Expense;
    onClose: () => void;
    onEdit?: () => void;
    canEdit?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
    CREATE: 'Recorded',
    UPDATE: 'Edited',
    DELETE: 'Deleted',
    ATTACHMENT_ADDED: 'Receipt attached',
    ATTACHMENT_REMOVED: 'Receipt removed',
};

const FIELD_LABELS: Record<string, string> = {
    amount: 'Amount',
    description: 'Description',
    categoryName: 'Category',
    category: 'Category',
    expenseDate: 'Date',
    notes: 'Notes',
    vendor: 'Paid to',
    reference: 'Reference',
    paymentMethod: 'Paid by',
    storeId: 'Store',
    attachment: 'Receipt',
    source: 'Source',
};

/** Absolute URL for an attachment stored as a relative /api/uploads path. */
function resolveAttachmentUrl(url: string) {
    if (url.startsWith('http')) return url;
    // API_URL is "/api" behind the Nginx proxy; the stored path already
    // includes that prefix, so joining both would double it.
    if (API_URL === '/api') return url;
    return `${API_URL}${url.replace(/^\/api/, '')}`;
}

export function ExpenseDetailModal({ expense, onClose, onEdit, canEdit }: ExpenseDetailModalProps) {
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [audit, setAudit] = useState<ExpenseAuditEntry[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(true);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        let cancelled = false;
        setLoadingAudit(true);
        api.expenses.getAudit(expense.id)
            .then(entries => { if (!cancelled) setAudit(entries); })
            .catch(() => { if (!cancelled) setAudit([]); })
            .finally(() => { if (!cancelled) setLoadingAudit(false); });
        return () => { cancelled = true; };
    }, [expense.id]);

    const money = (value: unknown) =>
        formatCurrency(Number(value) || 0, user?.currency, user?.locale);

    const formatAuditValue = (field: string, value: unknown) => {
        if (value === null || value === undefined || value === '') return '—';
        if (field === 'amount') return money(value);
        if (field === 'expenseDate') {
            const date = new Date(String(value));
            return isNaN(date.getTime())
                ? String(value)
                : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        }
        return String(value);
    };

    const isImage = expense.attachmentType?.startsWith('image/');
    const attachmentHref = expense.attachmentUrl ? resolveAttachmentUrl(expense.attachmentUrl) : null;

    const detailRows: { label: string; value: string }[] = [
        {
            label: 'Date',
            value: new Date(expense.expenseDate).toLocaleDateString(undefined, {
                weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
            }),
        },
        { label: 'Category', value: expense.category?.name || '—' },
        { label: 'Store', value: expense.store?.name || '—' },
        { label: 'Paid to', value: expense.vendor || '—' },
        { label: 'Paid by', value: expense.paymentMethod || '—' },
        { label: 'Reference', value: expense.reference || '—' },
        {
            label: 'Recorded by',
            value: expense.createdBy?.name || expense.createdBy?.email || '—',
        },
        {
            label: 'Recorded on',
            value: new Date(expense.createdAt).toLocaleString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            }),
        },
    ];

    const panel = (
        <div className="fixed inset-0 z-[60]">
            <div
                className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-label="Expense details"
                className="absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-lifted flex flex-col animate-slide-in-right"
            >
                <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-gray-100">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-mid-grey uppercase tracking-widest mb-2">
                            Expense
                        </p>
                        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight truncate">
                            {money(expense.amount)}
                        </h2>
                        <p className="text-sm text-charcoal mt-1 truncate">{expense.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                        {canEdit && onEdit && (
                            <button
                                onClick={onEdit}
                                className="p-2 rounded-lg text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                                aria-label="Edit expense"
                                title="Edit expense"
                            >
                                <Pencil size={18} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 rounded-lg text-gray-400 hover:bg-surface-muted hover:text-charcoal transition-colors"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 space-y-8">
                    <dl className="divide-y divide-gray-100">
                        {detailRows.map(row => (
                            <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
                                <dt className="text-xs font-semibold text-mid-grey uppercase tracking-wide shrink-0">
                                    {row.label}
                                </dt>
                                <dd className="text-sm text-charcoal text-right min-w-0 break-words">{row.value}</dd>
                            </div>
                        ))}
                    </dl>

                    {expense.notes && (
                        <div>
                            <h3 className="text-xs font-semibold text-mid-grey uppercase tracking-widest mb-2">Notes</h3>
                            <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed">{expense.notes}</p>
                        </div>
                    )}

                    {attachmentHref && (
                        <div>
                            <h3 className="text-xs font-semibold text-mid-grey uppercase tracking-widest mb-3">Receipt</h3>

                            {isImage ? (
                                <a
                                    href={attachmentHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-xl overflow-hidden border border-gray-200 hover:border-brand-300 transition-colors"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={attachmentHref}
                                        alt={expense.attachmentName || 'Receipt'}
                                        className="w-full max-h-72 object-contain bg-surface-muted"
                                    />
                                </a>
                            ) : (
                                <a
                                    href={attachmentHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
                                >
                                    <FileText size={20} className="text-brand-600 shrink-0" />
                                    <span className="text-sm text-charcoal truncate flex-1">
                                        {expense.attachmentName || 'Receipt document'}
                                    </span>
                                </a>
                            )}

                            <a
                                href={attachmentHref}
                                download={expense.attachmentName || undefined}
                                className="inline-flex items-center gap-2 mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700"
                            >
                                <Download size={14} />
                                Download receipt
                            </a>
                        </div>
                    )}

                    <div>
                        <h3 className="flex items-center gap-2 text-xs font-semibold text-mid-grey uppercase tracking-widest mb-4">
                            <History size={14} />
                            History
                        </h3>

                        {loadingAudit ? (
                            <div className="flex items-center gap-2 text-sm text-mid-grey py-4">
                                <Loader2 size={15} className="animate-spin" />
                                Loading history…
                            </div>
                        ) : audit.length === 0 ? (
                            <p className="text-sm text-mid-grey py-2">No history recorded.</p>
                        ) : (
                            <ol className="space-y-4">
                                {audit.map(entry => (
                                    <li key={entry.id} className="relative pl-5">
                                        <span className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-brand-300" />
                                        <div className="flex items-baseline justify-between gap-3">
                                            <p className="text-sm font-semibold text-gray-900">
                                                {ACTION_LABELS[entry.action] || entry.action}
                                            </p>
                                            <time className="text-[11px] text-mid-grey shrink-0">
                                                {new Date(entry.createdAt).toLocaleString(undefined, {
                                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                                })}
                                            </time>
                                        </div>
                                        <p className="text-xs text-mid-grey mt-0.5">
                                            {entry.user?.name || entry.user?.email || entry.userName || 'Unknown user'}
                                        </p>

                                        {entry.changes && Object.keys(entry.changes).length > 0 && (
                                            <ul className="mt-2 space-y-1">
                                                {Object.entries(entry.changes).map(([field, change]) => (
                                                    <li key={field} className="text-xs text-charcoal">
                                                        <span className="font-medium">
                                                            {FIELD_LABELS[field] || field}:
                                                        </span>{' '}
                                                        {entry.action === 'CREATE' ? (
                                                            <span>{formatAuditValue(field, change?.to)}</span>
                                                        ) : (
                                                            <>
                                                                <span className="text-mid-grey line-through">
                                                                    {formatAuditValue(field, change?.from)}
                                                                </span>
                                                                {' → '}
                                                                <span>{formatAuditValue(field, change?.to)}</span>
                                                            </>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (!mounted) return null;
    return createPortal(panel, document.body);
}
