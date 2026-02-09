/**
 * Login Page - Full Implementation
 * Authentication with JWT tokens
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, setLoading } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setIsLoggingIn(true);
    setLoading(true);

    try {
      const response = await authService.login({ username, password });

      if (response.success) {
        // Store auth data
        setAuth(response.user, response.access_token, response.refresh_token);

        toast.success(`Welcome, ${response.user.full_name}!`);
        navigate('/dashboard');
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      const message = error.response?.data?.detail || error.message || 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoggingIn(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-full mb-4">
            <span className="text-2xl font-bold text-white">PR</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Precision Receipt</h1>
          <p className="text-gray-300 mt-2">Meezan Bank - Digital Transaction System</p>
        </div>

        {/* Login Card */}
        <Card padding="lg" shadow="lg">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-text-primary">Sign In</h2>
            <p className="text-text-secondary mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-error-50 border border-error rounded-lg text-error text-sm">
                {error}
              </div>
            )}

            {/* Username */}
            <Input
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leftIcon={<FiUser />}
              fullWidth
              autoComplete="username"
            />

            {/* Password */}
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<FiLock />}
                fullWidth
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-[38px] text-text-secondary hover:text-text-primary"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isLoggingIn}
              className="mt-6"
            >
              {isLoggingIn ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-text-secondary text-center mb-2">Demo Credentials:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-center">
              <div className="p-2 bg-background-light rounded">
                <p className="font-medium">Admin</p>
                <p className="text-text-secondary">admin / Admin@123456</p>
              </div>
              <div className="p-2 bg-background-light rounded">
                <p className="font-medium">Teller</p>
                <p className="text-text-secondary">teller / Teller@123</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-400 text-sm">
          <p>2024 Meezan Bank Pakistan</p>
          <p className="mt-1">
            Powered by <span className="text-accent">eDimensionz</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
