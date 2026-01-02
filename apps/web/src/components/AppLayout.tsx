'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublicPage = ['/login', '/register', '/'].includes(pathname);

    if (isPublicPage) {
        return <div className="min-h-screen bg-gray-50">{children}</div>;
    }

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {children}
            </main>
        </div>
    );
}
