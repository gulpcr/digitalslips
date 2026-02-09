/**
 * User Management Page
 * Admin page for managing system users
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiUsers,
  FiUserPlus,
  FiEdit2,
  FiLock,
  FiUnlock,
  FiSearch,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiShield,
  FiUser,
  FiMail,
  FiPhone,
  FiBriefcase,
} from 'react-icons/fi';
import AdminLayout from '../components/layout/AdminLayout';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Table from '../components/ui/Table';
import toast from 'react-hot-toast';
import { userService, UserResponse, UserCreate, UserUpdate } from '../services/user.service';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';

const ROLES = [
  { value: 'ADMIN', label: 'Administrator', description: 'Full system access' },
  { value: 'MANAGER', label: 'Manager', description: 'Branch-level management' },
  { value: 'TELLER', label: 'Teller', description: 'Transaction processing' },
  { value: 'AUDITOR', label: 'Auditor', description: 'Read-only audit access' },
];

const UserManagement: React.FC = () => {
  const { user } = useAuthStore();

  // State
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState<UserCreate>({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'TELLER',
  });
  const [confirmPassword, setConfirmPassword] = useState('');

  // Edit form state
  const [editForm, setEditForm] = useState<UserUpdate>({});

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | boolean | undefined> = {};

      if (roleFilter) {
        params.role = roleFilter;
      }
      if (statusFilter !== '') {
        params.is_active = statusFilter === 'active';
      }

      const data = await userService.getUsers(params);
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load users');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter]);

  // Initial load
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter users by search query
  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.full_name.toLowerCase().includes(query)
    );
  });

  // Handle create user
  const handleCreateUser = async () => {
    if (!createForm.username || !createForm.email || !createForm.password || !createForm.full_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (createForm.password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (createForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setModalLoading(true);
    try {
      await userService.createUser(createForm);
      toast.success('User created successfully');
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        full_name: '',
        phone: '',
        role: 'TELLER',
      });
      setConfirmPassword('');
      loadUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle edit user
  const handleEditUser = async () => {
    if (!editingUser) return;

    setModalLoading(true);
    try {
      await userService.updateUser(editingUser.id, editForm);
      toast.success('User updated successfully');
      setShowEditModal(false);
      setEditingUser(null);
      setEditForm({});
      loadUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to update user');
    } finally {
      setModalLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (userToEdit: UserResponse) => {
    setEditingUser(userToEdit);
    setEditForm({
      email: userToEdit.email,
      full_name: userToEdit.full_name,
      phone: userToEdit.phone || '',
      role: userToEdit.role,
      is_active: userToEdit.is_active,
    });
    setShowEditModal(true);
  };

  // Handle unlock
  const handleUnlock = async (userId: string, username: string) => {
    if (!window.confirm(`Unlock account for "${username}"?`)) return;

    try {
      await userService.unlockUser(userId);
      toast.success(`Account unlocked for ${username}`);
      loadUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to unlock account');
    }
  };

  // Handle toggle active
  const handleToggleActive = async (userToToggle: UserResponse) => {
    const action = userToToggle.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} account for "${userToToggle.username}"?`)) return;

    try {
      if (userToToggle.is_active) {
        await userService.deactivateUser(userToToggle.id);
      } else {
        await userService.activateUser(userToToggle.id);
      }
      toast.success(`Account ${action}d for ${userToToggle.username}`);
      loadUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || `Failed to ${action} account`);
    }
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return 'text-error bg-error-50 border-error';
      case 'MANAGER':
        return 'text-warning bg-warning-50 border-warning';
      case 'TELLER':
        return 'text-accent bg-accent-50 border-accent';
      default:
        return 'text-text-secondary bg-gray-100 border-border';
    }
  };

  // Stats
  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    locked: users.filter((u) => u.is_locked).length,
    admins: users.filter((u) => u.role?.toUpperCase() === 'ADMIN').length,
  };

  return (
    <AdminLayout
      title="User Management"
      subtitle="Manage system users and access"
      icon={<FiShield />}
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card hover shadow="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text-secondary font-medium">Total Users</p>
                <h3 className="text-2xl font-bold text-text-primary mt-2">{stats.total}</h3>
              </div>
              <div className="p-3 bg-primary-50 rounded-lg">
                <FiUsers className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card hover shadow="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text-secondary font-medium">Active Users</p>
                <h3 className="text-2xl font-bold text-success mt-2">{stats.active}</h3>
              </div>
              <div className="p-3 bg-success-50 rounded-lg">
                <FiCheck className="w-6 h-6 text-success" />
              </div>
            </div>
          </Card>
          <Card hover shadow="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text-secondary font-medium">Locked Accounts</p>
                <h3 className="text-2xl font-bold text-error mt-2">{stats.locked}</h3>
              </div>
              <div className="p-3 bg-error-50 rounded-lg">
                <FiLock className="w-6 h-6 text-error" />
              </div>
            </div>
          </Card>
          <Card hover shadow="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text-secondary font-medium">Administrators</p>
                <h3 className="text-2xl font-bold text-warning mt-2">{stats.admins}</h3>
              </div>
              <div className="p-3 bg-warning-50 rounded-lg">
                <FiShield className="w-6 h-6 text-warning" />
              </div>
            </div>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card className="mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Input
                placeholder="Search by username, email, or name..."
                leftIcon={<FiSearch />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                fullWidth
              />
            </div>
            <div className="flex gap-2">
              <select
                className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="TELLER">Teller</option>
                <option value="AUDITOR">Auditor</option>
              </select>
              <select
                className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <Button variant="outline" leftIcon={<FiRefreshCw />} onClick={loadUsers}>
              Refresh
            </Button>
            <Button
              variant="primary"
              leftIcon={<FiUserPlus />}
              onClick={() => setShowCreateModal(true)}
            >
              Add User
            </Button>
          </div>
        </Card>

        {/* Users Table */}
        <Card>
          <div className="pb-4 mb-4 border-b border-border">
            <h3 className="text-lg font-bold text-text-primary">System Users</h3>
            <p className="text-sm text-text-secondary mt-1">
              {loading ? 'Loading...' : `${filteredUsers.length} users found`}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-text-secondary">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              {searchQuery || roleFilter || statusFilter
                ? 'No users found matching your filters.'
                : 'No users found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">User</th>
                    <th className="px-4 py-3 text-left font-semibold">Role</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Last Login</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-border">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-primary-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-text-primary">{u.full_name}</p>
                          <p className="text-xs text-text-secondary">@{u.username}</p>
                          <p className="text-xs text-text-secondary">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getRoleColor(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
                              u.is_active
                                ? 'text-success bg-success-50 border-success'
                                : 'text-error bg-error-50 border-error'
                            }`}
                          >
                            {u.is_active ? <><FiCheck className="w-3 h-3" /> Active</> : <><FiX className="w-3 h-3" /> Inactive</>}
                          </span>
                          {u.is_locked && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border text-warning bg-warning-50 border-warning">
                              <FiLock className="w-3 h-3" /> Locked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-text-secondary">
                          {u.last_login_at ? format(new Date(u.last_login_at), 'MMM dd, yyyy HH:mm') : 'Never'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" leftIcon={<FiEdit2 />} onClick={() => openEditModal(u)}>
                            Edit
                          </Button>
                          {u.is_locked && (
                            <Button variant="outline" size="sm" leftIcon={<FiUnlock />} onClick={() => handleUnlock(u.id, u.username)}>
                              Unlock
                            </Button>
                          )}
                          {u.id !== user?.id && (
                            <Button
                              variant={u.is_active ? 'outline' : 'ghost'}
                              size="sm"
                              leftIcon={u.is_active ? <FiLock /> : <FiUnlock />}
                              onClick={() => handleToggleActive(u)}
                              className={u.is_active ? '!text-error !border-error' : ''}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <Card padding="lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary">Create New User</h2>
                  <p className="text-sm text-text-secondary mt-1">Add a new user to the system</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-text-secondary hover:text-text-primary">
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Username *"
                  placeholder="Enter username"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  leftIcon={<FiUser />}
                  fullWidth
                />
                <Input
                  label="Email *"
                  type="email"
                  placeholder="Enter email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  leftIcon={<FiMail />}
                  fullWidth
                />
                <Input
                  label="Full Name *"
                  placeholder="Enter full name"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  leftIcon={<FiUser />}
                  fullWidth
                />
                <Input
                  label="Phone"
                  placeholder="Enter phone number"
                  value={createForm.phone || ''}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  leftIcon={<FiPhone />}
                  fullWidth
                />

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Role *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((role) => (
                      <label
                        key={role.value}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                          createForm.role === role.value ? 'border-primary bg-primary-50' : 'border-border hover:border-primary-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role.value}
                          checked={createForm.role === role.value}
                          onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserCreate['role'] })}
                          className="sr-only"
                        />
                        <div className="flex items-center gap-2">
                          <FiBriefcase className={`w-4 h-4 ${createForm.role === role.value ? 'text-primary' : 'text-text-secondary'}`} />
                          <div>
                            <p className={`text-sm font-medium ${createForm.role === role.value ? 'text-primary' : 'text-text-primary'}`}>
                              {role.label}
                            </p>
                            <p className="text-xs text-text-secondary">{role.description}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <Input
                  label="Password *"
                  type="password"
                  placeholder="Enter password (min 8 chars)"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  leftIcon={<FiLock />}
                  fullWidth
                />
                <Input
                  label="Confirm Password *"
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<FiLock />}
                  fullWidth
                />

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" fullWidth onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" fullWidth onClick={handleCreateUser} loading={modalLoading}>
                    Create User
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <Card padding="lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary">Edit User</h2>
                  <p className="text-sm text-text-secondary mt-1">Update user: {editingUser.username}</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-text-secondary hover:text-text-primary">
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Username"
                  value={editingUser.username}
                  leftIcon={<FiUser />}
                  fullWidth
                  disabled
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="Enter email"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  leftIcon={<FiMail />}
                  fullWidth
                />
                <Input
                  label="Full Name"
                  placeholder="Enter full name"
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  leftIcon={<FiUser />}
                  fullWidth
                />
                <Input
                  label="Phone"
                  placeholder="Enter phone number"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  leftIcon={<FiPhone />}
                  fullWidth
                />

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((role) => (
                      <label
                        key={role.value}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                          editForm.role === role.value ? 'border-primary bg-primary-50' : 'border-border hover:border-primary-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="editRole"
                          value={role.value}
                          checked={editForm.role === role.value}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserUpdate['role'] })}
                          className="sr-only"
                        />
                        <div className="flex items-center gap-2">
                          <FiBriefcase className={`w-4 h-4 ${editForm.role === role.value ? 'text-primary' : 'text-text-secondary'}`} />
                          <div>
                            <p className={`text-sm font-medium ${editForm.role === role.value ? 'text-primary' : 'text-text-primary'}`}>
                              {role.label}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Status</label>
                  <label
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                      editForm.is_active ? 'border-success bg-success-50' : 'border-error bg-error-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                      className="w-5 h-5 rounded border-border text-success focus:ring-success mr-3"
                    />
                    <div>
                      <p className={`text-sm font-medium ${editForm.is_active ? 'text-success' : 'text-error'}`}>
                        {editForm.is_active ? 'Account Active' : 'Account Inactive'}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {editForm.is_active ? 'User can log in' : 'User cannot log in'}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" fullWidth onClick={() => setShowEditModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" fullWidth onClick={handleEditUser} loading={modalLoading}>
                    Update User
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default UserManagement;
