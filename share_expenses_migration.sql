-- 1. Table for Invitations
create table if not exists expense_invitations (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users not null,
  recipient_email text not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now()
);

-- RLS for Invitations
alter table expense_invitations enable row level security;

-- Sender can see/insert their own invitations
create policy "Users can view sent invitations"
  on expense_invitations for select
  using (auth.uid() = sender_id);

create policy "Users can insert invitations"
  on expense_invitations for insert
  with check (auth.uid() = sender_id);

-- Recipient can see invitations sent to their email (Requires a function or loose matching if email is not in auth.users accessible way, usually we match by email if user is logged in)
-- Ideally we only allow users to see invitations if their auth.email matches. 
-- For simplicity in this specialized app, we might check if the current user's email matches the recipient_email (requires exposing email in RLS or using a secure function).
-- A simpler approach for the client: "Check Pending Invitations" button calls a Secure RPC or we rely on the sender to tell them, and we match by email on Accept.
-- Let's try to match by email using auth.jwt() -> email claim if possible, or just open specific select if we trust the client to filter? No, standard is:
-- create policy "Recipients can view invitations" on expense_invitations for select using ( (select email from auth.users where id = auth.uid()) = recipient_email ); 
-- NOTE: accessing auth.users from RLS is sometimes restricted or requires security definer views.
-- SAFE BET: We will handle the "Accept" logic via a remote procedure (RPC) or careful frontend matching.
-- For now, let's allow "Public" select for invitations if you know the ID? No.
-- Let's stick to: Sender sees it. Recipient will "Find" it by email match in a secure function or we assume the sender tells them. 
-- actually, let's make a policy that allows reading if the email matches the current user's email.
-- (This requires the `auth.email()` helper or similar if available, or we just rely on the sender management for now).

-- 2. Table for Partners (The link)
create table if not exists expense_partners (
  id uuid default gen_random_uuid() primary key,
  user_id_1 uuid references auth.users not null,
  user_id_2 uuid references auth.users not null,
  created_at timestamptz default now(),
  constraint unique_partnership unique (user_id_1, user_id_2)
);

-- RLS for Partners
alter table expense_partners enable row level security;

create policy "Users can view their partnerships"
  on expense_partners for select
  using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

-- 3. Update Expenses RLS to allow partners to see/edit
-- We need to drop existing policies first to be clean, or create new "Partner" policies.

create policy "Partners can view expenses"
  on expenses for select
  using (
    exists (
      select 1 from expense_partners
      where (user_id_1 = auth.uid() and user_id_2 = expenses.user_id)
         or (user_id_2 = auth.uid() and user_id_1 = expenses.user_id)
    )
  );

create policy "Partners can insert expenses (on behalf of themselves linked to logic? No, they insert as themselves, but RLS allows it)"
  on expenses for insert
  with check (
    -- Standard insert is for own user_id. 
    -- If I pay something, I insert it as ME. My partner sees it via Select policy.
    auth.uid() = user_id
  );

create policy "Partners can update expenses"
  on expenses for update
  using (
    exists (
      select 1 from expense_partners
      where (user_id_1 = auth.uid() and user_id_2 = expenses.user_id)
         or (user_id_2 = auth.uid() and user_id_1 = expenses.user_id)
    )
  );

create policy "Partners can delete expenses"
  on expenses for delete
  using (
    exists (
      select 1 from expense_partners
      where (user_id_1 = auth.uid() and user_id_2 = expenses.user_id)
         or (user_id_2 = auth.uid() and user_id_1 = expenses.user_id)
    )
  );

-- 4. RPC Function to Accept Invitation
-- This avoids RLS complexity for checking emails.
create or replace function accept_expense_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_recipient_email text;
  v_sender_id uuid;
  v_current_email text;
begin
  -- Get the invitation
  select recipient_email, sender_id into v_recipient_email, v_sender_id
  from expense_invitations
  where id = invitation_id and status = 'pending';

  if v_recipient_email is null then
    raise exception 'Invitation not found or already processed';
  end if;

  -- Get current user email
  select email into v_current_email from auth.users where id = auth.uid();

  -- Verify email matches
  if lower(v_current_email) != lower(v_recipient_email) then
    raise exception 'Email mismatch. This invitation is for %', v_recipient_email;
  end if;

  -- Create partnership (ensure order to avoid duplicates if we wanted to enforce it, but simpler to just insert)
  -- Check if exists first? constraint handles it but let's be safe.
  if not exists (select 1 from expense_partners where (user_id_1 = v_sender_id and user_id_2 = auth.uid()) or (user_id_1 = auth.uid() and user_id_2 = v_sender_id)) then
      insert into expense_partners (user_id_1, user_id_2) values (v_sender_id, auth.uid());
  end if;

  -- Update invitation status
  update expense_invitations set status = 'accepted' where id = invitation_id;
end;
$$;

-- 5. RPC to get pending invitations for current user
create or replace function get_my_pending_invitations()
returns table (
  id uuid,
  sender_email text,
  created_at timestamptz
)
language plpgsql
security definer
as $$
declare
  v_current_email text;
begin
  select email into v_current_email from auth.users where id = auth.uid();
  
  return query
  select i.id, u.email as sender_email, i.created_at
  from expense_invitations i
  join auth.users u on u.id = i.sender_id
  where lower(i.recipient_email) = lower(v_current_email)
  and i.status = 'pending';
end;
$$;

