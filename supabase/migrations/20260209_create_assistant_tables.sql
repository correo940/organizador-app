CREATE TABLE IF NOT EXISTS public.assistant_responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  keywords TEXT[] NOT NULL,
  category TEXT DEFAULT 'custom',
  response_template TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assistant_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read active assistant responses"
  ON public.assistant_responses FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated can manage assistant responses"
  ON public.assistant_responses FOR ALL
  USING (auth.uid() IS NOT NULL);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their assistant conversations"
  ON public.assistant_conversations FOR ALL
  USING (auth.uid() = user_id);

INSERT INTO public.assistant_responses (keywords, category, response_template, priority) VALUES
  (ARRAY['hola', 'buenas', 'hey', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos'], 'greeting', 'Hola! Soy el asistente de Quioba. Puedo ayudarte con informacion sobre tus ahorros, tareas, lista de compras y mas. En que puedo ayudarte?', 100),
  (ARRAY['gracias', 'muchas gracias', 'te agradezco', 'genial', 'perfecto'], 'farewell', 'De nada! Aqui estare cuando me necesites.', 90),
  (ARRAY['adios', 'chao', 'hasta luego', 'nos vemos'], 'farewell', 'Hasta pronto! Que tengas un excelente dia.', 90),
  (ARRAY['ayuda', 'help', 'que puedes hacer', 'funciones', 'opciones'], 'help', 'Puedo ayudarte con: Ahorros, Tareas, Compras, Medicamentos, Seguros y Vehiculos. Preguntame lo que necesites!', 100),
  (ARRAY['quien eres', 'que eres', 'como te llamas'], 'about', 'Soy el asistente virtual de Quioba. Estoy aqui para ayudarte a consultar informacion de tu cuenta de forma rapida y sencilla.', 80)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_assistant_responses_keywords ON public.assistant_responses USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_id ON public.assistant_conversations (user_id);
