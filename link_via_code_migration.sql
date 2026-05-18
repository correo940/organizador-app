-- 1. Table for Connection Codes (Short-lived codes to link users)
create table if not exists connection_codes (
    code text primary key, -- The 6-digit code (e.g. '123456')
    created_by uuid references auth.users not null,
    created_at timestamptz default now(),
    expires_at timestamptz default (now() + interval '15 minutes')
);

-- RLS
alter table connection_codes enable row level security;

create policy "Users can view codes they created"
  on connection_codes for select
  using (auth.uid() = created_by);

create policy "Users can insert codes"
  on connection_codes for insert
  with check (auth.uid() = created_by);

-- 2. RPC to Generate Code
create or replace function generate_connection_code()
returns text
language plpgsql
security definer
as $$
declare
  v_code text;
begin
  -- Generate a random 6-digit number
  v_code := floor(random() * (999999 - 100000 + 1) + 100000)::text;
  
  -- Delete any existing codes for this user to keep it clean
  delete from connection_codes where created_by = auth.uid();
  
  -- Insert
  insert into connection_codes (code, created_by) values (v_code, auth.uid());
  
  return v_code;
end;
$$;

-- 3. RPC to Redeem Code
create or replace function redeem_connection_code(p_code text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_creator_id uuid;
begin
  -- Find valid code
  select created_by into v_creator_id
  from connection_codes
  where code = p_code
    and expires_at > now();
    
  if v_creator_id is null then
    raise exception 'Código inválido o expirado';
  end if;
  
  if v_creator_id = auth.uid() then
    raise exception 'No puedes usar tu propio código';
  end if;

  -- Create Partnership
  -- Check existence
  if not exists (select 1 from expense_partners where (user_id_1 = v_creator_id and user_id_2 = auth.uid()) or (user_id_1 = auth.uid() and user_id_2 = v_creator_id)) then
      insert into expense_partners (user_id_1, user_id_2) values (v_creator_id, auth.uid());
  end if;
  
  -- Delete the used code
  delete from connection_codes where code = p_code;
  
  return true;
end;
$$;
