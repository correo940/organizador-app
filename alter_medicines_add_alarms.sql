-- Add dosage and alarm_times to medicines table
alter table public.medicines 
add column if not exists dosage text,
add column if not exists alarm_times text[]; -- Array of strings like "08:00", "20:00"

-- Update RLS policies if needed (usually not needed for new columns unless specific restrictions apply)
-- Ensure the new columns are accessible (public schema usually allows, RLS policies are row-based)
