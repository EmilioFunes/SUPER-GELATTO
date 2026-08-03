import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows, Center } from '@react-three/drei';
import { RefreshCw } from 'lucide-react';

if (typeof window !== 'undefined') {
  const isIgnored = (msg) => typeof msg === 'string' && (msg.includes('THREE.Clock') || msg.includes('X4122') || msg.includes('WebGLProgram'));
  const origWarn = console.warn;
  const origErr = console.error;
  console.warn = (...args) => { if (!isIgnored(args[0])) origWarn(...args); };
  console.error = (...args) => { if (!isIgnored(args[0])) origErr(...args); };
}

// Subcomponente para optimizar y renderizar el modelo GLB cargado
const Model = ({ url }) => {
  const { scene } = useGLTF(url);
  
  // Clonar y habilitar sombras y propiedades físicas premium en el modelo
  const optimizedScene = useMemo(() => {
    const cloned = scene.clone();
    cloned.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        
        // Mejorar los materiales si existen para que luzcan más realistas
        if (node.material) {
          node.material.roughness = 0.6;
          node.material.metalness = 0.1;
          node.material.envMapIntensity = 1.0;
        }
      }
    });
    return cloned;
  }, [scene]);

  // Escalado adecuado para que quepa en el visor
  return <primitive object={optimizedScene} scale={2.8} />;
};

const Model3DPreview = ({ url }) => {
  if (!url) return null;

  return (
    <div className="w-full h-[350px] bg-black/60 border border-white/10 rounded-3xl overflow-hidden relative shadow-inner group">
      {/* Fondo Premium Sutil */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] to-[#121212] opacity-40 pointer-events-none"></div>

      <Suspense fallback={
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
          <RefreshCw className="w-8 h-8 animate-spin text-gold-premium mb-3" />
          <p className="text-xs uppercase tracking-[0.2em] font-light text-gold-premium/80">Analizando Malla 3D...</p>
        </div>
      }>
        <Canvas 
          dpr={[1, 1.5]}
          camera={{ position: [0, 1.2, 4.2], fov: 45 }} 
          shadows
          gl={{ preserveDrawingBuffer: false, antialias: true }}
          frameloop="demand"
          onCreated={({ gl }) => {
            // Escuchar la pérdida de contexto WebGL para no lanzar errores
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              console.warn('[3D] Contexto WebGL perdido. Se restaurará al volver a montar.');
            });
          }}
        >
          <ambientLight intensity={0.8} />
          
          {/* Luz principal proyectora de sombras */}
          <directionalLight 
            position={[5, 10, 5]} 
            intensity={1.8} 
            castShadow 
            shadow-mapSize-width={512} 
            shadow-mapSize-height={512}
            shadow-bias={-0.0001}
          />
          
          {/* Luz de relleno */}
          <pointLight position={[-5, 5, -5]} intensity={0.6} />
          
          <Center>
            <Model url={url} />
          </Center>

          {/* Controles de cámara táctil y ratón */}
          <OrbitControls 
            enablePan={false} 
            enableZoom={true} 
            minDistance={2} 
            maxDistance={8} 
            autoRotate={true}
            autoRotateSpeed={1.5}
            makeDefault
          />
          
          {/* Sombra de contacto en el suelo */}
          <ContactShadows 
            position={[0, -1.3, 0]} 
            opacity={0.7} 
            scale={6} 
            blur={1.8} 
            far={10} 
          />
          
          {/* Reflexiones realistas de estudio */}
          <Environment preset="studio" />
        </Canvas>
      </Suspense>
      
      {/* Badge de Vista Interactiva */}
      <div className="absolute bottom-4 right-4 bg-[#0a0a0a]/80 border border-white/10 rounded-full px-4 py-1.5 text-[9px] tracking-[0.15em] uppercase text-gold-premium font-medium pointer-events-none backdrop-blur-md shadow-lg group-hover:border-gold-premium/30 transition-colors">
        Modelado 360° Activo
      </div>
    </div>
  );
};

export default Model3DPreview;
