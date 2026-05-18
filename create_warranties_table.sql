-- Create warranties table
create table if not exists warranties (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  product_name text not null,
  store_name text,
  purchase_date date not null,
  warranty_months integer default 36, -- Standard 3 years in Spain
  warranty_end_date date, -- Can be auto-calculated or manual override
  image_url text, -- Supabase Storage path
  price numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table warranties enable row level security;

-- Create policies
create policy "Users can view their own warranties"
  on warranties for select
  using (auth.uid() = user_id);

create policy "Users can insert their own warranties"
  on warranties for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own warranties"
  on warranties for update
  using (auth.uid() = user_id);

create policy "Users can delete their own warranties"
  on warranties for delete
  using (auth.uid() = user_id);

-- Update trigger
create trigger update_warranties_updated_at
  before update on warranties
  for each row
  execute function update_updated_at_column();
