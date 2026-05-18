-- Ensure users can UPDATE their own vehicles
create policy "Users can update their own vehicles"
on public.vehicles for update
using (auth.uid() = user_id);

-- Ensure users can UPDATE their own vehicle events
create policy "Users can update their own vehicle events"
on public.vehicle_events for update
using (auth.uid() = user_id);
