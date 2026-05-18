-- Create journal_collections table
create table if not exists journal_collections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  parent_id uuid references journal_collections(id) on delete cascade,
  name text not null,
  icon text, -- For custom folder icons
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on collections
alter table journal_collections enable row level security;

create policy "Users can view their own collections"
  on journal_collections for select
  using (auth.uid() = user_id);

create policy "Users can insert their own collections"
  on journal_collections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own collections"
  on journal_collections for update
  using (auth.uid() = user_id);

create policy "Users can delete their own collections"
  on journal_collections for delete
  using (auth.uid() = user_id);

-- Add metadata columns to journal_entries
-- We use a single 'metadata' jsonb column for flexibility (Zotero has many types)
-- And an 'entry_type' to distinguish between notes, books, etc.
alter table journal_entries 
add column if not exists collection_id uuid references journal_collections(id) on delete set null,
add column if not exists entry_type text default 'note', -- 'note', 'book', 'article', 'webpage', 'document'
add column if not exists metadata jsonb default '{}'::jsonb, -- author, year, url, isbn, volume, issue, etc.
add column if not exists attachments jsonb default '[]'::jsonb; -- Array of file references

-- Index for faster lookups
create index if not exists journal_entries_collection_id_idx on journal_entries(collection_id);
create index if not exists journal_collections_parent_id_idx on journal_collections(parent_id);
