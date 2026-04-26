import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/client';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import BoardPage from '@/pages/BoardPage';
import DocsPage from '@/pages/DocsPage';
import OAuthClientsPage from '@/pages/OAuthClientsPage';
import ApiKeysPage from '@/pages/developer/ApiKeysPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { token, setAuth, logout } = useAuthStore();

  useEffect(() => {
    if (token) {
      authApi.me().then((user) => setAuth(user, token)).catch(() => logout());
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="board/:id" element={<BoardPage />} />

          {/* Developer section — routes accessible via sidebar when Dev Mode is ON */}
          <Route path="developer/keys" element={<ApiKeysPage />} />
          <Route path="developer/oauth" element={<OAuthClientsPage />} />
          <Route path="developer/docs" element={<DocsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
