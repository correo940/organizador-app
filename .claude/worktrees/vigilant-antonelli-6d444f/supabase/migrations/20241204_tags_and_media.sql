-- Add tags column to journal_entries
alter table public.journal_entries 
add column if not exists tags text[] default '{}';

-- Create storage bucket for journal media
insert into storage.buckets (id, name, public)
values ('journal-media', 'journal-media', true)
on conflict (id) do nothing;

-- Set up storage policies for journal-media
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'journal-media' );

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'journal-media' and auth.role() = 'authenticated' );

create policy "Users can update their own files"
  on storage.objects for update
  using ( bucket_id = 'journal-media' and auth.uid() = owner );

create policy "Users can delete their own files"
  on storage.objects for delete
  using ( bucket_id = 'journal-media' and auth.uid() = owner );
