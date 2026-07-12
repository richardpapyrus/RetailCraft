"use client";

import { useEffect, useRef, useState } from 'react';
import { db, SyncRequest } from '@/lib/db';
import { api } from '@/lib/api';
import { confirmDialog } from '@/lib/dialog';
import { formatCurrency, useAuth } from '@/lib/useAuth';

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [pending, setPending] = useState<SyncRequest[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    // Ref, not state: syncData is captured once by setInterval, so a state
    // flag would be a stale closure and never actually guard re-entry.
    const syncingRef = useRef(false);

    const pendingCount = pending.length;

    useEffect(() => {
        updateCount();
        syncData();

        const interval = setInterval(() => {
            syncData();
        }, 15000); // Check every 15s

        // Also sync exactly when coming online
        window.addEventListener('online', syncData);

        // Expose for testing
        (window as any).syncNow = syncData;

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', syncData);
            delete (window as any).syncNow;
        };
    }, []);

    const updateCount = async () => {
        try {
            if (!db || !db.syncQueue) {
                console.warn("[Sync] db.syncQueue not initialized yet");
                return;
            }
            const items = await db.syncQueue.orderBy('createdAt').toArray();
            setPending(items);
        } catch (e) {
            console.error("[Sync] Error counting syncQueue", e);
        }
    };

    const syncData = async () => {
        if (!navigator.onLine) return;
        if (syncingRef.current) return;

        try {
            if (!db || !db.syncQueue) return;
            const queued = await db.syncQueue.toArray();
            if (queued.length === 0) {
                await updateCount();
                return;
            }

            syncingRef.current = true;
            setIsSyncing(true);

            for (const req of queued) {
                try {
                    // Replay Request
                    if (req.url === '/sales' && req.method === 'POST') {
                        await api.sales.create(req.body);
                        await db.syncQueue.delete(req.id!);
                    } else if (req.url === '/customers' && req.method === 'POST') {
                        // Strip offline-only fields and tenantId (handled by controller with connect)
                        const { id, code, synced, tenantId, ...payload } = req.body;

                        const newCustomer = await api.customers.create(payload);

                        // 1. Add real customer to DB (overwrite if needed, or add new)
                        await db.customers.put(newCustomer);

                        // 2. Delete offline customer
                        const offlineRecords = await db.customers
                            .filter(c => c.id.startsWith('OFFLINE') && c.name === req.body.name)
                            .toArray();

                        if (offlineRecords.length > 0) {
                            await db.customers.bulkDelete(offlineRecords.map(c => c.id));
                        }

                        await db.syncQueue.delete(req.id!);
                    } else if (req.url.startsWith('/customers/') && req.method === 'PATCH') {
                        // Offline customer edits. Previously these were queued by
                        // DataService.updateCustomer but never replayed, leaving
                        // them stuck in the queue forever.
                        const customerId = req.url.slice('/customers/'.length);
                        if (customerId.startsWith('OFFLINE')) {
                            // An edit to a customer that itself was created offline:
                            // the server has no such id. The POST replay above already
                            // carries the customer's latest local data, so this
                            // request can never succeed and is safe to drop.
                            await db.syncQueue.delete(req.id!);
                        } else {
                            await api.customers.update(customerId, req.body);
                            await db.customers.update(customerId, req.body).catch(() => { });
                            await db.syncQueue.delete(req.id!);
                        }
                    } else {
                        // Unknown request shape — record it so it surfaces in the
                        // details panel instead of failing silently forever.
                        await db.syncQueue.update(req.id!, {
                            retryCount: (req.retryCount || 0) + 1,
                            lastError: `No sync handler for ${req.method} ${req.url}`,
                        });
                    }
                } catch (err: any) {
                    console.error(`[Sync] Failed to sync item ${req.id}`, err);
                    // Keep the item, but record why it failed so the user can see
                    // and act on it from the notification's details panel.
                    await db.syncQueue.update(req.id!, {
                        retryCount: (req.retryCount || 0) + 1,
                        lastError: String(err?.message || err || 'Unknown error'),
                    }).catch(() => { });
                }
            }
            await updateCount();
        } catch (error) {
            console.error("[Sync] Error during sync process", error);
        } finally {
            syncingRef.current = false;
            setIsSyncing(false);
        }
    };

    const discardItem = async (req: SyncRequest) => {
        const label = describeItem(req, user);
        const ok = await confirmDialog({
            title: 'Discard unsynced item?',
            message: `${label.title}${label.subtitle ? ` — ${label.subtitle}` : ''} will be permanently removed from this device and will NOT reach the server. Only do this if you are sure the record is a duplicate or no longer needed.`,
            confirmLabel: 'Discard permanently',
            cancelLabel: 'Keep',
            destructive: true,
        });
        if (!ok) return;
        await db.syncQueue.delete(req.id!);
        await updateCount();
    };

    const [isDismissed, setIsDismissed] = useState(false);
    const [prevCount, setPrevCount] = useState(0);

    useEffect(() => {
        if (pendingCount > prevCount) {
            // New items added, show notification again
            setIsDismissed(false);
        }
        setPrevCount(pendingCount);
    }, [pendingCount]);

    return (
        <>
            {children}
            {pendingCount > 0 && !isDismissed && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <div className="bg-white border border-gray-200 shadow-lifted rounded-2xl p-4 w-80 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">Sync Required</h4>
                                    <p className="text-xs text-gray-500 font-medium">{pendingCount} unsaved item{pendingCount !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsDismissed(true)}
                                aria-label="Dismiss sync notification"
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-lg transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>

                        {showDetails && (
                            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto border-t border-gray-100 pt-3">
                                {pending.map(req => {
                                    const label = describeItem(req, user);
                                    return (
                                        <div key={req.id} className="flex items-start justify-between gap-2 text-xs">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-gray-800">{label.title}</div>
                                                {label.subtitle && <div className="text-gray-500 font-medium">{label.subtitle}</div>}
                                                <div className="text-gray-400 font-medium">
                                                    Queued {new Date(req.createdAt).toLocaleString()}
                                                    {req.retryCount > 0 ? ` · ${req.retryCount} failed attempt${req.retryCount === 1 ? '' : 's'}` : ''}
                                                </div>
                                                {req.lastError && (
                                                    <div className="text-red-600 font-medium break-words">{req.lastError}</div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => discardItem(req)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg font-semibold shrink-0 transition-colors"
                                                title="Permanently discard this unsynced item"
                                            >
                                                Discard
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={syncData}
                                disabled={isSyncing}
                                className="flex-1 bg-brand-500 hover:bg-brand-600 text-white py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
                            >
                                {isSyncing ? (
                                    <>
                                        <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Syncing...
                                    </>
                                ) : (
                                    'Sync Now'
                                )}
                            </button>
                            <button
                                onClick={() => setShowDetails(v => !v)}
                                className="bg-surface-muted hover:bg-cool-grey text-charcoal py-2 px-3 rounded-xl text-xs font-semibold transition-colors"
                            >
                                {showDetails ? 'Hide' : 'Details'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Human-readable description of a queued request for the details panel.
function describeItem(req: SyncRequest, user: any): { title: string; subtitle?: string } {
    if (req.url === '/sales' && req.method === 'POST') {
        const total = req.body?.total;
        return {
            title: 'Sale',
            subtitle: total !== undefined ? formatCurrency(Number(total), user?.currency, user?.locale) : undefined,
        };
    }
    if (req.url === '/customers' && req.method === 'POST') {
        return { title: 'New customer', subtitle: req.body?.name };
    }
    if (req.url.startsWith('/customers/') && req.method === 'PATCH') {
        return { title: 'Customer update', subtitle: req.body?.name };
    }
    return { title: `${req.method} ${req.url}` };
}
