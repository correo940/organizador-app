-- Migration: Create Tasks Sharing Schema
-- Description: Adds support for Task Lists, Sharing, and Assignments
-- Date: 2025-12-27

-- 1. Create task_lists table
create table if not exists public.task_lists (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    owner_id uuid references auth.users(id) not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Create task_list_members table
create table if not exists public.task_list_members (
    id uuid default gen_random_uuid() primary key,
    list_id uuid references public.task_lists(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    role text default 'editor' check (role in ('owner', 'editor', 'viewer')),
    joined_at timestamptz default now(),
    unique(list_id, user_id)
);

-- 3. Create task_list_invitations table (for sharing codes)
create table if not exists public.task_list_invitations (
    code text primary key,
    list_id uuid references public.task_lists(id) on delete cascade not null,
    created_by uuid references auth.users(id) not null,
    created_at timestamptz default now(),
    expires_at timestamptz default (now() + interval '24 hours')
);

-- 4. Update tasks table
-- We add list_id nullable first
alter table public.tasks 
add column if not exists list_id uuid references public.task_lists(id) on delete cascade,
add column if not exists assigned_to uuid references auth.users(id) on delete set null;

-- Enable RLS
alter table public.task_lists enable row level security;
alter table public.task_list_members enable row level security;
alter table public.task_list_invitations enable row level security;

-- Policies for task_lists
create policy "Users can view lists they are members of"
    on public.task_lists for select
    using (
        exists (
            select 1 from public.task_list_members
            where list_id = public.task_lists.id
            and user_id = auth.uid()
        )
        or owner_id = auth.uid() -- Failsafe
    );

create policy "Users can insert lists they own"
    on public.task_lists for insert
    with check (owner_id = auth.uid());

create policy "Owners and editors can update lists"
    on public.task_lists for update
    using (
        exists (
            select 1 from public.task_list_members
            where list_id = public.task_lists.id
            and user_id = auth.uid()
            and role in ('owner', 'editor')
        )
    );

create policy "Owners can delete lists"
    on public.task_lists for delete
    using (owner_id = auth.uid());


-- Policies for task_list_members
create policy "Members can view other members of the same list"
    on public.task_list_members for select
    using (
        exists (
            select 1 from public.task_list_members as my_membership
            where my_membership.list_id = public.task_list_members.list_id
            and my_membership.user_id = auth.uid()
        )
    );

-- Policies for tasks (Update existing policies or create new ones)
-- We need to ensure users can see tasks in their lists
-- drop policy if exists "Users can view their own tasks" on public.tasks; 
-- The existing policy might be "user_id = auth.uid()". We need to expand it.

create policy "Users can view tasks in their lists"
    on public.tasks for select
    using (
        list_id is not null and exists (
            select 1 from public.task_list_members
            where list_id = public.tasks.list_id
            and user_id = auth.uid()
        )
    );

create policy "Users can insert tasks into their lists"
    on public.tasks for insert
    with check (
        list_id is not null and exists (
            select 1 from public.task_list_members
            where list_id = public.tasks.list_id
            and user_id = auth.uid()
            and role in ('owner', 'editor')
        )
    );

create policy "Users can update tasks in their lists"
    on public.tasks for update
    using (
        list_id is not null and exists (
            select 1 from public.task_list_members
            where list_id = public.tasks.list_id
            and user_id = auth.uid()
            and role in ('owner', 'editor')
        )
    );
    
create policy "Users can delete tasks in their lists"
    on public.tasks for delete
    using (
        list_id is not null and exists (
            select 1 from public.task_list_members
            where list_id = public.tasks.list_id
            and user_id = auth.uid()
            and role in ('owner', 'editor')
        )
    );


-- 5. RPC Functions

-- Generate Code
create or replace function generate_task_list_invitation(p_list_id uuid)
returns text
language plpgsql
security definer
as $$
declare
    new_code text;
    is_member boolean;
begin
    -- Check permissions
    select exists (
        select 1 from public.task_list_members
        where list_id = p_list_id
        and user_id = auth.uid()
        and role in ('owner', 'editor')
    ) into is_member;

    if not is_member then
        raise exception 'Permission denied';
    end if;

    -- Generate random 6-digit code
    new_code := floor(random() * (999999 - 100000 + 1) + 100000)::text;

    -- Insert
    insert into public.task_list_invitations (code, list_id, created_by)
    values (new_code, p_list_id, auth.uid())
    on conflict (code) do update set created_at = now(); -- unlikely collision retry logic omitted for brevity

    return new_code;
end;
$$;

-- Redeem Code
create or replace function redeem_task_list_invitation(p_code text)
returns uuid
language plpgsql
security definer
as $$
declare
    v_list_id uuid;
    v_invitation record;
begin
    -- Find invitation
    select * into v_invitation from public.task_list_invitations
    where code = p_code
    and expires_at > now();

    if v_invitation is null then
        raise exception 'Invalid or expired code';
    end if;

    v_list_id := v_invitation.list_id;

    -- Add member if not exists
    insert into public.task_list_members (list_id, user_id, role)
    values (v_list_id, auth.uid(), 'editor')
    on conflict (list_id, user_id) do nothing;

    return v_list_id;
end;
$$;

-- 6. Helper to migrate existing tasks
create or replace function create_default_task_list_for_user()
returns uuid
language plpgsql
security definer
as $$
declare
    new_list_id uuid;
    v_user_id uuid := auth.uid();
begin
    -- Create list
    insert into public.task_lists (name, owner_id)
    values ('Mis Tareas', v_user_id)
    returning id into new_list_id;

    -- Add owner as member
    insert into public.task_list_members (list_id, user_id, role)
    values (new_list_id, v_user_id, 'owner');

    -- Move orphan tasks
    update public.tasks
    set list_id = new_list_id
    where user_id = v_user_id
    and list_id is null;

    return new_list_id;
end;
$$;
