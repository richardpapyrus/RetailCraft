'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Home, Settings, HelpCircle, FileText, ShoppingCart, Package, Users, Truck, LayoutDashboard, Calculator } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const SIDEBAR_ITEMS = [
    {
        category: 'Getting Started',
        items: [
            { name: 'Introduction', href: '/', icon: Home },
            { name: 'Installation', href: '/how-to/installation', icon: Settings },
            { name: 'Business Setup', href: '/how-to/business-setup', icon: BookOpen },
        ],
    },
    {
        category: 'Modules',
        items: [
            { name: 'Dashboard', href: '/how-to/dashboard', icon: LayoutDashboard },
            { name: 'Point of Sale (POS)', href: '/how-to/pos', icon: ShoppingCart },
            { name: 'Products', href: '/how-to/products', icon: Package },
            { name: 'Customers', href: '/how-to/customers', icon: Users },
            { name: 'Suppliers', href: '/how-to/suppliers', icon: Truck },
            { name: 'Sales History', href: '/how-to/sales', icon: FileText },
            { name: 'Tills', href: '/how-to/tills', icon: Calculator },
            { name: 'Settings', href: '/how-to/settings', icon: Settings },
        ],
    },
    {
        category: 'Support',
        items: [
            { name: 'FAQ', href: '/faq', icon: HelpCircle },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 border-r border-gray-200 bg-white overflow-y-auto">
            <div className="p-6">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">R</span>
                    </div>
                    <span className="font-bold text-xl text-gray-900">RetailCraft</span>
                </div>

                <nav className="space-y-8">
                    {SIDEBAR_ITEMS.map((section) => (
                        <div key={section.category}>
                            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                                {section.category}
                            </h2>
                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                                                isActive
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            )}
                                        >
                                            <item.icon className={cn('w-4 h-4', isActive ? 'text-blue-700' : 'text-gray-400')} />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>
        </aside>
    );
}
