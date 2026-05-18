-- Create medicines table
create table if not exists public.medicines (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text,
    expiration_date date,
    created_at timestamp with time zone default now(),
    
    constraint medicines_pkey primary key (id)
);

-- Enable RLS
alter table public.medicines enable row level security;

-- Create policies
create policy "Users can view their own medicines" 
on public.medicines for select 
using (auth.uid() = user_id);

create policy "Users can insert their own medicines" 
on public.medicines for insert 
with check (auth.uid() = user_id);

create policy "Users can update their own medicines" 
on public.medicines for update 
using (auth.uid() = user_id);

create policy "Users can delete their own medicines" 
on public.medicines for delete 
using (auth.uid() = user_id);

-- Create index for faster queries
create index medicines_user_id_idx on public.medicines(user_id);
create index medicines_expiration_date_idx on public.medicines(expiration_date);
