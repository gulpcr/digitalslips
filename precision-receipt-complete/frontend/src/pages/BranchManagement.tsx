/**
 * Branch Management Page
 * Admin page for managing bank branches
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiMapPin,
  FiPlus,
  FiEdit2,
  FiSearch,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiPhone,
  FiMail,
  FiHome,
} from 'react-icons/fi';
import AdminLayout from '../components/layout/AdminLayout';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Table from '../components/ui/Table';
import toast from 'react-hot-toast';
import { branchService, BranchCreate, BranchUpdate } from '../services/branch.service';
import { Branch } from '../types';

const BRANCH_TYPES = [
  { value: 'MAIN', label: 'Main Branch', description: 'Head office' },
  { value: 'REGIONAL', label: 'Regional', description: 'Regional hub' },
  { value: 'SUB', label: 'Sub Branch', description: 'Local branch' },
];

const BranchManagement: React.FC = () => {
  // State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState<BranchCreate>({
    branch_code: '',
    branch_name: '',
    branch_type: 'SUB',
    region: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Pakistan',
    phone: '',
    email: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState<BranchUpdate>({});

  // Load branches
  const loadBranches = useCallback(async () => {
    try {
      setLoading(true);
      const params: { is_active?: boolean } = {};

      if (statusFilter !== '') {
        params.is_active = statusFilter === 'active';
      }

      const data = await branchService.getBranches(params);
      setBranches(data);
    } catch (error) {
      toast.error('Failed to load branches');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Initial load
  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Filter branches by search query
  const filteredBranches = branches.filter((b) => {
    const query = searchQuery.toLowerCase();
    return (
      b.branch_code.toLowerCase().includes(query) ||
      b.branch_name.toLowerCase().includes(query) ||
      b.city.toLowerCase().includes(query) ||
      (b.region && b.region.toLowerCase().includes(query))
    );
  });

  // Handle create branch
  const handleCreateBranch = async () => {
    if (!createForm.branch_code || !createForm.branch_name || !createForm.address || !createForm.city || !createForm.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    setModalLoading(true);
    try {
      await branchService.createBranch(createForm);
      toast.success('Branch created successfully');
      setShowCreateModal(false);
      setCreateForm({
        branch_code: '',
        branch_name: '',
        branch_type: 'SUB',
        region: '',
        address: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Pakistan',
        phone: '',
        email: '',
      });
      loadBranches();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to create branch');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle edit branch
  const handleEditBranch = async () => {
    if (!editingBranch) return;

    setModalLoading(true);
    try {
      await branchService.updateBranch(editingBranch.id, editForm);
      toast.success('Branch updated successfully');
      setShowEditModal(false);
      setEditingBranch(null);
      setEditForm({});
      loadBranches();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to update branch');
    } finally {
      setModalLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setEditForm({
      branch_name: branch.branch_name,
      branch_type: branch.branch_type as 'MAIN' | 'SUB' | 'REGIONAL',
      region: branch.region || '',
      address: branch.address,
      city: branch.city,
      state: branch.state || '',
      postal_code: branch.postal_code || '',
      country: branch.country,
      phone: branch.phone,
      email: branch.email || '',
      is_active: branch.is_active,
    });
    setShowEditModal(true);
  };

  // Handle toggle active
  const handleToggleActive = async (branch: Branch) => {
    const action = branch.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} branch "${branch.branch_name}"?`)) return;

    try {
      if (branch.is_active) {
        await branchService.deactivateBranch(branch.id);
      } else {
        await branchService.activateBranch(branch.id);
      }
      toast.success(`Branch ${action}d successfully`);
      loadBranches();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || `Failed to ${action} branch`);
    }
  };

  // Get branch type color
  const getBranchTypeColor = (type: string) => {
    switch (type) {
      case 'MAIN':
        return 'text-error bg-error-50 border-error';
      case 'REGIONAL':
        return 'text-warning bg-warning-50 border-warning';
      case 'SUB':
        return 'text-accent bg-accent-50 border-accent';
      default:
        return 'text-text-secondary bg-gray-100 border-border';
    }
  };

  // Stats
  const stats = {
    total: branches.length,
    active: branches.filter((b) => b.is_active).length,
    main: branches.filter((b) => b.branch_type === 'MAIN').length,
    regional: branches.filter((b) => b.branch_type === 'REGIONAL').length,
  };

  return (
    <AdminLayout title="Branch Management" subtitle="Manage bank branches" icon={<FiMapPin />}>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card hover shadow="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text-secondary font-medium">Total Branches</p>
              <h3 className="text-2xl font-bold text-text-primary mt-2">{stats.total}</h3>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg">
              <FiMapPin className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>
        <Card hover shadow="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text-secondary font-medium">Active</p>
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
              <p className="text-sm text-text-secondary font-medium">Main Branches</p>
              <h3 className="text-2xl font-bold text-error mt-2">{stats.main}</h3>
            </div>
            <div className="p-3 bg-error-50 rounded-lg">
              <FiHome className="w-6 h-6 text-error" />
            </div>
          </div>
        </Card>
        <Card hover shadow="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text-secondary font-medium">Regional</p>
              <h3 className="text-2xl font-bold text-warning mt-2">{stats.regional}</h3>
            </div>
            <div className="p-3 bg-warning-50 rounded-lg">
              <FiMapPin className="w-6 h-6 text-warning" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <Input
              placeholder="Search by code, name, city, or region..."
              leftIcon={<FiSearch />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
            />
          </div>
          <div className="flex gap-2">
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
          <Button variant="outline" leftIcon={<FiRefreshCw />} onClick={loadBranches}>
            Refresh
          </Button>
          <Button
            variant="primary"
            leftIcon={<FiPlus />}
            onClick={() => setShowCreateModal(true)}
          >
            Add Branch
          </Button>
        </div>
      </Card>

      {/* Branches Table */}
      <Card>
        <div className="pb-4 mb-4 border-b border-border">
          <h3 className="text-lg font-bold text-text-primary">Bank Branches</h3>
          <p className="text-sm text-text-secondary mt-1">
            {loading ? 'Loading...' : `${filteredBranches.length} branches found`}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-text-secondary">Loading branches...</p>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            {searchQuery || statusFilter
              ? 'No branches found matching your filters.'
              : 'No branches found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table striped hoverable>
              <Table.Head>
                <Table.Row>
                  <Table.Cell header>Branch</Table.Cell>
                  <Table.Cell header>Type</Table.Cell>
                  <Table.Cell header>Location</Table.Cell>
                  <Table.Cell header>Contact</Table.Cell>
                  <Table.Cell header>Status</Table.Cell>
                  <Table.Cell header>Actions</Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {filteredBranches.map((branch) => (
                  <Table.Row key={branch.id}>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-text-primary">{branch.branch_name}</p>
                        <p className="text-xs text-accent font-mono">{branch.branch_code}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getBranchTypeColor(branch.branch_type)}`}>
                        {branch.branch_type}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <p className="text-sm text-text-primary">{branch.city}</p>
                        <p className="text-xs text-text-secondary">{branch.region || branch.state || '-'}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <p className="text-sm text-text-primary flex items-center gap-1">
                          <FiPhone className="w-3 h-3" /> {branch.phone}
                        </p>
                        {branch.email && (
                          <p className="text-xs text-text-secondary flex items-center gap-1">
                            <FiMail className="w-3 h-3" /> {branch.email}
                          </p>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
                          branch.is_active
                            ? 'text-success bg-success-50 border-success'
                            : 'text-error bg-error-50 border-error'
                        }`}
                      >
                        {branch.is_active ? <><FiCheck className="w-3 h-3" /> Active</> : <><FiX className="w-3 h-3" /> Inactive</>}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" leftIcon={<FiEdit2 />} onClick={() => openEditModal(branch)}>
                          Edit
                        </Button>
                        <Button
                          variant={branch.is_active ? 'outline' : 'ghost'}
                          size="sm"
                          onClick={() => handleToggleActive(branch)}
                          className={branch.is_active ? '!text-error !border-error' : ''}
                        >
                          {branch.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </Card>

      {/* Create Branch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <Card padding="lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary">Add New Branch</h2>
                  <p className="text-sm text-text-secondary mt-1">Create a new bank branch</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-text-secondary hover:text-text-primary">
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Branch Code *"
                  placeholder="e.g., KHI-001"
                  value={createForm.branch_code}
                  onChange={(e) => setCreateForm({ ...createForm, branch_code: e.target.value.toUpperCase() })}
                  fullWidth
                />
                <Input
                  label="Branch Name *"
                  placeholder="e.g., Clifton Branch"
                  value={createForm.branch_name}
                  onChange={(e) => setCreateForm({ ...createForm, branch_name: e.target.value })}
                  fullWidth
                />

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-2">Branch Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BRANCH_TYPES.map((type) => (
                      <label
                        key={type.value}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                          createForm.branch_type === type.value ? 'border-primary bg-primary-50' : 'border-border hover:border-primary-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="branch_type"
                          value={type.value}
                          checked={createForm.branch_type === type.value}
                          onChange={(e) => setCreateForm({ ...createForm, branch_type: e.target.value as 'MAIN' | 'SUB' | 'REGIONAL' })}
                          className="sr-only"
                        />
                        <div>
                          <p className={`text-sm font-medium ${createForm.branch_type === type.value ? 'text-primary' : 'text-text-primary'}`}>
                            {type.label}
                          </p>
                          <p className="text-xs text-text-secondary">{type.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Input
                    label="Address *"
                    placeholder="Full address"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    fullWidth
                  />
                </div>

                <Input
                  label="City *"
                  placeholder="e.g., Karachi"
                  value={createForm.city}
                  onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Region"
                  placeholder="e.g., South"
                  value={createForm.region || ''}
                  onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })}
                  fullWidth
                />
                <Input
                  label="State/Province"
                  placeholder="e.g., Sindh"
                  value={createForm.state || ''}
                  onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Postal Code"
                  placeholder="e.g., 75600"
                  value={createForm.postal_code || ''}
                  onChange={(e) => setCreateForm({ ...createForm, postal_code: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Phone *"
                  placeholder="e.g., 021-1234567"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  leftIcon={<FiPhone />}
                  fullWidth
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="branch@meezanbank.com"
                  value={createForm.email || ''}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  leftIcon={<FiMail />}
                  fullWidth
                />

                <div className="md:col-span-2 flex gap-3 pt-4">
                  <Button variant="outline" fullWidth onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" fullWidth onClick={handleCreateBranch} loading={modalLoading}>
                    Create Branch
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {showEditModal && editingBranch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <Card padding="lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-primary">Edit Branch</h2>
                  <p className="text-sm text-text-secondary mt-1">Update: {editingBranch.branch_code}</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-text-secondary hover:text-text-primary">
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Branch Code"
                  value={editingBranch.branch_code}
                  fullWidth
                  disabled
                />
                <Input
                  label="Branch Name"
                  placeholder="e.g., Clifton Branch"
                  value={editForm.branch_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, branch_name: e.target.value })}
                  fullWidth
                />

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-primary mb-2">Branch Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BRANCH_TYPES.map((type) => (
                      <label
                        key={type.value}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                          editForm.branch_type === type.value ? 'border-primary bg-primary-50' : 'border-border hover:border-primary-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="edit_branch_type"
                          value={type.value}
                          checked={editForm.branch_type === type.value}
                          onChange={(e) => setEditForm({ ...editForm, branch_type: e.target.value as 'MAIN' | 'SUB' | 'REGIONAL' })}
                          className="sr-only"
                        />
                        <div>
                          <p className={`text-sm font-medium ${editForm.branch_type === type.value ? 'text-primary' : 'text-text-primary'}`}>
                            {type.label}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Input
                    label="Address"
                    placeholder="Full address"
                    value={editForm.address || ''}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    fullWidth
                  />
                </div>

                <Input
                  label="City"
                  placeholder="e.g., Karachi"
                  value={editForm.city || ''}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Region"
                  placeholder="e.g., South"
                  value={editForm.region || ''}
                  onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                  fullWidth
                />
                <Input
                  label="Phone"
                  placeholder="e.g., 021-1234567"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  leftIcon={<FiPhone />}
                  fullWidth
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="branch@meezanbank.com"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  leftIcon={<FiMail />}
                  fullWidth
                />

                <div className="md:col-span-2">
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
                        {editForm.is_active ? 'Branch Active' : 'Branch Inactive'}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {editForm.is_active ? 'Branch is operational' : 'Branch is not operational'}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="md:col-span-2 flex gap-3 pt-4">
                  <Button variant="outline" fullWidth onClick={() => setShowEditModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" fullWidth onClick={handleEditBranch} loading={modalLoading}>
                    Update Branch
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

export default BranchManagement;
