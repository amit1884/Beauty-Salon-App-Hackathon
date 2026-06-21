import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import SalonDetailPage from './pages/SalonDetailPage';
import LoginPage from './pages/LoginPage';
import BookingsPage from './pages/BookingsPage';
import AccountPage from './pages/AccountPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-stone-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-stone-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'owner' && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-stone-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-stone-500">Loading…</p>;
  if (user?.role === 'owner') return <Navigate to="/dashboard" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return <HomePage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomeRoute />} />
            <Route path="dashboard" element={
              <OwnerRoute><OwnerDashboardPage /></OwnerRoute>
            } />
            <Route path="admin" element={
              <AdminRoute><AdminPage /></AdminRoute>
            } />
            <Route path="salons/:id" element={<SalonDetailPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="account" element={
              <ProtectedRoute><AccountPage /></ProtectedRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
