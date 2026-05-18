'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NotificationManager } from '@/lib/notifications';
import { toast } from 'sonner';

export default function MedicineAlarmManager() {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        // Init Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;

        const setupAlarms = async () => {
            // Request permissions explicitly when component mounts/user logs in
            const granted = await NotificationManager.requestPermissions();
            if (!granted) return;

            const { data: medicines, error } = await supabase
                .from('medicines')
                .select('id, name, dosage, alarm_times')
                .eq('user_id', user.id)
                .not('alarm_times', 'is', null);

            if (error || !medicines) return;

            // 1. Cancel previous medicine alarms to prevent duplicates/ghosts
            const pending = await NotificationManager.getPending();
            const medsToCancel = pending
                .filter(n => n.title === '💊 Hora de tu medicación' || n.extra?.type === 'medicine')
                .map(n => n.id);

            if (medsToCancel.length > 0) {
                await NotificationManager.cancel(medsToCancel);
                console.log(`Cancelled ${medsToCancel.length} stale medicine alarms.`);
            }

            // 2. Schedule current alarms
            medicines.forEach(med => {
                if (med.alarm_times && Array.isArray(med.alarm_times)) {
                    med.alarm_times.forEach((time: string) => {
                        const [hours, minutes] = time.split(':').map(Number);
                        const notifId = NotificationManager.generateId(`med_${med.id}_${time}`);

                        NotificationManager.schedule({
                            id: notifId,
                            title: `💊 Hora de tu medicación`,
                            body: `${med.name} - ${med.dosage || 'Toma tu dosis'}`,
                            schedule: {
                                on: { hour: hours, minute: minutes },
                                allowWhileIdle: true
                            } as any,
                            extra: { type: 'medicine' }
                        });
                    });
                }
            });
        };

        setupAlarms();

        // Optional: Subscribe to changes to auto-update
        const channel = supabase
            .channel('medicine_alarms_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'medicines' }, setupAlarms)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }

    }, [user]);

    return null;
}
