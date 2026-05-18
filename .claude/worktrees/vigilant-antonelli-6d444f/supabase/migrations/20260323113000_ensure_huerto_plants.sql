-- Ensure huerto_plants exists before adding columns or history.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'huerto_plants'
  ) THEN
    CREATE TABLE public.huerto_plants (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      species TEXT,
      common_name TEXT,
      watering_frequency_days INTEGER DEFAULT 7,
      sunlight_needs TEXT,
      health_status TEXT,
      care_instructions TEXT,
      image_b64 TEXT,
      last_watered_date DATE DEFAULT CURRENT_DATE,
      next_watering_date DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  END IF;
END $$;

ALTER TABLE public.huerto_plants ENABLE ROW LEVEL SECURITY;

-- Use a single consistent policy name; drop if it already exists.
DROP POLICY IF EXISTS "Users can manage their own plants" ON public.huerto_plants;
CREATE POLICY "Users can manage their own plants"
  ON public.huerto_plants
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS huerto_plants_user_id_idx ON public.huerto_plants(user_id);
CREATE INDEX IF NOT EXISTS huerto_plants_next_watering_idx ON public.huerto_plants(next_watering_date);

