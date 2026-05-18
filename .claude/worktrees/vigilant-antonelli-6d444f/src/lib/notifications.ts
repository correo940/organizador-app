import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import type { SecretaryPersonality } from './secretary-settings';
import { PERSONALITY_TEXTS } from './secretary-settings';

let permissionPromise: Promise<boolean> | null = null;
let isPermissionGranted: boolean | null = null;

export const NotificationManager = {
    async requestPermissions() {
        if (isPermissionGranted !== null) return isPermissionGranted;
        if (permissionPromise) return permissionPromise;

        permissionPromise = (async () => {
            try {
                // Return cached status if already granted
                const status = await LocalNotifications.checkPermissions();
                if (status.display === 'granted') {
                    isPermissionGranted = true;
                    return true;
                }

                const result = await LocalNotifications.requestPermissions();
                isPermissionGranted = result.display === 'granted';
                return isPermissionGranted;
            } catch (e) {
                console.error('Error requesting notification permissions:', e);
                return false;
            } finally {
                permissionPromise = null;
            }
        })();

        return permissionPromise;
    },

    async schedule(options: {
        id: number;
        title: string;
        body: string;
        schedule: { at?: Date; every?: 'year' | 'month' | 'two-weeks' | 'week' | 'day' | 'hour' | 'minute' | 'second' };
        extra?: any;
    }) {
        try {
            // Check/Request permission on fly? Better to rely on component doing it, but safe check here.
            // (Skipping permission check here to avoid spamming prompts, assume caller handles it or it fails silently)

            await LocalNotifications.schedule({
                notifications: [
                    {
                        id: options.id,
                        title: options.title,
                        body: options.body,
                        schedule: options.schedule,
                        sound: undefined,
                        attachments: undefined,
                        actionTypeId: "",
                        extra: options.extra
                    }
                ]
            });
            console.log(`Notification scheduled: ${options.title} at ${options.schedule.at}`);
            return true;
        } catch (e) {
            console.error('Error scheduling notification:', e);
            return false;
        }
    },

    async cancel(ids: number[]) {
        try {
            await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
        } catch (e) {
            console.error('Error cancelling notifications:', e);
        }
    },

    async getPending() {
        try {
            const pending = await LocalNotifications.getPending();
            return pending.notifications;
        } catch (e) {
            console.error('Error getting pending notifications:', e);
            return [];
        }
    },

    // Hash function to turn string IDs (UUIDs) into unique Integers for Android notifications
    generateId(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash); // Ensure positive
    },

    // ── Secretary notification IDs (reserved) ──────────────────────────────
    SYNC_NOTIFICATION_ID: 9001,
    BRIEFING_NOTIFICATION_ID: 9002,

    // Request web browser notification permission (PWA fallback)
    async requestWebPermission(): Promise<boolean> {
        if (typeof window === 'undefined' || !('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        const result = await Notification.requestPermission();
        return result === 'granted';
    },

    // Show a web notification (PWA) with optional link deeplink
    showWebNotification(title: string, body: string, deeplink?: string): void {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        const n = new Notification(title, {
            body,
            icon: '/icon.png',
            badge: '/icon.png',
            tag: deeplink ?? 'quioba-secretary',
        });
        if (deeplink) {
            n.onclick = () => { window.focus(); window.location.href = deeplink; };
        }
    },

    // Schedule the two daily secretary notifications (sync + briefing)
    // Works on native (Capacitor) and web (Notification API scheduled via setTimeout).
    async scheduleSecretary(
        syncTime: string,
        briefingTime: string,
        personality: SecretaryPersonality,
        userName: string = 'tú'
    ): Promise<void> {
        const texts = PERSONALITY_TEXTS[personality];
        const isNative = Capacitor.isNativePlatform();

        const parseTime = (timeStr: string): { hour: number; minute: number } => {
            const [h, m] = timeStr.split(':').map(Number);
            return { hour: h, minute: m };
        };

        const nextOccurrence = (hour: number, minute: number): Date => {
            const now = new Date();
            const target = new Date();
            target.setHours(hour, minute, 0, 0);
            if (target <= now) target.setDate(target.getDate() + 1);
            return target;
        };

        const sync = parseTime(syncTime);
        const briefing = parseTime(briefingTime);

        if (isNative) {
            // Cancel existing secretary notifications first
            await this.cancel([this.SYNC_NOTIFICATION_ID, this.BRIEFING_NOTIFICATION_ID]);

            await LocalNotifications.schedule({
                notifications: [
                    {
                        id: this.SYNC_NOTIFICATION_ID,
                        title: texts.syncNotifTitle,
                        body: texts.syncNotifBody,
                        schedule: {
                            at: nextOccurrence(sync.hour, sync.minute),
                            every: 'day',
                            repeats: true,
                        },
                        actionTypeId: '',
                        extra: { deeplink: '/apps/organizador/sync' },
                    },
                    {
                        id: this.BRIEFING_NOTIFICATION_ID,
                        title: texts.briefingNotifTitle,
                        body: texts.briefingNotifBody,
                        schedule: {
                            at: nextOccurrence(briefing.hour, briefing.minute),
                            every: 'day',
                            repeats: true,
                        },
                        actionTypeId: '',
                        extra: { deeplink: '/apps/organizador/briefing' },
                    },
                ],
            });
            console.log('[Secretary] Native notifications scheduled:', syncTime, briefingTime);
        } else {
            // PWA fallback: schedule via setTimeout for the current session
            const granted = await this.requestWebPermission();
            if (!granted) {
                toast.error('Activa los permisos de notificación en tu navegador para recibir los avisos de Quioba.');
                return;
            }

            // Clear any existing scheduled web timeouts
            const existingSyncId = (window as any).__quioba_sync_timeout;
            const existingBriefingId = (window as any).__quioba_briefing_timeout;
            if (existingSyncId) clearTimeout(existingSyncId);
            if (existingBriefingId) clearTimeout(existingBriefingId);

            const scheduleWebNotif = (hour: number, minute: number, title: string, body: string, deeplink: string, key: string) => {
                const now = new Date();
                const target = new Date();
                target.setHours(hour, minute, 0, 0);
                if (target <= now) target.setDate(target.getDate() + 1);
                const delay = target.getTime() - now.getTime();
                (window as any)[key] = setTimeout(() => {
                    this.showWebNotification(title, body, deeplink);
                }, delay);
            };

            scheduleWebNotif(sync.hour, sync.minute, texts.syncNotifTitle, texts.syncNotifBody, '/apps/organizador/sync', '__quioba_sync_timeout');
            scheduleWebNotif(briefing.hour, briefing.minute, texts.briefingNotifTitle, texts.briefingNotifBody, '/apps/organizador/briefing', '__quioba_briefing_timeout');
            console.log('[Secretary] Web notifications scheduled (session-only):', syncTime, briefingTime);
        }
    },

    async cancelSecretary(): Promise<void> {
        try {
            if (Capacitor.isNativePlatform()) {
                await this.cancel([this.SYNC_NOTIFICATION_ID, this.BRIEFING_NOTIFICATION_ID]);
            } else {
                const syncId = (window as any).__quioba_sync_timeout;
                const briefingId = (window as any).__quioba_briefing_timeout;
                if (syncId) clearTimeout(syncId);
                if (briefingId) clearTimeout(briefingId);
            }
            console.log('[Secretary] Notifications cancelled');
        } catch (e) {
            console.error('[Secretary] Error cancelling notifications:', e);
        }
    },
};
