/**
 * Main App Component
 * Precision Receipt - Meezan Bank
 */

import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import DRIDLookupModal from './components/DRIDLookupModal';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import CustomerDeposit from './pages/CustomerDeposit';
import DemoSetup from './pages/DemoSetup';
import UserManagement from './pages/UserManagement';
import Reports from './pages/Reports';
import BranchManagement from './pages/BranchManagement';
import ReceiptVerification from './pages/ReceiptVerification';
import MobileDemo from './pages/MobileDemo';
import Settings from './pages/Settings';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

/**
 * Extension Config Pusher - pushes system settings to Chrome extension on login
 */
const ExtensionConfigPusher: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch extension settings from backend and push to Chrome extension
    import('./services/settings.service').then(({ settingsService }) => {
      settingsService.getExtensionSettings().then(({ data }) => {
        window.postMessage({
          type: 'DDS_EXTENSION_CONFIG',
          config: {
            transactUrl: data.transact_url,
            autoOpenTransact: data.auto_open_transact === 'true',
            t24Version: data.t24_version,
          },
        }, '*');
      }).catch(() => {}); // Silently fail if settings endpoint unavailable
    });
  }, [isAuthenticated]);

  return null;
};

/**
 * Global DRID Lookup Modal - listens for Chrome Extension custom event on all pages
 */
const GlobalDRIDModal: React.FC = () => {
  const [isDRIDModalOpen, setIsDRIDModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleExtensionOpen = () => setIsDRIDModalOpen(true);
    window.addEventListener('dds-open-drid-modal', handleExtensionOpen);
    return () => window.removeEventListener('dds-open-drid-modal', handleExtensionOpen);
  }, []);

  return (
    <DRIDLookupModal
      isOpen={isDRIDModalOpen}
      onClose={() => setIsDRIDModalOpen(false)}
      onComplete={(transactionId) => {
        setIsDRIDModalOpen(false);
        if (transactionId) {
          navigate(`/dashboard`);
        }
      }}
    />
  );
};

/**
 * IdleTimer - auto-logout after 15 minutes of inactivity
 */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const IDLE_CHECK_INTERVAL_MS = 30 * 1000; // check every 30s

const IdleTimer: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        clearAuth();
        navigate('/login');
        toast.error('Session expired due to inactivity');
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearInterval(interval);
    };
  }, [isAuthenticated, clearAuth, navigate]);

  return null;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background-light">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            {/* Customer-facing deposit slip initiation */}
            <Route path="/deposit" element={<CustomerDeposit />} />
            <Route path="/customer/deposit" element={<CustomerDeposit />} />
            {/* Demo setup page */}
            <Route path="/demo" element={<DemoSetup />} />
            <Route path="/setup" element={<DemoSetup />} />
            {/* Bank Islami CIO Mobile Demo */}
            <Route path="/demo/mobile" element={<MobileDemo />} />
            {/* Admin pages */}
            <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/branches" element={<ProtectedRoute><BranchManagement /></ProtectedRoute>} />
            {/* Reports */}
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            {/* Settings (Admin only) */}
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            {/* Public receipt verification page */}
            <Route path="/verify/:receiptNumber" element={<ReceiptVerification />} />
          </Routes>
        </div>

        {/* Inactivity auto-logout timer */}
        <IdleTimer />

        {/* Push extension config to Chrome extension on login */}
        <ExtensionConfigPusher />

        {/* Global DRID Modal - works on all pages via Chrome Extension pill button */}
        <GlobalDRIDModal />
      </Router>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#FFFFFF',
            color: '#0F172A',
            boxShadow: '0 4px 6px -1px rgba(11, 31, 59, 0.08)',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: '#16A34A',
              secondary: '#FFFFFF',
            },
          },
          error: {
            iconTheme: {
              primary: '#DC2626',
              secondary: '#FFFFFF',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
