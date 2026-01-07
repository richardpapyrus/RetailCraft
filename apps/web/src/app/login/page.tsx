"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();
    const { login } = useAuth();
    const [API_URL_DISPLAY, setApiUrl] = useState('Loading...');

    // Load API URL for debug display
    useEffect(() => {
        import('@/lib/api').then(m => setApiUrl(m.API_URL));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);

            // Get user from store to check role
            const user = useAuth.getState().user;

            if (user?.role === 'SALES_AGENT') {
                router.push('/pos');
            } else {
                router.push('/dashboard');
            }
        } catch (err: any) {
            console.error('Login Error:', err);
            setError(err.message || 'Login failed');
        }
    };

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
                        Sign in to your workspace
                    </h2>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="-space-y-px rounded-md shadow-sm">
                        <div>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="relative block w-full rounded-t-md border-0 p-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="relative block w-full rounded-b-md border-0 p-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600 text-center">
                            <p className="font-bold">{error}</p>
                            <p className="text-xs mt-1 text-gray-500">
                                Connecting to: {API_URL_DISPLAY}
                            </p>
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                            Sign in
                        </button>
                    </div>
                </form>
            </div>

            {/* Product Branding Footer */}
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center justify-center opacity-70">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Powered by</span>
                    <span className="font-bold text-gray-600 text-sm tracking-tight">RetailCraft</span>
                </div>
                {/* Debug Connection Info - Temporary for Troubleshooting */}
                <div className="text-[10px] text-gray-300 mt-2 font-mono">
                    Server: {API_URL_DISPLAY}
                </div>
            </div>
        </div>
    );
}
