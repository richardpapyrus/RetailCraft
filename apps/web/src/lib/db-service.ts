import { api, Product } from './api';
import { db } from './db';

export const DataService = {
    async getProducts(skip: number = 0, take: number = 50, filters: any = {}, storeId?: string): Promise<{ data: Product[], total: number }> {
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        // console.log(`[DataService] getProducts skip=${skip} take=${take} filters=${JSON.stringify(filters)} storeId=${storeId} online=${isOnline}`);

        // 1. Check Offline Status
        if (!isOnline) {
            // For now, offline cache ignores storeId filtering (simplification)
            // or we ideally filter cached items.
            // Dexie filtering complex here without index. Let's return all or warn.
            console.log("[DataService] Serving from cache (offline).");
            try {
                const total = await db.products.count();
                const cached = await db.products.offset(skip).limit(take).toArray();
                return { data: cached, total };
            } catch (err) {
                console.error("[DataService] Cache read failed while offline", err);
                return { data: [], total: 0 };
            }
        } else {
            // 2. Try Network
            try {
                const response = await api.products.list(skip, take, filters, storeId);
                const { data, total } = response;
                console.log(`[DataService] Network success: found ${data.length} products (total: ${total})`);

                // Cache in background
                db.transaction('rw', db.products, async () => {
                    if (skip === 0 && !filters.search && !filters.category && !filters.lowStock) {
                        await db.products.clear();
                    }
                    await db.products.bulkPut(data);
                }).catch(err => {
                    console.error("[DataService] Background caching failed (non-blocking)", err);
                });

                return { data, total };
            } catch (error) {
                console.error("[DataService] Network fetch failed, falling back to cache", error);
                try {
                    const total = await db.products.count();
                    const cached = await db.products.offset(skip).limit(take).toArray();
                    console.log(`[DataService] Serving ${cached.length} products from cache.`);
                    return { data: cached, total };
                } catch (cacheErr) {
                    console.error("[DataService] Cache fallback also failed", cacheErr);
                    throw error; // Re-throw network error if cache is also broken
                }
            }
        }
    },

    async getProductStats(storeId?: string) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return { totalProducts: 0, inventoryValue: '0.00', lowStockCount: 0 };
        return api.products.getStats(storeId);
    },

    async saveSale(payload: any): Promise<{ success: boolean; offline: boolean; data?: any }> {
        // 1. Try Network
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
                const data = await api.sales.create(payload);
                return { success: true, offline: false, data };
            } catch (error) {
                console.warn("[DataService] Sale upload failed, queuing...", error);
            }
        }

        // 2. Offline Queue
        await db.syncQueue.add({
            url: '/sales',
            method: 'POST',
            body: payload,
            createdAt: Date.now(),
            retryCount: 0
        });

        // Return Mock Sale for UI
        return {
            success: true,
            offline: true,
            data: {
                id: `OFFLINE - ${Date.now()} `,
                total: payload.total,
                paymentMethod: payload.paymentMethod || 'CASH',
                createdAt: new Date(),
                // Add other fields if needed by Receipt UI
            }
        };
    },

    async getCustomers(skip: number = 0, take: number = 50, storeId?: string): Promise<{ data: any[], total: number }> {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            console.log("App is offline, skipping customer fetch.");
            const total = await db.customers.count();
            const data = await db.customers.offset(skip).limit(take).toArray();
            return { data, total };
        } else {
            try {
                const response = await api.customers.list(skip, take, storeId);
                const { data, total } = response;

                db.transaction('rw', db.customers, async () => {
                    // Only clear if we are fetching the first page (refresh)
                    if (skip === 0) {
                        await db.customers.clear();
                    }
                    await db.customers.bulkPut(data);
                }).catch(err => console.error("[DataService] Failed to cache customers", err));

                return { data, total };
            } catch (e) {
                console.warn("Customer fetch failed", e);
                const total = await db.customers.count();
                const data = await db.customers.offset(skip).limit(take).toArray();
                return { data, total };
            }
        }
    },

    async saveCustomer(payload: any): Promise<{ success: boolean; offline: boolean; data?: any }> {
        // 1. Try Network
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
                const data = await api.customers.create(payload);
                // Cache immediately
                await db.customers.put(data);
                return { success: true, offline: false, data };
            } catch (error) {
                console.warn("[DataService] Customer upload failed, queuing...", error);
            }
        }

        // 2. Offline Queue
        const mockId = `OFFLINE - ${Date.now()} `;
        const offlineData = { ...payload, id: mockId, createdAt: new Date() };

        await db.syncQueue.add({
            url: '/customers',
            method: 'POST',
            body: payload,
            createdAt: Date.now(),
            retryCount: 0
        });

        await db.customers.add(offlineData);

        return { success: true, offline: true, data: offlineData };
    },

    async clearCache() {
        await db.products.clear();
        await db.customers.clear();
        console.log("Local cache cleared.");
    }
};
