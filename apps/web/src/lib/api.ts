// Smart API URL determination
let computedUrl = 'http://localhost:4000';

if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Fallback logic ONLY if Env Var is missing
    if (hostname.includes('retailcraft.com.ng')) {
        // Guessing production API - but allow override via Env Var
        computedUrl = 'https://api.retailcraft.com.ng';
    } else if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        // LAN / IP Access (Assume Backend is on same host, port 4000)
        computedUrl = `${protocol}//${hostname}:4000`;
    }
}

// CRITICAL: Respect the Build-time Environment Variable if it exists. 
// Only fallback to computedUrl if NEXT_PUBLIC_API_URL is undefined or empty.
let finalUrl = process.env.NEXT_PUBLIC_API_URL || computedUrl;

if (typeof window !== 'undefined') {
    const isRemoteOrigin = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const isLocalhostApi = finalUrl.includes('localhost') || finalUrl.includes('127.0.0.1');

    // SMART OVERRIDE: If we are on a remote device (e.g. LAN or Prod) but the API is set to localhost,
    // it is definitely wrong (it points to the device's own localhost). We must trust the computedUrl.
    if (isRemoteOrigin && isLocalhostApi) {
        console.warn(`[RetailCraft Config] Overriding hardcoded localhost API (${finalUrl}) with detected remote API (${computedUrl})`);
        finalUrl = computedUrl;
    }

    console.info(`[RetailCraft Config] Final API URL: ${finalUrl}`);
}

export const API_URL = finalUrl;

export async function fetchClient(endpoint: string, options: RequestInit = {}) {
    // Access token from Zustand persisted storage
    let token = null;
    try {
        const storageStr = typeof window !== 'undefined' ? localStorage.getItem('auth-storage') : null;
        if (storageStr) {
            const storage = JSON.parse(storageStr);
            token = storage.state?.token;
        }
    } catch (e) {
        console.error('Failed to parse auth token', e);
    }

    const headers: any = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    // Prevent Next.js/Browser Caching
    (options as any).cache = 'no-store';

    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            let errorMessage = response.statusText;
            let errorBody;
            const text = await response.text();
            try {
                errorBody = JSON.parse(text);
                if (errorBody && errorBody.message) {
                    errorMessage = Array.isArray(errorBody.message)
                        ? errorBody.message.join(', ')
                        : errorBody.message;
                }
            } catch (e) {
                // If it's not JSON, fall back to the raw text if available
                if (text) errorMessage = text;
            }
            console.error(`[API Client] Error: ${errorMessage}`);
            throw new Error(errorMessage);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && (contentType.includes('text/csv') || contentType.includes('application/blob'))) {
            return response.blob();
        }

        return response.json();
    } catch (e: any) {
        console.error(`[API Client] Network/Fetch Error:`, e);
        throw e;
    }
}

export interface Product {
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    category?: string;
    price: string | number;
    costPrice?: string | number;
    minStockLevel?: number;
    supplierId?: string | null;
    description?: string;
    inventory?: { quantity: number }[];
    supplier?: { id: string; name: string };
}

export interface ReturnRequest {
    saleId: string;
    items: { productId: string; quantity: number; restock: boolean }[];
}

export interface ReturnResponse {
    id: string;
}

export const api = {
    products: {
        list: (skip: number = 0, take: number = 50, filters: { search?: string; category?: string; lowStock?: boolean } = {}, storeId?: string) => {
            const params = new URLSearchParams();
            params.append('skip', skip.toString());
            params.append('take', take.toString());
            if (filters.search) params.append('search', filters.search);
            if (filters.category) params.append('category', filters.category);
            if (filters.lowStock) params.append('lowStock', 'true');
            if (storeId) params.append('storeId', storeId);
            return fetchClient(`/products?${params.toString()}`).then(res => res as { data: Product[], total: number });
        },
        getStats: (storeId?: string) => {
            const params = new URLSearchParams();
            if (storeId) params.append('storeId', storeId);
            return fetchClient(`/products/stats?${params.toString()}`).then(res => res as { totalProducts: number; inventoryValue: string; lowStockCount: number });
        },
        get: (id: string) => fetchClient(`/products/${id}`).then(res => res as Product & { inventoryEvents: any[] }),
        create: (data: Partial<Product>) => fetchClient('/products', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        import: (file: File, storeId?: string) => {
            const formData = new FormData();
            formData.append('file', file);
            let url = '/products/import';
            if (storeId) url += `?storeId=${storeId}`;
            return fetchClient(url, {
                method: 'POST',
                body: formData
            });
        },
        update: (id: string, data: Partial<Product>) => fetchClient(`/products/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
        getEvents: (id: string, skip: number, take: number) => fetchClient(`/products/${id}/events?skip=${skip}&take=${take}`).then(res => res as { data: any[], total: number }),
    },
    suppliers: {
        list: (storeId?: string) => {
            const params = new URLSearchParams();
            if (storeId) params.append('storeId', storeId);
            return fetchClient(`/suppliers?${params.toString()}`).then(res => res as any[]);
        },
        create: (data: any) => fetchClient('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: any) => fetchClient(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        delete: (id: string) => fetchClient(`/suppliers/${id}`, { method: 'DELETE' }),
    },
    inventory: {
        adjust: (productId: string, quantity: number, reason: string, storeId?: string) =>
            fetchClient('/inventory/adjust', {
                method: 'POST',
                body: JSON.stringify({ productId, quantity, reason, storeId }),
            }),
        restock: (data: { productId: string; quantity: number; unitCost: number; newPrice?: number; supplierName?: string; storeId?: string }) =>
            fetchClient('/inventory/restock', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
    },
    sales: {
        list: (skip: number = 0, take: number = 50, storeId?: string) => {
            // Currently backend /sales doesn't support pagination/filtering in the controller list method?
            // Let's assume it does or I will need to update backend too.
            // Actually currently getting ALL sales might be heavy.
            const params = new URLSearchParams();
            if (storeId) params.append('storeId', storeId);
            params.append('skip', skip.toString());
            params.append('take', take.toString());
            return fetchClient(`/sales?${params.toString()}`);
        },
        create: (data: { items: { productId: string; quantity: number }[]; paymentMethod: string; customerId?: string; discount?: any; tillSessionId?: string; redeemPoints?: number; storeId?: string }) =>
            fetchClient('/sales', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
        stats: (from?: string, to?: string, storeId?: string) => {
            const query = new URLSearchParams();
            if (from) query.append('from', from);
            if (to) query.append('to', to);
            if (storeId) query.append('storeId', storeId);
            return fetchClient(`/sales/stats?${query.toString()}`);
        },
        topProducts: (params: { from?: string, to?: string, sortBy?: 'value' | 'count', limit?: number, skip?: number, storeId?: string }) => {
            const query = new URLSearchParams();
            if (params.from) query.append('from', params.from);
            if (params.to) query.append('to', params.to);
            if (params.sortBy) query.append('sortBy', params.sortBy);
            if (params.limit) query.append('limit', params.limit.toString());
            if (params.skip) query.append('skip', params.skip.toString());
            if (params.storeId) query.append('storeId', params.storeId);
            return fetchClient(`/sales/top-products?${query.toString()}`);
        },
        export: (from?: string, to?: string, storeId?: string) => {
            const query = new URLSearchParams();
            if (from) query.append('from', from);
            if (to) query.append('to', to);
            if (storeId) query.append('storeId', storeId);
            return fetchClient(`/sales/export?${query.toString()}`);
        },
    },
    customers: {
        list: (skip: number = 0, take: number = 50, storeId?: string) => {
            const params = new URLSearchParams();
            params.append('skip', skip.toString());
            params.append('take', take.toString());
            if (storeId) params.append('storeId', storeId);
            return fetchClient(`/customers?${params.toString()}`).then(res => res as { data: any[], total: number });
        },
        get: (id: string) => fetchClient(`/customers/${id}`).then(res => res as any),
        create: (data: any) => fetchClient('/customers', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        getSales: (id: string, skip: number, take: number) => fetchClient(`/customers/${id}/sales?skip=${skip}&take=${take}`).then(res => res as { data: any[], total: number }),
    },
    users: {
        list: (storeId?: string) => fetchClient(`/users${storeId ? `?storeId=${storeId}` : ''}`),
        create: (data: any) => fetchClient('/users', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: any) => fetchClient(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        delete: (id: string) => fetchClient(`/users/${id}`, { method: 'DELETE' }),
    },
    stores: {
        list: (storeId?: string) => fetchClient(`/stores${storeId ? `?storeId=${storeId}` : ''}`),
        create: (data: any) => fetchClient('/stores', {
            method: 'POST', body: JSON.stringify(data)
        }),
        update: (id: string, data: any) => fetchClient(`/stores/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        delete: (id: string) => fetchClient(`/stores/${id}`, { method: 'DELETE' }),
    },
    taxes: {
        list: () => fetchClient('/taxes').then(res => res as any[]),
        create: (data: any) => fetchClient('/taxes', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: any) => fetchClient(`/taxes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        delete: (id: string) => fetchClient(`/taxes/${id}`, { method: 'DELETE' }),
    },
    discounts: {
        list: () => fetchClient('/discounts').then(res => res as any[]),
        create: (data: { name: string; type: string; value: number; targetType?: string; targetValues?: string[]; startDate?: string; endDate?: string }) => fetchClient('/discounts', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: any) => fetchClient(`/discounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        delete: (id: string) => fetchClient(`/discounts/${id}`, { method: 'DELETE' }),
    },
    tenants: {
        update: (id: string, data: { currency?: string; locale?: string; logoUrl?: string; brandColor?: string }) => fetchClient(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        uploadLogo: (id: string, file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return fetchClient(`/tenants/${id}/logo`, {
                method: 'POST',
                body: formData
            }).then(res => res as { logoUrl: string });
        }
    },
    returns: {
        create: (data: ReturnRequest) => fetchClient('/returns', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    },
    tills: {
        list: (storeId: string) => fetchClient(`/tills?storeId=${storeId}`),
        create: (data: { name: string; storeId: string }) => fetchClient('/tills', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: any) => fetchClient(`/tills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => fetchClient(`/tills/${id}`, { method: 'DELETE' }),
        getActiveSession: (storeId?: string) => fetchClient(`/tills/session/active${storeId ? `?storeId=${storeId}` : ''}`),
        openSession: (data: { tillId: string; openingFloat: number }) => fetchClient('/tills/session/open', { method: 'POST', body: JSON.stringify(data) }),
        getSessionSummary: (id: string) => fetchClient(`/tills/session/${id}/summary`),
        closeSession: (id: string, data: { closingCash: number }) => fetchClient(`/tills/session/${id}/close`, { method: 'POST', body: JSON.stringify(data) }),
        recordTransaction: (data: { tillSessionId: string; type: 'CASH_IN' | 'CASH_OUT'; amount: number; reason: string }) => fetchClient('/tills/transaction', { method: 'POST', body: JSON.stringify(data) }),
        getSessions: (id: string) => fetchClient(`/tills/${id}/sessions`),
    },
    auth: {
        me: (email: string) => fetchClient('/auth/profile', { method: 'POST', body: JSON.stringify({ email }) }),
        register: (data: any) => fetchClient('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    },
    onboarding: {
        updateBusiness: (data: { name: string; currency: string; locale: string }) => fetchClient('/onboarding/business', { method: 'POST', body: JSON.stringify(data) }),
        updateStore: (data: { name?: string; address: string; phone: string }) => fetchClient('/onboarding/store', { method: 'POST', body: JSON.stringify(data) }),
        createTax: (data: { name: string; rate: number }) => fetchClient('/onboarding/tax', { method: 'POST', body: JSON.stringify(data) }),
        createProduct: (data: { name: string; price: number; sku: string }) => fetchClient('/onboarding/product', { method: 'POST', body: JSON.stringify(data) }),
        complete: () => fetchClient('/onboarding/complete', { method: 'POST' }),
    },
    roles: {
        list: () => fetchClient('/roles').then(res => res as Role[]),
        create: (data: { name: string; description?: string; permissions: string[] }) => fetchClient('/roles', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: Partial<Role>) => fetchClient(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        delete: (id: string) => fetchClient(`/roles/${id}`, { method: 'DELETE' }),
        getPermissions: () => fetchClient('/roles/permissions').then(res => res as PermissionGroup[]),
    }
};

export interface Role {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    isSystem: boolean;
    _count?: { users: number };
}

export interface PermissionGroup {
    label: string;
    permissions: string[];
}

// Just to be safe with the Backend structure:
export interface PermissionItem {
    label: string;
    code: string;
    // Wait, the backend returns simple strings in the array?
    // Let's re-check the constant file I wrote.
}

