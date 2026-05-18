-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: Quioba Secretaria — Fase 4 (IA, Prioridades, Conversaciones)
-- Ejecuta esto en el SQL Editor de Supabase
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Historial de conversación IA (para el Sync Conversacional con Groq)
ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS conversation_history JSONB;

-- 2. Resumen generado por la IA al final de cada sync conversacional
ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- 3. Puntuaciones de prioridad calculadas en cada sync (para historial)
ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS priority_scores JSONB;

-- 4. Verificar columnas finales
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'secretary_syncs'
ORDER BY ordinal_position;
