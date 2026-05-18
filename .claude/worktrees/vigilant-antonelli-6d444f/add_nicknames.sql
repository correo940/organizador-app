-- 1. Add nickname column
alter table profiles add column if not exists nickname text;

-- 2. Update RLS to allow reading other users' nicknames
drop policy if exists "Authenticated users can read profiles" on profiles;
create policy "Authenticated users can read profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

-- 3. Allow users to UPDATE their own nickname
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);
