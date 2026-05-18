-- Add event_date to admin_post_its
ALTER TABLE public.admin_post_its 
ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ;
