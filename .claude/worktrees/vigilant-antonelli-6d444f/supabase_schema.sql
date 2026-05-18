-- Create profiles table
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Create policies for profiles
create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );

-- Create passwords table
create table public.passwords (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  username text,
  password_hash text not null,
  website text,
  category text,
  device text,
  location text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.passwords enable row level security;

create policy "Users can CRUD their own passwords."
  on public.passwords for all
  using ( auth.uid() = user_id );

-- Create shopping_items table
create table public.shopping_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  quantity integer default 1,
  category text,
  is_checked boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.shopping_items enable row level security;

create policy "Users can CRUD their own shopping items."
  on public.shopping_items for all
  using ( auth.uid() = user_id );

-- Create manuals table
create table public.manuals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  category text,
  type text, -- 'text', 'image', 'video', 'link'
  content text, -- URL, Base64, or Text content
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.manuals enable row level security;

create policy "Users can CRUD their own manuals."
  on public.manuals for all
  using ( auth.uid() = user_id );

-- Create tasks table
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  description text,
  due_date timestamp with time zone,
  is_completed boolean default false,
  has_alarm boolean default true,
  priority text, -- 'low', 'medium', 'high'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;

create policy "Users can CRUD their own tasks."
  on public.tasks for all
  using ( auth.uid() = user_id );

-- Create insurances table
create table public.insurances (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  provider text,
  policy_number text,
  expiration_date date,
  cost numeric,
  coverage_details text,
  notes text, -- Added
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.insurances enable row level security;

create policy "Users can CRUD their own insurances."
  on public.insurances for all
  using ( auth.uid() = user_id );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
