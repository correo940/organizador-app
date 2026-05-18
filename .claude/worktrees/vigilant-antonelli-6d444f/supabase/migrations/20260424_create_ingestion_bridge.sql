-- Crear la tabla ingestion_bridge para el puente de escaneo móvil
CREATE TABLE IF NOT EXISTS public.document_ingestion_bridge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_code TEXT NOT NULL UNIQUE,
    file_url TEXT,
    file_name TEXT,
    content_type TEXT,
    status TEXT DEFAULT 'pending', -- pending, uploaded, processed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Habilitar Realtime para esta tabla
ALTER PUBLICATION supabase_realtime ADD TABLE document_ingestion_bridge;

-- RLS (Políticas de Seguridad)
ALTER TABLE public.document_ingestion_bridge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for bridge" 
ON public.document_ingestion_bridge FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public select for bridge if code matches" 
ON public.document_ingestion_bridge FOR SELECT 
USING (true);

CREATE POLICY "Allow public update for bridge" 
ON public.document_ingestion_bridge FOR UPDATE 
USING (true);
