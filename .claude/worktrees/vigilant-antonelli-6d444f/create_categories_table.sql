-- Create expense_categories table
create table if not exists expense_categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

-- RLS
alter table expense_categories enable row level security;

-- Policies
-- 1. View: Everyone (simplification for shared groups)
create policy "Users can view all categories"
  on expense_categories for select
  using (auth.role() = 'authenticated');

-- 2. Insert: Authenticated users
create policy "Users can create categories"
  on expense_categories for insert
  with check (auth.role() = 'authenticated');

-- 3. Delete: Authenticated users (allows cleaning up defaults or partner typos)
create policy "Users can delete categories"
  on expense_categories for delete
  using (auth.role() = 'authenticated');
