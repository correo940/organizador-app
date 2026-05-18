-- ─────────────────────────────────────────────────────────────
-- Migración: Secretaria Quioba — Fase 2
-- Ejecuta esto en Supabase SQL Editor si ya tenías la tabla
-- secretary_syncs creada previamente (Fase 1).
-- ─────────────────────────────────────────────────────────────

-- 1. Añadir columna planned_expenses si no existe
ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS planned_expenses NUMERIC(10,2);

-- 2. Verificar que la tabla tiene todas las columnas de Fase 2
-- (Si la tabla NO existía aún, usa el script create_secretary_syncs.sql)

-- Resultado esperado al hacer SELECT:
-- id, user_id, sync_date, sync_type, mode, notes,
-- victories, planned_expenses, briefing_read_at,
-- completed_at, created_at

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'secretary_syncs'
ORDER BY ordinal_position;
