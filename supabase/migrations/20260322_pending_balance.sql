-- ============================================
-- MIGRACIÓN: Módulo "Balance Pendiente"
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Ampliar savings_accounts con nuevas columnas
ALTER TABLE savings_accounts
  ADD COLUMN IF NOT EXISTS include_in_total BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'libre';

-- 2. Tabla de Proyectos de Balance Pendiente
CREATE TABLE IF NOT EXISTS pending_balance_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pending_balance_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own projects"
  ON pending_balance_projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Tabla de Gastos Pendientes
CREATE TABLE IF NOT EXISTS pending_balance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES pending_balance_projects(id) ON DELETE SET NULL,
  source_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,
  concept TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  merchant TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'repaid')),
  repaid_date DATE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pending_balance_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own expenses"
  ON pending_balance_expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Tabla de Claves API del usuario
CREATE TABLE IF NOT EXISTS ai_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openrouter', 'groq')),
  api_key TEXT NOT NULL,
  model_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API keys"
  ON ai_api_keys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
