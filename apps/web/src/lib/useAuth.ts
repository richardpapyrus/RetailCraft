import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { fetchClient } from './api';

interface User {
    id: string;
    email: string;
    name?: string;
    role: string;
    storeId?: string;
    tenantId?: string;
    tenantName?: string;
    store?: { id: string; name: string };
    currency?: string;
    locale?: string;
    locale?: string;
    permissions?: string[];
    tenantLogo?: string;
    tenantBrandColor?: string;
}

export const formatCurrency = (amount: number | string | undefined | null, currency = 'USD', locale = 'en-US') => {
    const validAmount = Number(amount) || 0;
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(validAmount);
};

interface AuthState {
    user: User | null;
    token: string | null;
    lastActive: number;
    isHydrated: boolean;
    setHydrated: () => void;
    login: (email: string, password: string) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => void;
    updateActivity: () => void;
    refreshProfile: () => Promise<void>;
    hasPermission: (permission: string) => boolean;
    // Multi-Store Context (Global)
    selectedStoreId: string | null;
    setSelectedStoreId: (storeId: string | null) => void;
}

export const useAuth = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            lastActive: Date.now(),
            isHydrated: false,
            setHydrated: () => set({ isHydrated: true }),
            login: async (email, password) => {
                try {
                    const data = await fetchClient('/auth/login', {
                        method: 'POST',
                        body: JSON.stringify({ email, password }),
                    });

                    const isStrictLocation = data.user.role !== 'Administrator' && data.user.role !== 'ADMIN';
                    const initialStoreId = isStrictLocation ? data.user.storeId : null; // Admin defaults to Business Dashboard (null)

                    set({
                        token: data.access_token,
                        user: data.user,
                        lastActive: Date.now(),
                        selectedStoreId: initialStoreId
                    });
                } catch (error) {
                    console.error('Login failed', error);
                    throw error;
                }
            },
            register: async (data: any) => {
                try {
                    const res = await fetchClient('/auth/register', {
                        method: 'POST',
                        body: JSON.stringify(data),
                    });
                    set({ token: res.access_token, user: res.user, lastActive: Date.now() });
                } catch (error) {
                    console.error('Registration failed', error);
                    throw error;
                }
            },
            logout: () => {
                set({ token: null, user: null, lastActive: 0 });
            },
            updateActivity: () => set({ lastActive: Date.now() }),
            refreshProfile: async () => {
                const { user, token } = get();
                if (user && user.email && token) {
                    try {
                        const freshUser = await fetchClient('/auth/profile', { method: 'POST', body: JSON.stringify({ email: user.email }) });
                        if (freshUser) {
                            // Re-enforce binding
                            const isStrictLocation = freshUser.role !== 'Administrator' && freshUser.role !== 'ADMIN';
                            const currentSelection = get().selectedStoreId;

                            // If strict user somehow got unselected, force them back
                            if (isStrictLocation && currentSelection !== freshUser.storeId) {
                                set({ user: freshUser, selectedStoreId: freshUser.storeId });
                            } else {
                                set({ user: freshUser });
                            }
                        }
                    } catch (e) {
                        console.error('Failed to refresh profile', e);
                        // If fails (e.g. 401), maybe logout? For now just log.
                    }
                }
            },
            hasPermission: (permission: string) => {
                const { user } = get();
                if (!user) return false;
                if (user.role === 'ADMIN' || user.role === 'Administrator') return true;
                if (user.permissions?.includes('*')) return true;
                return user.permissions?.includes(permission) || false;
            },
            selectedStoreId: null,
            setSelectedStoreId: (storeId) => set({ selectedStoreId: storeId }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                state?.setHydrated();
                state?.refreshProfile();
            },
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                lastActive: state.lastActive,
                selectedStoreId: state.selectedStoreId // Persist selection
            } as any),
        }
    )
);
