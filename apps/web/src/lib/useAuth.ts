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

    permissions?: string[];
    tenantLogo?: string;
    tenantBrandColor?: string;
}

import { formatCurrency } from './format';
export { formatCurrency };


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
    checkInactivity: (limit?: number) => boolean;
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

                    // STRICT VALIDATION: Prevent "Zombie" login
                    if (!data.user || !data.user.role || data.user.role === 'Unknown') {
                        throw new Error('User account has no assigned role. Please contact an administrator.');
                    }

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

                        // STRICT VALIDATION
                        if (!freshUser || !freshUser.id || !freshUser.role || freshUser.role === 'Unknown') {
                            console.warn('Profile refresh returned invalid user. Forcing logout.');
                            set({ token: null, user: null, lastActive: 0 });
                            return;
                        }

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
                        console.error('Failed to refresh profile, forcing logout to prevent zombie state', e);
                        // CRITICAL FIX: If profile refresh fails (token expired/invalid), wipe the session.
                        set({ token: null, user: null, lastActive: 0 });
                    }
                }
            },
            checkInactivity: (limit = 15 * 60 * 1000) => {
                const { lastActive } = get();
                if (Date.now() - lastActive > limit) {
                    get().logout();
                    return true;
                }
                return false;
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
            storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => { }, removeItem: () => { } })),
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
