import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Truck, ShieldCheck, Heart, ArrowRight,
  Instagram, Facebook, Twitter, X, MapPin, ShoppingCart,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import FlavorModal from '../components/FlavorModal';
import FrameAnimation from '../components/FrameAnimation';
import GelatoBuilder3D from '../components/GelatoBuilder3D';
import { FLAVORS } from '../data/flavors';

const storyParagraphs = [
  {
    text: 'En el corazón de Medellín, donde el clima fresco de las montañas se mezcla con el calor de su gente, nació una idea que iba más allá de un simple helado.',
    highlight: false,
  },
  {
    text: 'Todo comenzó con una obsesión: ¿por qué el gelato artesanal de verdad era tan difícil de encontrar? Las heladerías de siempre ofrecían lo mismo de siempre. Nada especial. Nada que te hiciera cerrar los ojos al primer bocado.',
    highlight: false,
  },
  {
    text: 'Entonces llegó super gelatto.',
    highlight: true,
  },
  {
    text: 'No era solo una heladería. Era una experiencia. Cada sabor fue desarrollado con ingredientes reales — fruta fresca del Eje Cafetero, chocolate de origen colombiano, vainilla traída de regiones remotas. Sin atajos. Sin artificiales. Solo producto puro, congelado lentamente hasta alcanzar esa textura cremosa que se derrite justo antes de que la cuchara llegue a tu boca.',
    highlight: false,
  },
  {
    text: 'Pero lo que realmente hacía diferente a super gelatto era su mundo digital. Desde la app, cada cliente podía construir su gelato ideal — elegir el recipiente, los sabores, los toppings — girándolo en 360° antes de ordenarlo, como si lo tuviera en las manos. Era como diseñar tu propio pequeño universo helado.',
    highlight: false,
  },
  {
    text: 'Y los clientes más fieles se convertían en algo más. Pasaban de ser Lovers a Fans, luego a Pro, y los más apasionados alcanzaban el nivel Master — con acceso a sabores exclusivos, preventas y experiencias únicas en tienda.',
    highlight: false,
  },
  {
    text: 'super gelatto no vendía helado.',
    highlight: true,
  },
  {
    text: 'Vendía el momento exacto en que todo lo demás desaparece.',
    highlight: false,
  },
];

const Home = ({ user }) => {
  const [selectedFlavor, setSelectedFlavor] = useState(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [allProducts, setAllProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const fetchHomeProducts = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/products`);
        if (res.ok) {
          const data = await res.json();
          setAllProducts(data);
        }
      } catch (err) {
        console.error('Error fetching home products:', err);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchHomeProducts();
    const interval = setInterval(fetchHomeProducts, 2500);
    window.addEventListener('focus', fetchHomeProducts);
    window.addEventListener('storage', fetchHomeProducts);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchHomeProducts);
      window.removeEventListener('storage', fetchHomeProducts);
    };
  }, []);

  // Los sabores destacados en Home reflejan 100% los marcados por el Admin
  const featured = allProducts.filter(p => Boolean(p.destacado)).slice(0, 6);
  const loading = loadingProducts;

  const handleQuickAdd = (flavor, e) => {
    e.stopPropagation(); // Evitar que se abra el modal al presionar el botón de añadir
    if (!user?.id) {
      alert('¡Vaya! Necesitas una cuenta registrada para realizar pedidos. Te llevamos al registro 🍦');
      navigate('/register');
      return;
    }
    // Asegurarnos de pasar los campos correctos (nombre, precio, imagen)
    addToCart({ ...flavor, precio: flavor.price }, 1);
    alert(`¡${flavor.name} añadido al carrito! 🍦`);
  };

  const tiers = [
    {
      name: 'Lover',
      points: '0 – 100',
      rawPoints: 100,
      icon: '🍨',
      emoji: '💗',
      gradient: 'from-pink-500/30 via-rose-500/10 to-transparent',
      border: 'border-pink-500/30',
      glow: 'shadow-pink-500/20',
      badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      bar: 'from-pink-400 to-rose-500',
      progress: 25,
      features: [
        { icon: '🎁', text: '5% Descuento en cada compra' },
        { icon: '🆕', text: 'Acceso anticipado a sabores nuevos' },
        { icon: '📱', text: 'Newsletter exclusivo de temporada' },
      ],
    },
    {
      name: 'Fan',
      points: '101 – 500',
      rawPoints: 500,
      icon: '🍦',
      emoji: '💙',
      gradient: 'from-blue-500/30 via-cyan-500/10 to-transparent',
      border: 'border-blue-500/30',
      glow: 'shadow-blue-500/20',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      bar: 'from-blue-400 to-cyan-500',
      progress: 50,
      features: [
        { icon: '💸', text: '10% Descuento permanente' },
        { icon: '🚚', text: 'Envíos gratis los fines de semana' },
        { icon: '🎨', text: 'Acceso a ediciones limitadas' },
      ],
    },
    {
      name: 'Pro',
      points: '501 – 1000',
      rawPoints: 1000,
      icon: '🍨',
      emoji: '💚',
      gradient: 'from-emerald-500/30 via-green-500/10 to-transparent',
      border: 'border-emerald-500/30',
      glow: 'shadow-emerald-500/20',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      bar: 'from-emerald-400 to-green-500',
      progress: 75,
      features: [
        { icon: '💎', text: '15% Descuento exclusivo' },
        { icon: '🎂', text: 'Regalo sorpresa de cumpleaños' },
        { icon: '🏪', text: 'Prioridad en nuevas sucursales' },
      ],
    },
    {
      name: 'Master',
      points: '1000+',
      rawPoints: null,
      icon: '👑',
      emoji: '✨',
      gradient: 'from-yellow-500/40 via-amber-400/15 to-transparent',
      border: 'border-yellow-400/50',
      glow: 'shadow-yellow-400/30',
      badge: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
      bar: 'from-yellow-400 to-amber-500',
      progress: 100,
      features: [
        { icon: '👑', text: '20% Descuento VIP permanente' },
        { icon: '🧁', text: 'Muestras gratis cada mes' },
        { icon: '🌟', text: 'Invitaciones a eventos privados' },
      ],
    },
  ];

  const benefits = [
    { icon: <ShieldCheck className="text-pastel-green" />, title: 'Ingredientes Premium', desc: 'Solo usamos las mejores frutas y cremas locales.' },
    { icon: <Heart className="text-pastel-pink" />, title: 'Hecho a Mano', desc: 'Procesos artesanales para una textura inigualable.' },
    { icon: <Truck className="text-pastel-blue" />, title: 'Entrega en 30 min', desc: 'Tu antojo llega rápido y en perfecto estado.' },
  ];


  return (
    <div className="pt-[80px]">
      {/* ─── Flavor Modal ──────────────────────────────── */}
      <FlavorModal flavor={selectedFlavor} onClose={() => setSelectedFlavor(null)} user={user} />

      {/* ─── Story Modal ───────────────────────────────── */}
      <AnimatePresence>
        {storyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStoryOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-lg"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 200 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[32px] border border-white/10 bg-background-dark/90 shadow-2xl flex flex-col"
            >
              {/* Gradient top accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pink-500 via-gold-premium to-pastel-blue" />

              {/* Decorative glows */}
              <div className="pointer-events-none absolute -top-32 -left-32 w-64 h-64 bg-pink-500/10 blur-[80px] rounded-full" />
              <div className="pointer-events-none absolute -bottom-32 -right-32 w-64 h-64 bg-gold-premium/10 blur-[80px] rounded-full" />

              {/* Header */}
              <div className="relative px-8 pt-8 pb-5 border-b border-white/8 flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-gold-premium/10 border border-gold-premium/20 rounded-full text-[10px] font-bold tracking-widest text-gold-premium uppercase mb-3">
                    <span>🍦</span> Nuestra Historia
                  </span>
                  <h2 className="text-3xl font-playfair font-bold text-white leading-tight">
                    Más que un{' '}
                    <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-pastel-pink via-gold-premium to-pastel-blue">
                      helado
                    </span>
                  </h2>
                </div>
                <button
                  onClick={() => setStoryOpen(false)}
                  className="flex-shrink-0 p-2 mt-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-8 py-7 space-y-6">
                {storyParagraphs.map((p, i) =>
                  p.highlight ? (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="text-2xl font-playfair font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-premium to-amber-300 leading-snug py-1"
                    >
                      {p.text}
                    </motion.p>
                  ) : (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="text-white/70 leading-relaxed text-[15px]"
                    >
                      {p.text}
                    </motion.p>
                  )
                )}
              </div>

              {/* Footer */}
              <div className="relative px-8 pb-7 pt-5 border-t border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/30 text-xs font-bold uppercase tracking-widest">
                  <MapPin size={14} />
                  <span>Medellín · Artesanal · Sin Límites</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStoryOpen(false)}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-gold-premium to-amber-400 text-background-dark font-bold text-sm"
                >
                  ¡Me Enamoro! 🍦
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Hero Section ──────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden px-6">
        <div className="absolute inset-0 w-full h-full -z-20">
          <video
            autoPlay loop muted playsInline
            className="w-full h-full object-cover opacity-60 mix-blend-screen"
            src="/video/video_preview_h264.mp4"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-dark/50 to-background-dark" />
        </div>
        <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pastel-pink/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-premium/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <span className="inline-block px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-bold tracking-widest text-gold-premium uppercase mb-6">
              Experiencia Artesanal Premium
            </span>
            <h1 className="text-6xl md:text-8xl font-playfair font-bold leading-tight mb-8">
              Sabor que <br />
              <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-pastel-pink via-gold-premium to-pastel-blue">
                Enamora
              </span>
            </h1>
            <p className="text-lg text-white/60 mb-10 max-w-lg leading-relaxed">
              Descubre el verdadero arte del gelato. Fusionamos tradición italiana con ingredientes frescos de nuestra tierra para crear momentos de pura felicidad.
            </p>
            <div className="flex flex-wrap gap-4">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStoryOpen(true)}
                className="px-8 py-3 rounded-full border border-white/20 hover:bg-white/5 hover:border-gold-premium/40 hover:text-gold-premium transition-all duration-300"
              >
                Nuestra Historia
              </motion.button>
            </div>
          </motion.div>

          {/* Animation frames — right side */}
          <div className="flex items-center justify-center md:justify-end relative z-10 md:translate-x-16">
            <FrameAnimation
              fps={24}
              className="relative z-10 w-[240px] h-[240px] md:w-[400px] md:h-[400px] rounded-full overflow-hidden shadow-2xl drop-shadow-[0_20px_40px_rgba(255,183,197,0.15)]"
            />
          </div>

        </div>
      </section>

      {/* ─── Featured Flavors ────────────────────────── */}
      <section id="sabores-destacados" className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-bold tracking-widest text-gold-premium uppercase mb-4">
              Colección Artesanal
            </span>
            <h2 className="text-4xl md:text-5xl font-playfair font-bold mb-4">Sabores Destacados</h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Cada cucharada es una obra de arte. Toca cualquier sabor para ver sus especificaciones completas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              // Loading Skeleton
              [...Array(6)].map((_, i) => (
                <div key={i} className="h-80 rounded-3xl bg-white/5 animate-pulse border border-white/10" />
              ))
            ) : (
              featured.map((flavor, idx) => (
              <motion.div
                key={flavor.id || idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.6 }}
                onClick={() => setSelectedFlavor(flavor)}
                className={`group relative glass-card overflow-hidden cursor-pointer hover:border-white/25 transition-all duration-500 hover:shadow-2xl ${flavor.glow}`}
              >
                {/* Image */}
                <div className={`relative h-56 overflow-hidden bg-gradient-to-br ${flavor.accent}`}>
                  <img
                    src={flavor.image}
                    alt={flavor.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background-card/90 via-transparent to-transparent" />
                  <span className={`absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border backdrop-blur-sm ${flavor.badgeColor}`}>
                    {flavor.badge}
                  </span>
                  <span className="absolute top-4 right-4 text-sm font-bold text-gold-premium bg-background-dark/70 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                    {flavor.priceLabel}
                  </span>
                  {/* Hover hint */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-white text-xs font-bold uppercase tracking-widest bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                      Ver Especificaciones →
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-playfair font-bold text-white group-hover:text-gold-premium transition-colors">
                      {flavor.name}
                    </h3>
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => handleQuickAdd(flavor, e)}
                      className="w-10 h-10 rounded-full bg-gold-premium text-background-dark flex items-center justify-center shadow-lg shadow-gold-premium/20 hover:shadow-gold-premium/40 transition-all"
                    >
                      <ShoppingCart size={18} />
                    </motion.button>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed mb-4 line-clamp-2">{flavor.desc}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={11} className="text-gold-premium fill-gold-premium" />
                      ))}
                      <span className="text-[10px] text-white/40 ml-1 font-bold">{flavor.rating}</span>
                    </div>
                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                      {flavor.reviews} reseñas
                    </span>
                  </div>
                </div>
              </motion.div>
            )))}
          </div>
        </div>
      </section>

      {/* ─── 3D Gelato Builder ─────────────────────────── */}
      <div id="gelato-builder-360">
        <GelatoBuilder3D user={user} />
      </div>

      {/* ─── Benefits ────────────────────────────────── */}
      <section className="py-32 px-6 relative overflow-hidden bg-white/[0.01]">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="flex flex-col items-center text-center p-10 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500 group"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.01] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-2xl">
                {React.cloneElement(b.icon, { size: 32, strokeWidth: 1.5 })}
              </div>
              <h3 className="text-2xl font-playfair font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">{b.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed max-w-[240px]">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── SuperPoints ─────────────────────────────── */}
      <section id="super-points-section" className="py-28 px-6 relative overflow-hidden">
        {/* Fondo decorativo */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-yellow-400/5 blur-[140px] rounded-full" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-pink-500/5 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-20"
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 bg-yellow-400/10 border border-yellow-400/20 rounded-full text-xs font-bold tracking-widest text-yellow-300 uppercase mb-6">
              <span className="text-base">⭐</span> Programa de Lealtad
            </span>
            <h2 className="text-5xl md:text-6xl font-playfair font-bold mb-5">
              Super
              <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500">
                Points
              </span>
            </h2>
            <p className="text-white/50 max-w-lg mx-auto text-base leading-relaxed">
              Cada compra suma. Sube de nivel y desbloquea beneficios exclusivos del club más dulce del mundo.
            </p>
          </motion.div>

          {/* ── Stats row ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-3 gap-4 mb-16 max-w-2xl mx-auto"
          >
            {[
              { val: '12K+', label: 'Miembros activos' },
              { val: '4.9★', label: 'Satisfacción' },
              { val: '20%', label: 'Desc. máximo' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center p-4 rounded-2xl bg-white/[0.03] border border-white/8">
                <span className="text-2xl font-playfair font-bold text-gold-premium">{s.val}</span>
                <span className="text-[11px] text-white/40 mt-1 font-bold uppercase tracking-widest">{s.label}</span>
              </div>
            ))}
          </motion.div>

          {/* ── Tier Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {tiers.map((t, idx) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.6 }}
                whileHover={{ y: -15, scale: 1.03 }}
                className={`relative group rounded-[32px] border ${t.border} overflow-hidden cursor-pointer shadow-2xl ${t.glow} transition-all duration-700`}
              >
                {/* Card gradient bg con efecto animado */}
                <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-40 group-hover:opacity-100 transition-opacity duration-700`} />
                <div className="absolute inset-0 bg-background-dark/60 backdrop-blur-xl group-hover:backdrop-blur-lg transition-all" />

                {/* Glow top accent - más grueso en hover */}
                <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${t.bar} opacity-60 group-hover:opacity-100 transition-opacity`} />

                <div className="relative z-10 p-7 flex flex-col h-full">
                  {/* Icon + badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="text-4xl drop-shadow-lg">{t.icon}</div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${t.badge}`}>
                      {t.name}
                    </span>
                  </div>

                  {/* Points range */}
                  <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-1">Rango</p>
                  <p className="text-white text-lg font-playfair font-bold mb-5">{t.points} <span className="text-xs text-white/40">pts</span></p>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-white/10 mb-6 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${t.progress}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 + 0.3, duration: 0.9, ease: 'easeOut' }}
                      className={`h-full rounded-full bg-gradient-to-r ${t.bar}`}
                    />
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 flex-1">
                    {t.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                        <span className="text-base leading-none mt-0.5">{f.icon}</span>
                        <span className="leading-tight">{f.text}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Emoji decorativo */}
                  <div className="absolute bottom-4 right-4 text-3xl opacity-20 group-hover:opacity-40 transition-opacity select-none">
                    {t.emoji}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────── */}
      <footer className="bg-background-dark border-t border-white/5 pt-20 pb-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-12 mb-16">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 mb-6">
                <img 
                  src="/images/LOGO-GELATTO.png" 
                  alt="super gelatto" 
                  className="h-14 w-auto object-contain" 
                />
              </div>
              <p className="text-white/40 text-sm leading-relaxed mb-6">
                Redefiniendo el placer del helado artesanal en cada bocado. Calidad gourmet, pasión local.
              </p>
              <div className="flex gap-4">
                {[Instagram, Facebook, Twitter].map((Icon, i) => (
                  <button key={i} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-gold-premium/20 hover:text-gold-premium transition-all">
                    <Icon size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 sm:gap-24">
              <div>
                <h4 className="font-bold mb-6 text-gold-premium/80">Navegación</h4>
                <ul className="space-y-4 text-sm text-white/50">
                  <li><button className="hover:text-gold-premium">Productos</button></li>
                  <li><button className="hover:text-gold-premium">Favoritos</button></li>
                  <li><button className="hover:text-gold-premium">Locales</button></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-6 text-gold-premium/80">Soporte</h4>
                <ul className="space-y-4 text-sm text-white/50">
                  <li><button className="hover:text-gold-premium">FAQ</button></li>
                  <li><button className="hover:text-gold-premium">Envíos</button></li>
                  <li><button className="hover:text-gold-premium">Privacidad</button></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/30 text-xs text-center">
              © 2025 super gelatto Artigianale. Todos los derechos reservados.
            </p>
            <div className="flex gap-6 text-[10px] text-white/20 uppercase tracking-widest font-bold">
              <span>GDL, MX</span>
              <span>BOG, CO</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
