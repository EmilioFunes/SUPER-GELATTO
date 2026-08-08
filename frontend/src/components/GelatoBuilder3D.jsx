import React, { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows, Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart } from 'lucide-react';
import { useCart, formatPrice } from '../context/CartContext';
import { apiFetch } from '../utils/api';

// Silence THREE.Clock, WebGLProgram & DirectX X4122 shader precision warnings
if (typeof window !== 'undefined') {
  const isIgnored = (msg) => typeof msg === 'string' && (msg.includes('THREE.Clock') || msg.includes('X4122') || msg.includes('WebGLProgram'));
  const origWarn = console.warn;
  const origErr = console.error;
  console.warn = (...args) => { if (!isIgnored(args[0])) origWarn(...args); };
  console.error = (...args) => { if (!isIgnored(args[0])) origErr(...args); };
}

const BASE_PATH = '/360';
const MAX_SCOOPS = 3;
const MAX_TOPPINGS = 3;
const SCOOP_HEIGHT = 0.7;   // vertical spacing between scoops (compact)

// Topping transforms to cluster them beautifully at the center top
const TOPPING_TRANSFORMS = [
  { pos: [0, 0, 0], rot: [0, 0, 0] },                                  // 1st topping: perfectly centered
  { pos: [0.12, 0.08, 0.12], rot: [0.1, Math.PI / 4, -0.1] },          // 2nd topping: slightly right/front, tilted
  { pos: [-0.12, 0.05, -0.12], rot: [-0.1, -Math.PI / 6, 0.1] },       // 3rd topping: slightly left/back, tilted
];

/* ─── Single Part Model with Material Optimization ────────────── */
const PartModel = ({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, isScoop = false }) => {
  const { scene } = useGLTF(url);
  
  // Clone and optimize materials for a "creamy" look
  const cloned = useMemo(() => {
    const root = scene.clone();
    root.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (isScoop && node.material) {
          node.material.roughness = 0.8;
          node.material.metalness = 0.1;
          node.material.envMapIntensity = 0.5;
        }
      }
    });
    return root;
  }, [scene, isScoop]);

  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
};

/* ─── Rotating Group that holds all parts ─────────────── */
const RotatingGroup = ({ children }) => {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.6;
    }
  });
  return <group ref={ref}>{children}</group>;
};

/* ─── Auto-adjusting camera based on item count ───────── */
const CameraAdjuster = ({ scoopCount, toppingCount }) => {
  useFrame(({ camera }) => {
    const totalItems = scoopCount + toppingCount;
    const targetZ = 8 + totalItems * 1.2;
    const targetY = 3 + totalItems * 0.6;
    const lookAtY = -0.5 + scoopCount * 0.3;
    camera.position.z += (targetZ - camera.position.z) * 0.04;
    camera.position.y += (targetY - camera.position.y) * 0.04;
    camera.lookAt(0, lookAtY, 0);
  });
  return null;
};

/* ─── Premium Loading Experience ─────────────────────────── */
const Loader = () => (
  <Html center>
    <div className="flex flex-col items-center gap-4 bg-background-dark/80 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 shadow-2xl scale-75 md:scale-100">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gold-premium/20 border-t-gold-premium rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-xl">🍦</div>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-white font-bold tracking-[0.2em] uppercase text-[10px]">Cocinando...</span>
        <span className="text-white/40 text-[8px] uppercase tracking-widest mt-1">Arte en proceso</span>
      </div>
    </div>
  </Html>
);

/* ─── Data ────────────────────────────────────────────── */
const containers = [
  { id: 'cone', name: 'Cono', file: 'cone.glb', emoji: '🍦', scale: 2.2 },
  { id: 'cup', name: 'Copa', file: 'cup.glb', emoji: '🥤', scale: 2.0 },
  { id: 'glass', name: 'Vaso', file: 'glass.glb', emoji: '🍷', scale: 2.0 },
];

const DEFAULT_SCOOPS = [
  { id: 'vanilla', name: 'Vainilla', file: 'scoop_vanilla.glb', color: '#F3E5AB', emoji: '🍨', scale: 2.0 },
  { id: 'chocolate', name: 'Chocolate', file: 'scoop_chocolate.glb', color: '#5C3317', emoji: '🍫', scale: 2.0 },
  { id: 'fresa', name: 'Fresa', file: 'scoop_fresa.glb', color: '#FF6B8A', emoji: '🍓', scale: 2.0 },
  { id: 'mango', name: 'Mango', file: 'scoop_mango.glb', color: '#FFB347', emoji: '🥭', scale: 2.0 },
  { id: 'menta', name: 'Menta', file: 'scoop_menta.glb', color: '#98FB98', emoji: '🌿', scale: 2.0 },
  { id: 'mora', name: 'Mora', file: 'scoop_mora.glb', color: '#8B45A6', emoji: '🫐', scale: 2.0 },
];

const getFlavorColor = (name = '', cat = '') => {
  const n = String(name).toLowerCase();
  if (n.includes('dulce') || n.includes('caramelo')) return '#D4AF37';
  if (n.includes('fresa') || n.includes('berry') || n.includes('mora') || n.includes('rosa')) return '#FF6B8A';
  if (n.includes('chocolate') || n.includes('tiramis')) return '#5C3317';
  if (n.includes('mango') || n.includes('maracuy')) return '#FFB347';
  if (n.includes('pistacho') || n.includes('menta') || n.includes('matcha')) return '#A3C1AD';
  if (n.includes('coco') || n.includes('vainilla') || n.includes('limon') || n.includes('limón')) return '#F3E5AB';
  if (cat === 'Vegano') return '#86EFAC';
  if (cat === 'Temporada') return '#F9A8D4';
  return '#D4AF37';
};

const toppingsData = [
  { id: 'cherry', name: 'Cereza', file: 'topping_cherry.glb', emoji: '🍒', scale: 2.0 },
  { id: 'chips', name: 'Chips', file: 'topping_chips.glb', emoji: '🍪', scale: 2.0 },
  { id: 'coco', name: 'Coco', file: 'topping_coco.glb', emoji: '🥥', scale: 2.0 },
  { id: 'cream', name: 'Crema', file: 'topping_cream.glb', emoji: '🍦', scale: 2.0 },
  { id: 'gummies', name: 'Gomitas', file: 'topping_gummies.glb', emoji: '🍬', scale: 2.0 },
  { id: 'nuts', name: 'Nueces', file: 'topping_nuts.glb', emoji: '🥜', scale: 2.0 },
  { id: 'sprinkles', name: 'Sprinkles', file: 'topping_sprinkles.glb', emoji: '✨', scale: 2.0 },
  { id: 'syrup', name: 'Jarabe', file: 'topping_syrup.glb', emoji: '🍯', scale: 2.0 },
];

/* ─── Scene ───────────────────────────────────────────── */
const GelatoScene = ({ container, selectedScoops, selectedToppings, availableScoops = DEFAULT_SCOOPS }) => {
  const containerData = containers.find(c => c.id === container);

  const baseY = -1;
  const firstScoopY = 0.6;
  // Y position for toppings: just above the top scoop
  const toppingBaseY = firstScoopY + (selectedScoops.length - 1) * SCOOP_HEIGHT + SCOOP_HEIGHT * 0.9;

  return (
    <>
      {/* Lighting Suite for Premium Photography Look */}
      <ambientLight intensity={0.4} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ffb7c5" />
      
      {/* Main backlight (Rim Light) for depth */}
      <directionalLight position={[0, 5, -5]} intensity={0.8} color="#ffffff" />
      
      {/* Front fill light */}
      <directionalLight position={[0, 2, 5]} intensity={0.4} color="#ffd4a8" />

      {/* Camera auto-adjusts to fit all items */}
      <CameraAdjuster scoopCount={selectedScoops.length} toppingCount={selectedToppings.length} />

      <RotatingGroup>
        {/* Container (base) */}
        <Suspense fallback={<Loader />}>
          {containerData && (
            <PartModel
              url={`${BASE_PATH}/${containerData.file}`}
              scale={containerData.scale}
              position={[0, baseY, 0]}
            />
          )}
        </Suspense>

        {/* Scoops — stacked above the container */}
        {selectedScoops.map((scoopId, index) => {
          const scoopData = availableScoops.find(s => String(s.id) === String(scoopId)) || DEFAULT_SCOOPS.find(s => String(s.id) === String(scoopId));
          if (!scoopData) return null;
          const y = firstScoopY + index * SCOOP_HEIGHT;
          const modelUrl = (scoopData.file && (scoopData.file.startsWith('http') || scoopData.file.startsWith('/')))
            ? scoopData.file
            : `${BASE_PATH}/${scoopData.file || 'scoop_vanilla.glb'}`;

          return (
            <Suspense key={`scoop-${index}-${scoopId}`} fallback={null}>
              <PartModel
                url={modelUrl}
                scale={scoopData.scale || 2.0}
                position={[0, y, 0]}
                isScoop={true}
              />
            </Suspense>
          );
        })}

        {/* Toppings — spread beautifully at the center top of the last scoop */}
        {selectedToppings.map((toppingId, index) => {
          const toppingData = toppingsData.find(t => t.id === toppingId);
          if (!toppingData) return null;
          const transform = TOPPING_TRANSFORMS[index] || { pos: [0, 0, 0], rot: [0, 0, 0] };
          const y = toppingBaseY + transform.pos[1];
          return (
            <Suspense key={`topping-${index}-${toppingId}`} fallback={null}>
              <PartModel
                url={`${BASE_PATH}/${toppingData.file}`}
                scale={toppingData.scale}
                position={[transform.pos[0], y, transform.pos[2]]}
                rotation={transform.rot}
              />
            </Suspense>
          );
        })}
      </RotatingGroup>

      <ContactShadows
        position={[0, -2.5, 0]}
        opacity={0.4}
        scale={8}
        blur={2.5}
      />
      <Environment preset="studio" />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3}
        maxDistance={12}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
        autoRotate={false}
      />
    </>
  );
};

// Memoize the entire 3D segment to prevent re-mounts on global state changes (like Cart)
const MemoizedCanvas = React.memo(({ container, selectedScoops, selectedToppings, availableScoops, canvasRef }) => {
  return (
    <Canvas
      ref={canvasRef}
      dpr={[1, 1.5]}
      camera={{ position: [0, 3, 8], fov: 40 }}
      style={{ width: '100%', height: '100%', minHeight: '500px' }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
        });
      }}
    >
      <GelatoScene 
        container={container} 
        selectedScoops={selectedScoops} 
        selectedToppings={selectedToppings} 
        availableScoops={availableScoops}
      />
    </Canvas>
  );
});

/* ─── Selector Button (single-select for container) ───── */
const SelectorButton = ({ item, isSelected, onClick, showColor, count }) => (
  <motion.button
    whileHover={{ scale: 1.08 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`
      relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border transition-all duration-300
      ${isSelected
        ? 'bg-white/10 border-amber-400/60 shadow-lg shadow-amber-400/10'
        : 'bg-white/[0.03] border-white/8 hover:bg-white/[0.06] hover:border-white/15'}
    `}
  >
    {/* Count badge for multi-select */}
    {count > 0 && (
      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-background-dark text-[10px] font-black flex items-center justify-center z-10">
        {count}
      </div>
    )}
    {showColor && item.color && (
      <div
        className="w-5 h-5 rounded-full border border-white/20 shadow-inner"
        style={{ backgroundColor: item.color }}
      />
    )}
    <span className="text-xl">{item.emoji}</span>
    <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected || count > 0 ? 'text-amber-300' : 'text-white/50'}`}>
      {item.name}
    </span>
  </motion.button>
);

/* ─── Chip for selected items in summary ──────────────── */
const SelectionChip = ({ emoji, name, onRemove }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/8 border border-white/10 text-xs"
  >
    <span>{emoji}</span>
    <span className="text-white/70 font-bold">{name}</span>
    <button onClick={onRemove} className="ml-0.5 text-white/30 hover:text-red-400 transition-colors">
      <X size={12} />
    </button>
  </motion.div>
);

/* ─── Main Component ──────────────────────────────────── */
const GelatoBuilder3D = ({ user }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const canvasRef = useRef();
  const [container, setContainer] = useState('cone');
  const [selectedScoops, setSelectedScoops] = useState(['vanilla']);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [activeTab, setActiveTab] = useState('container');
  const [scoopsList, setScoopsList] = useState(DEFAULT_SCOOPS);

  useEffect(() => {
    let isMounted = true;
    apiFetch('/api/products')
      .then(res => res.ok ? res.json() : [])
      .then(products => {
        if (!isMounted || !Array.isArray(products) || products.length === 0) return;

        const dynamicScoops = products.map(p => ({
          id: String(p.id || p.id_producto),
          name: p.name || p.nombre,
          file: p.model_3d_url || p.glb_url || 'scoop_vanilla.glb',
          color: getFlavorColor(p.name || p.nombre, p.categoria),
          emoji: p.emoji || '🍨',
          scale: 2.0
        }));

        const mergedMap = new Map();
        dynamicScoops.forEach(s => mergedMap.set(s.name.toLowerCase().trim(), s));
        DEFAULT_SCOOPS.forEach(s => {
          if (!mergedMap.has(s.name.toLowerCase().trim())) {
            mergedMap.set(s.name.toLowerCase().trim(), s);
          }
        });

        setScoopsList(Array.from(mergedMap.values()));
      })
      .catch(err => console.warn('Error al cargar catálogo en 3D:', err));

    return () => { isMounted = false; };
  }, []);

  // Calculate price: Base(10k) + Extra Scoops(2k each) + Toppings(1k each)
  const basePrice = 10000;
  const extraScoopsPrice = Math.max(0, selectedScoops.length - 1) * 2000;
  const toppingsPrice = selectedToppings.length * 1000;
  const total = basePrice + extraScoopsPrice + toppingsPrice;

  const handleAddToCart = () => {
    // SECURITY CHECK: Solo registrados en DB pueden comprar
    if (!user?.id) {
      alert('¡Vaya! Necesitas una cuenta registrada para realizar pedidos. Te llevamos al registro 🍦');
      navigate('/register');
      return;
    }

    // Capture the 3D scene as an image
    let screenshot = null;
    if (canvasRef.current) {
      try {
        screenshot = canvasRef.current.toDataURL('image/png');
      } catch (e) {
        console.error('Error capturing 3D snapshot:', e);
      }
    }

    const containerName = containers.find(c => c.id === container)?.name || 'Gelato';
    const firstScoop = scoopsList.find(s => String(s.id) === String(selectedScoops[0])) || DEFAULT_SCOOPS[0];

    const customProduct = {
      id: `custom-${Date.now()}`,
      nombre: `Personalizado: ${containerName}`,
      precio: total,
      image: screenshot, // The 360 snapshot!
      emoji: firstScoop?.emoji || '🍨',
      categoria: 'Personalizado',
      isCustom: true,
      gradientArt: {
        gradient: `linear-gradient(135deg, ${firstScoop?.color || '#FFB347'} 0%, #ffffff 100%)`,
        emoji: firstScoop?.emoji || '🍦',
        decorEmoji: containers.find(c => c.id === container)?.emoji || '✨'
      }
    };

    addToCart(customProduct, 1);
    
    // Optional: show some feedback or close modal/reset
    alert('¡Tu creación ha sido añadida al carrito! 🍦');
  };

  const tabs = [
    { id: 'container', label: 'Base', emoji: '🍦' },
    { id: 'scoop', label: `Sabor (${selectedScoops.length}/${MAX_SCOOPS})`, emoji: '🍨' },
    { id: 'topping', label: `Topping (${selectedToppings.length}/${MAX_TOPPINGS})`, emoji: '🍒' },
  ];

  // Toggle scoop: add if not maxed, remove if already present
  const handleToggleScoop = (id) => {
    setSelectedScoops(prev => {
      const index = prev.indexOf(id);
      if (index !== -1) {
        // Remove — but keep at least 1 scoop
        if (prev.length <= 1) return prev;
        return prev.filter((_, i) => i !== index);
      }
      // Add if under limit
      if (prev.length >= MAX_SCOOPS) return prev;
      return [...prev, id];
    });
  };

  // Toggle topping: add if not maxed, remove if already present
  const handleToggleTopping = (id) => {
    setSelectedToppings(prev => {
      const index = prev.indexOf(id);
      if (index !== -1) {
        return prev.filter((_, i) => i !== index);
      }
      if (prev.length >= MAX_TOPPINGS) return prev;
      return [...prev, id];
    });
  };

  const removeScoop = (index) => {
    if (selectedScoops.length <= 1) return;
    setSelectedScoops(prev => prev.filter((_, i) => i !== index));
  };

  const removeTopping = (index) => {
    setSelectedToppings(prev => prev.filter((_, i) => i !== index));
  };

  const getScoopCount = (id) => selectedScoops.filter(s => String(s) === String(id)).length;
  const getToppingCount = (id) => selectedToppings.filter(t => String(t) === String(id)).length;

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-amber-500/5 blur-[140px] rounded-full" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-pink-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-5 py-2 bg-amber-400/10 border border-amber-400/20 rounded-full text-xs font-bold tracking-widest text-amber-300 uppercase mb-6">
            <span className="text-base">🎨</span> Experiencia Interactiva
          </span>
          <h2 className="text-4xl md:text-5xl font-playfair font-bold mb-4">
            Crea tu{' '}
            <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400">
              Gelato
            </span>
          </h2>
          <p className="text-white/50 max-w-xl mx-auto">
            Diseña tu combinación perfecta en 3D. Hasta {MAX_SCOOPS} sabores y {MAX_TOPPINGS} toppings por creación.
          </p>
        </motion.div>

        {/* Main Layout */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="grid lg:grid-cols-[1fr_380px] gap-8"
        >
          {/* 3D Viewer */}
          <div className="relative rounded-[32px] border border-white/8 bg-white/[0.02] backdrop-blur-sm overflow-hidden min-h-[500px] group">
            {/* Corner decorations */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400/60 animate-pulse" />
              <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Vista 3D</span>
            </div>
            <div className="absolute top-4 right-4 z-10">
              <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Arrastra para rotar</span>
            </div>

            {/* Gradient border glow */}
            <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-amber-400/5 via-transparent to-pink-500/5 pointer-events-none" />

            <MemoizedCanvas 
              container={container} 
              selectedScoops={selectedScoops} 
              selectedToppings={selectedToppings} 
              availableScoops={scoopsList}
              canvasRef={canvasRef}
            />

            {/* Bottom info bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-dark/80 to-transparent">
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{containers.find(c => c.id === container)?.emoji}</span>
                  <span className="text-[11px] text-white/60 font-bold">{containers.find(c => c.id === container)?.name}</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-white/40 font-bold">{selectedScoops.length} sabor{selectedScoops.length !== 1 ? 'es' : ''}</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-white/40 font-bold">{selectedToppings.length} topping{selectedToppings.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configurator Panel */}
          <div className="flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-white/[0.03] border border-white/8 rounded-2xl">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300
                    ${activeTab === tab.id
                      ? 'bg-white/10 text-amber-300 shadow-lg'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'}
                  `}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Help text */}
            <div className="px-3">
              {activeTab === 'container' && (
                <p className="text-[11px] text-white/30 italic">Selecciona un tipo de base.</p>
              )}
              {activeTab === 'scoop' && (
                <p className="text-[11px] text-white/30 italic">
                  Toca para agregar un sabor (máx. {MAX_SCOOPS}). Toca de nuevo para quitar.
                </p>
              )}
              {activeTab === 'topping' && (
                <p className="text-[11px] text-white/30 italic">
                  Toca para agregar un topping (máx. {MAX_TOPPINGS}). Toca de nuevo para quitar.
                </p>
              )}
            </div>

            {/* Options */}
            <div className="flex-1 p-5 bg-white/[0.02] border border-white/8 rounded-[24px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-3 gap-3"
                >
                  {activeTab === 'container' && containers.map((item) => (
                    <SelectorButton
                      key={item.id}
                      item={item}
                      isSelected={container === item.id}
                      onClick={() => setContainer(item.id)}
                      showColor={false}
                      count={0}
                    />
                  ))}

                  {activeTab === 'scoop' && scoopsList.map((item) => (
                    <SelectorButton
                      key={item.id}
                      item={item}
                      isSelected={selectedScoops.map(String).includes(String(item.id))}
                      onClick={() => handleToggleScoop(item.id)}
                      showColor={true}
                      count={getScoopCount(item.id)}
                    />
                  ))}

                  {activeTab === 'topping' && toppingsData.map((item) => (
                    <SelectorButton
                      key={item.id}
                      item={item}
                      isSelected={selectedToppings.includes(item.id)}
                      onClick={() => handleToggleTopping(item.id)}
                      showColor={false}
                      count={getToppingCount(item.id)}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Summary card */}
            <div className="p-5 bg-gradient-to-br from-amber-400/5 to-orange-500/5 border border-amber-400/15 rounded-[24px]">
              <h4 className="text-sm font-bold text-amber-300 mb-3 flex items-center gap-2">
                <span className="text-base">✨</span> Tu Creación
              </h4>
              <div className="space-y-3">
                {/* Base */}
                <div>
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Base</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span>{containers.find(c => c.id === container)?.emoji}</span>
                    <span className="text-white text-sm font-bold">{containers.find(c => c.id === container)?.name}</span>
                  </div>
                </div>

                {/* Scoops */}
                <div>
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                    Sabores ({selectedScoops.length}/{MAX_SCOOPS})
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <AnimatePresence>
                      {selectedScoops.map((scoopId, idx) => {
                        const s = scoopsList.find(sc => String(sc.id) === String(scoopId));
                        return s ? (
                          <SelectionChip
                            key={`s-${idx}`}
                            emoji={s.emoji}
                            name={s.name}
                            onRemove={() => removeScoop(idx)}
                          />
                        ) : null;
                      })}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Toppings */}
                <div>
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                    Toppings ({selectedToppings.length}/{MAX_TOPPINGS})
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <AnimatePresence>
                      {selectedToppings.length === 0 ? (
                        <span className="text-xs text-white/20 italic">Sin toppings</span>
                      ) : (
                        selectedToppings.map((toppingId, idx) => {
                          const t = toppingsData.find(tp => tp.id === toppingId);
                          return t ? (
                            <SelectionChip
                              key={`t-${idx}`}
                              emoji={t.emoji}
                              name={t.name}
                              onRemove={() => removeTopping(idx)}
                            />
                          ) : null;
                        })
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/8">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToCart}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-background-dark font-bold text-sm uppercase tracking-widest shadow-lg shadow-amber-400/20 hover:shadow-amber-400/40 transition-shadow flex items-center justify-center gap-2"
                >
                  Confirmar y Añadir ({formatPrice(total)}) <ShoppingCart size={18} />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Preload assets to avoid popping ────────────────────────
[...containers, ...DEFAULT_SCOOPS, ...toppingsData].forEach(item => {
  useGLTF.preload(`${BASE_PATH}/${item.file}`);
});

export default GelatoBuilder3D;
