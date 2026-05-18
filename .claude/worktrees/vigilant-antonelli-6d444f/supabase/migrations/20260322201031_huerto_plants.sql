-- Create huerto_plants table
CREATE TABLE IF NOT EXISTS public.huerto_plants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT,
    common_name TEXT,
    watering_frequency_days INTEGER,
    sunlight_needs TEXT,
    health_status TEXT,
    care_instructions TEXT,
    image_b64 TEXT,
    last_watered_date DATE,
    next_watering_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set Enable RLS
ALTER TABLE public.huerto_plants ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view their own plants"
    ON public.huerto_plants FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plants"
    ON public.huerto_plants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plants"
    ON public.huerto_plants FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plants"
    ON public.huerto_plants FOR DELETE
    USING (auth.uid() = user_id);
