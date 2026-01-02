"use client";

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/useAuth';

const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL = 60 * 1000; // Check every minute
const ACTIVITY_THROTTLE = 30 * 1000; // throttle updates to every 30s

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const { user, lastActive, logout, updateActivity } = useAuth();
    // Using a ref to track throttle without re-rendering or depending on store state constantly
    const lastUpdate = useRef(Date.now());

    // 1. Check for timeout
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceActive = now - useAuth.getState().lastActive; // Read fresh from state

            if (timeSinceActive > INACTIVITY_LIMIT) {
                console.log("Session timed out due to inactivity");
                logout();
            }
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [user, logout]);

    // 2. Initial check on mount (in case they reload page after 30m)
    useEffect(() => {
        if (user) {
            const now = Date.now();
            // Important: user might be stale from hydration, use getState to be safe or rely on prop
            // but prop is fine in useEffect
            if (now - lastActive > INACTIVITY_LIMIT) {
                logout();
            }
        }
    }, []);

    // 3. Listen for activity
    useEffect(() => {
        if (!user) return;

        const handleActivity = () => {
            const now = Date.now();
            if (now - lastUpdate.current > ACTIVITY_THROTTLE) {
                lastUpdate.current = now;
                updateActivity();
            }
        };

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);
        window.addEventListener('scroll', handleActivity);

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('scroll', handleActivity);
        };
    }, [user, updateActivity]);

    return <>{children}</>;
}
