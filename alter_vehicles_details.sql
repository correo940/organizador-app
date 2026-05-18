-- Add detailed columns to vehicles table
alter table public.vehicles 
add column if not exists brand text,
add column if not exists model text,
add column if not exists year int,
add column if not exists oil_type text,       -- e.g., "5W-30"
add column if not exists tire_pressure text;  -- e.g., "2.5 bar / 2.3 bar"

-- Update vehicle_events to support granular maintenance items (optional JSON or text details)
-- We can standardise common items in description or add a 'maintenance_items' column
alter table public.vehicle_events
add column if not exists maintenance_items text[]; -- e.g., ['oil_filter', 'air_filter', 'cabin_filter', 'spark_plugs']
