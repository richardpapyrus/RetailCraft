"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes
const CHECK_INTERVAL = 60 * 1000; // Check every minute
const ACTIVITY_THROTTLE = 30 * 1000; // throttle updates to every 30s

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const { user, lastActive, logout, updateActivity, checkInactivity } = useAuth();
    const router = useRouter(); // Import this
    // Using a ref to track throttle without re-rendering or depending on store state constantly
    const lastUpdate = useRef(Date.now());

    // 1. Check for timeout
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            if (checkInactivity(INACTIVITY_LIMIT)) {
                console.log("Session timed out due to inactivity");
                router.push('/login');
            }
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [user, checkInactivity, router]);

    // 2. Initial check on mount (in case they reload page after 15m)
    useEffect(() => {
        if (user) {
            if (checkInactivity(INACTIVITY_LIMIT)) {
                router.push('/login');
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
