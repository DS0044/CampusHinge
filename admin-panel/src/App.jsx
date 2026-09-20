import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminNav from './components/AdminNav';
import AdminLoginPage from './pages/AdminLoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import { getAdminToken } from './api';

function ProtectedLayout({ children }) {
  const token = getAdminToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-layout">
      <AdminNav />
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const token = getAdminToken();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/dashboard" replace /> : <AdminLoginPage />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              <DashboardPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedLayout>
              <UsersPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedLayout>
              <ReportsPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="*"
          element={<Navigate to={token ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
