'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { addMonths, format, setMonth, setYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useJournal } from '@/context/JournalContext';
import { supabase } from '@/lib/supabase';

interface CalendarWidgetProps {
    date: Date | undefined;
    onDateSelect: (date: Date | undefined) => void;
    user: User | null; // ✅ recibido del padre, sin llamadas extra a Supabase
}

export default function CalendarWidget({ date, onDateSelect, user }: CalendarWidgetProps) {
    const [taskDates, setTaskDates] = useState<Date[]>([]);
    const [journalDates, setJournalDates] = useState<Date[]>([]);
    const [shiftDates, setShiftDates] = useState<Date[]>([]);
    const [visibleMonth, setVisibleMonth] = useState<Date>(date ?? new Date());
    const { setSelectedDate } = useJournal();

    useEffect(() => {
        const fetchCalendarData = async () => {
            // ✅ Usar el user recibido como prop — sin llamadas extra a Supabase
            if (!user) return;

            const { data: tasks } = await supabase
                .from('tasks')
                .select('due_date')
                .eq('user_id', user.id)
                .eq('is_completed', false)
                .not('due_date', 'is', null);
            if (tasks) setTaskDates(tasks.map((task: any) => new Date(task.due_date)));

            const { data: entries } = await supabase
                .from('journal_entries')
                .select('updated_at')
                .eq('user_id', user.id);
            if (entries) setJournalDates(entries.map((entry: any) => new Date(entry.updated_at)));

            const { data: shifts } = await supabase
                .from('work_shifts')
                .select('start_time')
                .eq('user_id', user.id);
            if (shifts) setShiftDates(shifts.map((shift: any) => new Date(shift.start_time)));
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void fetchCalendarData();
            }
        };

        const handleWindowFocus = () => {
            void fetchCalendarData();
        };

        const handleExternalRefresh = () => {
            void fetchCalendarData();
        };

        void fetchCalendarData();
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('quioba-calendar-refresh', handleExternalRefresh);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleWindowFocus);
            window.removeEventListener('quioba-calendar-refresh', handleExternalRefresh);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, date]); // ✅ re-ejecutar cuando user cambia de null → User

    useEffect(() => {
        if (date) {
            setVisibleMonth(date);
        }
    }, [date]);

    const monthOptions = useMemo(
        () =>
            Array.from({ length: 12 }, (_, index) => ({
                value: index.toString(),
                label: format(new Date(2026, index, 1), 'MMMM', { locale: es }),
            })),
        []
    );

    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(
        () => Array.from({ length: 41 }, (_, index) => currentYear - 20 + index),
        [currentYear]
    );

    const handleDateSelect = (nextDate: Date | undefined) => {
        onDateSelect(nextDate);
        setSelectedDate(nextDate);
    };

    const handleToday = () => {
        const today = new Date();
        setVisibleMonth(today);
        handleDateSelect(today);
    };

    const handleMonthSelect = (monthValue: string) => {
        setVisibleMonth((current) => setMonth(current, Number(monthValue)));
    };

    const handleYearSelect = (yearValue: string) => {
        setVisibleMonth((current) => setYear(current, Number(yearValue)));
    };

    return (
        <Card className="h-full flex flex-col overflow-hidden border-none shadow-md">
            <CardHeader className="space-y-0 py-3 px-4 bg-green-50/50 dark:bg-green-800-950/10 border-b border-green-100 dark:border-green-950/30">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-green-950 dark:text-green-400 font-headline text-lg">
                            Calendario
                        </CardTitle>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {date ? `Fecha seleccionada: ${format(date, 'PPP', { locale: es })}` : 'Selecciona una fecha'}
                        </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleToday}>
                        Hoy
                    </Button>
                </div>

                <div className="grid grid-cols-[40px_minmax(0,1fr)_116px_40px] gap-2 pt-3">
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-10 w-10"
                        onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <Select value={visibleMonth.getMonth().toString()} onValueChange={handleMonthSelect}>
                        <SelectTrigger className="h-10 bg-white dark:bg-slate-950 capitalize">
                            <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                            {monthOptions.map((month) => (
                                <SelectItem key={month.value} value={month.value} className="capitalize">
                                    {month.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={visibleMonth.getFullYear().toString()} onValueChange={handleYearSelect}>
                        <SelectTrigger className="h-10 bg-white dark:bg-slate-950">
                            <SelectValue placeholder="Año" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                            {yearOptions.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-10 w-10"
                        onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex justify-center p-2 flex-1 min-h-0 items-start bg-white dark:bg-slate-950">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    month={visibleMonth}
                    onMonthChange={setVisibleMonth}
                    locale={es}
                    initialFocus
                    className="rounded-lg"
                    classNames={{
                        caption: 'hidden',
                        head_cell: 'text-green-800 dark:text-green-500 rounded-md w-9 font-bold text-[0.8rem]',
                        day_selected:
                            'bg-green-800 text-white hover:bg-green-900 focus:bg-green-900 shadow-lg transition-transform z-10 font-bold rounded-lg',
                        day_today: 'bg-green-50 text-green-950 font-bold ring-1 ring-green-500/50 rounded-lg',
                    }}
                    modifiers={{
                        hasTask: taskDates,
                        hasJournal: journalDates,
                        hasShift: shiftDates,
                    }}
                    modifiersStyles={{
                        hasTask: {
                            textDecoration: 'underline',
                            textDecorationColor: '#9333ea',
                            textDecorationThickness: '3px',
                            fontWeight: 'bold',
                        },
                        hasJournal: { color: '#ea580c', fontWeight: '600', fontStyle: 'italic' },
                        hasShift: {
                            backgroundColor: '#d1fae5',
                            color: '#065f46',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                        },
                    }}
                />
            </CardContent>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-2 border-t border-slate-100 dark:border-slate-800 flex justify-around text-[10px] text-muted-foreground shrink-0">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-purple-500"></div><span>Tarea</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-200 border border-green-800"></div><span>Turno</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"></div><span>Diario</span></div>
            </div>
        </Card>
    );
}

