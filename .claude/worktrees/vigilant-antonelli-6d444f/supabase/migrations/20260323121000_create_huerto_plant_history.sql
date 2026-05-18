-- Create huerto plant scan history
CREATE TABLE IF NOT EXISTS public.huerto_plant_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES public.huerto_plants(id) ON DELETE CASCADE,
    species TEXT,
    common_name TEXT,
    watering_frequency_days INTEGER,
    sunlight_needs TEXT,
    health_status TEXT,
    care_instructions TEXT,
    image_b64 TEXT,
    action_type TEXT DEFAULT 'scan',
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.huerto_plant_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plant history"
    ON public.huerto_plant_history FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plant history"
    ON public.huerto_plant_history FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS huerto_plant_history_user_id_idx ON public.huerto_plant_history(user_id);
CREATE INDEX IF NOT EXISTS huerto_plant_history_plant_id_idx ON public.huerto_plant_history(plant_id);
CREATE INDEX IF NOT EXISTS huerto_plant_history_scanned_at_idx ON public.huerto_plant_history(scanned_at);

