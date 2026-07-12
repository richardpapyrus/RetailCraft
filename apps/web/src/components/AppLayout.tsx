'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublicPage = ['/login', '/register', '/', '/home'].includes(pathname);
    // Print-oriented document views render without the app shell so the
    // sidebar/header never appear on screen or in the printed output.
    const isPrintableReport = pathname?.startsWith('/reports/eod');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    if (isPublicPage || isPrintableReport) {
        return <div className="min-h-screen bg-canvas">{children}</div>;
    }

    return (
        <div className="flex h-screen bg-canvas overflow-hidden">
            {/* Desktop sidebar */}
            <div className="hidden md:flex h-full">
                <Sidebar />
            </div>

            {/* Mobile slide-in drawer */}
            {mobileNavOpen && (
                <div className="md:hidden">
                    <div
                        className="fixed inset-0 z-40 bg-charcoal/30 backdrop-blur-sm animate-fade-in"
                        onClick={() => setMobileNavOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 z-50 animate-slide-in-left">
                        <Sidebar mobile onNavigate={() => setMobileNavOpen(false)} />
                    </div>
                </div>
            )}

            <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
                <TopHeader onMenuClick={() => setMobileNavOpen(true)} />
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
