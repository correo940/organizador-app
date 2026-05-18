-- 1. Asegurar que la tabla profiles existe
create table if not exists profiles (
    id uuid references auth.users on delete cascade primary key,
    is_premium boolean default false,
    updated_at timestamptz
);

-- 2. Activar seguridad (RLS) si no estaba
alter table profiles enable row level security;
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);

-- 3. INSERTAR PERFILES FALTANTES (Clave del problema)
-- Esto crea una fila en 'profiles' para cada usuario que ya exista en 'auth.users' y no tenga perfil.
insert into profiles (id, is_premium)
select id, true -- <-- LOS CREAMOS DIRECTAMENTE COMO PREMIUM
from auth.users
on conflict (id) do update
set is_premium = true; -- SI YA EXISTIAN, LOS ACTUALIZAMOS A TRUE TAMBIEN

-- 4. Confirmación
-- Si ejecutas esto, TODOS los usuarios que hay ahora mismo en tu base de datos pasarán a ser PREMIUM.
