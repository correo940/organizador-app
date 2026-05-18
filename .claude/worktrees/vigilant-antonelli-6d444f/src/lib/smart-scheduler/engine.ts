import { supabase } from '@/lib/supabase';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface TimeBlock {
    start: number; // minutes from midnight
    end: number;   // minutes from midnight
}

interface Activity {
    id: string;
    name: string;
    duration_minutes: number;
    intensity_level: string;
    required_physical_level: string;
    category: string;
}

// Convert "HH:MM" to minutes
function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

// Convert minutes to "HH:MM:00"
function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
}

export async function generateSchedule(userId: string, startDate: Date) {

    // 1. Fetch Data
    const { data: profile } = await supabase.from('smart_scheduler_profiles').select('*').eq('id', userId).single();
    if (!profile) throw new Error("Profile not found");

    const { data: fixedBlocks } = await supabase.from('smart_scheduler_fixed_blocks').select('*').eq('user_id', userId);
    const { data: activities } = await supabase.from('smart_scheduler_activities').select('*');

    if (!activities || !fixedBlocks) throw new Error("Missing data");

    // Filter activities based on profile
    const validActivities = activities.filter(act => {
        // Physical Level Check
        if (act.required_physical_level === 'athlete' && profile.physical_level !== 'athlete') return false;
        if (act.required_physical_level === 'active' && profile.physical_level === 'sedentary') return false;

        // Intensity Check (Simple Heuristic: If availability is low, don't schedule high intensity/duration?)
        // keeping it simple for now: validActivities are candidates.
        return true;
    });

    const generatedBlocks = [];
    const generatedDate = new Date(startDate); // Start from the given Monday (or current day)

    // For each day of the week
    for (let i = 0; i < 7; i++) {
        const currentDayName = DAYS[generatedDate.getDay() === 0 ? 6 : generatedDate.getDay() - 1]; // Make Monday index 0
        const currentDayDate = new Date(generatedDate);
        currentDayDate.setDate(generatedDate.getDate() + i);
        const dayString = currentDayDate.toISOString().split('T')[0];

        // 1. Get Fixed Time Ranges
        const dayFixed = (fixedBlocks || [])
            .filter((b: any) => b.day_of_week === currentDayName)
            .map((b: any) => ({ start: timeToMinutes(b.start_time), end: timeToMinutes(b.end_time) }))
            .sort((a: TimeBlock, b: TimeBlock) => a.start - b.start);

        // 2. Identify Gaps — use profile wake/sleep times instead of hardcoded values
        const DAY_START = timeToMinutes(profile.wake_time || '07:00');
        const DAY_END = timeToMinutes(profile.sleep_time || '23:00');

        let cursor = DAY_START;
        const gaps: TimeBlock[] = [];

        for (const block of dayFixed) {
            if (block.start > cursor) {
                gaps.push({ start: cursor, end: block.start });
            }
            cursor = Math.max(cursor, block.end);
        }
        if (cursor < DAY_END) {
            gaps.push({ start: cursor, end: DAY_END });
        }

        // 3. Fill Gaps
        for (const gap of gaps) {
            let gapCursor = gap.start;
            let gapDuration = gap.end - gap.start;

            while (gapDuration >= 30) { // Minimum 30 min slot
                // Pick a random valid activity
                const candidates = validActivities.filter(a => a.duration_minutes <= gapDuration);

                if (candidates.length === 0) break; // No activity fits

                const picked = candidates[Math.floor(Math.random() * candidates.length)];

                generatedBlocks.push({
                    user_id: userId,
                    date: dayString,
                    start_time: minutesToTime(gapCursor),
                    end_time: minutesToTime(gapCursor + picked.duration_minutes),
                    activity_id: picked.id,
                    status: 'scheduled'
                });

                gapCursor += picked.duration_minutes;
                gapDuration -= picked.duration_minutes;

                // Add a small buffer/break? Or back-to-back?
                // Let's add 15 min buffer if possible
                if (gapDuration >= 15) {
                    gapCursor += 15;
                    gapDuration -= 15;
                }
            }
        }
    }

    // 4. Save to Database (Clear old generated blocks for this week first?)
    // For this prototype, we just insert. Real app should handle updates.
    if (generatedBlocks.length > 0) {
        // Delete existing future generated blocks for these dates?
        // Let's just insert for now.
        const { error } = await supabase.from('smart_scheduler_generated_blocks').insert(generatedBlocks);
        if (error) throw error;
    }

    return generatedBlocks;
}
