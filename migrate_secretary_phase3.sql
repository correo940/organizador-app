-- ─────────────────────────────────────────────────────────────
-- Migración: Secretaria Quioba — Fase 3 (Visión Semanal y Mensual)
-- Ejecuta esto en Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- 1. Ampliar secretary_syncs para soportar tipo semanal/mensual
ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS sync_type TEXT DEFAULT 'daily'
    CHECK (sync_type IN ('daily', 'weekly', 'monthly'));

ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS week_start DATE;

ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS month_year TEXT; -- formato '2026-04'

-- 2. Añadir planned_expenses si no existe (Fase 2)
ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS planned_expenses NUMERIC(10,2);

-- 3. Añadir completed_tasks_count para resúmenes mensuales
ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS completed_tasks_count INTEGER;

-- 4. Añadir savings_achieved para el resumen mensual
ALTER TABLE secretary_syncs
  ADD COLUMN IF NOT EXISTS savings_achieved NUMERIC(10,2);

-- 5. Verificar columnas finales
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'secretary_syncs'
ORDER BY ordinal_position;
