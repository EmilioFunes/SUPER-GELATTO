import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import './index.css';

// Lazy loading de páginas y componentes pesados para carga inicial ultrarrápida
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Home = lazy(() => import('./pages/Home'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Gelbot = lazy(() => import('./components/Gelbot'));

// Componente de Carga Ultraligero y Elegante
const PageLoader = () => (
  <div className="min-h-screen bg-[#070709] flex flex-col items-center justify-center text-white p-4">
    <div className="w-10 h-10 border-3 border-amber-400/20 border-t-amber-400 rounded-full animate-spin mb-3"></div>
    <span className="text-xs uppercase tracking-widest text-amber-400/80 font-medium">Cargando Super Gelatto...</span>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, user, onLogout }) => {
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <Navbar user={user} onLogout={onLogout} />
      {children}
      <Suspense fallback={null}>
        <Gelbot user={user} />
      </Suspense>
    </>
  );
};

// Admin Route Component (Verifica autenticación Y rol de Administrador de manera estricta)
const AdminRoute = ({ children, user, onLogout }) => {
  if (!user) return <Navigate to="/login" replace />;
  if (String(user.rol).trim() !== 'admin') return <Navigate to="/" replace />;
  return (
    <>
      <Navbar user={user} onLogout={onLogout} />
      {children}
      <Suspense fallback={null}>
        <Gelbot user={user} />
      </Suspense>
    </>
  );
};

function App() {
  const [user, setUser] = React.useState(() => {
    const saved = sessionStorage.getItem('superGelatto_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = React.useCallback((userData) => {
    setUser(prev => {
      const updated = prev ? { ...prev, ...userData } : userData;
      sessionStorage.setItem('superGelatto_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleLogout = React.useCallback(() => {
    setUser(null);
    localStorage.removeItem('superGelatto_user');
    localStorage.removeItem('superGelatto_token');
    sessionStorage.removeItem('superGelatto_user');
    sessionStorage.removeItem('superGelatto_token');
    sessionStorage.removeItem('superGelatto_face_verified');
    sessionStorage.removeItem('superGelatto_face_verified_at');
  }, []);

  // Limpieza de sesiones antiguas/incompletas (sin ID de base de datos)
  React.useEffect(() => {
    if (user && !user.id && !user.id_usuario) {
      handleLogout();
    }
  }, [user, handleLogout]);

  return (
    <CartProvider user={user}>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Auth Routes */}
            <Route
              path="/login"
              element={<Login onLogin={handleLogin} />}
            />
            <Route
              path="/register"
              element={user ? <Navigate to="/" /> : <Register />}
            />
            <Route
              path="/forgot-password"
              element={user ? <Navigate to="/" /> : <ForgotPassword />}
            />
            <Route
              path="/reset-password/:token"
              element={user ? <Navigate to="/" /> : <ResetPassword />}
            />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute user={user} onLogout={handleLogout}>
                  <Home user={user} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/productos"
              element={
                <ProtectedRoute user={user} onLogout={handleLogout}>
                  <ProductsPage user={user} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute user={user} onLogout={handleLogout}>
                  <ProfilePage user={user} onUpdateUser={handleLogin} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute user={user} onLogout={handleLogout}>
                  <CheckoutPage user={user} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute user={user} onLogout={handleLogout}>
                  <AdminDashboard user={user} onLogout={handleLogout} />
                </AdminRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Router>
    </CartProvider>
  );
}

export default App;
