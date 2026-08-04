-- ============================================================
-- MIGRACIÓN DE BASE DE DATOS: SUPER GELATTO ADMIN PANEL
-- Ejecuta este script en el editor SQL de tu panel de Supabase.
-- ============================================================

-- 1. LIMPIEZA DE TABLAS DE FACE ID ANTERIOR
DROP TABLE IF EXISTS public.rostros_admin_muestras CASCADE;
DROP TABLE IF EXISTS public.rostros_admin CASCADE;

-- 1b. TABLAS DE BIOMETRÍA WEBAUTHN (FACE ID / TOUCH ID / PASSKEYS)
CREATE TABLE IF NOT EXISTS public.admin_face_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports TEXT[],
    id_usuario INTEGER NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_webauthn_challenges (
    id_usuario INTEGER PRIMARY KEY REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    challenge TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1c. TABLA DE RECONOCIMIENTO FACIAL CON AWS REKOGNITION
CREATE TABLE IF NOT EXISTS public.admin_face_rekognition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aws_face_id TEXT UNIQUE NOT NULL,
    id_usuario INTEGER NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_face_rekognition ENABLE ROW LEVEL SECURITY;


-- 2. TABLA: modelos_3d
-- Almacena los enlaces a los modelos 3D (.glb) generados por Tripo AI vinculados a un producto.
-- Soporta producto_id como INTEGER o UUID.

-- Si tu columna 'producto.id_producto' es de tipo INTEGER (Serial):
CREATE TABLE IF NOT EXISTS public.modelos_3d (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id INTEGER REFERENCES public.producto(id_producto) ON DELETE CASCADE,
    prompt_usado TEXT,
    glb_url TEXT NOT NULL,
    tripo_task_id TEXT,
    estado TEXT DEFAULT 'listo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si tu columna 'producto.id_producto' es de tipo UUID, descomenta esta sección y elimina la de arriba:
/*
CREATE TABLE IF NOT EXISTS public.modelos_3d (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID REFERENCES public.producto(id_producto) ON DELETE CASCADE,
    prompt_usado TEXT,
    glb_url TEXT NOT NULL,
    tripo_task_id TEXT,
    estado TEXT DEFAULT 'listo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- Habilitar RLS en 'modelos_3d'
ALTER TABLE public.modelos_3d ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para 'modelos_3d'
CREATE POLICY "Public read access for modelos_3d" 
ON public.modelos_3d 
FOR SELECT 
USING (true); -- Cualquiera en la tienda puede consultar los modelos 3D

CREATE POLICY "Admin write access for modelos_3d" 
ON public.modelos_3d 
FOR ALL 
USING (true)
WITH CHECK (true);


-- ============================================================
-- INSTRUCCIÓN ADICIONAL EN SUPABASE STORAGE:
-- Recuerda crear un bucket público en Supabase Storage llamado 'modelos-3d'
-- para almacenar los archivos .glb. Asegúrate de configurar sus políticas de
-- acceso como públicas para permitir la previsualización 3D en el sitio.
-- ============================================================




