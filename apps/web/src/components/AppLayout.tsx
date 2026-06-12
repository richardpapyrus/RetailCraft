'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublicPage = ['/login', '/register', '/', '/home'].includes(pathname);

    if (isPublicPage) {
        return <div className="min-h-screen bg-canvas">{children}</div>;
    }

    return (
        <div className="flex h-screen bg-canvas overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <TopHeader />
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
