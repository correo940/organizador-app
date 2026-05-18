'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { useAi } from '@/context/AiContext';
import { motion } from 'framer-motion';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Settings, ArrowRight, CheckCircle2, Archive,
    Home, ListChecks, ShoppingCart, Pill, Wallet,
    CalendarClock
} from 'lucide-react';
import {
    getSecretarySettings, getAvatarById, getUserFirstName,
    PERSONALITY_TEXTS, type SecretarySettings
} from '@/lib/secretary-settings';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type DaySummary = {
    shifts: any[];
    tasks: any[];
    shopping: any[];
    medicines: any[];
    totalBalance: number;
};

// ─── Componente píldora de resumen ───────────────────────────────────────────

function SummaryPill({
    icon: Icon, label, value, accent, onClick
}: {
    icon: any;
    label: string;
    value: string | number;
    accent: 'green-800' | 'amber' | 'blue' | 'rose' | 'violet';
    onClick?: () => void;
}) {
    const colors = {
        'green-800': 'bg-green-500/10 border-green-500/20 text-green-800 dark:text-green-400',
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
        rose: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
        violet: 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400',
    };

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all hover:scale-105 active:scale-95 ${colors[accent]} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
        >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-foreground/70">{label}</span>
            <span className="font-bold">{value}</span>
        </button>
    );
}

// ─── Componente de acción principal ──────────────────────────────────────────

function MainActionCard({
    emoji, title, subtitle, badge, badgeColor, done, onClick, accent
}: {
    emoji: string;
    title: string;
    subtitle: string;
    badge?: string;
    badgeColor?: 'amber' | 'indigo';
    done?: boolean;
    onClick: () => void;
    accent?: 'amber' | 'indigo' | 'green-800';
}) {
    const accentStyles = {
        amber: 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20',
        indigo: 'border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/20',
        'green-800': 'border-green-200 dark:border-green-950/50 bg-green-50/50 dark:bg-green-800-950/20',
    };

    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: done ? 1 : 1.02, y: done ? 0 : -2 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group shadow-sm hover:shadow-md ${done
                ? 'bg-muted/30 border-border opacity-60'
                : accent
                    ? accentStyles[accent]
                    : 'bg-card border-border'
                }`}
        >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-transform group-hover:scale-110 ${done ? 'grayscale opacity-50' : ''
                }`}>
                {done ? '✅' : emoji}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`font-semibold text-sm ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {title}
                    </p>
                    {badge && !done && (
                        <Badge className={`px-1.5 py-0 text-[9px] font-bold leading-none ${badgeColor === 'amber'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                            }`}>{badge}</Badge>
                    )}
                </div>
                <p className="text-muted-foreground text-xs mt-0.5 leading-snug">{subtitle}</p>
            </div>
            {!done && (
                <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
            )}
        </motion.button>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SecretariaPage() {
    const router = useRouter();
    const { setIsOpen, setPendingPrompt } = useAi();
    const [settings, setSettings] = useState<SecretarySettings | null>(null);
    const [user, setUser] = useState<any>(null);
    const [todaySync, setTodaySync] = useState<any>(null);
    const [summary, setSummary] = useState<DaySummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const s = getSecretarySettings();
        setSettings(s);
        loadStatus();
    }, []);

    const loadStatus = async () => {
        try {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (!u) { router.push('/login'); return; }
            setUser(u);

            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
            const today = format(new Date(), 'yyyy-MM-dd');

            const [shifts, tasks, shopping, medicines, accounts, sync] = await Promise.all([
                supabase.from('work_shifts').select('*').eq('user_id', u.id)
                    .gte('start_time', todayStart.toISOString())
                    .lte('start_time', todayEnd.toISOString())
                    .order('start_time'),
                supabase.from('tasks').select('*').eq('user_id', u.id).eq('is_completed', false)
                    .gte('due_date', todayStart.toISOString())
                    .lte('due_date', todayEnd.toISOString())
                    .order('due_date'),
                supabase.from('shopping_items').select('*').eq('user_id', u.id).eq('is_checked', false),
                supabase.from('medicines').select('*').eq('user_id', u.id),
                supabase.from('savings_accounts').select('*').eq('user_id', u.id),
                supabase.from('secretary_syncs')
                    .select('completed_at, briefing_read_at, mode, victories, planned_expenses')
                    .eq('user_id', u.id)
                    .eq('sync_date', today)
                    .maybeSingle(),
            ]);

            const totalBalance = (accounts.data || [])
                .filter((a: any) => a.include_in_total !== false)
                .reduce((sum: number, a: any) => sum + (a.current_balance || 0), 0);

            setSummary({
                shifts: shifts.data || [],
                tasks: tasks.data || [],
                shopping: shopping.data || [],
                medicines: medicines.data || [],
                totalBalance,
            });

            setTodaySync(sync.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (type: 'sync' | 'briefing') => {
        toast.info(type === 'sync' ? 'Iniciando cierre del día...' : 'Preparando plan de hoy...', { icon: '🤖' });
        setPendingPrompt(type === 'sync' ? 'Quiero hacer el cierre del día.' : 'Dime el plan que tenemos para hoy.');
        setIsOpen(true);
    };

    if (loading || !settings) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                    <p className="text-xs text-muted-foreground animate-pulse">Cargando organizador...</p>
                </div>
            </div>
        );
    }

    const profile = getAvatarById(settings.avatarId);
    const texts = PERSONALITY_TEXTS[settings.personality];
    const firstName = getUserFirstName(user);
    const now = new Date();
    const hour = now.getHours();
    const isMorning = hour >= 5 && hour < 14;
    const isDaytime = hour >= 5 && hour < 20;
    const isNight = hour >= 20 || hour < 5;

    const syncDone = !!todaySync?.completed_at;
    const briefingRead = !!todaySync?.briefing_read_at;
    const allDone = syncDone && briefingRead;

    const greeting = isMorning
        ? texts.briefingGreeting(firstName)
        : hour >= 14 && hour < 20
            ? `Buenas tardes, ${firstName}. Todavía queda día por delante.`
            : texts.syncWelcome(firstName);

    return (
        <div className="min-h-screen bg-background text-foreground pb-nav">

            {/* ── Header sticky ── */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="rounded-full gap-2 text-xs font-semibold uppercase tracking-wider">
                            <Home className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Inicio</span>
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{profile.emoji}</span>
                        <span className="font-bold text-sm">Organizador</span>
                    </div>
                    <Link href="/apps/organizador/settings">
                        <Button variant="ghost" size="sm" className="rounded-full gap-2 text-xs font-semibold uppercase tracking-wider">
                            <Settings className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">IA</span>
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

                {/* ── Saludo + píldoras ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="p-5 rounded-2xl bg-card border border-border shadow-sm"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <p className="text-muted-foreground/50 text-[10px] uppercase tracking-widest font-semibold mb-1">
                                {format(now, "EEEE, d 'de' MMMM", { locale: es })}
                            </p>
                            <h2 className="text-base font-bold text-foreground leading-snug">{greeting}</h2>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-xl shrink-0">
                            {isDaytime ? '☀️' : '🌙'}
                        </div>
                    </div>

                    {summary && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border"
                        >
                            {summary.shifts.length > 0 && (
                                <SummaryPill
                                    icon={CalendarClock} label="Turnos" value={summary.shifts.length} accent="blue"
                                    onClick={() => router.push('/apps/cuadrante')}
                                />
                            )}
                            {summary.tasks.length > 0 && (
                                <SummaryPill
                                    icon={ListChecks} label="Tareas" value={summary.tasks.length} accent="amber"
                                    onClick={() => router.push('/apps/mi-hogar/tasks')}
                                />
                            )}
                            {summary.shopping.length > 0 && (
                                <SummaryPill
                                    icon={ShoppingCart} label="Compra" value={summary.shopping.length} accent="rose"
                                    onClick={() => router.push('/apps/mi-hogar/shopping')}
                                />
                            )}
                            {summary.medicines.length > 0 && (
                                <SummaryPill
                                    icon={Pill} label="Medicación" value={summary.medicines.length} accent="violet"
                                    onClick={() => router.push('/apps/mi-hogar/pharmacy')}
                                />
                            )}
                            <SummaryPill
                                icon={Wallet} label="Saldo"
                                value={summary.totalBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                accent="green-800"
                                onClick={() => router.push('/apps/mi-hogar/savings')}
                            />
                        </motion.div>
                    )}
                </motion.div>

                {/* ── Acciones del día ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="space-y-2"
                >
                    <p className="text-muted-foreground/50 text-[10px] uppercase tracking-widest font-semibold ml-1">
                        {allDone ? '✅ Todo completado hoy' : 'Acciones del día'}
                    </p>
                    <MainActionCard
                        emoji="☀️" title="Plan de Hoy" subtitle="Descubre qué te depara el día"
                        badge={!briefingRead && isDaytime ? 'Nuevo' : undefined}
                        badgeColor="amber" done={briefingRead} accent="amber"
                        onClick={() => handleAction('briefing')}
                    />
                    <MainActionCard
                        emoji="🌙" title="Cierre del Día" subtitle="Haz balance y prepara mañana"
                        badge={!syncDone && isNight ? 'Pendiente' : undefined}
                        badgeColor="indigo" done={syncDone} accent="indigo"
                        onClick={() => handleAction('sync')}
                    />
                </motion.div>

                {/* ── Victorias de hoy ── */}
                {todaySync?.victories && todaySync.victories.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                        className="space-y-2"
                    >
                        <p className="text-muted-foreground/50 text-[10px] uppercase tracking-widest font-semibold ml-1">Victorias de hoy ✨</p>
                        <div className="space-y-1.5">
                            {todaySync.victories.slice(0, 3).map((v: string, i: number) => (
                                <div key={i} className="flex items-center gap-2.5 p-3 rounded-xl bg-green-500/10 border border-green-500/15">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                    <span className="text-sm text-green-900 dark:text-green-300">{v}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── Visión amplia ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="space-y-2"
                >
                    <p className="text-muted-foreground/50 text-[10px] uppercase tracking-widest font-semibold ml-1">Visión Amplia</p>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { emoji: '📅', label: 'Semanal', path: '/apps/organizador/sync/weekly' },
                            { emoji: '📆', label: 'Mensual', path: '/apps/organizador/sync/monthly' },
                            { emoji: '✨', label: 'Vida', path: '/apps/organizador/vida' },
                        ].map((item) => (
                            <motion.button
                                key={item.path}
                                onClick={() => router.push(item.path)}
                                whileHover={{ scale: 1.03, y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all group"
                            >
                                <span className="text-2xl group-hover:scale-110 transition-transform">{item.emoji}</span>
                                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* ── Historial ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 }}
                >
                    <button
                        onClick={() => router.push('/apps/organizador/archivo')}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                            <Archive className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="text-left flex-1">
                            <h3 className="text-sm font-semibold text-foreground">Historial de Cierres</h3>
                            <p className="text-muted-foreground text-xs leading-snug">Todos tus balances y planificaciones pasadas</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </button>
                </motion.div>

            </div>
        </div>
    );
}

