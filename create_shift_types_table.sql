-- Create shift_types table for user-configurable roster settings
CREATE TABLE IF NOT EXISTS public.shift_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,          -- e.g. 'M', 'T', 'N', 'SALIENTE'
    label TEXT NOT NULL,         -- e.g. 'Mañana', 'Tarde'
    start_time TIME NOT NULL,    -- e.g. '07:00'
    end_time TIME NOT NULL,      -- e.g. '15:00'
    color TEXT NOT NULL,         -- e.g. '#eab308'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, code)
);

-- Enable RLS
ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own shift types" 
    ON public.shift_types FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shift types" 
    ON public.shift_types FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shift types" 
    ON public.shift_types FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shift types" 
    ON public.shift_types FOR DELETE 
    USING (auth.uid() = user_id);

-- Optional: Initial seeding for specific user? No, we will handle seeding in the UI if empty.
