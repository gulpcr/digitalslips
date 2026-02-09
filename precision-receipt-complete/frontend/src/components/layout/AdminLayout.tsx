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
  const isAdmin = userRole === 'ADMIN';

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

  return (
    <div className="min-h-screen bg-background-light">
      {/* Mobile Header */}
      <div className="lg:hidden bg-primary text-white shadow-md">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            {mobileMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2">
            {icon}
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg"
          >
            <FiLogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-64 h-full bg-primary text-white" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10">
              <h2 className="text-xl font-bold">Precision Receipt</h2>
              <p className="text-sm text-gray-300 mt-1">Meezan Bank</p>
            </div>
            <nav className="p-4">
              {availableNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                    isActive(item.path)
                      ? 'bg-accent text-white'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden lg:flex flex-col bg-primary text-white transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-20'
          }`}
          style={{ minHeight: 'calc(100vh)' }}
        >
          {/* Logo */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h2 className="text-xl font-bold">Precision Receipt</h2>
                <p className="text-sm text-gray-300 mt-1">Meezan Bank</p>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg"
            >
              <FiChevronLeft className={`w-5 h-5 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            {availableNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive(item.path)
                    ? 'bg-accent text-white'
                    : 'text-gray-300 hover:bg-white/10'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="text-xl">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-white/10">
            {sidebarOpen && (
              <div className="mb-3">
                <p className="font-medium">{user?.full_name || 'User'}</p>
                <p className="text-sm text-gray-300">{user?.role || 'TELLER'}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
              title={!sidebarOpen ? 'Logout' : undefined}
            >
              <FiLogOut className="w-5 h-5" />
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          {/* Desktop Header */}
          <header className="hidden lg:block bg-white border-b border-border shadow-sm">
            <div className="px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {icon && <span className="text-2xl text-accent">{icon}</span>}
                  <div>
                    <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
                    {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium text-text-primary">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-text-secondary">{user?.role || 'TELLER'}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 lg:p-8">
            {children}
          </div>

          {/* Footer */}
          <footer className="bg-white border-t border-border mt-auto">
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
