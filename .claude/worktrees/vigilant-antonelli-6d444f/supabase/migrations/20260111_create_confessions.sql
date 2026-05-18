-- Create table for contacts specific to the Confessions app
create table if not exists public.confession_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Establish RLS for contacts
alter table public.confession_contacts enable row level security;

create policy "Users can view their own confession contacts"
  on public.confession_contacts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own confession contacts"
  on public.confession_contacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own confession contacts"
  on public.confession_contacts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own confession contacts"
  on public.confession_contacts for delete
  using (auth.uid() = user_id);

-- Create table for confessions (entries)
create table if not exists public.confessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references public.confession_contacts(id) on delete set null,
  type text check (type in ('text', 'audio', 'video')) not null,
  content text, -- Can be text body or file path for media
  mood text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Establish RLS for confessions
alter table public.confessions enable row level security;

create policy "Users can view their own confessions"
  on public.confessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own confessions"
  on public.confessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own confessions"
  on public.confessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own confessions"
  on public.confessions for delete
  using (auth.uid() = user_id);

-- Create storage bucket for confessions media if it doesn't exist
insert into storage.buckets (id, name, public)
values ('confessions', 'confessions', false)
on conflict (id) do nothing;

create policy "Confession Media Access"
  on storage.objects for select
  using ( bucket_id = 'confessions' and auth.uid() = owner );

create policy "Confession Media Upload"
  on storage.objects for insert
  with check ( bucket_id = 'confessions' and auth.uid() = owner );

create policy "Confession Media Delete"
  on storage.objects for delete
  using ( bucket_id = 'confessions' and auth.uid() = owner );
