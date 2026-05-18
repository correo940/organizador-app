'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import CalendarWidget from './widgets/calendar-widget';
import OrganizerWidget from './widgets/organizer-widget';
import AppsSummaryWidget from './widgets/apps-summary-widget';
import QuickActionFab from './quick-action-fab';
import PostItQuotes from '@/components/post-it-quotes';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { getSecretarySettings, getAvatarById } from '@/lib/secretary-settings';

/**
 * Dashboard optimizado para dispositivos móviles (iOS y Android)
 * Layout vertical con scroll, diseñado para uso táctil
 */
export default function MobileDashboard() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [refreshing, setRefreshing] = useState(false);
    const { user } = useAuth();
    const [secretaryStatus, setSecretaryStatus] = useState<'sync' | 'briefing' | 'ok' | null>(null);
    const [secretaryEmoji, setSecretaryEmoji] = useState('🤖');

    useEffect(() => {
        const checkSecretaryStatus = async () => {
            const settings = getSecretarySettings();
            if (!settings.enabled) return;
            setSecretaryEmoji(getAvatarById(settings.avatarId).emoji);
            const { data: u } = await supabase.auth.getUser();
            if (!u.user) return;
            const today = format(new Date(), 'yyyy-MM-dd');
            const { data } = await supabase
                .from('secretary_syncs')
                .select('completed_at, briefing_read_at')
                .eq('user_id', u.user.id)
                .eq('sync_date', today)
                .maybeSingle();
            if (!data || !data.completed_at) {
                setSecretaryStatus('sync');
            } else if (!data.briefing_read_at) {
                setSecretaryStatus('briefing');
            } else {
                setSecretaryStatus('ok');
            }
        };
        checkSecretaryStatus();
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setRefreshing(false);
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-green-100/20 dark:from-slate-950 dark:to-green-950/10">
            {/* Mobile Header con branding verde */}
            <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-green-800/10 dark:border-green-900/30 shadow-sm">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-primary font-headline">
                            Quiova
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {new Date().toLocaleDateString('es-ES', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short'
                            })}
                        </p>
                    </div>

                    {/* Botón de refresh */}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-900/20 active:scale-95 transition-all"
                        aria-label="Actualizar"
                    >
                        <RefreshCw
                            className={`w-5 h-5 text-primary ${refreshing ? 'animate-spin' : ''}`}
                        />
                    </button>
                </div>
            </div>

            {/* Contenido Principal - Vertical Scroll */}
            <div className="pb-6 space-y-4">

                {/* Secretary status banner */}
                {secretaryStatus && secretaryStatus !== 'ok' && (
                    <div className="px-4 pt-3">
                        <button
                            onClick={() => router.push(secretaryStatus === 'sync' ? '/apps/organizador/sync' : '/apps/organizador/briefing')}
                            className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-98 ${secretaryStatus === 'sync'
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700/40'
                                    : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700/40'
                                }`}
                        >
                            <span className="text-2xl">{secretaryEmoji}</span>
                            <div className="flex-1 text-left">
                                <p className={`text-sm font-semibold ${secretaryStatus === 'sync' ? 'text-indigo-700 dark:text-indigo-300' : 'text-amber-700 dark:text-amber-300'
                                    }`}>
                                    {secretaryStatus === 'sync' ? '🌙 Sync pendiente' : '📋 Briefing sin leer'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {secretaryStatus === 'sync' ? 'Toca para planificar mañana' : 'Tu resumen del día está listo'}
                                </p>
                            </div>
                            <span className="text-muted-foreground text-xs">→</span>
                        </button>
                    </div>
                )}

                {/* 1. Apps Summary - Horizontal Scroll Cards */}
                <div className="px-4 pt-4">
                    <AppsSummaryWidget selectedDate={selectedDate} user={user} />
                </div>

                {/* 2. Calendar Widget - Compacto */}
                <div className="px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-green-100/50 dark:border-green-900/30 overflow-hidden">
                        <div className="p-3 border-b border-green-100/50 dark:border-green-900/30 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/30">
                            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <span className="text-green-800">📅</span>
                                Calendario
                            </h2>
                        </div>
                        <div className="p-2">
                            <CalendarWidget
                                date={selectedDate}
                                onDateSelect={setSelectedDate}
                                user={user}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Organizer Widget - Eventos del día */}
                <div className="px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-green-100/50 dark:border-green-900/30 overflow-hidden">
                        <div className="p-3 border-b border-green-100/50 dark:border-green-900/30 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/30">
                            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <span className="text-green-800">📋</span>
                                Agenda del Día
                            </h2>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            <OrganizerWidget selectedDate={selectedDate} user={user} />
                        </div>
                    </div>
                </div>

                {/* 4. Post-it Quotes - Nevera */}
                <div className="px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-green-100/50 dark:border-green-900/30 overflow-hidden">
                        <div className="p-3 border-b border-green-100/50 dark:border-green-900/30 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/30">
                            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <span className="text-green-800">🧲</span>
                                Nevera
                            </h2>
                        </div>
                        <div className="p-2">
                            <PostItQuotes compact={true} />
                        </div>
                    </div>
                </div>

                {/* Espaciado inferior para safe area + taskbar */}
                <div className="h-28"></div>
            </div>
        </div>
    );
}
