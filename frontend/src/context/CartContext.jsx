import React, { createContext, useContext, useState, useEffect } from 'react';

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
      totalPrice 
    }}>
      {children}
    </CartContext.Provider>
  );
};
