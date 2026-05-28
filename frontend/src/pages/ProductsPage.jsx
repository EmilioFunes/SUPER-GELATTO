import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Star, SlidersHorizontal, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import FlavorModal from '../components/FlavorModal';
import { FLAVORS } from '../data/flavors';

const CATEGORIES = ['Todos', 'Clásico', 'Vegano', 'Temporada'];

const ProductsPage = ({ user }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedFlavor, setSelectedFlavor] = useState(null);
  const [sortBy, setSortBy] = useState('default');
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [flavors, setFlavors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/products`);
        if (!res.ok) throw new Error('Error al conectar con la heladería');
        const data = await res.json();
        setFlavors(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleQuickAdd = (flavor, e) => {
    e.stopPropagation();
    if (!user?.id) {
      alert('¡Vaya! Necesitas una cuenta registrada para realizar pedidos. Te llevamos al registro 🍦');
      navigate('/register');
      return;
    }
    addToCart({ ...flavor, precio: flavor.price }, 1);
    alert(`¡${flavor.name} añadido al carrito! 🍦`);
  };

  const filtered = useMemo(() => {
    let list = [...flavors];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q) ||
        f.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'Todos') {
      list = list.filter(f => f.categoria === selectedCategory);
    }

    if (sortBy === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    if (sortBy === 'reviews') list.sort((a, b) => b.reviews - a.reviews);

    return list;
  }, [flavors, searchTerm, selectedCategory, sortBy]);

  return (
    <div className="pt-[80px] pb-24 px-6 min-h-screen">
      <FlavorModal flavor={selectedFlavor} onClose={() => setSelectedFlavor(null)} user={user} />

      <div className="max-w-7xl mx-auto">
        {/* ─── Header ──────────────────────────────── */}
        <div className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-bold tracking-widest text-gold-premium uppercase mb-4">
              Colección Completa
            </span>
            <h1 className="text-5xl md:text-6xl font-playfair font-bold mb-4">
              Nuestros{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-premium to-pastel-pink italic">
                Sabores
              </span>
            </h1>
            <p className="text-white/50 max-w-xl">
              {flavors.length} creaciones artesanales. Toca cualquier sabor para descubrir sus especificaciones completas.
            </p>
          </motion.div>
        </div>

        {/* ─── Filters Bar ──────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="flex flex-col lg:flex-row gap-4 mb-12"
        >
          {/* Search */}
          <div className="relative group flex-1 max-w-sm">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-gold-premium transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar sabores, ingredientes…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input-field pl-11 h-11 w-full"
            />
          </div>

          {/* Category pills */}
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-gold-premium text-background-dark shadow-lg shadow-gold-premium/20'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4">
            <SlidersHorizontal size={16} className="text-white/40" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-bold text-white/60 focus:outline-none py-2 cursor-pointer"
            >
              <option value="default">Recomendados</option>
              <option value="rating">Mayor valoración</option>
              <option value="reviews">Más reseñas</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
            </select>
          </div>

          {/* Count */}
          <div className="flex items-center px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/40 font-bold whitespace-nowrap">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </div>
        </motion.div>

        {/* ─── Loading / Error ──────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <div className="flex gap-2">
              <span className="w-3 h-3 bg-gold-premium rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-3 h-3 bg-gold-premium rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-3 h-3 bg-gold-premium rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
            <p className="text-white/40 text-sm">Cargando sabores desde la base de datos…</p>
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-40 text-center">
            <div className="text-5xl mb-4">😕</div>
            <h3 className="text-xl font-bold text-white mb-2">Error al cargar</h3>
            <p className="text-white/40 text-sm">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-6 text-gold-premium font-bold hover:underline">
              Reintentar
            </button>
          </div>
        )}

        {/* ─── Grid ─────────────────────────────────── */}
        {!loading && !error && (filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-40 text-center"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 text-4xl">🍦</div>
            <h3 className="text-2xl font-playfair font-bold mb-2">No encontramos ese sabor</h3>
            <p className="text-white/40 max-w-sm">Prueba con otros términos o quita los filtros activos.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('Todos'); setSortBy('default'); }}
              className="mt-8 text-gold-premium font-bold hover:underline"
            >
              Ver todos los productos
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((flavor, idx) => (
              <motion.div
                key={flavor.id ?? idx}
                layout
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.5 }}
                onClick={() => setSelectedFlavor(flavor)}
                className={`group relative glass-card overflow-hidden cursor-pointer hover:border-white/25 transition-all duration-500 hover:shadow-2xl ${flavor.glow}`}
              >
                {/* Image */}
                <div className={`relative h-52 overflow-hidden bg-gradient-to-br ${flavor.accent}`}>
                  <img
                    src={flavor.image}
                    alt={flavor.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background-card/90 via-transparent to-transparent" />

                  {/* Badge */}
                  <span className={`absolute top-3 left-3 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border backdrop-blur-sm ${flavor.badgeColor}`}>
                    {flavor.badge}
                  </span>

                  {/* Price */}
                  <span className="absolute top-3 right-3 text-xs font-bold text-gold-premium bg-background-dark/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
                    {flavor.priceLabel}
                  </span>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-white text-[10px] font-bold uppercase tracking-widest bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                      Ver Especificaciones →
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-1.5">
                    <h3 className="text-lg font-playfair font-bold text-white group-hover:text-gold-premium transition-colors line-clamp-1">
                      {flavor.name}
                    </h3>
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => handleQuickAdd(flavor, e)}
                      className="w-8 h-8 rounded-full bg-gold-premium text-background-dark flex items-center justify-center shadow-lg shadow-gold-premium/20 hover:shadow-gold-premium/40 transition-all"
                    >
                      <ShoppingCart size={15} />
                    </motion.button>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed mb-4 line-clamp-2">
                    {flavor.desc}
                  </p>

                  {/* Rating + reviews */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={10} className="text-gold-premium fill-gold-premium" />
                      ))}
                      <span className="text-[10px] text-white/50 ml-1 font-bold">{flavor.rating}</span>
                    </div>
                    <span className="text-[9px] text-white/25 font-bold uppercase tracking-widest">
                      {flavor.reviews} reseñas
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductsPage;
