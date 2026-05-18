-- create work_shifts table
create table if not exists public.work_shifts (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null default auth.uid(),
    start_time timestamptz not null,
    end_time timestamptz not null,
    title text not null,
    color text,
    created_at timestamptz not null default now(),
    
    constraint work_shifts_pkey primary key (id),
    constraint work_shifts_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Enable RLS
alter table public.work_shifts enable row level security;

-- Create policies
create policy "Users can view their own shifts"
    on public.work_shifts for select
    using (auth.uid() = user_id);

create policy "Users can insert their own shifts"
    on public.work_shifts for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own shifts"
    on public.work_shifts for update
    using (auth.uid() = user_id);

create policy "Users can delete their own shifts"
    on public.work_shifts for delete
    using (auth.uid() = user_id);

-- Create index for faster queries by date range (optional but recommended)
create index work_shifts_user_id_idx on public.work_shifts(user_id);
create index work_shifts_start_time_idx on public.work_shifts(start_time);
