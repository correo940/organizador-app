-- Tabla para guardar el historial de Syncs con la Secretaria Quioba
CREATE TABLE IF NOT EXISTS secretary_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  sync_date DATE NOT NULL,
  sync_type TEXT DEFAULT 'daily' CHECK (sync_type IN ('daily', 'weekly', 'monthly')),
  mode TEXT DEFAULT 'quick' CHECK (mode IN ('quick', 'deep')),
  notes TEXT,
  victories TEXT[],
  planned_expenses NUMERIC(10,2),
  briefing_read_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: cada usuario solo ve sus propios syncs
ALTER TABLE secretary_syncs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_syncs_select" ON secretary_syncs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_own_syncs_insert" ON secretary_syncs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_own_syncs_update" ON secretary_syncs
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "users_own_syncs_delete" ON secretary_syncs
  FOR DELETE USING (user_id = auth.uid());

-- Índice para buscar syncs por usuario y fecha
CREATE INDEX IF NOT EXISTS idx_secretary_syncs_user_date
  ON secretary_syncs (user_id, sync_date DESC);
