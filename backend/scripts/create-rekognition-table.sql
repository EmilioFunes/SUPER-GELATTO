-- Ejecuta este SQL en el Editor SQL de tu consola de Supabase:
-- https://supabase.com/dashboard → Tu proyecto → SQL Editor

CREATE TABLE IF NOT EXISTS public.admin_face_rekognition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aws_face_id TEXT UNIQUE NOT NULL,
    id_usuario INTEGER NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_face_rekognition ENABLE ROW LEVEL SECURITY;
