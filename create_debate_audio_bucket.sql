-- Crear el bucket si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('debate-audio', 'debate-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Política para que cualquiera pueda ESCUCHAR (Select)
CREATE POLICY "Public Access Debate Audio" ON storage.objects
FOR SELECT USING ( bucket_id = 'debate-audio' );

-- Política para que usuarios autenticados puedan SUBIR (Insert)
CREATE POLICY "Auth Upload Debate Audio" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'debate-audio' 
    AND auth.role() = 'authenticated'
);
