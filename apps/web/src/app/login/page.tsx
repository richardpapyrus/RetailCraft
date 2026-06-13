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

            if (user?.permissions?.includes('VIEW_DASHBOARD') || user?.permissions?.includes('*')) {
                router.push('/dashboard');
            } else {
                router.push('/pos');
            }
        } catch (err: any) {
            console.error('Login Error:', err);
            setError(err.message || 'Login failed');
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* Calm brand gradient backdrop */}
            <div className="absolute inset-0 z-0 overflow-hidden bg-[#13302D]">
                <div className="absolute inset-0" style={{
                    background:
                        'radial-gradient(1200px 800px at 15% 10%, rgba(56, 195, 181, 0.35), transparent 60%),' +
                        'radial-gradient(1000px 700px at 85% 90%, rgba(31, 138, 128, 0.3), transparent 60%),' +
                        'radial-gradient(800px 600px at 70% 20%, rgba(26, 90, 85, 0.4), transparent 55%)'
                }} />
            </div>

            {/* Glassmorphism Login Panel */}
            <div className="relative z-20 w-full max-w-md p-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lifted space-y-8 animate-in fade-in zoom-in duration-500">
                <div>
                    <div className="flex flex-col items-center justify-center mb-6">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logo.jpg"
                            alt="RetailCraft Logo"
                            className="h-28 w-auto object-contain mb-4 filter drop-shadow-lg rounded-xl"
                        />
                        <h1 className="text-4xl font-semibold text-white tracking-tight drop-shadow-md">RetailCraft</h1>
                        <p className="text-gray-200 font-medium mt-2 drop-shadow-sm">The Operating System for Retail</p>
                    </div>
                    <h2 className="mt-2 text-center text-xl font-semibold tracking-tight text-white drop-shadow-sm">
                        Sign in to your workspace
                    </h2>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email-address" className="sr-only">Email address</label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="relative block w-full rounded-lg border-0 bg-white/20 p-4 text-white placeholder-gray-300 ring-1 ring-inset ring-white/30 focus:ring-2 focus:ring-inset focus:ring-brand-400 sm:text-sm sm:leading-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/30"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="relative block w-full rounded-lg border-0 bg-white/20 p-4 text-white placeholder-gray-300 ring-1 ring-inset ring-white/30 focus:ring-2 focus:ring-inset focus:ring-brand-400 sm:text-sm sm:leading-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/30"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm text-red-100 text-center backdrop-blur-sm">
                            <p className="font-semibold">{error}</p>
                            <p className="text-xs mt-1 text-red-200/80">
                                Connecting to: {API_URL_DISPLAY}
                            </p>
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-lg bg-brand-600/90 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-500 hover:shadow-brand-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 transition-all duration-200 backdrop-blur-sm transform hover:scale-[1.02]"
                        >
                            Sign in
                        </button>
                    </div>
                </form>

                {/* Footer inside the card for better visibility */}
                <div className="flex items-center justify-center gap-2 mt-6 opacity-80">
                    <span className="text-xs text-gray-300 font-medium uppercase tracking-wider">Powered by</span>
                    <span className="font-semibold text-white text-sm tracking-tight">RetailCraft</span>
                </div>
            </div>

            {/* Debug Connection Info - Fixed at bottom */}
            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                <div className="text-[10px] text-white/30 font-mono">
                    Server: {API_URL_DISPLAY}
                </div>
            </div>
        </div>
    );
}
