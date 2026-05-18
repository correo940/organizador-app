'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { supabase } from '@/lib/supabase';
import { NotificationManager } from '@/lib/notifications';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'sonner';

interface SavingsNotificationSettings {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'disabled';
    weekDays: number[];
    monthDay: number;
    time: string;
    channels: ('app' | 'web')[];  // Puede incluir ambos
}

const SAVINGS_NOTIFICATION_BASE_ID = 900000; // Base ID for savings notifications

export default function SavingsNotificationManager() {
    const { user } = useAuth();
    const hasScheduled = useRef(false);

    useEffect(() => {
        if (!user) return;

        const handleSettingsChange = (event?: CustomEvent<SavingsNotificationSettings>) => {
            const settings = event?.detail || getSettings();
            scheduleNotifications(settings);
        };

        // Check for web notification on load (if channel is 'web')
        checkWebNotification();

        // Initial schedule
        if (!hasScheduled.current) {
            const settings = getSettings();
            if (settings.enabled) {
                scheduleNotifications(settings);
            }
            hasScheduled.current = true;
        }

        // Listen for settings changes
        window.addEventListener('savingsNotificationSettingsChanged', handleSettingsChange as EventListener);

        return () => {
            window.removeEventListener('savingsNotificationSettingsChanged', handleSettingsChange as EventListener);
        };
    }, [user]);

    const getSettings = (): SavingsNotificationSettings => {
        const saved = localStorage.getItem('savingsNotificationSettings');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Error parsing savings notification settings:', e);
            }
        }
        return {
            enabled: false,
            frequency: 'weekly',
            weekDays: [4],
            monthDay: 1,
            time: '09:00',
            channels: ['app']
        };
    };

    const checkWebNotification = async () => {
        const settings = getSettings();

        // Only show web notification if:
        // 1. Channels include 'web'
        // 2. We're on web (not native app)
        // 3. It's the right time to show
        if (!settings.channels?.includes('web') || !settings.enabled) return;
        if (Capacitor.isNativePlatform()) return;

        const lastShown = localStorage.getItem('savingsNotificationLastShown');
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Check if we should show based on frequency
        let shouldShow = false;

        if (settings.frequency === 'daily') {
            shouldShow = lastShown !== today;
        } else if (settings.frequency === 'weekly') {
            const dayOfWeek = now.getDay();
            if (settings.weekDays.includes(dayOfWeek) && lastShown !== today) {
                shouldShow = true;
            }
        } else if (settings.frequency === 'monthly') {
            const dayOfMonth = now.getDate();
            if (dayOfMonth === settings.monthDay && lastShown !== today) {
                shouldShow = true;
            }
        }

        if (shouldShow) {
            // Fetch savings summary and show toast
            const summary = await getSavingsSummary();
            if (summary) {
                toast.info(
                    `💰 Resumen de Mi Economía: ${summary.totalBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} en ${summary.accountCount} cuentas`,
                    {
                        duration: 10000,
                        action: {
                            label: 'Ver más',
                            onClick: () => window.location.href = '/apps/mi-hogar/savings'
                        }
                    }
                );
                localStorage.setItem('savingsNotificationLastShown', today);
            }
        }
    };

    const getSavingsSummary = async () => {
        try {
            const { data: accounts } = await supabase
                .from('savings_accounts')
                .select('current_balance')
                .eq('user_id', user?.id);

            if (accounts) {
                const totalBalance = accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);
                return {
                    totalBalance,
                    accountCount: accounts.length
                };
            }
        } catch (error) {
            console.error('Error fetching savings summary:', error);
        }
        return null;
    };

    const scheduleNotifications = async (settings: SavingsNotificationSettings) => {
        // Only schedule native notifications on native platforms
        if (!Capacitor.isNativePlatform()) return;
        if (!settings.channels?.includes('app')) return;

        try {
            // Cancel existing savings notifications
            const pending = await LocalNotifications.getPending();
            const savingsNotifications = pending.notifications.filter(
                n => n.id >= SAVINGS_NOTIFICATION_BASE_ID && n.id < SAVINGS_NOTIFICATION_BASE_ID + 100
            );
            if (savingsNotifications.length > 0) {
                await LocalNotifications.cancel({
                    notifications: savingsNotifications.map(n => ({ id: n.id }))
                });
            }

            if (!settings.enabled) return;

            // Request permissions
            await NotificationManager.requestPermissions();

            // Parse time
            const [hours, minutes] = settings.time.split(':').map(Number);

            if (settings.frequency === 'daily') {
                // Schedule daily notification
                const scheduleDate = getNextOccurrence(hours, minutes);
                await LocalNotifications.schedule({
                    notifications: [{
                        id: SAVINGS_NOTIFICATION_BASE_ID,
                        title: '💰 Resumen de Mi Economía',
                        body: 'Revisa el estado de tus cuentas y tu economía',
                        schedule: {
                            at: scheduleDate,
                            every: 'day',
                            allowWhileIdle: true
                        },
                        sound: undefined,
                        actionTypeId: '',
                        extra: { route: '/apps/mi-hogar/savings' }
                    }]
                });
            } else if (settings.frequency === 'weekly') {
                // Schedule for each selected day
                for (let i = 0; i < settings.weekDays.length; i++) {
                    const dayOfWeek = settings.weekDays[i];
                    const scheduleDate = getNextWeekdayOccurrence(dayOfWeek, hours, minutes);

                    await LocalNotifications.schedule({
                        notifications: [{
                            id: SAVINGS_NOTIFICATION_BASE_ID + i + 1,
                            title: '💰 Resumen Semanal de Mi Economía',
                            body: 'Revisa el estado de tus cuentas y tu economía',
                            schedule: {
                                at: scheduleDate,
                                every: 'week',
                                allowWhileIdle: true
                            },
                            sound: undefined,
                            actionTypeId: '',
                            extra: { route: '/apps/mi-hogar/savings' }
                        }]
                    });
                }
            } else if (settings.frequency === 'monthly') {
                // Schedule monthly notification
                const scheduleDate = getNextMonthlyOccurrence(settings.monthDay, hours, minutes);
                await LocalNotifications.schedule({
                    notifications: [{
                        id: SAVINGS_NOTIFICATION_BASE_ID + 50,
                        title: '💰 Resumen Mensual de Mi Economía',
                        body: 'Revisa el estado de tus cuentas y tus finanzas',
                        schedule: {
                            at: scheduleDate,
                            every: 'month',
                            allowWhileIdle: true
                        },
                        sound: undefined,
                        actionTypeId: '',
                        extra: { route: '/apps/mi-hogar/savings' }
                    }]
                });
            }

            console.log('Savings notifications scheduled successfully');
        } catch (error) {
            console.error('Error scheduling savings notifications:', error);
        }
    };

    return null; // This is a logic-only component
}

// Helper functions
function getNextOccurrence(hours: number, minutes: number): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    return next;
}

function getNextWeekdayOccurrence(dayOfWeek: number, hours: number, minutes: number): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    const currentDay = now.getDay();
    let daysUntil = dayOfWeek - currentDay;

    if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
    }

    next.setDate(next.getDate() + daysUntil);
    return next;
}

function getNextMonthlyOccurrence(dayOfMonth: number, hours: number, minutes: number): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    // Try this month first
    next.setDate(dayOfMonth);

    // If that day doesn't exist in this month, use last day
    if (next.getDate() !== dayOfMonth) {
        next.setDate(0); // Last day of previous month
    }

    // If we've passed this day, go to next month
    if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth);

        // Check again for months with fewer days
        if (next.getDate() !== dayOfMonth) {
            next.setDate(0);
        }
    }

    return next;
}
