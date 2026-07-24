"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ExpenseCategory } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { Check, ChevronDown, Plus, Search, Loader2 } from 'lucide-react';

interface CategorySelectProps {
    categories: ExpenseCategory[];
    value?: string;
    onChange: (categoryId: string) => void;
    /** Called after a category is created inline so the parent can refresh its list. */
    onCategoryCreated?: (category: ExpenseCategory) => void;
    /** Inline creation is hidden for users who cannot record expenses. */
    allowCreate?: boolean;
    disabled?: boolean;
}

/**
 * Searchable category picker. When the typed name matches nothing, it offers to
 * create that category in place so expense entry is never interrupted.
 */
export function CategorySelect({
    categories,
    value,
    onChange,
    onCategoryCreated,
    allowCreate = true,
    disabled = false,
}: CategorySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [creating, setCreating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const selected = categories.find(c => c.id === value);

    const matches = useMemo(() => {
        const term = query.trim().toLowerCase();
        const active = categories.filter(c => c.status === 'ACTIVE');
        if (!term) return active;
        return active.filter(c => c.name.toLowerCase().includes(term));
    }, [categories, query]);

    const exactMatch = matches.some(
        c => c.name.toLowerCase() === query.trim().toLowerCase()
    );
    const canCreate = allowCreate && query.trim().length > 0 && !exactMatch;

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) searchRef.current?.focus();
    }, [isOpen]);

    const handleCreate = async () => {
        const name = query.trim();
        if (!name || creating) return;

        setCreating(true);
        try {
            const created = await api.expenseCategories.create({ name });
            onCategoryCreated?.(created);
            onChange(created.id);
            toast.success(`Created category "${created.name}"`);
            setIsOpen(false);
            setQuery('');
        } catch (e: any) {
            toast.error(e?.message || 'Could not create the category');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(o => !o)}
                className={`
                    w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border bg-white text-left
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                    ${isOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-200 hover:border-brand-300'}
                `}
            >
                <span className="flex items-center gap-2 min-w-0">
                    {selected && (
                        <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: selected.color || '#A9B0B0' }}
                        />
                    )}
                    <span className={`text-sm truncate ${selected ? 'text-gray-900 font-medium' : 'text-mid-grey'}`}>
                        {selected ? selected.name : 'Select a category'}
                    </span>
                </span>
                <ChevronDown
                    size={16}
                    className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-brand-500' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lifted border border-gray-100 overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (matches.length === 1) {
                                            onChange(matches[0].id);
                                            setIsOpen(false);
                                            setQuery('');
                                        } else if (canCreate) {
                                            handleCreate();
                                        }
                                    }
                                    if (e.key === 'Escape') {
                                        setIsOpen(false);
                                        setQuery('');
                                    }
                                }}
                                placeholder="Search or type a new category"
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                            />
                        </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                        {matches.map(category => {
                            const isSelected = category.id === value;
                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(category.id);
                                        setIsOpen(false);
                                        setQuery('');
                                    }}
                                    className={`
                                        w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors
                                        ${isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'}
                                    `}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: category.color || '#A9B0B0' }}
                                    />
                                    <span className={`text-sm flex-1 truncate ${isSelected ? 'text-brand-900 font-semibold' : 'text-gray-700'}`}>
                                        {category.name}
                                    </span>
                                    {isSelected && <Check size={15} className="text-brand-600 shrink-0" />}
                                </button>
                            );
                        })}

                        {matches.length === 0 && !canCreate && (
                            <p className="text-xs text-mid-grey text-center py-6 px-3">
                                No categories yet. Type a name to create one.
                            </p>
                        )}
                    </div>

                    {canCreate && (
                        <div className="p-1.5 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={creating}
                                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left hover:bg-brand-50 text-brand-700 transition-colors disabled:opacity-60"
                            >
                                {creating
                                    ? <Loader2 size={15} className="animate-spin shrink-0" />
                                    : <Plus size={15} className="shrink-0" />}
                                <span className="text-sm font-semibold truncate">
                                    Create &ldquo;{query.trim()}&rdquo;
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
