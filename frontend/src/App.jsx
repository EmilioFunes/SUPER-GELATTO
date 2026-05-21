import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import ProductsPage from './pages/ProductsPage';
import ProfilePage from './pages/ProfilePage';
import CheckoutPage from './pages/CheckoutPage';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';
import Gelbot from './components/Gelbot';
import './index.css';

// Protected Route Component
const ProtectedRoute = ({ children, user, onLogout }) => {
  if (!user) return <Navigate to="/login" />;
  return (
    <>
      <Navbar user={user} onLogout={onLogout} />
      {children}
      <Gelbot user={user} />
    </>
  );
};

function App() {
  const [user, setUser] = React.useState(() => {
    const saved = sessionStorage.getItem('superGelatto_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (userData) => {
    setUser(prev => {
      const updated = prev ? { ...prev, ...userData } : userData;
      sessionStorage.setItem('superGelatto_user', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('superGelatto_user');
  };

  // Limpieza de sesiones antiguas/incompletas (sin ID de base de datos)
  React.useEffect(() => {
    if (user && !user.id) {
      handleLogout();
    }
  }, [user]);

  return (
    <CartProvider user={user}>
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />}
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
              <ProtectedRoute user={user} onLogout={handleLogout}>
                <AdminDashboard user={user} />
              </ProtectedRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </CartProvider>
  );
}

export default App;
