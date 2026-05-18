-- Create vehicles table
create table if not exists public.vehicles (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,       -- e.g. "Audi A3"
    type text not null,       -- 'car' or 'moto'
    license_plate text,
    next_itv_date date,
    insurance_expiry_date date,
    image_url text,
    created_at timestamp with time zone default now(),
    
    constraint vehicles_pkey primary key (id)
);

-- Create vehicle events table (maintenance history)
create table if not exists public.vehicle_events (
    id uuid not null default gen_random_uuid(),
    vehicle_id uuid not null references public.vehicles(id) on delete cascade,
    type text not null,       -- 'repair', 'maintenance', 'oil_change', 'other'
    date date not null,
    cost numeric,
    description text,
    kilometers int,
    created_at timestamp with time zone default now(),
    
    constraint vehicle_events_pkey primary key (id)
);

-- Enable RLS
alter table public.vehicles enable row level security;
alter table public.vehicle_events enable row level security;

-- Policies for vehicles
create policy "Users can view their own vehicles" 
on public.vehicles for select using (auth.uid() = user_id);

create policy "Users can insert their own vehicles" 
on public.vehicles for insert with check (auth.uid() = user_id);

create policy "Users can update their own vehicles" 
on public.vehicles for update using (auth.uid() = user_id);

create policy "Users can delete their own vehicles" 
on public.vehicles for delete using (auth.uid() = user_id);

-- Policies for events (link via vehicle ownership would be ideal, but for simplicity checking accessing via vehicle_id usually requires a join or simple ownership if we added user_id to events too. 
-- To keep it normalized, we can check if the vehicle belongs to the user or simpler: add user_id to events or use a complex policy.
-- Adding user_id to events is safer for RLS performance.)

alter table public.vehicle_events add column user_id uuid references auth.users(id) on delete cascade;

create policy "Users can view their own vehicle events" 
on public.vehicle_events for select using (auth.uid() = user_id);

create policy "Users can insert their own vehicle events" 
on public.vehicle_events for insert with check (auth.uid() = user_id);

create policy "Users can update their own vehicle events" 
on public.vehicle_events for update using (auth.uid() = user_id);

create policy "Users can delete their own vehicle events" 
on public.vehicle_events for delete using (auth.uid() = user_id);

-- Indexes
create index vehicles_user_id_idx on public.vehicles(user_id);
create index vehicle_events_vehicle_id_idx on public.vehicle_events(vehicle_id);
create index vehicle_events_user_id_idx on public.vehicle_events(user_id);
