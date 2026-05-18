-- Create huerto_plants table
CREATE TABLE IF NOT EXISTS public.huerto_plants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT,
    common_name TEXT,
    watering_frequency_days INTEGER DEFAULT 7,
    sunlight_needs TEXT,
    health_status TEXT,
    care_instructions TEXT,
    image_b64 TEXT, -- Storing as base64 for simplicity in this demo, but S3/Storage is better for production
    last_watered_date DATE DEFAULT CURRENT_DATE,
    next_watering_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up RLS
ALTER TABLE public.huerto_plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own plants"
    ON public.huerto_plants
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS huerto_plants_user_id_idx ON public.huerto_plants(user_id);
CREATE INDEX IF NOT EXISTS huerto_plants_next_watering_idx ON public.huerto_plants(next_watering_date);
