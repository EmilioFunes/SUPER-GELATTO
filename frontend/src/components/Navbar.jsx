import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, LogOut, User, Menu, X, Star, RotateCcw } from 'lucide-react';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';
import '../styles/Navbar.css';

const Navbar = ({ user, onLogout }) => {
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { totalItems } = useCart();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Inicio', path: '/' },
    { name: 'Productos', path: '/productos' },
    { name: 'Perfil', path: '/perfil' },
  ];

  if (user && String(user.rol).trim() === 'admin') {
    navLinks.push({ name: 'Admin', path: '/admin' });
  }

  const scrollToBuilder = () => {
    setIsMobileMenuOpen(false);
    const el = document.getElementById('gelato-builder-360');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = '/#gelato-builder-360';
    }
  };

  const scrollToSuperPoints = () => {
    setIsMobileMenuOpen(false);
    const el = document.getElementById('super-points-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = '/#super-points-section';
    }
  };

  return (
    <>
      <nav className={`fixed top-0 w-full h-[80px] flex items-center z-[100] transition-all duration-500 ${
        scrolled 
          ? 'bg-background-dark/95 backdrop-blur-xl border-b border-white/10 shadow-2xl' 
          : 'bg-background-dark/60 backdrop-blur-sm'
      }`}>
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 flex justify-between items-center">
          {/* Logo - Fixed width for centering balance */}
          <div className="flex-1 flex justify-start">
            <Link to="/" className="flex items-center group relative min-h-[44px]">
              <img 
                src="/images/LOGO-GELATTO.png" 
                alt="super gelatto" 
                className="navbar-logo-pop" 
              />
            </Link>
          </div>

          {/* Desktop Navigation - Centered */}
          <div className="hidden md:flex items-center justify-center gap-6 lg:gap-10 flex-[2]">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`text-sm font-medium transition-colors hover:text-gold-premium ${
                  location.pathname === link.path ? 'text-gold-premium' : 'text-white/70'
                }`}
              >
                {link.name}
              </Link>
            ))}
            {/* 360 Builder Button */}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={scrollToBuilder}
              className="flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-full bg-background-dark/40 backdrop-blur-md border border-amber-400/20 text-amber-300 text-xs font-bold hover:border-amber-400/50 hover:bg-amber-400/10 transition-all duration-300 min-h-[40px]"
            >
              <RotateCcw size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
              <span className="tracking-wide">GELATO 360°</span>
            </motion.button>

            {/* SuperPoints Button */}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={scrollToSuperPoints}
              className="flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-full bg-background-dark/40 backdrop-blur-md border border-yellow-400/20 text-yellow-300 text-xs font-bold hover:border-yellow-400/50 hover:bg-yellow-400/10 transition-all duration-300 min-h-[40px]"
            >
              <Star size={14} className="fill-yellow-300/80 text-yellow-300" />
              <span className="tracking-wide">SUPERPOINTS</span>
            </motion.button>
          </div>

          {/* User Info & Cart - Fixed width for centering balance */}
          <div className="flex-1 hidden md:flex items-center justify-end gap-5 lg:gap-8">
            {/* SuperPoints Badge */}
            <div className="flex items-center gap-2 px-3 lg:px-4 py-1.5 bg-gold-premium/5 border border-gold-premium/10 rounded-full group hover:border-gold-premium/30 transition-all">
              <Star size={13} className="text-gold-premium fill-gold-premium animate-pulse" />
              <span className="text-xs font-bold text-gold-premium/90 tracking-tighter">120 PTS</span>
            </div>

            {/* Cart Icon */}
            <div className="relative flex items-center">
              <button 
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="relative p-2.5 text-white/70 hover:text-gold-premium transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Carrito de compras"
              >
                <ShoppingCart size={22} />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 bg-gold-premium text-background-dark text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>
              {/* Desktop Cart Dropdown */}
              <div className="hidden md:block">
                <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
              </div>
            </div>

            {/* User Avatar & Logout */}
            <div className="flex items-center gap-4 lg:gap-5 pl-4 lg:pl-8 border-l border-white/5">
              <Link to="/perfil" className="flex items-center gap-3 group min-h-[44px]">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pastel-pink to-gold-premium flex items-center justify-center text-background-dark font-black text-sm ring-2 ring-white/5 group-hover:ring-gold-premium/40 transition-all shadow-lg shadow-gold-premium/10 overflow-hidden">
                    {user?.picture || user?.avatar ? (
                      <img src={user.picture || user.avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      user?.name?.charAt(0).toUpperCase() || <User size={16} />
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background-dark rounded-full"></div>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-white/90 group-hover:text-gold-premium transition-colors leading-none">
                    {user?.name?.split(' ')[0] || 'Gourmet'}
                  </span>
                  <span className="text-[10px] text-white/40 font-medium uppercase tracking-widest mt-1">
                    {user && String(user.rol).trim() === 'admin' ? 'Admin' : 'Miembro'}
                  </span>
                </div>
              </Link>
              <button 
                onClick={onLogout}
                className="p-2.5 text-white/20 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Cerrar Sesión"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            <div className="relative flex items-center">
              <button 
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="relative p-2.5 text-white/70 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Carrito de compras"
              >
                <ShoppingCart size={22} />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 bg-gold-premium text-background-dark text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>
              {/* Mobile Cart Dropdown */}
              <div className="md:hidden">
                <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
              </div>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white/70 hover:text-white transition-colors p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Menú principal"
            >
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 w-full max-h-[calc(100vh-80px)] overflow-y-auto bg-background-dark/95 backdrop-blur-xl border-b border-white/10 md:hidden shadow-2xl z-50"
            >
              <div className="flex flex-col p-6 gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-medium text-white/80 hover:text-gold-premium py-2 border-b border-white/5 flex items-center justify-between"
                  >
                    <span>{link.name}</span>
                    <span className="text-xs text-white/30">→</span>
                  </Link>
                ))}
                {/* 360 Builder — mobile */}
                <button
                  onClick={scrollToBuilder}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400/10 to-orange-500/10 border border-amber-400/30 text-amber-300 font-bold text-center hover:bg-amber-400/15 transition-all min-h-[48px]"
                >
                  <RotateCcw size={18} className="animate-spin" style={{ animationDuration: '3s' }} />
                  Gelato 360°
                </button>
                {/* SuperPoints — mobile */}
                <button
                  onClick={scrollToSuperPoints}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-yellow-400/10 to-amber-500/10 border border-yellow-400/30 text-yellow-300 font-bold text-center hover:bg-yellow-400/15 transition-all min-h-[48px]"
                >
                  <Star size={18} className="fill-yellow-300 text-yellow-300" />
                  SuperPoints
                </button>
                <hr className="border-white/10 my-2" />
                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-premium/20 flex items-center justify-center text-gold-premium font-bold overflow-hidden">
                      {user?.picture || user?.avatar ? (
                        <img src={user.picture || user.avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        user?.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-white font-medium text-sm">{user?.name || 'Invitado'}</p>
                      <p className="text-gold-premium text-xs font-bold">⭐ 120 pts</p>
                    </div>
                  </div>
                  <button 
                    onClick={onLogout}
                    className="p-3 text-red-400 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Cerrar sesión"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
};

export default Navbar;
