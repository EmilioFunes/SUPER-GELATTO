import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  X, ShoppingCart, Star, Flame, Droplets, Zap, Award, Clock, Leaf, Lock,
} from 'lucide-react';
import { useCart, formatPrice } from '../context/CartContext';

const FlavorModal = ({ flavor, onClose, user }) => {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const handleAddToCart = () => {
    if (!user?.id) {
      onClose();
      navigate('/register');
      return;
    }
    addToCart({ ...flavor, precio: flavor.price }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <AnimatePresence>
      {flavor && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl"
              style={{
                background: `radial-gradient(circle at top left, ${flavor.glowModal || 'rgba(212,175,55,0.15)'} 0%, #0d0a1a 60%)`,
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
              >
                <X size={20} />
              </button>

              <div className="grid md:grid-cols-2">
                {/* Left — Image */}
                <div className="relative h-72 md:h-full min-h-[300px] overflow-hidden rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none">
                  <img src={flavor.image} alt={flavor.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r" />
                  <span className={`absolute top-5 left-5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border backdrop-blur-sm ${flavor.badgeColor}`}>
                    {flavor.badge}
                  </span>
                  <div className="absolute bottom-5 left-5 flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-xs text-white/70">📍 {flavor.origin || 'Colombia'}</span>
                  </div>
                </div>

                {/* Right — Details */}
                <div className="p-8 flex flex-col gap-6 overflow-y-auto">
                  {/* Header */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h2 className="text-3xl font-playfair font-bold text-white leading-tight">{flavor.name}</h2>
                      <span className="text-2xl font-bold whitespace-nowrap" style={{ color: flavor.accentColor }}>{flavor.priceLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={14} className="fill-gold-premium text-gold-premium" />
                        ))}
                      </div>
                      <span className="text-sm font-bold text-white">{flavor.rating || 4.8}</span>
                      <span className="text-xs text-white/40">({flavor.reviews || 0} reseñas)</span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{flavor.longDesc || flavor.desc}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(flavor.tags || []).map(tag => (
                      <span key={tag} className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
                        {tag}
                      </span>
                    ))}
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 flex items-center gap-1">
                      <Clock size={10} /> {flavor.prepTime || '48h'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Perfil de Sabor</h4>
                    <div className="space-y-2.5">
                      {(flavor.flavorProfile || []).map(f => (
                        <div key={f.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white/70 font-medium">{f.label}</span>
                            <span className="font-bold" style={{ color: flavor.accentColor }}>{f.value}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${f.value}%` }}
                              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ background: `linear-gradient(90deg, ${flavor.accentColor}99, ${flavor.accentColor})` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
                      Información Nutricional <span className="normal-case font-normal">(por 100g)</span>
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { icon: <Flame size={14} />, label: 'Calorías', value: flavor.nutrition?.calorias || 0, unit: 'kcal' },
                        { icon: <Droplets size={14} />, label: 'Grasas', value: flavor.nutrition?.grasas || 0, unit: 'g' },
                        { icon: <Zap size={14} />, label: 'Carbos', value: flavor.nutrition?.carbos || 0, unit: 'g' },
                        { icon: <Award size={14} />, label: 'Proteína', value: flavor.nutrition?.proteinas || 0, unit: 'g' },
                      ].map(n => (
                        <div key={n.label} className="bg-white/5 border border-white/8 rounded-2xl p-3 text-center">
                          <div className="flex justify-center mb-1" style={{ color: flavor.accentColor }}>{n.icon}</div>
                          <div className="text-base font-bold text-white">
                            {n.value}<span className="text-[9px] text-white/40 ml-0.5">{n.unit}</span>
                          </div>
                          <div className="text-[9px] text-white/40 uppercase tracking-wide">{n.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Ingredientes</h4>
                      <ul className="space-y-1">
                        {(flavor.ingredients || []).map(ing => (
                          <li key={ing} className="text-xs text-white/60 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-white/30 flex-shrink-0" />
                            {ing}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Alérgenos</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {(flavor.allergens || []).map(a => (
                          <span key={a} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
                            ⚠ {a}
                          </span>
                        ))}
                      </div>
                      {flavor.tags?.includes('Vegano') && (
                        <div className="mt-2 flex items-center gap-1.5 text-green-400 text-xs font-bold">
                          <Leaf size={12} /> 100% Vegano
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add to Cart */}
                  <div className="flex items-center gap-4 pt-2 border-t border-white/8">
                    {/* Qty selector — solo si está logueado */}
                    {user && (
                      <div className="flex items-center bg-white/5 border border-white/10 rounded-full h-11 px-3">
                        <button
                          onClick={() => setQty(q => Math.max(1, q - 1))}
                          className="w-7 h-7 flex items-center justify-center hover:text-gold-premium transition-colors text-xl font-bold"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{qty}</span>
                        <button
                          onClick={() => setQty(q => q + 1)}
                          className="w-7 h-7 flex items-center justify-center hover:text-gold-premium transition-colors text-xl font-bold"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleAddToCart}
                      className="flex-1 h-11 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
                      style={
                        user
                          ? {
                              background: added
                                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                                : `linear-gradient(135deg, ${flavor.accentColor}, ${flavor.accentColor}bb)`,
                              color: '#0d0a1a',
                              boxShadow: `0 8px 24px ${flavor.glowModal}`,
                            }
                          : {
                              background: 'rgba(255,255,255,0.05)',
                              color: 'rgba(255,255,255,0.5)',
                              border: '1px solid rgba(255,255,255,0.15)',
                            }
                      }
                    >
                      {user ? (
                        added ? (
                          <>✓ ¡Agregado al carrito!</>
                        ) : (
                          <><ShoppingCart size={16} /> Agregar · {formatPrice(flavor.price * qty)}</>
                        )
                      ) : (
                        <><Lock size={14} /> Inicia sesión para agregar</>
                      )}
                    </button>
                  </div>

                  {/* Hint cuando no está logueado */}
                  {!user && (
                    <p className="text-center text-xs text-white/30 -mt-3">
                      <button
                        onClick={() => { onClose(); navigate('/login'); }}
                        className="text-gold-premium underline underline-offset-2 hover:text-white transition-colors"
                      >
                        Inicia sesión
                      </button>
                      {' '}o{' '}
                      <button
                        onClick={() => { onClose(); navigate('/register'); }}
                        className="text-gold-premium underline underline-offset-2 hover:text-white transition-colors"
                      >
                        regístrate
                      </button>
                      {' '}para agregar al carrito
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FlavorModal;
