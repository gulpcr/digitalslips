/**
 * Edit User Modal
 * Admin modal to edit existing users
 */

import React, { useState, useEffect } from 'react';
import { FiX, FiUser, FiMail, FiPhone, FiBriefcase } from 'react-icons/fi';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';
import toast from 'react-hot-toast';
import { userService, UserResponse, UserUpdate } from '../services/user.service';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserResponse | null;
}

const ROLES = [
  { value: 'ADMIN', label: 'Administrator', description: 'Full system access' },
  { value: 'MANAGER', label: 'Manager', description: 'Branch-level management' },
  { value: 'TELLER', label: 'Teller', description: 'Transaction processing' },
  { value: 'AUDITOR', label: 'Auditor', description: 'Read-only audit access' },
];

const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserUpdate>({
    email: '',
    full_name: '',
    phone: '',
    role: 'TELLER',
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || '',
        role: user.role,
        is_active: user.is_active,
      });
    }
  }, [user]);

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.full_name?.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !user) {
      return;
    }

    setLoading(true);
    try {
      const submitData: UserUpdate = {
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone || undefined,
        role: formData.role,
        is_active: formData.is_active,
      };

      await userService.updateUser(user.id, submitData);
      toast.success('User updated successfully');
      onSuccess();
      handleClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to update user';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <Card padding="lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Edit User</h2>
              <p className="text-sm text-text-secondary mt-1">
                Update user information for <span className="font-medium">{user.username}</span>
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-text-secondary hover:text-text-primary"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username (read-only) */}
            <div className="mb-4">
              <Input
                label="Username"
                value={user.username}
                leftIcon={<FiUser />}
                fullWidth
                disabled
              />
              <p className="text-xs text-text-secondary mt-1">Username cannot be changed</p>
            </div>

            {/* Email */}
            <div className="mb-4">
              <Input
                label="Email"
                type="email"
                placeholder="Enter email address"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                leftIcon={<FiMail />}
                error={errors.email}
                fullWidth
                required
              />
            </div>

            {/* Full Name */}
            <div className="mb-4">
              <Input
                label="Full Name"
                placeholder="Enter full name"
                value={formData.full_name || ''}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                leftIcon={<FiUser />}
                error={errors.full_name}
                fullWidth
                required
              />
            </div>

            {/* Phone */}
            <div className="mb-4">
              <Input
                label="Phone (Optional)"
                placeholder="Enter phone number"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                leftIcon={<FiPhone />}
                fullWidth
              />
            </div>

            {/* Role Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Role <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((role) => (
                  <label
                    key={role.value}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                      formData.role === role.value
                        ? 'border-accent bg-accent-50'
                        : 'border-border hover:border-accent-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role.value}
                      checked={formData.role === role.value}
                      onChange={(e) =>
                        setFormData({ ...formData, role: e.target.value as UserUpdate['role'] })
                      }
                      className="sr-only"
                    />
                    <div className="flex items-center gap-2">
                      <FiBriefcase
                        className={`w-4 h-4 ${
                          formData.role === role.value ? 'text-accent' : 'text-text-secondary'
                        }`}
                      />
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            formData.role === role.value ? 'text-accent' : 'text-text-primary'
                          }`}
                        >
                          {role.label}
                        </p>
                        <p className="text-xs text-text-secondary">{role.description}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {errors.role && <p className="text-sm text-error mt-1">{errors.role}</p>}
            </div>

            {/* Active Status */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Account Status
              </label>
              <label
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                  formData.is_active ? 'border-success bg-success-50' : 'border-error bg-error-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-success focus:ring-success mr-3"
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      formData.is_active ? 'text-success' : 'text-error'
                    }`}
                  >
                    {formData.is_active ? 'Account Active' : 'Account Inactive'}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {formData.is_active
                      ? 'User can log in and use the system'
                      : 'User cannot log in to the system'}
                  </p>
                </div>
              </label>
            </div>

            {/* Locked Status Warning */}
            {user.is_locked && (
              <div className="mb-6 p-4 bg-warning-50 border border-warning rounded-lg">
                <p className="text-sm font-medium text-warning">Account Locked</p>
                <p className="text-xs text-text-secondary mt-1">
                  This account is locked due to multiple failed login attempts. Use the unlock
                  button on the user list to unlock it.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={handleClose} type="button">
                Cancel
              </Button>
              <Button variant="primary" fullWidth type="submit" loading={loading}>
                Update User
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default EditUserModal;
