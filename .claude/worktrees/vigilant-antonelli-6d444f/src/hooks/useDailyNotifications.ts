import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { NotificationManager } from '@/lib/notifications';
import { getSecretarySettings } from '@/lib/secretary-settings';

// ── Notification IDs ──────────────────────────────────────────────────────────
const NOTIF_DAILY_SUMMARY = 1001; // legacy / resumen diario
const NOTIF_BRIEFING = 1002; // secretary briefing matutino
const NOTIF_SYNC = 1003; // secretary sync nocturno
const NOTIF_BUDGET_ALERT = 1004; // alerta 18h desviación presupuestaria
const NOTIF_WEEKLY_SYNC = 1005; // secretary sync semanal
const NOTIF_MONTHLY_SYNC = 1006; // secretary sync mensual

export function useDailyNotifications() {
    const router = useRouter();

    useEffect(() => {
        const checkPermissions = async () => {
            const oldSettings = getOldSettings();
            const secretarySettings = getSecretarySettings();

            const needsNotif = oldSettings.enabled || secretarySettings.enabled;
            if (!needsNotif) return;

            const granted = await NotificationManager.requestPermissions();

            if (Capacitor.getPlatform() !== 'web' && granted) {
                try {
                    await LocalNotifications.createChannel({
                        id: 'daily-summary',
                        name: 'Resumen Diario',
                        description: 'Notificaciones del resumen diario',
                        importance: 5,
                        visibility: 1,
                        sound: 'beep.wav',
                        vibration: true
                    });
                    await LocalNotifications.createChannel({
                        id: 'secretary',
                        name: 'Secretaria Quioba',
                        description: 'Notificaciones del asistente personal',
                        importance: 5,
                        visibility: 1,
                        sound: 'beep.wav',
                        vibration: true
                    });
                } catch (e) {
                    console.error('Error creating notification channels', e);
                }
            }

            if (oldSettings.enabled) scheduleDailyNotification();
            if (secretarySettings.enabled) scheduleSecretaryNotifications();
        };

        checkPermissions();

        // Tap handler — navigate based on notification ID
        const handleNotificationAction = (notification: any) => {
            const id = notification.notification.id;
            if (id === NOTIF_DAILY_SUMMARY) router.push('/apps/resumen-diario');
            if (id === NOTIF_BRIEFING) router.push('/apps/organizador/briefing');
            if (id === NOTIF_SYNC) router.push('/apps/organizador/sync');
            if (id === NOTIF_BUDGET_ALERT) router.push('/apps/organizador/briefing');
            if (id === NOTIF_WEEKLY_SYNC) router.push('/apps/organizador/sync/weekly');
            if (id === NOTIF_MONTHLY_SYNC) router.push('/apps/organizador/sync/monthly');
        };

        LocalNotifications.addListener('localNotificationActionPerformed', handleNotificationAction);

        // Re-schedule when settings change
        const handleSettingsChange = () => {
            scheduleDailyNotification();
            scheduleSecretaryNotifications();
        };
        window.addEventListener('notificationSettingsChanged', handleSettingsChange);
        window.addEventListener('secretarySettingsChanged', handleSettingsChange);

        return () => {
            window.removeEventListener('notificationSettingsChanged', handleSettingsChange);
            window.removeEventListener('secretarySettingsChanged', handleSettingsChange);
            LocalNotifications.removeAllListeners();
        };
    }, []);

    // ── Legacy daily summary ───────────────────────────────────────────────────

    const getOldSettings = () => {
        try {
            const saved = localStorage.getItem('dailyNotificationSettings');
            return saved ? JSON.parse(saved) : { enabled: false, time: '08:00' };
        } catch {
            return { enabled: false, time: '08:00' };
        }
    };

    const scheduleDailyNotification = async () => {
        const settings = getOldSettings();
        await LocalNotifications.cancel({ notifications: [{ id: NOTIF_DAILY_SUMMARY }] });
        if (!settings.enabled) return;

        const [hours, minutes] = settings.time.split(':').map(Number);
        const scheduleDate = new Date();
        scheduleDate.setHours(hours, minutes, 0, 0);
        if (scheduleDate <= new Date()) scheduleDate.setDate(scheduleDate.getDate() + 1);

        const isEvening = hours >= 18;
        await LocalNotifications.schedule({
            notifications: [{
                title: `${isEvening ? 'Resumen para mañana' : 'Resumen de hoy'} está listo 📅`,
                body: 'Toca aquí para ver tus tareas, turnos y recordatorios.',
                id: NOTIF_DAILY_SUMMARY,
                schedule: { at: scheduleDate, repeats: true, every: 'day', allowWhileIdle: true },
                channelId: 'daily-summary',
                sound: 'beep.wav',
                smallIcon: 'ic_stat_icon_config_sample',
                actionTypeId: '',
                extra: { url: '/apps/resumen-diario' }
            }]
        });
    };

    // ── Secretary notifications (Fase 2) ──────────────────────────────────────

    const scheduleSecretaryNotifications = async () => {
        const s = getSecretarySettings();

        // Cancel existing secretary notifications
        await LocalNotifications.cancel({
            notifications: [
                { id: NOTIF_BRIEFING },
                { id: NOTIF_SYNC },
                { id: NOTIF_BUDGET_ALERT },
                { id: NOTIF_WEEKLY_SYNC },
                { id: NOTIF_MONTHLY_SYNC },
            ]
        });

        if (!s.enabled) return;
        const texts = getPersonalityTexts(s.personality);

        // 1. Briefing matutino
        const briefingDate = buildScheduleDate(s.briefingTime);
        await LocalNotifications.schedule({
            notifications: [{
                title: texts.briefingNotifTitle,
                body: texts.briefingNotifBody,
                id: NOTIF_BRIEFING,
                schedule: { at: briefingDate, repeats: true, every: 'day', allowWhileIdle: true },
                channelId: 'secretary',
                sound: 'beep.wav',
                smallIcon: 'ic_stat_icon_config_sample',
                actionTypeId: '',
                extra: { url: '/apps/organizador/briefing' }
            }]
        });

        // 2. Sync nocturno
        const syncDate = buildScheduleDate(s.syncTime);
        await LocalNotifications.schedule({
            notifications: [{
                title: texts.syncNotifTitle,
                body: texts.syncNotifBody,
                id: NOTIF_SYNC,
                schedule: { at: syncDate, repeats: true, every: 'day', allowWhileIdle: true },
                channelId: 'secretary',
                sound: 'beep.wav',
                smallIcon: 'ic_stat_icon_config_sample',
                actionTypeId: '',
                extra: { url: '/apps/organizador/sync' }
            }]
        });

        // 3. Alerta 18h — desviación presupuestaria (Fase 2)
        // Solo si hay un sync de hoy con gasto planeado, comprueba a las 18h si hay desviación
        await scheduleBudgetAlert();

        // 4. Sync Semanal (Fase 3)
        if (s.weeklySync?.enabled) {
            const weeklyDate = buildWeeklyScheduleDate(s.weeklySync.dayOfWeek, s.weeklySync.time);
            await LocalNotifications.schedule({
                notifications: [{
                    title: '📅 Sync Semanal',
                    body: 'Echa un vistazo a la semana que viene. ¿Organizamos los próximos días?',
                    id: NOTIF_WEEKLY_SYNC,
                    schedule: { at: weeklyDate, repeats: true, every: 'week', allowWhileIdle: true },
                    channelId: 'secretary',
                    sound: 'beep.wav',
                    smallIcon: 'ic_stat_icon_config_sample',
                    actionTypeId: '',
                    extra: { url: '/apps/organizador/sync/weekly' }
                }]
            });
        }

        // 5. Sync Mensual (Fase 3)
        if (s.monthlySync?.enabled) {
            const monthlyDate = buildMonthlyScheduleDate(s.monthlySync.dayOfMonth, s.monthlySync.time);
            await LocalNotifications.schedule({
                notifications: [{
                    title: '📆 Sync Mensual',
                    body: 'Entra a repasar tu presupuesto, logros del mes y tareas.',
                    id: NOTIF_MONTHLY_SYNC,
                    schedule: { at: monthlyDate, repeats: true, every: 'month', allowWhileIdle: true },
                    channelId: 'secretary',
                    sound: 'beep.wav',
                    smallIcon: 'ic_stat_icon_config_sample',
                    actionTypeId: '',
                    extra: { url: '/apps/organizador/sync/monthly' }
                }]
            });
        }
    };

    // ── Budget alert at 18:00 (Fase 2) ───────────────────────────────────────

    const scheduleBudgetAlert = async () => {
        const alertDate = buildScheduleDate('18:00');

        // We always schedule the check — the app will verify deviation on open
        // The notification itself serves as a soft reminder to check
        await LocalNotifications.schedule({
            notifications: [{
                title: '⏰ Revisión a mitad de tarde',
                body: '¿Cómo van las finanzas hoy? Comprueba si te has desviado del presupuesto.',
                id: NOTIF_BUDGET_ALERT,
                schedule: { at: alertDate, repeats: true, every: 'day', allowWhileIdle: true },
                channelId: 'secretary',
                sound: 'beep.wav',
                smallIcon: 'ic_stat_icon_config_sample',
                actionTypeId: '',
                extra: { url: '/apps/organizador/briefing' }
            }]
        });
    };

    return { scheduleDailyNotification, scheduleSecretaryNotifications };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildScheduleDate(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    if (d <= new Date()) d.setDate(d.getDate() + 1); // next occurrence
    return d;
}

function buildWeeklyScheduleDate(dayOfWeek: number, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);

    let dist = dayOfWeek - d.getDay();
    if (dist < 0) {
        dist += 7;
    } else if (dist === 0 && d <= new Date()) {
        dist = 7;
    }
    d.setDate(d.getDate() + dist);
    return d;
}

function buildMonthlyScheduleDate(dayOfMonth: number, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setDate(dayOfMonth);
    d.setHours(hours, minutes, 0, 0);

    if (d <= new Date()) {
        d.setMonth(d.getMonth() + 1);
    }
    return d;
}

function getPersonalityTexts(personality: string) {
    const map: Record<string, { syncNotifTitle: string; syncNotifBody: string; briefingNotifTitle: string; briefingNotifBody: string }> = {
        formal: {
            syncNotifTitle: 'Quioba — Revisión diaria',
            syncNotifBody: 'Es hora de planificar el día de mañana.',
            briefingNotifTitle: 'Su resumen del día está listo',
            briefingNotifBody: 'Buenos días. Aquí tiene su agenda de hoy.',
        },
        friendly: {
            syncNotifTitle: '¡Hey! ¿Revisamos mañana? 🌙',
            syncNotifBody: 'Solo 2 minutitos y mañana irá de lujo 😊',
            briefingNotifTitle: '☀️ ¡Buenos días! Tu briefing está listo',
            briefingNotifBody: 'Aquí tienes todo para empezar el día con buen pie.',
        },
        sergeant: {
            syncNotifTitle: 'Sync obligatorio. Entra.',
            syncNotifBody: 'Tienes 2 minutos. Mueve ficha.',
            briefingNotifTitle: 'Arriba. Tu agenda.',
            briefingNotifBody: 'Sin excusas. Aquí está todo lo de hoy.',
        },
    };
    return map[personality] ?? map.friendly;
}
