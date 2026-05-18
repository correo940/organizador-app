-- Create Smart Scheduler Tables

-- 1. Scheduler Profiles (extends public.profiles)
create table if not exists public.smart_scheduler_profiles (
    id uuid primary key references public.profiles(id) on delete cascade,
    physical_level text not null check (physical_level in ('sedentary', 'active', 'athlete')),
    availability_intensity text not null check (availability_intensity in ('low', 'medium', 'high')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Activities Catalog
create table if not exists public.smart_scheduler_activities (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    duration_minutes integer not null default 30,
    intensity_level text not null check (intensity_level in ('low', 'medium', 'high')),
    category text not null check (category in ('physical', 'mental', 'leisure', 'household')),
    required_physical_level text not null default 'any' check (required_physical_level in ('any', 'sedentary', 'active', 'athlete')),
    created_at timestamptz default now(),
    created_by uuid references public.profiles(id) on delete set null
);

-- 3. Fixed Time Blocks (User's weekly template)
create table if not exists public.smart_scheduler_fixed_blocks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    day_of_week text not null check (day_of_week in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    start_time time not null,
    end_time time not null,
    label text not null,
    color text default '#3b82f6', -- default blue
    created_at timestamptz default now(),
    
    constraint end_time_after_start_time check (end_time > start_time)
);

-- 4. Generated Schedule Blocks (The result)
create table if not exists public.smart_scheduler_generated_blocks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    date date not null,
    start_time time not null,
    end_time time not null,
    activity_id uuid references public.smart_scheduler_activities(id) on delete set null,
    status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'skipped')),
    created_at timestamptz default now()
);

-- Enable RLS
alter table public.smart_scheduler_profiles enable row level security;
alter table public.smart_scheduler_activities enable row level security;
alter table public.smart_scheduler_fixed_blocks enable row level security;
alter table public.smart_scheduler_generated_blocks enable row level security;

-- Policies (Simple for now: Users manage their own data, Everyone reads activities)

-- Profiles: Users can view/edit their own
create policy "Users can view own scheduler profile" on public.smart_scheduler_profiles
    for select using (auth.uid() = id);

create policy "Users can update own scheduler profile" on public.smart_scheduler_profiles
    for update using (auth.uid() = id);

create policy "Users can insert own scheduler profile" on public.smart_scheduler_profiles
    for insert with check (auth.uid() = id);

-- Activities: All authenticated users can read. Only admins/creators (for now everyone can be creator to simplify testing) can create/edit.
create policy "Authenticated users can read activities" on public.smart_scheduler_activities
    for select using (auth.role() = 'authenticated');

create policy "Authenticated users can create activities" on public.smart_scheduler_activities
    for insert with check (auth.role() = 'authenticated'); -- Logic will handle admin check in UI or trigger later if strictly needed

create policy "Creators can update activities" on public.smart_scheduler_activities
    for update using (auth.uid() = created_by);

create policy "Creators can delete activities" on public.smart_scheduler_activities
    for delete using (auth.uid() = created_by);

-- Fixed Blocks: CRUD for own
create policy "Users can manage own fixed blocks" on public.smart_scheduler_fixed_blocks
    for all using (auth.uid() = user_id);

-- Generated Blocks: CRUD for own
create policy "Users can manage own generated blocks" on public.smart_scheduler_generated_blocks
    for all using (auth.uid() = user_id);

-- Notify schema reload
notify pgrst, 'reload schema';
