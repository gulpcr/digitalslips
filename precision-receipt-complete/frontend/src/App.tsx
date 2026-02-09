/**
 * Main App Component
 * Precision Receipt - Meezan Bank
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import CustomerDeposit from './pages/CustomerDeposit';
import DemoSetup from './pages/DemoSetup';
import UserManagement from './pages/UserManagement';
import Reports from './pages/Reports';
import BranchManagement from './pages/BranchManagement';
import ReceiptVerification from './pages/ReceiptVerification';

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
            {/* Admin pages */}
            <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/branches" element={<ProtectedRoute><BranchManagement /></ProtectedRoute>} />
            {/* Reports */}
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            {/* Public receipt verification page */}
            <Route path="/verify/:receiptNumber" element={<ReceiptVerification />} />
          </Routes>
        </div>
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
