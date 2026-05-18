-- Create Helper Types (idempotent)
DO $$ BEGIN
  CREATE TYPE app_category AS ENUM ('productivity', 'utility', 'lifestyle', 'finance', 'social');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table: marketplace_apps (The Catalog)
CREATE TABLE IF NOT EXISTS public.marketplace_apps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon_key TEXT NOT NULL,
  route TEXT NOT NULL,
  price DECIMAL(10,2) DEFAULT 0.00, -- precio anual
  category app_category DEFAULT 'utility',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_app_purchases (Subscriptions)
CREATE TABLE IF NOT EXISTS public.user_app_purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  app_id UUID REFERENCES public.marketplace_apps(id) ON DELETE CASCADE NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0.00,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
  auto_renew BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active', -- active, expired, refunded
  UNIQUE(user_id, app_id)
);

-- Add columns if table already exists without them
DO $$ BEGIN
  ALTER TABLE public.user_app_purchases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year');
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.user_app_purchases ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;
EXCEPTION WHEN others THEN NULL;
END $$;

-- RLS: marketplace_apps
ALTER TABLE public.marketplace_apps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view active apps" ON public.marketplace_apps;
CREATE POLICY "Everyone can view active apps" 
  ON public.marketplace_apps FOR SELECT 
  USING (is_active = true);

-- RLS: user_app_purchases
ALTER TABLE public.user_app_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases" ON public.user_app_purchases;
CREATE POLICY "Users can view own purchases" 
  ON public.user_app_purchases FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own purchases
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.user_app_purchases;
CREATE POLICY "Users can insert own purchases"
  ON public.user_app_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own purchases (renewal)
DROP POLICY IF EXISTS "Users can update own purchases" ON public.user_app_purchases;
CREATE POLICY "Users can update own purchases"
  ON public.user_app_purchases FOR UPDATE
  USING (auth.uid() = user_id);

-- Seeding Data (precios anuales)
INSERT INTO public.marketplace_apps (key, name, description, icon_key, route, price, category) VALUES
  ('desktop', 'Quioba Web', 'Acceso al escritorio completo de Quioba desde tu móvil.', 'Settings', '/desktop', 1.99, 'utility'),
  ('shopping', 'Lista de la Compra', 'Gestiona tu lista de la compra y despensa inteligente.', 'ShoppingBag', '/apps/mi-hogar/shopping', 4.99, 'lifestyle'),
  ('chef-ia', 'Chef IA', 'Tu asistente personal de cocina y recetas.', 'ChefHat', '/apps/mi-hogar/chef', 2.99, 'lifestyle'),
  ('tasks', 'Gestor de Tareas', 'Organiza tu día a día con tareas rápidas.', 'ListTodo', '/apps/mi-hogar/tasks', 1.99, 'productivity'),
  ('roster', 'Cuadrante de Turnos', 'Gestiona y escanea tu cuadrante de trabajo.', 'Calendar', '/apps/mi-hogar/roster', 3.99, 'productivity'),
  ('documents', 'Gestor Documental', 'Tus documentos importantes (DNI, Seguros) siempre a mano.', 'FileText', '/apps/mi-hogar/documents', 4.99, 'utility'),
  ('passwords', 'Gestor de Contraseñas', 'Almacena tus contraseñas de forma segura.', 'KeyRound', '/apps/passwords', 5.99, 'utility'),
  ('assistant', 'Asistente Quioba', 'Tu asistente personal con IA para todo.', 'MessageCircle', '/apps/mi-hogar/asistente', 9.99, 'productivity')
ON CONFLICT (key) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  route = EXCLUDED.route,
  icon_key = EXCLUDED.icon_key;

-- NOTE: No auto-grant. All apps start locked for all users.
-- Users unlock apps by purchasing individual subscriptions or upgrading to Premium.
