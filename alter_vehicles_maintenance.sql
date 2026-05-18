-- Add mileage tracking columns to vehicles table
alter table public.vehicles 
add column if not exists current_kilometers int default 0,
add column if not exists last_oil_change_km int default 0,
add column if not exists last_tire_change_km int default 0,
add column if not exists oil_change_interval_km int default 15000,
add column if not exists tire_change_interval_km int default 40000;
