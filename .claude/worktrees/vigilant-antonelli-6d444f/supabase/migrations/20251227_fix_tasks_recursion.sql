-- Fix: Resolve Infinite Recursion in Task Policies
-- Date: 2025-12-27

-- 1. Helper function to getting my list IDs (bypasses RLS)
create or replace function public.get_my_task_list_ids()
returns setof uuid
language sql
security definer
stable
as $$
    select list_id from public.task_list_members
    where user_id = auth.uid();
$$;

-- 2. Helper function to check edit permission (bypasses RLS)
create or replace function public.can_edit_task_list(p_list_id uuid)
returns boolean
language sql
security definer
stable
as $$
    select exists (
        select 1 from public.task_list_members
        where list_id = p_list_id
        and user_id = auth.uid()
        and role in ('owner', 'editor')
    );
$$;

-- 3. Update task_list_members policy (Fixes recursion)
drop policy if exists "Members can view other members of the same list" on public.task_list_members;
drop policy if exists "Members can view members of their lists" on public.task_list_members;

create policy "Members can view members of their lists"
    on public.task_list_members for select
    using (
        list_id in (select public.get_my_task_list_ids())
        or
        user_id = auth.uid() -- Always view self
    );

-- 4. Update TASKS policies (Fixes recursion and allows legacy tasks)
drop policy if exists "Users can view tasks in their lists" on public.tasks;
drop policy if exists "Users can view their tasks" on public.tasks; -- Added this one
drop policy if exists "Users can insert tasks into their lists" on public.tasks;
drop policy if exists "Users can insert tasks" on public.tasks; -- Added this one
drop policy if exists "Users can update tasks in their lists" on public.tasks;
drop policy if exists "Users can update their tasks" on public.tasks; -- Added this one
drop policy if exists "Users can delete tasks in their lists" on public.tasks;
drop policy if exists "Users can delete their tasks" on public.tasks; -- Added this one

create policy "Users can view their tasks"
    on public.tasks for select
    using (
        (list_id in (select public.get_my_task_list_ids()))
        or
        (list_id is null and user_id = auth.uid()) -- Allow legacy
    );

create policy "Users can insert tasks"
    on public.tasks for insert
    with check (
        (list_id is not null and public.can_edit_task_list(list_id))
        or
        (list_id is null and user_id = auth.uid()) -- Allow legacy
    );

create policy "Users can update their tasks"
    on public.tasks for update
    using (
        (list_id is not null and public.can_edit_task_list(list_id))
        or
        (list_id is null and user_id = auth.uid()) -- Allow legacy
    );

create policy "Users can delete their tasks"
    on public.tasks for delete
    using (
        (list_id is not null and public.can_edit_task_list(list_id))
        or
        (list_id is null and user_id = auth.uid()) -- Allow legacy
    );
