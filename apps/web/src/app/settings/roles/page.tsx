
'use client';

import { useState, useEffect } from 'react';
import { api, Role, PermissionGroup } from '@/lib/api';
import { Plus, Edit2, Trash2, X, Shield, Users } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissionsConfig, setPermissionsConfig] = useState<PermissionGroup[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentRole, setCurrentRole] = useState<Partial<Role>>({ permissions: [] });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [rolesData, permsData] = await Promise.all([
                api.roles.list(),
                api.roles.getPermissions()
            ]);
            setRoles(rolesData);
            setPermissionsConfig(permsData);
        } catch (error) {
            console.error('Failed to load roles/permissions', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && currentRole.id) {
                await api.roles.update(currentRole.id, currentRole);
            } else {
                await api.roles.create(currentRole as any);
            }
            setIsModalOpen(false);
            loadData(); // Reload all to refresh counts etc
        } catch (error) {
            alert('Failed to save role');
        }
    };

    const startEdit = (role: Role) => {
        setCurrentRole({ ...role });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const startCreate = () => {
        setCurrentRole({ name: '', description: '', permissions: [] });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this role?')) return;
        try {
            await api.roles.delete(id);
            loadData();
        } catch (error) {
            alert('Cannot delete role (it might be in use or is a system role)');
        }
    };

    const togglePermission = (code: string) => {
        const currentPerms = currentRole.permissions || [];
        if (currentPerms.includes(code)) {
            setCurrentRole({ ...currentRole, permissions: currentPerms.filter(p => p !== code) });
        } else {
            setCurrentRole({ ...currentRole, permissions: [...currentPerms, code] });
        }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="p-6 max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold">Roles</h1>
                            <p className="text-gray-500">Manage roles and their access privileges.</p>
                        </div>
                        <button
                            onClick={startCreate}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
                        >
                            <Plus size={20} />
                            Create Role
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-10">Loading roles...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {roles.map(role => (
                                <div key={role.id} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100 relative group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                            <Shield size={24} />
                                        </div>
                                        {role.isSystem ? (
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">System</span>
                                        ) : (
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                                <button onClick={() => startEdit(role)} className="p-1 hover:bg-gray-100 rounded text-blue-600"><Edit2 size={18} /></button>
                                                <button onClick={() => handleDelete(role.id)} className="p-1 hover:bg-gray-100 rounded text-red-600"><Trash2 size={18} /></button>
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">{role.name}</h3>
                                    <p className="text-sm text-gray-500 mb-4 h-10 line-clamp-2">{role.description || 'No description provided.'}</p>

                                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded">
                                        <Users size={16} />
                                        <span>{role._count?.users || 0} Users</span>
                                    </div>

                                    <div className="border-t pt-4">
                                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Permissions</span>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {role.permissions.includes('*') ? (
                                                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded">Full Access</span>
                                            ) : (
                                                <span className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded">
                                                    {role.permissions.length} Permissions
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{isEditing ? 'Edit Role' : 'Create Role'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                                    <input
                                        required
                                        value={currentRole.name}
                                        onChange={e => setCurrentRole({ ...currentRole, name: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                        placeholder="e.g. Sales Associate"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                        value={currentRole.description || ''}
                                        onChange={e => setCurrentRole({ ...currentRole, description: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                        placeholder="Role responsibilities..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">Permissions Matrix</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto border p-4 rounded-lg bg-gray-50">
                                    {permissionsConfig.map(group => (
                                        <div key={group.label} className="bg-white p-4 rounded-lg border shadow-sm">
                                            <h4 className="font-semibold text-gray-800 mb-3 border-b pb-2">{group.label}</h4>
                                            <div className="space-y-2">
                                                {group.permissions.map(permCode => (
                                                    <label key={permCode} className="flex items-start gap-3 p-1 hover:bg-gray-50 rounded cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={currentRole.permissions?.includes(permCode)}
                                                            onChange={() => togglePermission(permCode)}
                                                            className="mt-1 w-4 h-4 text-blue-600 rounded"
                                                        />
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-700 block">{permCode}</span>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Role</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
