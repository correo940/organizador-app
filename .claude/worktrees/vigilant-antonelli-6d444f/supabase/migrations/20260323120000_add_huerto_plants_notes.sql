-- Add user notes to huerto_plants (safe if huerto_plants doesn't exist yet)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'huerto_plants'
  ) THEN
    ALTER TABLE public.huerto_plants
    ADD COLUMN IF NOT EXISTS user_notes TEXT DEFAULT '';
  END IF;
END $$;

