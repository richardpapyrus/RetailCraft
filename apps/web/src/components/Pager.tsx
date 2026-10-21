"use client";

import { ChevronLeft, ChevronRight } from 'lucide-react';

// Previous / Next footer for server-paged tables (same look as the Purchase Orders list).
export function Pager({ page, pageSize, total, noun, loading, onPageChange }: {
    page: number;
    pageSize: number;
    total: number;
    noun: string;
    loading?: boolean;
    onPageChange: (page: number) => void;
}) {
    if (total <= pageSize) return null;

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    const buttonClass = "flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
                Showing <span className="font-semibold">{start}</span>–<span className="font-semibold">{end}</span> of{' '}
                <span className="font-semibold">{total}</span> {noun}
            </p>
            <div className="flex items-center gap-2">
                <button onClick={() => onPageChange(page - 1)} disabled={page <= 1 || loading} className={buttonClass}>
                    <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-gray-600 font-medium px-2">
                    Page {page} of {totalPages}
                </span>
                <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || loading} className={buttonClass}>
                    Next <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
