-- Migración para el Módulo de Salud Ocupacional y Ergonomía

-- 1. Tabla de Auditorías Ergonómicas (Módulo 1)
CREATE TABLE public.occupational_audits (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  
  -- Evaluaciones (1-10 o categorías, almacenadas como texto para mayor flexibilidad inicial)
  feet_alignment text,
  knees_alignment text,
  pelvis_alignment text,
  lumbar_support text,
  arms_alignment text,
  wrists_alignment text,
  monitor_alignment text,
  neck_alignment text,
  
  -- Puntuación global calculada
  score integer,
  notes text,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.occupational_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own audits" 
  ON public.occupational_audits FOR ALL 
  USING (auth.uid() = user_id);

-- 2. Tabla de Configuración de Ergonomía (Módulos 2 y 5)
CREATE TABLE public.occupational_settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  
  -- Tipo de escritorio
  desk_type text DEFAULT 'traditional', -- 'traditional', 'standing'
  
  -- Pomodoro y Reglas (Minutos)
  pomodoro_work_time integer DEFAULT 25,
  pomodoro_break_time integer DEFAULT 5,
  
  -- Regla Escritorio Elevable (ej. 20 sentado, 8 de pie, 2 en movimiento)
  sitting_minutes integer DEFAULT 20,
  standing_minutes integer DEFAULT 8,
  moving_minutes integer DEFAULT 2,
  
  -- Notificaciones y silencios (Módulo 5)
  notifications_enabled boolean DEFAULT true,
  notifications_start_time time DEFAULT '09:00:00',
  notifications_end_time time DEFAULT '18:00:00',
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.occupational_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own settings" 
  ON public.occupational_settings FOR ALL 
  USING (auth.uid() = user_id);

-- 3. Tabla de Síntomas y Dolor Diario (Módulo 5)
CREATE TABLE public.occupational_symptoms (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  
  -- Nivel de dolor general y por zonas
  pain_level integer CHECK (pain_level >= 0 AND pain_level <= 10),
  pain_zones text[], -- Ej: ['cuello', 'lumbar', 'munecas']
  
  -- Fatiga Visual
  visual_fatigue integer CHECK (visual_fatigue >= 0 AND visual_fatigue <= 10),
  
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.occupational_symptoms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own symptoms" 
  ON public.occupational_symptoms FOR ALL 
  USING (auth.uid() = user_id);

-- Funciones y Triggers (Opcional: para actulizar updated_at en settings)
CREATE OR REPLACE FUNCTION update_occupational_settings_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_occupational_settings_modtime
    BEFORE UPDATE ON public.occupational_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_occupational_settings_modtime();
