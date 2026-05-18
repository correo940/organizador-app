'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { Bell, Calendar, CheckCircle2, Wrench, AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, isBefore, isAfter, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';

interface ReminderWithManual {
    id: string;
    title: string;
    description?: string;
    interval_months: number;
    next_date: string;
    is_active: boolean;
    manual_id: string;
    manual_title: string;
    manual_category: string;
}

export function MaintenanceAgendaPanel() {
    const { user } = useAuth();
    const [reminders, setReminders] = useState<ReminderWithManual[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'upcoming' | 'overdue' | 'all'>('upcoming');

    useEffect(() => {
        fetchAllReminders();
    }, [user]);

    const fetchAllReminders = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('manual_reminders')
                .select(`
                    *,
                    manuals!inner(title, category)
                `)
                .eq('is_active', true)
                .order('next_date', { ascending: true });

            if (error) throw error;

            const mapped: ReminderWithManual[] = (data || []).map((r: any) => ({
                id: r.id,
                title: r.title,
                description: r.description,
                interval_months: r.interval_months,
                next_date: r.next_date,
                is_active: r.is_active,
                manual_id: r.manual_id,
                manual_title: r.manuals?.title || 'Sin nombre',
                manual_category: r.manuals?.category || 'General',
            }));

            setReminders(mapped);
        } catch (err) {
            console.error('Error fetching reminders:', err);
        } finally {
            setLoading(false);
        }
    };

    const markAsDone = async (reminder: ReminderWithManual) => {
        try {
            const nextDate = new Date(reminder.next_date);
            nextDate.setMonth(nextDate.getMonth() + reminder.interval_months);
            const { error } = await supabase
                .from('manual_reminders')
                .update({ next_date: nextDate.toISOString() })
                .eq('id', reminder.id);
            if (error) throw error;
            toast.success(`✅ Próximo: ${format(nextDate, 'PPP', { locale: es })}`);
            fetchAllReminders();
        } catch {
            toast.error('Error al marcar como hecho');
        }
    };

    const now = new Date();
    const in30Days = addDays(now, 30);

    const overdue = reminders.filter(r => isBefore(new Date(r.next_date), now));
    const upcoming = reminders.filter(r =>
        !isBefore(new Date(r.next_date), now) && isBefore(new Date(r.next_date), in30Days)
    );
    const later = reminders.filter(r => isAfter(new Date(r.next_date), in30Days));

    const displayReminders = filter === 'overdue' ? overdue
        : filter === 'upcoming' ? [...overdue, ...upcoming]
            : reminders;

    const getDaysLabel = (dateStr: string) => {
        const d = new Date(dateStr);
        const diff = differenceInDays(d, now);
        if (diff < 0) return { label: `Hace ${Math.abs(diff)} días`, color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30' };
        if (diff === 0) return { label: 'Hoy', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' };
        if (diff === 1) return { label: 'Mañana', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' };
        if (diff <= 7) return { label: `En ${diff} días`, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' };
        return { label: format(d, 'dd MMM', { locale: es }), color: 'text-slate-600 bg-slate-100 dark:bg-slate-800' };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats rápidos */}
            <div className="grid grid-cols-3 gap-3">
                <button
                    onClick={() => setFilter('overdue')}
                    className={`p-4 rounded-2xl border text-left transition-all ${filter === 'overdue' ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-200' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-rose-200'}`}
                >
                    <AlertTriangle className={`h-5 w-5 mb-1 ${filter === 'overdue' ? 'text-white' : 'text-rose-500'}`} />
                    <p className={`text-2xl font-black ${filter === 'overdue' ? 'text-white' : 'text-rose-600'}`}>{overdue.length}</p>
                    <p className={`text-xs font-bold ${filter === 'overdue' ? 'text-rose-100' : 'text-slate-500'}`}>Vencidas</p>
                </button>
                <button
                    onClick={() => setFilter('upcoming')}
                    className={`p-4 rounded-2xl border text-left transition-all ${filter === 'upcoming' ? 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-200' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-green-200'}`}
                >
                    <Clock className={`h-5 w-5 mb-1 ${filter === 'upcoming' ? 'text-white' : 'text-green-500'}`} />
                    <p className={`text-2xl font-black ${filter === 'upcoming' ? 'text-white' : 'text-green-800'}`}>{upcoming.length}</p>
                    <p className={`text-xs font-bold ${filter === 'upcoming' ? 'text-green-100' : 'text-slate-500'}`}>Próximos 30d</p>
                </button>
                <button
                    onClick={() => setFilter('all')}
                    className={`p-4 rounded-2xl border text-left transition-all ${filter === 'all' ? 'bg-slate-800 text-white border-slate-800 shadow-lg shadow-slate-200' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
                >
                    <Calendar className={`h-5 w-5 mb-1 ${filter === 'all' ? 'text-white' : 'text-slate-500'}`} />
                    <p className={`text-2xl font-black ${filter === 'all' ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{reminders.length}</p>
                    <p className={`text-xs font-bold ${filter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>Total</p>
                </button>
            </div>

            {/* Lista de recordatorios */}
            {displayReminders.length === 0 ? (
                <div className="text-center py-16">
                    <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-300" />
                    <p className="font-black text-slate-700 dark:text-slate-300 text-lg">¡Todo al día!</p>
                    <p className="text-slate-500 text-sm mt-1">No hay recordatorios pendientes en este período.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayReminders.map(reminder => {
                        const { label, color } = getDaysLabel(reminder.next_date);
                        const isOverdue = isBefore(new Date(reminder.next_date), now);
                        return (
                            <div
                                key={reminder.id}
                                className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 flex items-start gap-4 transition-all hover:shadow-md ${isOverdue ? 'border-rose-200 dark:border-rose-900' : 'border-slate-100 dark:border-slate-800'}`}
                            >
                                <div className={`p-2.5 rounded-xl shrink-0 ${isOverdue ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-green-100 dark:bg-green-950/30'}`}>
                                    <Wrench className={`h-5 w-5 ${isOverdue ? 'text-rose-500' : 'text-green-500'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{reminder.title}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{reminder.manual_title} · {reminder.manual_category}</p>
                                        </div>
                                        <Badge className={`text-[10px] font-bold shrink-0 ${color} border-transparent`}>
                                            {label}
                                        </Badge>
                                    </div>
                                    {reminder.description && (
                                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{reminder.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(reminder.next_date), 'PPP', { locale: es })}
                                        </span>
                                        <span className="text-[10px] text-slate-400">· Cada {reminder.interval_months} meses</span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    className="shrink-0 h-8 px-3 bg-green-500 hover:bg-green-800 text-white rounded-xl text-xs font-bold shadow-sm"
                                    onClick={() => markAsDone(reminder)}
                                    title="Marcar como hecho"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                    Hecho
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

