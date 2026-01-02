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

    return (
        <>
            {children}
            {pendingCount > 0 && (
                <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded shadow-lg z-50 flex items-center gap-3">
                    <span className="font-bold">{pendingCount} Unsaved Items</span>
                    {isSyncing ? (
                        <span className="text-sm animate-pulse">Syncing...</span>
                    ) : (
                        <button onClick={syncData} className="text-sm underline hover:text-yellow-900">
                            Sync Now
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
