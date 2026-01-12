import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface CategoryManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void; // Trigger refresh of parent categories
    tenantId?: string;
}

export default function CategoryManager({ isOpen, onClose, onUpdate }: CategoryManagerProps) {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newCategory, setNewCategory] = useState('');

    useEffect(() => {
        if (isOpen) loadCategories();
    }, [isOpen]);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const data = await api.categories.list();
            setCategories(data);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategory.trim()) return;
        try {
            await api.categories.create({ name: newCategory });
            toast.success('Category saved');
            setNewCategory('');
            loadCategories();
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || 'Failed to create');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? Products in this category will not be deleted but logic may break if not handled.')) return;
        try {
            await api.categories.delete(id);
            toast.success('Category deleted');
            loadCategories();
            onUpdate();
        } catch (e: any) {
            toast.error(e.message || 'Failed to delete');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">Manage Categories</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="p-4 border-b bg-gray-50">
                    <form onSubmit={handleAdd} className="flex gap-2">
                        <input
                            className="flex-1 border rounded px-3 py-2"
                            placeholder="New Category Name..."
                            value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                        />
                        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded font-medium hover:bg-indigo-700">
                            Add
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? <p className="text-center text-gray-500">Loading...</p> : (
                        categories.length === 0 ? <p className="text-center text-gray-500 italic">No categories found.</p> :
                            categories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center p-3 bg-white border rounded hover:border-indigo-300 group">
                                    <span className="font-medium">{cat.name}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-400">{cat._count?.products || 0} products</span>
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Category"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </div>
        </div>
    );
}
