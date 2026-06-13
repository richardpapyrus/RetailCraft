'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useDialogStore } from '@/lib/dialog';

/**
 * Single host that renders the active confirm/prompt dialog driven by the
 * dialog store. Replaces native window.confirm / window.prompt with an
 * on-brand, accessible modal. Mounted once at the app root.
 */
export function DialogHost() {
    const { open, mode, options, close } = useDialogStore();
    const [mounted, setMounted] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => setMounted(true), []);

    // Seed the input each time a prompt opens, and focus it.
    useEffect(() => {
        if (open && mode === 'prompt') {
            setInputValue(options.defaultValue ?? '');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open, mode, options.defaultValue]);

    // Escape closes (cancel); Enter confirms a prompt.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close(mode === 'confirm' ? false : null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, mode, close]);

    if (!mounted || !open) return null;

    const isPrompt = mode === 'prompt';
    const destructive = !!options.destructive;
    const confirmLabel = options.confirmLabel || (isPrompt ? 'Save' : destructive ? 'Delete' : 'Confirm');
    const cancelLabel = options.cancelLabel || 'Cancel';

    const onConfirm = () => close(isPrompt ? inputValue : true);
    const onCancel = () => close(isPrompt ? null : false);

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 print:hidden">
            <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm animate-fade-in" onClick={onCancel} />

            <div
                role="dialog"
                aria-modal="true"
                className="relative bg-white rounded-2xl shadow-lifted w-full max-w-sm flex flex-col animate-fade-in-up overflow-hidden"
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        {destructive && (
                            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                                <AlertTriangle size={20} />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            {options.title && (
                                <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-1">{options.title}</h2>
                            )}
                            {options.message && (
                                <p className="text-sm text-gray-500 leading-relaxed">{options.message}</p>
                            )}
                        </div>
                    </div>

                    {isPrompt && (
                        <div className="mt-4">
                            <div className="flex items-center rounded-xl border border-cool-grey focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 overflow-hidden">
                                {options.prefix && (
                                    <span className="pl-4 pr-2 text-sm text-mid-grey font-medium select-none">{options.prefix}</span>
                                )}
                                <input
                                    ref={inputRef}
                                    type={options.inputType || 'text'}
                                    value={inputValue}
                                    placeholder={options.placeholder}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); }}
                                    className={`flex-1 bg-transparent py-3 text-sm text-charcoal placeholder:text-mid-grey focus:outline-none ${options.prefix ? 'pr-4' : 'px-4'}`}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-canvas px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-charcoal bg-white border border-cool-grey hover:bg-surface-muted transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-soft transition-colors ${destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-500 hover:bg-brand-600'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
