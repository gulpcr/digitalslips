/**
 * Login Page - Full Implementation
 * Authentication with JWT tokens
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi';
import Button from '../components/ui/Button';
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
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary to-primary-600 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-white/5 rounded-full"></div>
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gold/5 rounded-full"></div>
        <div className="absolute bottom-1/3 right-1/5 w-48 h-48 bg-accent/5 rounded-full"></div>
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          {/* Gold top accent */}
          <div className="h-1 bg-gradient-to-r from-gold-600 via-gold to-gold-600"></div>

          <div className="p-8">
            {/* Logo inside card */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-5">
                <img src="/assets/meezan-logo.png" alt="Meezan Bank" className="h-14 w-auto" />
              </div>
              <div className="w-12 h-0.5 bg-gold mx-auto mb-5"></div>
              <h2 className="text-2xl font-serif font-bold text-text-primary">Precision Receipt</h2>
              <p className="text-text-secondary text-sm mt-1.5">Digital Transaction System</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-error-50 border border-error/30 rounded-lg text-error text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-error rounded-full flex-shrink-0"></span>
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
                  className="absolute right-3 top-[38px] text-text-secondary hover:text-text-primary transition-colors"
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
                rightIcon={!isLoggingIn ? <FiArrowRight /> : undefined}
                className="mt-6 !py-2.5"
              >
                {isLoggingIn ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs text-text-secondary text-center mb-3 uppercase tracking-wider font-medium">Demo Credentials</p>
              <div className="grid grid-cols-2 gap-3 text-xs text-center">
                <div className="p-3 bg-primary-50 rounded-lg border border-primary-100">
                  <p className="font-semibold text-primary">Admin</p>
                  <p className="text-text-secondary mt-1">admin / Admin@123456</p>
                </div>
                <div className="p-3 bg-accent-50 rounded-lg border border-accent-100">
                  <p className="font-semibold text-accent">Teller</p>
                  <p className="text-text-secondary mt-1">teller / Teller@123</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-white/50 text-sm">
          <p>2024 Meezan Bank Pakistan</p>
          <p className="mt-1">
            Powered by <span className="text-gold">eDimensionz</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
