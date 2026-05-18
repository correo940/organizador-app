-- 1. Si la tabla no existe, la crea.
create table if not exists profiles (
    id uuid references auth.users on delete cascade primary key,
    updated_at timestamptz
);

-- 2. AGREGA LA COLUMNA SI FALTA (Esta es la solución al error)
alter table profiles add column if not exists is_premium boolean default false;

-- 3. Asegurar RLS
alter table profiles enable row level security;
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);

-- 4. AHORA SÍ, actualizar o insertar usuarios como PREMIUM
insert into profiles (id, is_premium)
select id, true
from auth.users
on conflict (id) do update
set is_premium = true;
