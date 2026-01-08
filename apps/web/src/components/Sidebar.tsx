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
    Shield,
    Pin,
    PinOff
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { StoreSelector } from './StoreSelector';


export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { logout, user, hasPermission, selectedStoreId } = useAuth();
    const [isPinned, setIsPinned] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('sidebar-pinned');
        if (stored === 'true') setIsPinned(true);
    }, []);

    const togglePin = () => {
        const newState = !isPinned;
        setIsPinned(newState);
        localStorage.setItem('sidebar-pinned', String(newState));
    };

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    if (pathname === '/login') return null;

    const allMenuItems = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'VIEW_DASHBOARD' },
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
        <div className={`
            bg-white flex flex-col items-center py-6 h-full shrink-0 transition-all duration-300 z-20 shadow-xl border-r border-gray-100 print:hidden group
            ${isPinned ? 'w-72' : 'w-24 hover:w-72'}
        `}>
            {/* Logo Area */}
            {/* Branding Header */}
            <div className="mb-2 flex flex-col w-full pt-4 relative">

                {/* Product Branding (Persistent) */}
                <div className={`flex items-center justify-center w-full mb-6 transition-all duration-300 ${isPinned ? 'px-4 justify-start' : 'group-hover:px-4 group-hover:justify-start'}`}>
                    <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-md shadow-indigo-200 shrink-0 z-20 relative overflow-hidden p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.jpg" alt="RC" className="w-full h-full object-cover rounded-xl bg-white" />
                    </div>

                    {/* Product Name (Slide out) */}
                    <div className={`
                        ml-3 overflow-hidden transition-all duration-300 
                        ${isPinned
                            ? 'opacity-100 w-auto'
                            : 'opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto'
                        }
                    `}>
                        <span className="font-extrabold text-xl text-gray-900 tracking-tight whitespace-nowrap">
                            RetailCraft
                        </span>
                    </div>
                </div>

                {/* Business Branding (Expanded Only) */}
                <div className={`
                    w-full px-3 mb-2 transition-all duration-300 
                    ${isPinned
                        ? 'opacity-100 block'
                        : 'opacity-0 hidden group-hover:opacity-100 group-hover:block'
                    }
                `}>
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 group/biz">
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1 block">
                            Organization
                        </span>

                        <div className="flex items-center gap-2">
                            {user?.tenantLogo && (
                                <img src={user.tenantLogo} alt="Biz" className="w-6 h-6 object-contain rounded-sm" />
                            )}
                            <h3 className="font-bold text-sm leading-tight truncate"
                                style={{ color: user?.tenantBrandColor || '#1f2937' }}>
                                {user?.tenantName || 'My Business'}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Store Context (Expanded Only) */}
                <div className={`
                    w-full px-3 transition-all duration-300
                    ${isPinned
                        ? 'opacity-100 block'
                        : 'opacity-0 hidden group-hover:opacity-100 group-hover:block'
                    }
                `}>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1 block px-1">
                        Location
                    </span>
                    <StoreSelector />
                </div>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 w-full space-y-2 px-3">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    // Global View Lock: Disable POS if no store selected
                    const isGlobalView = !selectedStoreId;
                    const isDisabled = item.name === 'POS' && isGlobalView;

                    if (isDisabled) {
                        return (
                            <div
                                key={item.name}
                                className="flex items-center px-3 py-3 rounded-xl text-gray-300 cursor-not-allowed group/item relative overflow-hidden"
                                title="Select a store to access POS"
                            >
                                <span className="w-6 h-6 flex items-center justify-center shrink-0">
                                    <Icon size={20} strokeWidth={2} />
                                </span>
                                <span className={`
                                    ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300
                                    ${isPinned
                                        ? 'opacity-100 relative left-0'
                                        : 'opacity-0 absolute left-12 group-hover:opacity-100 group-hover:relative group-hover:left-0'
                                    }
                                `}>
                                    {item.name}
                                </span>
                            </div>
                        );
                    }

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

                            <span className={`
                                ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300
                                ${isPinned
                                    ? 'opacity-100 relative left-0'
                                    : 'opacity-0 absolute left-12 group-hover:opacity-100 group-hover:relative group-hover:left-0'
                                }
                            `}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* User Profile Info */}
            <div className="mt-auto px-3 w-full mb-2">
                <div className="flex items-center px-1 py-2 rounded-xl border border-transparent hover:bg-indigo-50/50 transition-colors overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0 border-2 border-white shadow-sm">
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className={`
                        ml-3 overflow-hidden transition-opacity duration-300 flex flex-col justify-center
                        ${isPinned
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }
                    `}>
                        <p className="text-sm font-bold text-gray-900 truncate leading-none">{user?.name || 'User'}</p>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{user?.role || 'Staff'}</p>
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="px-3 w-full space-y-2 mb-4">
                {/* Pin Toggle */}
                <button
                    onClick={togglePin}
                    className={`
                        flex items-center px-3 py-2 w-full rounded-xl transition-colors group/pin
                        ${isPinned ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}
                    `}
                    title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
                >
                    <span className="w-6 h-6 flex items-center justify-center shrink-0">
                        {isPinned ? <PinOff size={20} /> : <Pin size={20} />}
                    </span>
                    <span className={`
                        ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300
                        ${isPinned
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }
                    `}>
                        {isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
                    </span>
                </button>

                <button onClick={handleLogout} className="flex items-center px-3 py-3 w-full rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors group/logout">
                    <span className="w-6 h-6 flex items-center justify-center shrink-0">
                        <LogOut size={20} />
                    </span>
                    <span className={`
                        ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300
                        ${isPinned
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }
                    `}>
                        Logout
                    </span>
                </button>
            </div>
        </div>
    );
}
