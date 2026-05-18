-- Repair missing columns and tables safely
-- Date: 2025-12-27

-- 1. DOCUMENTS: Ensure 'name' exists (Fix for 400 error)
create table if not exists public.documents (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) not null,
    title text,
    category text not null,
    expiration_date timestamptz,
    file_url text not null,
    file_type text,
    is_favorite boolean default false,
    created_at timestamptz default now()
);

-- Force add 'name' if it doesn't exist (because create table if not exists skips it)
alter table public.documents add column if not exists name text;
alter table public.documents add column if not exists title text;

-- Re-apply trigger to sync them
create or replace function sync_doc_title_name() returns trigger as $$
begin
    if new.title is not null and new.name is null then
        new.name := new.title;
    elsif new.name is not null and new.title is null then
        new.title := new.name;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists sync_documents_title_name_trigger on public.documents;
create trigger sync_documents_title_name_trigger
before insert or update on public.documents
for each row execute function sync_doc_title_name();


-- 2. DEBATES: Ensure table exists (Fix for 404 error)
create table if not exists public.debates (
    id uuid default gen_random_uuid() primary key,
    topic text not null,
    status text default 'waiting' check (status in ('waiting', 'active', 'voting', 'finished')),
    is_public boolean default true,
    created_at timestamptz default now(),
    creator_id uuid references auth.users(id) not null,
    guest_id uuid references auth.users(id),
    updated_at timestamptz default now()
);

-- Ensure RLS is enabled
alter table public.documents enable row level security;
alter table public.debates enable row level security;
alter table public.journal_entries enable row level security;

-- Re-apply policies (safely)
drop policy if exists "Users can manage their own documents" on public.documents;
create policy "Users can manage their own documents"
    on public.documents for all
    using (auth.uid() = user_id);

drop policy if exists "Anyone can view public debates" on public.debates;
create policy "Anyone can view public debates"
    on public.debates for select
    using (is_public = true or auth.uid() in (creator_id, guest_id));
