-- Fix Foreign Keys for PostgREST Joins
-- Date: 2025-12-28
-- This adds explicit foreign keys to profiles table so Supabase can resolve joins

-- 1. Add foreign key from task_list_members.user_id to profiles.id
-- First, ensure the column exists and drop any conflicting constraint
alter table public.task_list_members 
drop constraint if exists task_list_members_user_id_fkey_profiles;

alter table public.task_list_members 
add constraint task_list_members_user_id_fkey_profiles
foreign key (user_id) references public.profiles(id) on delete cascade;

-- 2. Add foreign key from tasks.assigned_to to profiles.id  
alter table public.tasks
drop constraint if exists tasks_assigned_to_fkey_profiles;

alter table public.tasks
add constraint tasks_assigned_to_fkey_profiles
foreign key (assigned_to) references public.profiles(id) on delete set null;

-- 3. CRITICAL: Reload the schema cache so PostgREST recognizes the new relationships
notify pgrst, 'reload schema';
