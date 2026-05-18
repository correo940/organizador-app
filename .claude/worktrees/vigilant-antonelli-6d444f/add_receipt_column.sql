-- 1. Add column to expenses
alter table expenses add column if not exists receipt_url text;

-- 2. Create Storage Bucket for Receipts
insert into storage.buckets (id, name, public) 
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- 3. Storage Policies
-- Allow Authenticated uploads
create policy "Authenticated users can upload receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

-- Allow Public Read (or Authenticated Read? Shared Expenses means partners need to see it).
-- Simplest is Public Read if the URL is known (UUIDs are hard to guess).
create policy "Anyone can read receipts"
  on storage.objects for select
  using (bucket_id = 'receipts');

-- Allow Owners to Delete
create policy "Users can delete own receipts"
  on storage.objects for delete
  using (bucket_id = 'receipts' and auth.uid() = owner);
