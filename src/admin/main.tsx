import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProxyPage } from './pages/ProxyPage';
import { ProxyConfigPage } from './pages/ProxyConfigPage';
import { AccountsPage } from './pages/AccountsPage';
import { LogsPage } from './pages/LogsPage';
import { AdminLayout } from './components/AdminLayout';
import '../App.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = checkAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/proxy" element={<ProxyPage />} />
          <Route path="/proxy-config" element={<ProxyConfigPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Route>

        {/* Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
