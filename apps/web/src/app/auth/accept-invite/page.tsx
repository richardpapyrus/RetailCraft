"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_URL } from '@/lib/api';

function AcceptInviteContent() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError('Invalid or missing invitation token.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/accept-invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to accept invitation');
            }

            // Success - Redirect to login (or auto-login if token returned)
            // Ideally we auto-login, but for now redirecting to login with a query param is safe.
            // Or if the API returns a token (it does), we could store it.
            // But reuse of useAuth might be cleaner.
            // Let's just redirect to login for simplicity and robustness.
            router.push('/login?invited=true');

        } catch (err: any) {
            console.error('Invite Error:', err);
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="text-center">
                <h2 className="text-red-600 font-bold">Invalid Invitation</h2>
                <p className="text-gray-600 mt-2">No token provided in the URL.</p>
            </div>
        );
    }

    return (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="-space-y-px rounded-md shadow-sm">
                <div>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="relative block w-full rounded-t-md border-0 p-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        placeholder="New Password"
                    />
                </div>
                <div>
                    <input
                        id="confirm-password"
                        name="confirmPassword"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="relative block w-full rounded-b-md border-0 p-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        placeholder="Confirm Password"
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600 text-center">
                    <p className="font-bold">{error}</p>
                </div>
            )}

            <div>
                <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                >
                    {loading ? 'Setting Password...' : 'Set Password & Login'}
                </button>
            </div>
        </form>
    );
}

export default function AcceptInvitePage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8">
                <div>
                    <div className="flex flex-col items-center justify-center mb-8">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.jpg" alt="RetailCraft Logo" className="h-32 w-auto object-contain mb-4 filter drop-shadow-xl" />
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">RetailCraft</h1>
                        <p className="text-gray-500 font-medium mt-2">The Operating System for Retail</p>
                    </div>
                    <h2 className="mt-2 text-center text-xl font-bold tracking-tight text-gray-900">
                        Set your password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Please enter a secure password to activate your account.
                    </p>
                </div>

                <Suspense fallback={<div className="text-center">Loading...</div>}>
                    <AcceptInviteContent />
                </Suspense>
            </div>
            {/* Product Branding Footer */}
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center justify-center opacity-70">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Powered by</span>
                    <span className="font-bold text-gray-600 text-sm tracking-tight">RetailCraft</span>
                </div>
            </div>
        </div>
    );
}
