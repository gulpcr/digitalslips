/**
 * Login Page
 * Demonstrates authentication UI with design system
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import Button from '@components/ui/Button';
import Card from '@components/ui/Card';
import Input from '@components/ui/Input';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // For demo purposes, accept any non-empty credentials
      if (formData.username && formData.password) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        toast.error('Please enter username and password');
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Precision Receipt</h1>
          <p className="text-text-secondary">Meezan Bank - Digital Transaction System</p>
        </div>

        {/* Login Card */}
        <Card padding="lg" shadow="lg">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-primary">Welcome Back</h2>
            <p className="text-sm text-text-secondary mt-1">
              Sign in to access your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username or Email"
              type="text"
              placeholder="Enter your username"
              leftIcon={<FiMail />}
              fullWidth
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              leftIcon={<FiLock />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="focus:outline-none"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              }
              fullWidth
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                Remember me
              </label>
              <a href="#" className="text-sm text-accent hover:text-accent-600 font-medium">
                Forgot password?
              </a>
            </div>

            <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-text-secondary text-center">
              Default credentials for demo:{' '}
              <span className="text-primary font-medium">admin / Admin@123456</span>
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-text-secondary">
          <p>
            © 2024 Meezan Bank. Built by{' '}
            <span className="text-accent font-medium">eDimensionz</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
