import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart, formatPrice } from '../context/CartContext';
import { Link } from 'react-router-dom';
import FlavorImage from './FlavorImage';

const CartDrawer = ({ isOpen, onClose }) => {
  const { cart, removeFromCart, updateQuantity, totalPrice } = useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute top-[100%] right-0 mt-4 w-[360px] max-h-[80vh] bg-background-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl z-[90] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
            <h2 className="text-xl font-playfair font-bold flex items-center gap-2">
              Tu <span className="text-gold-premium italic">Pedido</span> <ShoppingBag className="text-white/20" size={18} />
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
            {cart.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center opacity-40">
                <div className="text-5xl mb-3">🍨</div>
                <p className="font-bold uppercase tracking-widest text-[10px]">Tu carrito está vacío</p>
                <Link 
                  to="/productos" 
                  onClick={onClose} 
                  className="mt-3 text-gold-premium text-xs font-bold hover:underline"
                >
                  Ir a comprar sabores
                </Link>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={item.id || `item-${index}`} className="flex gap-3 group">
                  <div className="w-16 h-16 rounded-xl bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/5 group-hover:border-gold-premium/30 transition-all duration-500">
                    <FlavorImage flavor={item} className="w-full h-full text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h4 className="font-bold text-white text-sm leading-tight truncate">{item.nombre || item.name}</h4>
                      <button onClick={() => removeFromCart(item.id)} className="flex-shrink-0 text-white/20 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] text-white/40 mb-2">{formatPrice(item.precio || item.price)} c/u</p>
                    
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center bg-white/5 border border-white/10 rounded-md p-0.5">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 hover:text-gold-premium">
                          <Minus size={10} />
                        </button>
                        <span className="w-5 text-center text-[10px] font-bold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:text-gold-premium">
                          <Plus size={10} />
                        </button>
                      </div>
                      <span className="font-bold text-sm text-gold-premium">{formatPrice((item.quantity * (item.precio || item.price)))}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Summary */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-white/10 bg-white/[0.03] space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-xs text-white/40 font-bold uppercase tracking-widest">Total</span>
                <span className="text-2xl font-bold text-gold-premium">{formatPrice(totalPrice)}</span>
              </div>
              <Link 
                to="/checkout" 
                onClick={onClose}
                className="w-full py-3 bg-gold-premium text-background-dark text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-lg shadow-gold-premium/20"
              >
                Continuar al Pago <ArrowRight size={16} />
              </Link>
              <p className="text-[9px] text-center text-white/30 font-bold uppercase tracking-tighter">
                💰 +{(totalPrice / 10).toFixed(0)} SuperPoints
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
