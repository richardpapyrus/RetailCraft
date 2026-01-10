import { useState, useEffect } from 'react';
import { DataService } from '@/lib/db-service';
import { Product } from '@/lib/api';
import { Search, Package, AlertCircle, Plus, Filter, LayoutGrid, List as ListIcon } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface ProductPickerProps {
    onSelect: (product: Product) => void;
    storeId?: string;
    className?: string;
}

export function ProductPicker({ onSelect, storeId, className = "" }: ProductPickerProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default to List

    useEffect(() => {
        loadProducts(debouncedSearch);
    }, [debouncedSearch, storeId]);

    const loadProducts = async (term: string) => {
        setLoading(true);
        try {
            const { data } = await DataService.getProducts(0, 50, { search: term }, storeId || undefined);
            setProducts(data || []);
        } catch (e) {
            console.error("Failed to load products", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col h-full bg-slate-50 border-r border-slate-200 ${className}`}>
            {/* Header / Search */}
            <div className="p-4 bg-white border-b border-gray-100 shadow-sm z-10">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 uppercase tracking-wide">
                        <Package className="w-4 h-4 text-indigo-600" />
                        Inventory
                    </h3>
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={14} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                            title="List View"
                        >
                            <ListIcon size={14} />
                        </button>
                    </div>
                </div>
                <div className="relative group">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all focus:bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 space-y-3">
                        <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <span className="text-xs font-medium">Loading...</span>
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 px-6 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="font-medium text-gray-500">No products found</p>
                        <p className="text-xs mt-1 text-gray-400">Try adjusting your search</p>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-3" : "space-y-1"}>
                        {products.map((product) => {
                            const stock = product.inventory?.reduce((acc: any, curr: any) => acc + curr.quantity, 0) || 0;
                            const isLow = stock <= (product.minStockLevel || 0);

                            if (viewMode === 'list') {
                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => onSelect(product)}
                                        className="w-full flex items-center p-2 bg-white hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 rounded-lg transition-all group text-left h-14"
                                    >
                                        <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center text-gray-300 mr-3 flex-shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0 pr-3">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-gray-800 text-sm truncate group-hover:text-indigo-900">{product.name}</span>
                                                <span className="font-bold text-gray-900 text-sm ml-2">${Number(product.price).toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <span className="text-[10px] text-gray-400 font-mono truncate">{product.sku}</span>
                                                <span className={`text-[10px] font-bold ${isLow ? 'text-amber-600' : 'text-green-600'} flex items-center gap-1`}>
                                                    {isLow && <AlertCircle size={10} />}
                                                    {stock} units
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            }

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => onSelect(product)}
                                    className="flex flex-col bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg hover:border-indigo-300 hover:-translate-y-1 transition-all duration-300 overflow-hidden group text-left h-full relative"
                                >
                                    <div className="h-20 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative w-full group-hover:from-indigo-50/50 group-hover:to-white transition-colors">
                                        <Package className="w-8 h-8 text-gray-300 group-hover:text-indigo-500 transition-all transform group-hover:scale-110 duration-500" />
                                        {isLow && (
                                            <div className="absolute top-2 right-2 bg-amber-100 ring-4 ring-white text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Low
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col w-full relative">
                                        <h4 className="font-semibold text-gray-800 text-xs sm:text-sm line-clamp-2 min-h-[2.5em] group-hover:text-indigo-700 transition-colors">{product.name}</h4>
                                        <div className="mt-3 flex justify-between items-end w-full">
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-mono tracking-tighter">{product.sku}</p>
                                                <p className={`text-[10px] font-bold mt-1 ${isLow ? 'text-amber-600' : 'text-green-600'}`}>
                                                    {stock} units
                                                </p>
                                            </div>
                                            <div className="bg-gray-50 text-gray-600 px-2 py-1 rounded-md text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                                Add
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="p-3 border-t border-gray-100 text-center text-[10px] text-gray-400 bg-gray-50/50">
                Found {products.length} products
            </div>
        </div>
    );
}
