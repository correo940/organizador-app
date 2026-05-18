-- Lock down activities table for regular users
-- They should only be able to READ (for the scheduler engine).
-- Creating/Editing is now done via Admin API (Service Role) only.

-- Drop existing permissive policies
drop policy if exists "Authenticated users can create activities" on public.smart_scheduler_activities;
drop policy if exists "Creators can update activities" on public.smart_scheduler_activities;
drop policy if exists "Creators can delete activities" on public.smart_scheduler_activities;

-- Ensure READ policy still exists (if not, re-create it)
-- create policy "Authenticated users can read activities" on public.smart_scheduler_activities for select using (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
