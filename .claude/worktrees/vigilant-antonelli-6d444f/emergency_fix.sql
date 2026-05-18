-- 1. Asegurar tabla profiles
create table if not exists profiles (
    id uuid references auth.users on delete cascade primary key,
    updated_at timestamptz
);

-- 2. Asegurar columna is_premium
alter table profiles add column if not exists is_premium boolean default false;

-- 3. Asegurar columna nickname (Probablemente esta es la que te falta)
alter table profiles add column if not exists nickname text;

-- 4. Asegurar Políticas de lectura (para que no de error de permisos después)
alter table profiles enable row level security;

-- Permitir lectura pública de perfiles (necesario para ver si son premium o ver nicks)
drop policy if exists "Enable read access for all users" on profiles;
drop policy if exists "Authenticated users can read profiles" on profiles;
create policy "Authenticated users can read profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

-- Permitir editar tu propio perfil
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Permitir insertar tu propio perfil (por si acaso)
drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);
