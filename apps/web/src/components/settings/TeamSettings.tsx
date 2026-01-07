
"use client";

import { useEffect, useState } from 'react';
import { api, Role } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

export default function TeamSettings() {
    const { user: currentUser, selectedStoreId } = useAuth(); // Use reactive hook
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [roleId, setRoleId] = useState('');
    const [storeId, setStoreId] = useState('');

    const [stores, setStores] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersData, storesData, rolesData] = await Promise.all([
                api.users.list(selectedStoreId || undefined), // Use reactive ID
                api.stores.list(selectedStoreId || undefined),
                api.roles.list()
            ]);
            setUsers(usersData);
            setStores(storesData);
            setRoles(rolesData);

            if (storesData.length > 0) setStoreId(storesData[0].id);
            if (rolesData.length > 0) setRoleId(rolesData[0].id);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedStoreId]); // Re-fetch when store selection changes

    const handleCreate = async () => {
        if (!email || !password || !roleId) return;
        try {
            await api.users.create({
                name,
                email,
                password,
                roleId,
                storeId: storeId || undefined
            });
            setIsCreating(false);
            // Reset form
            setName('');
            setEmail('');
            setPassword('');
            fetchData(); // Reload all
        } catch (e) {
            alert('Failed to create user');
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
        try {
            await api.users.delete(userId);
            fetchData();
        } catch (e) {
            alert('Failed to delete user');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Team Members</h2>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    + Add User
                </button>
            </div>

            {isCreating && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="font-medium mb-4">New User</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input type="text" placeholder="Name" className="p-2 border rounded-lg" value={name} onChange={e => setName(e.target.value)} />
                        <input type="email" placeholder="Email" className="p-2 border rounded-lg" value={email} onChange={e => setEmail(e.target.value)} />
                        <input type="password" placeholder="Password" className="p-2 border rounded-lg" value={password} onChange={e => setPassword(e.target.value)} />

                        <select
                            className="p-2 border rounded-lg"
                            value={roleId}
                            onChange={e => {
                                const newRole = e.target.value;
                                setRoleId(newRole);
                                // If Admin, clear store selection
                                const role = roles.find(r => r.id === newRole);
                                if (role?.name === 'Administrator' || role?.name === 'Owner' || role?.name === 'Admin') {
                                    setStoreId('');
                                }
                            }}
                        >
                            <option value="">Select Role</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name} {r.isSystem ? '(System)' : ''}</option>
                            ))}
                        </select>

                        <div className="col-span-2">
                            <label className="text-xs text-gray-500 mb-1 block">Assigned Store</label>
                            <select
                                className="w-full p-2 border rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                                value={storeId}
                                onChange={e => setStoreId(e.target.value)}
                                disabled={(() => {
                                    const role = roles.find(r => r.id === roleId);
                                    return role?.name === 'Administrator' || role?.name === 'Owner' || role?.name === 'Admin';
                                })()}
                            >
                                <option value="">All Stores (Tenant Wide)</option>
                                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            {(() => {
                                const role = roles.find(r => r.id === roleId);
                                const isAdmin = role?.name === 'Administrator' || role?.name === 'Owner' || role?.name === 'Admin';
                                return isAdmin ? <p className="text-xs text-gray-500 mt-1">Global roles have access to all stores.</p> : null;
                            })()}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreate} className="bg-green-600 text-white px-4 py-2 rounded-lg">Save User</button>
                        <button onClick={() => setIsCreating(false)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg">Cancel</button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-200 text-gray-500 text-sm">
                            <th className="pb-3 font-medium">Name</th>
                            <th className="pb-3 font-medium">Email</th>
                            <th className="pb-3 font-medium">Role</th>
                            <th className="pb-3 font-medium">Store</th>
                            <th className="pb-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={5} className="py-4 text-center">Loading...</td></tr>
                        ) : users.map(user => {
                            const isSystemAdmin = user.roleDef?.name === 'Administrator' || user.role === 'ADMIN';
                            const isSelf = user.id === currentUser?.id;
                            const canDelete = !isSystemAdmin && !isSelf;

                            return (
                                <tr key={user.id} className="group hover:bg-gray-50">
                                    <td className="py-3 font-medium text-gray-900">{user.name || '-'}</td>
                                    <td className="py-3 text-gray-500 text-sm">{user.email}</td>
                                    <td className="py-3">
                                        <span className={`text-xs px-2 py-1 rounded-full ${user.roleDef?.isSystem ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {user.roleDef?.name || user.role}
                                        </span>
                                    </td>
                                    <td className="py-3 text-sm text-gray-600">{user.store?.name || 'All Locations'}</td>
                                    <td className="py-3 text-right">
                                        {canDelete ? (
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="text-red-600 hover:text-red-800 hover:underline text-sm font-medium"
                                            >
                                                Remove
                                            </button>
                                        ) : (
                                            <span className="text-gray-300 text-sm italic cursor-not-allowed" title={isSelf ? "Cannot delete yourself" : "Cannot delete Admin"}>
                                                Remove
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

