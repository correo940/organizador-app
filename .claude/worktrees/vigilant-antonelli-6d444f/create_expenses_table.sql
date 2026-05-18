-- Create expenses table
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  amount numeric not null,
  paid_by text not null, -- 'Mi' (user) or 'Partner' (other person)
  category text not null, -- 'Comida', 'Hogar', 'Facturas', 'Ocio', 'Viajes', 'Otros'
  date date default CURRENT_DATE,
  created_at timestamptz default now()
);

-- Enable RLS
alter table expenses enable row level security;

-- Create policies
create policy "Users can view their own expenses"
  on expenses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own expenses"
  on expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own expenses"
  on expenses for update
  using (auth.uid() = user_id);

create policy "Users can delete their own expenses"
  on expenses for delete
  using (auth.uid() = user_id);
