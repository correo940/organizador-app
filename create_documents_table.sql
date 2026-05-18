-- Create documents table
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  category text not null, -- 'Identidad', 'Vehículo', 'Seguro', 'Hogar', 'Salud', 'Otros'
  file_url text not null,
  file_type text, -- 'image/jpeg', 'application/pdf', etc.
  is_favorite boolean default false,
  expiration_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table documents enable row level security;

-- Create policies
create policy "Users can view their own documents"
  on documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own documents"
  on documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own documents"
  on documents for update
  using (auth.uid() = user_id);

create policy "Users can delete their own documents"
  on documents for delete
  using (auth.uid() = user_id);

-- Update trigger
create trigger update_documents_updated_at
  before update on documents
  for each row
  execute function update_updated_at_column();
