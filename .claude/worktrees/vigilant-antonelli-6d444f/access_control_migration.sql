-- 1. Create Profiles table
create table if not exists profiles (
    id uuid references auth.users on delete cascade primary key,
    is_premium boolean default false,
    updated_at timestamptz
);

-- 2. RLS for Profiles
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

-- 3. Trigger to create profile on signup (Optional but recommended)
-- For now, we'll handle missing profiles as "Not Premium" in frontend/backend to avoid complexity with existing users.
-- But inserting a default profile for existing users is good practice.
insert into profiles (id, is_premium)
select id, false from auth.users
on conflict (id) do nothing;
