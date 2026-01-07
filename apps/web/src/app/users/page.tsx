
"use client";

import { useEffect, useState } from 'react';
import { api, Role } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function UsersPage() {
    const { user, token, isHydrated } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');

    useEffect(() => {
        if (!isHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }
        // Basic check, ideally check permission 'MANAGE_USERS'
        if (user?.role !== 'ADMIN' && !user?.permissions?.includes('MANAGE_USERS')) {
            router.push('/dashboard');
            return;
        }
        loadData();
    }, [token, isHydrated, router, user]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, storesData, rolesData] = await Promise.all([
                api.users.list(),
                api.stores.list().catch(() => []),
                api.roles.list().catch(() => [])
            ]);
            setUsers(usersData);
            setStores(storesData);
            setRoles(rolesData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const data: any = Object.fromEntries(formData.entries());

        // Clean up
        if (!data.password) delete data.password;
        if (data.storeId === '') data.storeId = null;
        if (data.roleId === '') delete data.roleId;

        // Force Global Access for Admins
        if (data.roleId) {
            const selectedRole = roles.find(r => r.id === data.roleId);
            if (selectedRole?.name === 'Administrator' || selectedRole?.name === 'Owner' || selectedRole?.name === 'Admin') {
                data.storeId = null; // Enforce Global
            }
        }

        try {
            if (editingUser) {
                await api.users.update(editingUser.id, data);
            } else {
                await api.users.create(data);
            }
            setIsModalOpen(false);
            setEditingUser(null);
            loadData();
            toast.success(editingUser ? 'User Updated' : 'User Created');
        } catch (err) {
            console.error(err);
            toast.error('Failed to save user');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.users.delete(id);
            loadData();
            toast.success('User Deleted');
        } catch (e) {
            console.error(e);
            toast.error('Failed to delete user');
        }
    };

    if (loading || !isHydrated) return <div className="p-8">Loading...</div>;

    return (
        <div className="h-full bg-gray-50 overflow-y-auto">
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <button
                        onClick={() => {
                            setEditingUser(null);
                            setSelectedRoleId('');
                            setSelectedStoreId('');
                            setIsModalOpen(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold"
                    >
                        Add User
                    </button>
                </div>

                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-800`}>
                                            {u.roleDef?.name || u.role || 'No Role'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.store?.name || 'All Stores'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => {
                                                setEditingUser(u);
                                                setSelectedRoleId(u.roleId || '');
                                                setSelectedStoreId(u.storeId || '');
                                                setIsModalOpen(true);
                                            }}
                                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="text-red-600 hover:text-red-900"
                                            disabled={u.id === user?.id} // Cannot delete self
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MODAL */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                            <h2 className="text-xl font-bold mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                    <input name="name" defaultValue={editingUser?.name} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                    <input name="email" type="email" defaultValue={editingUser?.email} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Password {editingUser && '(Leave blank to keep current)'}</label>
                                    <input name="password" type="password" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" minLength={6} required={!editingUser} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Role</label>
                                    <select
                                        name="roleId"
                                        value={selectedRoleId}
                                        onChange={(e) => {
                                            const newRole = e.target.value;
                                            setSelectedRoleId(newRole);
                                            // If Admin, clear store selection
                                            const role = roles.find(r => r.id === newRole);
                                            const isAdmin = role?.name === 'Administrator' || role?.name === 'Owner' || role?.name === 'Admin';
                                            if (isAdmin) {
                                                setSelectedStoreId('');
                                            }
                                        }}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                        required
                                    >
                                        <option value="" disabled>Select a Role</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.name} {r.isSystem && '(System)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Assigned Store</label>
                                    <select
                                        name="storeId"
                                        value={selectedStoreId}
                                        onChange={(e) => setSelectedStoreId(e.target.value)}
                                        disabled={(() => {
                                            const role = roles.find(r => r.id === selectedRoleId);
                                            return role?.name === 'Administrator' || role?.name === 'Owner' || role?.name === 'Admin';
                                        })()}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border disabled:bg-gray-100 disabled:text-gray-500"
                                    >
                                        <option value="">All Stores (Tenant Wide)</option>
                                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    {(() => {
                                        const role = roles.find(r => r.id === selectedRoleId);
                                        const isAdmin = role?.name === 'Administrator' || role?.name === 'Owner' || role?.name === 'Admin';
                                        return isAdmin ? <p className="text-xs text-gray-500 mt-1">Global roles have access to all stores.</p> : null;
                                    })()}
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save User</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
