/**
 * Admin Layout Component
 * Sidebar navigation for admin pages
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiUsers,
  FiBarChart2,
  FiMapPin,
  FiLogOut,
  FiMenu,
  FiX,
  FiChevronLeft,
} from 'react-icons/fi';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <FiHome />, roles: ['ADMIN', 'MANAGER', 'TELLER', 'AUDITOR'] },
  { id: 'reports', label: 'Reports', path: '/reports', icon: <FiBarChart2 />, roles: ['ADMIN', 'MANAGER', 'TELLER', 'AUDITOR'] },
  { id: 'users', label: 'Users', path: '/admin/users', icon: <FiUsers />, roles: ['ADMIN'] },
  { id: 'branches', label: 'Branches', path: '/admin/branches', icon: <FiMapPin />, roles: ['ADMIN'] },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, subtitle, icon }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userRole = user?.role?.toUpperCase() || 'TELLER';

  // Filter nav items by role
  const availableNavItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  // Check if current path matches nav item
  const isActive = (path: string) => location.pathname === path;

  // Logout handler
  const handleLogout = () => {
    clearAuth();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background-light">
      {/* Mobile Header */}
      <div className="lg:hidden shadow-md">
        <div className="bg-white px-4 py-2.5 flex items-center justify-center border-b-2 border-gold">
          <img src="/assets/meezan-logo.png" alt="Meezan Bank" className="h-8 w-auto" />
        </div>
        <div className="bg-gradient-to-r from-primary-700 to-primary text-white flex items-center justify-between px-4 py-2.5">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
          <span className="text-sm font-semibold tracking-wide">Precision Receipt</span>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <FiLogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-72 h-full bg-gradient-to-b from-primary-700 to-primary text-white shadow-2xl animate-slide-in-left" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white px-4 py-3.5 border-b-2 border-gold">
              <img src="/assets/meezan-logo.png" alt="Meezan Bank" className="h-9 w-auto" />
            </div>
            <nav className="p-4 mt-2">
              {availableNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1.5 transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-white/15 text-white border-l-3 border-gold shadow-sm'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Mobile user info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-sm font-bold text-gold">
                  {getInitials(user?.full_name || 'U')}
                </div>
                <div>
                  <p className="font-medium text-sm">{user?.full_name || 'User'}</p>
                  <p className="text-xs text-white/50">{user?.role || 'TELLER'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <FiLogOut className="w-4 h-4" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden lg:flex flex-col bg-gradient-to-b from-primary-700 to-primary text-white transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-20'
          }`}
          style={{ minHeight: 'calc(100vh)' }}
        >
          {/* Logo */}
          {sidebarOpen ? (
            <div>
              <div className="bg-white px-4 py-3.5 flex items-center justify-between">
                <img src="/assets/meezan-logo.png" alt="Meezan Bank" className="h-9 w-auto" />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
                >
                  <FiChevronLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="h-0.5 bg-gradient-to-r from-gold-600 via-gold to-gold-600"></div>
            </div>
          ) : (
            <div>
              <div className="bg-white py-3.5 px-2 flex items-center justify-center">
                <img src="/assets/meezan-logo.png" alt="Meezan Bank" className="h-9 w-9 object-contain object-left" />
              </div>
              <div className="h-0.5 bg-gold"></div>
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-full flex justify-center py-2.5 text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <FiChevronLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 mt-2">
            {sidebarOpen && (
              <p className="text-xs text-white/40 uppercase tracking-wider font-semibold px-4 mb-3">Navigation</p>
            )}
            {availableNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg mb-1 transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-white/15 text-white shadow-sm border-l-3 border-gold'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="text-lg">{item.icon}</span>
                {sidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-white/10">
            {sidebarOpen ? (
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-sm font-bold text-gold flex-shrink-0">
                  {getInitials(user?.full_name || 'U')}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{user?.full_name || 'User'}</p>
                  <p className="text-xs text-white/50">{user?.role || 'TELLER'}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center mb-3">
                <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-xs font-bold text-gold">
                  {getInitials(user?.full_name || 'U')}
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
              title={!sidebarOpen ? 'Logout' : undefined}
            >
              <FiLogOut className="w-4 h-4" />
              {sidebarOpen && <span className="text-sm">Logout</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen flex flex-col">
          {/* Desktop Header */}
          <header className="hidden lg:block bg-white border-b border-border">
            <div className="px-8 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {icon && (
                    <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                      <span className="text-xl text-primary">{icon}</span>
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-text-primary">{title}</h1>
                    {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-sm text-text-primary">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-text-secondary">{user?.role || 'TELLER'}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary-50 border-2 border-primary-100 flex items-center justify-center text-sm font-bold text-primary">
                    {getInitials(user?.full_name || 'U')}
                  </div>
                </div>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
          </header>

          {/* Page Content */}
          <div className="flex-1 p-4 lg:p-8">
            {children}
          </div>

          {/* Footer */}
          <footer className="bg-white border-t border-border">
            <div className="px-4 lg:px-8 py-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-sm text-text-secondary">
                <p>2024 Meezan Bank. All rights reserved.</p>
                <p>Built by <span className="text-accent font-medium">eDimensionz</span></p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
