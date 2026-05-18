'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NotificationManager } from '@/lib/notifications';

export default function TaskNotificationManager() {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
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

        const setupTaskNotifications = async () => {
            // We assume permission is requested by MedicineManager or earlier, but safe to ask again (idempotent)
            const granted = await NotificationManager.requestPermissions();
            if (!granted) return;

            // Fetch pending tasks in the future
            const now = new Date();
            const { data: tasks, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_completed', false)
                .gt('due_date', now.toISOString());

            if (error || !tasks) return;

            tasks.forEach(task => {
                if (task.due_date) {
                    const dueDate = new Date(task.due_date);

                    // Unique ID: Hash of "task_ID"
                    const notifId = NotificationManager.generateId(`task_${task.id}`);

                    NotificationManager.schedule({
                        id: notifId,
                        title: `📅 Tarea pendiente`,
                        body: task.title,
                        schedule: { at: dueDate }
                    });
                }
            });
        };

        setupTaskNotifications();

        // Subscribe to changes
        const channel = supabase
            .channel('task_notifications_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, setupTaskNotifications)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }

    }, [user]);

    return null;
}
