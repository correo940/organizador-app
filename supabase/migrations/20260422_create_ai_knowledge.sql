-- Tabla para almacenar el conocimiento personalizado que el usuario alimenta a la IA de Quioba
CREATE TABLE IF NOT EXISTS ai_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS ai_knowledge_user_id_idx ON ai_knowledge(user_id);

-- Row Level Security
ALTER TABLE ai_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own knowledge"
  ON ai_knowledge
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
