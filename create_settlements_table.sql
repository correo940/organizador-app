-- Create settlements table
create table if not exists settlements (
  id uuid default gen_random_uuid() primary key,
  payer_id uuid references auth.users not null,
  receiver_id uuid references auth.users not null,
  amount numeric not null,
  currency text default 'EUR',
  created_at timestamptz default now()
);

-- RLS
alter table settlements enable row level security;

-- Policy: Users can view settlements where they are payer or receiver
create policy "Users can view their settlements"
  on settlements for select
  using (auth.uid() = payer_id or auth.uid() = receiver_id);

-- Policy: Users can insert settlements (usually as payer)
create policy "Users can pay debts"
  on settlements for insert
  with check (auth.uid() = payer_id);
