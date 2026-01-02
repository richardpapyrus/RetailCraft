"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import {
    LayoutDashboard,
    ShoppingCart,
    Tags,
    Users,
    Truck,
    Banknote,
    Calculator,
    Settings,
    LogOut,
    Shield
} from 'lucide-react';
import { StoreSelector } from './StoreSelector';

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { logout, user, hasPermission } = useAuth();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    if (pathname === '/login') return null;

    const allMenuItems = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null },
        { name: 'POS', href: '/pos', icon: ShoppingCart, permission: 'PROCESS_SALES' },
        { name: 'Products', href: '/products', icon: Tags, permission: 'VIEW_PRODUCTS' },
        { name: 'Customers', href: '/customers', icon: Users, permission: 'MANAGE_CUSTOMERS' },
        { name: 'Suppliers', href: '/suppliers', icon: Truck, permission: 'MANAGE_SUPPLIERS' },
        { name: 'Sales', href: '/sales', icon: Banknote, permission: 'VIEW_SALES' },
        { name: 'Tills', href: '/tills', icon: Calculator, permission: 'MANAGE_TILLS' },
        { name: 'Team', href: '/users', icon: Shield, permission: 'MANAGE_USERS' },
        { name: 'Settings', href: '/settings', icon: Settings, permission: 'MANAGE_SETTINGS' },
    ];

    const menuItems = allMenuItems.filter(item =>
        !item.permission || hasPermission(item.permission)
    );

    return (
        <div className="w-20 bg-white flex flex-col items-center py-6 h-full shrink-0 transition-all duration-300 hover:w-64 group z-20 shadow-xl border-r border-gray-100 print:hidden">
            {/* Logo Area */}
            <div className="mb-4 flex flex-col items-center overflow-hidden">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-2 shadow-sm transform transition-transform group-hover:scale-105 p-1 border border-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
                </div>
                {/* Logo Text - Hidden initially */}
                <span className="font-bold text-lg text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap mb-2">
                    RetailCraft
                </span>

                {/* Global Store Selector - Only visible on hover/expand for better UX */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-full px-2">
                    <StoreSelector />
                </div>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 w-full space-y-2 px-3">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`
                                flex items-center px-3 py-3 rounded-xl transition-all duration-200
                                ${isActive
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                    : 'text-gray-400 hover:bg-indigo-50 hover:text-indigo-600'
                                }
                                group/item relative overflow-hidden
                            `}
                        >
                            <span className="w-6 h-6 flex items-center justify-center shrink-0">
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            </span>

                            <span className={`ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300 opacity-0 group-hover:opacity-100 absolute left-12 group-hover:relative group-hover:left-0`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* User Profile Info */}
            <div className="mt-auto px-3 w-full mb-2">
                <div className="flex items-center px-1 py-2 rounded-xl border border-transparent group-hover:bg-indigo-50/50 transition-colors overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0 border-2 border-white shadow-sm">
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="ml-3 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center">
                        <p className="text-sm font-bold text-gray-900 truncate leading-none">{user?.name || 'User'}</p>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{user?.role || 'Staff'}</p>
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="px-3 w-full space-y-2 mb-4">
                <button onClick={handleLogout} className="flex items-center px-3 py-3 w-full rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors group/logout">
                    <span className="w-6 h-6 flex items-center justify-center shrink-0">
                        <LogOut size={20} />
                    </span>
                    <span className="ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300 opacity-0 group-hover:opacity-100">
                        Switch User
                    </span>
                </button>
            </div>
        </div>
    );
}
