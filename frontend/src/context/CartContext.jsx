import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const formatPrice = (price) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

export const CartProvider = ({ children, user }) => {
  const userId = user?.id; // Usar el ID de la base de datos
  const [cart, setCart] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Efecto para CARGAR el carrito correcto cuando cambia el usuario (login/logout)
  useEffect(() => {
    const storageKey = userId ? `superGelatto_cart_${userId}` : 'superGelatto_cart_guest';
    const saved = localStorage.getItem(storageKey);
    setCart(saved ? JSON.parse(saved) : []);
    setIsLoaded(true);
  }, [userId]);

  // Efecto para GUARDAR el carrito cuando cambia su contenido o el usuario
  useEffect(() => {
    if (!isLoaded) return;
    const storageKey = userId ? `superGelatto_cart_${userId}` : 'superGelatto_cart_guest';
    localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, userId, isLoaded]);

  const addToCart = (product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return removeFromCart(productId);
    setCart(prev =>
      prev.map(item => (item.id === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + ((item.precio || item.price || 0) * item.quantity), 0);

  return (
    <CartContext.Provider value={{ 
      cart, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart, 
      totalItems, 
      totalPrice,
      showToast
    }}>
      {children}

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-24 right-4 sm:right-8 z-[200] max-w-sm px-5 py-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-bold ${
              toast.type === 'error' 
                ? 'bg-red-950/90 border-red-500/40 text-red-200 shadow-red-950/50' 
                : toast.type === 'info'
                ? 'bg-blue-950/90 border-blue-500/40 text-blue-200 shadow-blue-950/50'
                : 'bg-[#0d0a1a]/95 border-gold-premium/40 text-gold-premium shadow-gold-premium/20'
            }`}
          >
            <span className="text-lg">{toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '🍦'}</span>
            <span className="leading-tight flex-1 text-left">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-white/40 hover:text-white p-1">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </CartContext.Provider>
  );
};
