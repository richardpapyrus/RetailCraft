"use client";

import { useEffect, useState } from 'react';
import { db, SyncRequest } from '@/lib/db';
import { api } from '@/lib/api';

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        // Initial Count
        updateCount();

        // Initial Sync
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
            const count = await db.syncQueue.count();
            setPendingCount(count);
        } catch (e) {
            console.error("[Sync] Error counting syncQueue", e);
        }
    };

    const syncData = async () => {
        if (!navigator.onLine) return;
        if (isSyncing) return;

        try {
            if (!db || !db.syncQueue) return;
            const pending = await db.syncQueue.toArray();
            if (pending.length === 0) return;

            setIsSyncing(true);
            console.log(`[Sync] Found ${pending.length} items to sync...`);

            for (const req of pending) {
                try {
                    // Replay Request
                    if (req.url === '/sales' && req.method === 'POST') {
                        await api.sales.create(req.body);
                        console.log(`[Sync] Synced Sale ${req.id}`);
                        await db.syncQueue.delete(req.id!);
                    }

                    if (req.url === '/customers' && req.method === 'POST') {
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

                        console.log(`[Sync] Synced Customer ${newCustomer.name}`);
                        await db.syncQueue.delete(req.id!);
                    }
                } catch (err) {
                    console.error(`[Sync] Failed to sync item ${req.id}`, err);
                    // Optional: Exponential backoff or max retries
                }
            }
            await updateCount();
        } catch (error) {
            console.error("[Sync] Error during sync process", error);
        } finally {
            setIsSyncing(false);
        }
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

    // ... existing code ...

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
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-lg transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={syncData}
                                disabled={isSyncing}
                                className="flex-1 bg-gray-900 hover:bg-black text-white py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
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
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
