import { Search, Bell, ArrowLeft } from 'lucide-react';

export function Header() {
    return (
        <header className="h-16 border-b border-gray-200 bg-white px-8 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4 w-1/3">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search documentation..."
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <a href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md hover:bg-gray-50 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back to App
                </a>
                <div className="h-6 w-px bg-gray-200"></div>
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                    <Bell className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 bg-gray-200 rounded-full border border-gray-300"></div>
            </div>
        </header>
    );
}
