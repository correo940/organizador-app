-- Crear el bucket de medios (videos/imagenes) si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('debate-media', 'debate-media', true)
ON CONFLICT (id) DO NOTHING;

-- Política para acceso público (ver/descargar)
CREATE POLICY "Public Access Debate Media" ON storage.objects
FOR SELECT USING ( bucket_id = 'debate-media' );

-- Política para subir (usuarios autenticados)
CREATE POLICY "Auth Upload Debate Media" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'debate-media' 
    AND auth.role() = 'authenticated'
);
