insert into storage.buckets (id, name, public)
values ('secure-docs', 'secure-docs', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload own secure documents" on storage.objects;
drop policy if exists "Users can view own secure documents" on storage.objects;
drop policy if exists "Users can update own secure documents" on storage.objects;
drop policy if exists "Users can delete own secure documents" on storage.objects;

create policy "Users can upload own secure documents"
  on storage.objects for insert
  with check (
    bucket_id = 'secure-docs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own secure documents"
  on storage.objects for select
  using (
    bucket_id = 'secure-docs'
    and (owner = auth.uid() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy "Users can update own secure documents"
  on storage.objects for update
  using (
    bucket_id = 'secure-docs'
    and (owner = auth.uid() or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id = 'secure-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own secure documents"
  on storage.objects for delete
  using (
    bucket_id = 'secure-docs'
    and (owner = auth.uid() or (storage.foldername(name))[1] = auth.uid()::text)
  );
