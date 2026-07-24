"use client";

import { useState } from 'react';
import { api, ExpenseCategory } from '@/lib/api';
import { confirmDialog } from '@/lib/dialog';
import { toast } from 'react-hot-toast';
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Check, X, Loader2, Sparkles } from 'lucide-react';

const SWATCHES = ['#235347', '#B8843A', '#B3574A', '#3F5C8A', '#7BA396', '#6B7280', '#8A6BA8', '#2F7A8C', '#C2703D', '#A9B0B0'];

interface CategoryManagerProps {
    categories: ExpenseCategory[];
    onChanged: () => void;
    canManage: boolean;
}

export function CategoryManager({ categories, onChanged, canManage }: CategoryManagerProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState({ name: '', description: '', color: SWATCHES[0] });
    const [isCreating, setIsCreating] = useState(false);
    const [busy, setBusy] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    const visible = categories.filter(c => (showArchived ? true : c.status === 'ACTIVE'));
    const archivedCount = categories.filter(c => c.status === 'ARCHIVED').length;

    const resetDraft = () => {
        setDraft({ name: '', description: '', color: SWATCHES[0] });
        setEditingId(null);
        setIsCreating(false);
    };

    const startCreate = () => {
        setDraft({ name: '', description: '', color: SWATCHES[0] });
        setEditingId(null);
        setIsCreating(true);
    };

    const startEdit = (category: ExpenseCategory) => {
        setDraft({
            name: category.name,
            description: category.description || '',
            color: category.color || SWATCHES[0],
        });
        setIsCreating(false);
        setEditingId(category.id);
    };

    const handleSave = async () => {
        const name = draft.name.trim();
        if (!name) {
            toast.error('Give the category a name.');
            return;
        }

        setBusy(true);
        try {
            if (editingId) {
                await api.expenseCategories.update(editingId, {
                    name,
                    description: draft.description.trim(),
                    color: draft.color,
                });
                toast.success('Category updated');
            } else {
                await api.expenseCategories.create({
                    name,
                    description: draft.description.trim() || undefined,
                    color: draft.color,
                });
                toast.success('Category created');
            }
            resetDraft();
            onChanged();
        } catch (e: any) {
            toast.error(e?.message || 'Could not save the category');
        } finally {
            setBusy(false);
        }
    };

    const handleArchive = async (category: ExpenseCategory) => {
        const confirmed = await confirmDialog({
            title: `Archive "${category.name}"?`,
            message:
                'It will no longer appear when recording new expenses. Existing expenses keep this category and stay in your reports.',
            confirmLabel: 'Archive',
        });
        if (!confirmed) return;

        try {
            await api.expenseCategories.archive(category.id);
            toast.success(`"${category.name}" archived`);
            onChanged();
        } catch (e: any) {
            toast.error(e?.message || 'Could not archive the category');
        }
    };

    const handleRestore = async (category: ExpenseCategory) => {
        try {
            await api.expenseCategories.restore(category.id);
            toast.success(`"${category.name}" restored`);
            onChanged();
        } catch (e: any) {
            toast.error(e?.message || 'Could not restore the category');
        }
    };

    const handleDelete = async (category: ExpenseCategory) => {
        const confirmed = await confirmDialog({
            title: `Delete "${category.name}"?`,
            message: 'This category has never been used, so deleting it is safe. This cannot be undone.',
            confirmLabel: 'Delete',
            destructive: true,
        });
        if (!confirmed) return;

        try {
            await api.expenseCategories.delete(category.id);
            toast.success(`"${category.name}" deleted`);
            onChanged();
        } catch (e: any) {
            toast.error(e?.message || 'Could not delete the category');
        }
    };

    const handleSeedDefaults = async () => {
        setBusy(true);
        try {
            await api.expenseCategories.seedDefaults();
            toast.success('Starter categories added');
            onChanged();
        } catch (e: any) {
            toast.error(e?.message || 'Could not add the starter categories');
        } finally {
            setBusy(false);
        }
    };

    const editor = (
        <div className="p-5 rounded-xl border border-brand-200 bg-brand-50/40 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-charcoal mb-2">Name</label>
                    <input
                        autoFocus
                        type="text"
                        value={draft.name}
                        onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') resetDraft();
                        }}
                        placeholder="e.g. Utilities"
                        className="input-field w-full"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-charcoal mb-2">
                        Description <span className="text-mid-grey font-normal">(optional)</span>
                    </label>
                    <input
                        type="text"
                        value={draft.description}
                        onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                        placeholder="What belongs in this category"
                        className="input-field w-full"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-charcoal mb-2">Chart colour</label>
                <div className="flex flex-wrap gap-2">
                    {SWATCHES.map(color => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setDraft(d => ({ ...d, color }))}
                            aria-label={`Use colour ${color}`}
                            className={`w-8 h-8 rounded-lg transition-transform ${draft.color === color ? 'ring-2 ring-offset-2 ring-brand-500 scale-105' : 'hover:scale-105'}`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={resetDraft} className="btn-secondary">Cancel</button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={busy}
                    className="btn-primary flex items-center gap-2 disabled:opacity-60"
                >
                    {busy && <Loader2 size={15} className="animate-spin" />}
                    {editingId ? 'Save changes' : 'Create category'}
                </button>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100/80 p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Expense categories</h2>
                    <p className="text-sm text-mid-grey font-medium mt-1">
                        Shared across every store in your organization.
                    </p>
                </div>

                {canManage && (
                    <div className="flex items-center gap-2">
                        {categories.length === 0 && (
                            <button
                                onClick={handleSeedDefaults}
                                disabled={busy}
                                className="btn-secondary flex items-center gap-2 disabled:opacity-60"
                            >
                                <Sparkles size={15} />
                                Add starter set
                            </button>
                        )}
                        <button onClick={startCreate} className="btn-primary flex items-center gap-2">
                            <Plus size={16} />
                            New category
                        </button>
                    </div>
                )}
            </div>

            {(isCreating || editingId) && canManage && <div className="mb-6">{editor}</div>}

            {visible.length === 0 ? (
                <div className="text-center py-14">
                    <p className="text-sm text-mid-grey">
                        No categories yet.
                        {canManage && ' Add the starter set above, or create your own.'}
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-gray-100">
                    {visible.map(category => {
                        const isArchived = category.status === 'ARCHIVED';
                        const inUse = (category.expenseCount || 0) > 0;

                        return (
                            <li
                                key={category.id}
                                className={`flex items-center gap-4 py-4 ${isArchived ? 'opacity-55' : ''}`}
                            >
                                <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: category.color || '#A9B0B0' }}
                                />

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{category.name}</p>
                                        {isArchived && (
                                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-muted text-mid-grey shrink-0">
                                                Archived
                                            </span>
                                        )}
                                    </div>
                                    {category.description && (
                                        <p className="text-xs text-mid-grey truncate mt-0.5">{category.description}</p>
                                    )}
                                </div>

                                <span className="text-xs text-mid-grey shrink-0 tabular-nums">
                                    {category.expenseCount || 0} expense{category.expenseCount === 1 ? '' : 's'}
                                </span>

                                {canManage && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => startEdit(category)}
                                            className="p-2 rounded-lg text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                                            aria-label={`Edit ${category.name}`}
                                            title="Edit"
                                        >
                                            <Pencil size={15} />
                                        </button>

                                        {isArchived ? (
                                            <button
                                                onClick={() => handleRestore(category)}
                                                className="p-2 rounded-lg text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                                                aria-label={`Restore ${category.name}`}
                                                title="Restore"
                                            >
                                                <ArchiveRestore size={15} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleArchive(category)}
                                                className="p-2 rounded-lg text-gray-400 hover:bg-surface-muted hover:text-charcoal transition-colors"
                                                aria-label={`Archive ${category.name}`}
                                                title="Archive"
                                            >
                                                <Archive size={15} />
                                            </button>
                                        )}

                                        {/* Deletion is only offered while the category has no history. */}
                                        {!inUse && (
                                            <button
                                                onClick={() => handleDelete(category)}
                                                className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                aria-label={`Delete ${category.name}`}
                                                title="Delete"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {archivedCount > 0 && (
                <button
                    onClick={() => setShowArchived(s => !s)}
                    className="mt-5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                    {showArchived
                        ? 'Hide archived categories'
                        : `Show ${archivedCount} archived categor${archivedCount === 1 ? 'y' : 'ies'}`}
                </button>
            )}
        </div>
    );
}
