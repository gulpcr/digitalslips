/**
 * Create User Modal
 * Admin modal to create new users
 */

import React, { useState } from 'react';
import { FiX, FiUser, FiMail, FiLock, FiPhone, FiBriefcase } from 'react-icons/fi';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';
import toast from 'react-hot-toast';
import { userService, UserCreate } from '../services/user.service';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES = [
  { value: 'ADMIN', label: 'Administrator', description: 'Full system access' },
  { value: 'MANAGER', label: 'Manager', description: 'Branch-level management' },
  { value: 'TELLER', label: 'Teller', description: 'Transaction processing' },
  { value: 'AUDITOR', label: 'Auditor', description: 'Read-only audit access' },
];

const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserCreate>({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'TELLER',
    branch_id: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: 'TELLER',
      branch_id: '',
    });
    setConfirmPassword('');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain an uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Password must contain a lowercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain a digit';
    }

    if (formData.password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        ...formData,
        phone: formData.phone || undefined,
        branch_id: formData.branch_id || undefined,
      };

      await userService.createUser(submitData);
      toast.success('User created successfully');
      onSuccess();
      handleClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to create user';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <Card padding="lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Create New User</h2>
              <p className="text-sm text-text-secondary mt-1">
                Add a new user to the system
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
            {/* Username */}
            <div className="mb-4">
              <Input
                label="Username"
                placeholder="Enter username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })
                }
                leftIcon={<FiUser />}
                error={errors.username}
                fullWidth
                required
              />
            </div>

            {/* Email */}
            <div className="mb-4">
              <Input
                label="Email"
                type="email"
                placeholder="Enter email address"
                value={formData.email}
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
                value={formData.full_name}
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
                        setFormData({ ...formData, role: e.target.value as UserCreate['role'] })
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

            {/* Password */}
            <div className="mb-4">
              <Input
                label="Password"
                type="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                leftIcon={<FiLock />}
                error={errors.password}
                fullWidth
                required
              />
              <p className="text-xs text-text-secondary mt-1">
                Min 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            {/* Confirm Password */}
            <div className="mb-6">
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<FiLock />}
                error={errors.confirmPassword}
                fullWidth
                required
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={handleClose} type="button">
                Cancel
              </Button>
              <Button variant="primary" fullWidth type="submit" loading={loading}>
                Create User
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CreateUserModal;
