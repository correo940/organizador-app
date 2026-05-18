-- 1. CORRECCIÓN DE TABLA (Permitir acceso público por código)
-- Aseguramos que la tabla existe y tiene RLS
ALTER TABLE public.document_ingestion_bridge ENABLE ROW LEVEL SECURITY;

-- Borramos políticas anteriores por si acaso para evitar conflictos
DROP POLICY IF EXISTS "Allow public insert for bridge" ON public.document_ingestion_bridge;
DROP POLICY IF EXISTS "Allow public select for bridge if code matches" ON public.document_ingestion_bridge;
DROP POLICY IF EXISTS "Allow public update for bridge" ON public.document_ingestion_bridge;

-- Política para INSERT (Solo PC autenticado suele hacerlo, pero lo dejamos abierto por simplicidad en local)
CREATE POLICY "Allow public insert for bridge" 
ON public.document_ingestion_bridge FOR INSERT 
WITH CHECK (true);

-- Política para SELECT (Necesaria para que el móvil lea la fila antes de actualizarla)
CREATE POLICY "Allow public select for bridge" 
ON public.document_ingestion_bridge FOR SELECT 
USING (true);

-- Política para UPDATE (Donde el móvil guarda la URL del archivo)
CREATE POLICY "Allow public update for bridge" 
ON public.document_ingestion_bridge FOR UPDATE 
USING (true)
WITH CHECK (true);


-- 2. CORRECCIÓN DE STORAGE (Permitir subida de fotos sin login)
-- Nos aseguramos de que el bucket existe (esto no suele dar error si ya existe)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('secure-docs', 'secure-docs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Permitir INSERT (Upload) anónimo en la carpeta 'bridge-uploads/'
CREATE POLICY "Allow public uploads to bridge-uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
    bucket_id = 'secure-docs' AND 
    (storage.foldername(name))[1] = 'bridge-uploads'
);

-- Permitir SELECT (View) público para que el PC pueda ver el archivo
CREATE POLICY "Allow public select for bridge-uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'secure-docs');
