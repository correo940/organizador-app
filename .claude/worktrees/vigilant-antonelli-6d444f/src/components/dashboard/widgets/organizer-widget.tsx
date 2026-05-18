'use client';

import React, { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Circle, Clock, Book, FileText, Calendar as CalendarIcon, ArrowRight, Tag } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useJournal } from '@/context/JournalContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Task = {
    id: string;
    title: string;
    description?: string;
    due_date: string;
    is_completed: boolean;
};

type JournalEntry = {
    id: string;
    content: any;
    updated_at: string;
    context_id: string;
    tags?: string[];
};

type SmartBlock = {
    id: string;
    type: 'fixed' | 'generated';
    title: string;
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
    date?: string;
    description?: string;
};

interface OrganizerWidgetProps {
    selectedDate: Date | undefined;
    user: User | null; // ✅ recibido del padre, sin llamadas extra a Supabase
}

export default function OrganizerWidget({ selectedDate, user }: OrganizerWidgetProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [smartBlocks, setSmartBlocks] = useState<SmartBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const { setIsOpen, setSelectedDate } = useJournal();
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState<string>('all');

    const fetchData = async () => {
        setLoading(true);
        // ✅ Usar el user recibido como prop — sin llamadas extra a Supabase
        if (!user) {
            setLoading(false);
            return;
        }

        // --- Fetch Smart Schedule Blocks ---
        const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

        // 1. Fixed Blocks for this day of week
        // Map spanish day names to english enum if needed
        const dayName = format(selectedDate || new Date(), 'EEEE', { locale: es }).toLowerCase();
        const daysMap: any = { 'lunes': 'monday', 'martes': 'tuesday', 'miércoles': 'wednesday', 'jueves': 'thursday', 'viernes': 'friday', 'sábado': 'saturday', 'domingo': 'sunday' };
        const englishDay = daysMap[dayName] || format(selectedDate || new Date(), 'EEEE').toLowerCase();

        const { data: fixedData } = await supabase
            .from('smart_scheduler_fixed_blocks')
            .select('*')
            .eq('user_id', user.id)
            .eq('day_of_week', englishDay);

        // 2. Generated Blocks for this specific date
        const { data: generatedData } = await supabase
            .from('smart_scheduler_generated_blocks')
            .select(`
                *,
                activity:smart_scheduler_activities(name, description)
            `)
            .eq('user_id', user.id)
            .eq('date', dateStr);

        // Combine and sort
        let combined: SmartBlock[] = [];

        if (fixedData) {
            combined = combined.concat(fixedData.map((b: any) => ({
                id: b.id,
                type: 'fixed',
                title: b.label,
                start_time: b.start_time.slice(0, 5),
                end_time: b.end_time.slice(0, 5),
                description: 'Bloque Fijo'
            })));
        }

        if (generatedData) {
            combined = combined.concat(generatedData.map((b: any) => ({
                id: b.id,
                type: 'generated',
                title: b.activity?.name || 'Actividad',
                start_time: b.start_time.slice(0, 5),
                end_time: b.end_time.slice(0, 5),
                description: b.activity?.description
            })));
        }

        combined.sort((a, b) => a.start_time.localeCompare(b.start_time));
        setSmartBlocks(combined);

        // --- Fetch Tasks ---
        let taskQuery = supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_completed', false)
            .order('due_date', { ascending: true });

        if (selectedDate) {
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            taskQuery = taskQuery
                .gte('due_date', startOfDay.toISOString())
                .lte('due_date', endOfDay.toISOString());
        } else {
            taskQuery = taskQuery.limit(10);
        }

        const { data: taskData } = await taskQuery;
        if (taskData) setTasks(taskData);

        // --- Fetch Journal Entries ---
        let journalQuery = supabase
            .from('journal_entries')
            .select('*, tags')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (selectedDate) {
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            journalQuery = journalQuery
                .gte('updated_at', startOfDay.toISOString())
                .lte('updated_at', endOfDay.toISOString());
        } else {
            journalQuery = journalQuery.limit(5);
        }

        const { data: journalData } = await journalQuery;
        if (journalData) {
            setJournalEntries(journalData);

            // Extract unique tags
            const allTags = new Set<string>();
            journalData.forEach((entry: any) => {
                if (entry.tags && Array.isArray(entry.tags)) {
                    entry.tags.forEach((tag: string) => allTags.add(tag));
                }
            });
            setAvailableTags(Array.from(allTags));
        }

        // --- Fetch Work Shifts ---
        let shiftQuery = supabase
            .from('work_shifts')
            .select('*')
            .eq('user_id', user.id)
            .order('start_time', { ascending: true });

        if (selectedDate) {
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            shiftQuery = shiftQuery
                .gte('start_time', startOfDay.toISOString())
                .lte('start_time', endOfDay.toISOString());
        } else {
            // If no date selected, maybe show upcoming 3?
            shiftQuery = shiftQuery.gte('start_time', new Date().toISOString()).limit(3);
        }

        const { data: shiftData } = await shiftQuery;
        if (shiftData) setShifts(shiftData);

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [selectedDate, user]); // ✅ re-ejecutar cuando user cambia de null → User

    // Subscribe to changes
    useEffect(() => {
        const channel = supabase
            .channel('organizer_widget')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, fetchData)
            // Listen to smart blocks changes too?
            .on('postgres_changes', { event: '*', schema: 'public', table: 'smart_scheduler_generated_blocks' }, fetchData)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedDate, user]); // ✅ re-suscribir con el user correcto

    const toggleTask = async (taskId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('tasks')
            .update({ is_completed: !currentStatus })
            .eq('id', taskId);

        if (!error) fetchData();
    };

    const openJournalEntry = (dateStr: string) => {
        const date = new Date(dateStr);
        setSelectedDate(date);
        setIsOpen(true);
    };

    // Helper to extract text from Tiptap JSON content
    const getPreviewText = (content: any) => {
        if (!content) return "Sin contenido";
        if (typeof content === 'string') return content;
        if (content.type === 'doc' && content.content) {
            return content.content.map((node: any) => {
                if (node.content) {
                    return node.content.map((n: any) => n.text).join(' ');
                }
                return '';
            }).join(' ').slice(0, 100) + '...';
        }
        return "Nota guardada";
    };

    return (
        <Card className="h-full flex flex-col border-none shadow-md overflow-hidden dark:bg-slate-950">
            <CardHeader className="py-2 px-4 bg-green-100/50 dark:bg-green-950/10 border-b border-green-200 dark:border-green-900/30">
                <CardTitle className="text-green-800 dark:text-green-400 font-headline text-lg flex items-center justify-between">
                    <span>
                        {selectedDate
                            ? `Organizador: ${format(selectedDate, "d MMMM", { locale: es })}`
                            : "Organizador"
                        }
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0 sm:p-4 sm:pt-4 bg-white dark:bg-slate-950">
                <Tabs defaultValue="agenda" className="h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-4 mb-3 h-auto bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                        <TabsTrigger value="agenda" className="flex items-center justify-center gap-2 text-xs sm:text-sm py-1.5 data-[state=active]:bg-green-800 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all font-medium">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Agenda</span>
                        </TabsTrigger>
                        <TabsTrigger value="tasks" className="flex items-center justify-center gap-2 text-xs sm:text-sm py-1.5 data-[state=active]:bg-green-800 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Tareas</span>
                            <span className="sm:hidden">({tasks.length})</span>
                        </TabsTrigger>
                        <TabsTrigger value="shifts" className="flex items-center justify-center gap-2 text-xs sm:text-sm py-1.5 data-[state=active]:bg-green-800 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Turnos</span>
                            <span className="sm:hidden">({shifts.length})</span>
                        </TabsTrigger>
                        <TabsTrigger value="journal" className="flex items-center justify-center gap-2 text-xs sm:text-sm py-1.5 data-[state=active]:bg-green-800 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all font-medium">
                            <Book className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Apuntes</span>
                            <span className="sm:hidden">({journalEntries.length})</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="agenda" className="flex-1 h-0 min-h-0 data-[state=active]:flex flex-col">
                        <ScrollArea className="flex-1 pr-4">
                            {loading ? (
                                <p className="text-center py-4"><span className="inline-block h-4 w-24 bg-slate-200/60 rounded animate-pulse" /></p>
                            ) : smartBlocks.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>Agenda vacía</p>
                                    <Button variant="link" asChild className="text-green-800 p-0 h-auto">
                                        <Link href="/apps/organizador-vital">Generar ahora &rarr;</Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-4 py-2">
                                    {smartBlocks.map((block, idx) => {
                                        const isFixed = block.type === 'fixed';
                                        // Check if current time is within this block
                                        const now = new Date();
                                        const [startH, startM] = block.start_time.split(':').map(Number);
                                        const [endH, endM] = block.end_time.split(':').map(Number);
                                        const nowMinutes = now.getHours() * 60 + now.getMinutes();
                                        const startMinutes = startH * 60 + startM;
                                        const endMinutes = endH * 60 + endM;
                                        const isNow = selectedDate?.toDateString() === new Date().toDateString() && nowMinutes >= startMinutes && nowMinutes <= endMinutes;

                                        return (
                                            <div key={block.id} className="relative pl-6">
                                                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 transition-all ${
                                                    isNow 
                                                        ? 'bg-green-500 border-green-200 ring-4 ring-green-500/20 animate-pulse' 
                                                        : isFixed 
                                                            ? 'bg-blue-500 border-blue-100' 
                                                            : 'bg-green-800 border-green-100'
                                                }`} />
                                                <div className={`p-3 rounded-xl border-l-4 transition-all ${
                                                    isNow 
                                                        ? 'bg-green-50 dark:bg-green-900/20 border-l-green-500 shadow-sm' 
                                                        : isFixed 
                                                            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-blue-400' 
                                                            : 'bg-slate-50/50 dark:bg-slate-800/30 border-l-green-800'
                                                }`}>
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-xs font-bold text-muted-foreground flex items-center gap-2 mb-0.5">
                                                                {block.start_time} - {block.end_time}
                                                                {isFixed && <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium dark:bg-blue-900/40 dark:text-blue-300">Fijo</span>}
                                                                {isNow && <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold dark:bg-green-900/40 dark:text-green-300">Ahora</span>}
                                                            </div>
                                                            <h4 className={`font-semibold text-sm ${isFixed ? 'text-blue-900 dark:text-blue-300' : 'text-green-900 dark:text-green-300'}`}>
                                                                {block.title}
                                                            </h4>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                        <div className="mt-2 text-center pt-2 border-t text-xs">
                            <Link href="/apps/organizador-vital" className="text-muted-foreground hover:text-primary hover:underline flex items-center justify-center gap-1">
                                Ver Agenda Completa <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </TabsContent>

                    <TabsContent value="shifts" className="flex-1 h-0 min-h-0 data-[state=active]:flex flex-col">
                        <ScrollArea className="flex-1 pr-4">
                            {loading ? (
                                <p className="text-center py-4"><span className="inline-block h-4 w-24 bg-slate-200/60 rounded animate-pulse" /></p>
                            ) : shifts.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground space-y-2">
                                    <div className="w-12 h-12 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                        <Clock className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <p className="font-medium text-slate-500">Sin turnos</p>
                                    <p className="text-xs text-slate-400">Todo despejado por aquí.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {shifts.map((shift, idx) => {
                                        // Alternate border colors for multiple shifts
                                        const borderColors = ['border-l-green-600', 'border-l-blue-500', 'border-l-amber-500', 'border-l-purple-500'];
                                        const borderColor = borderColors[idx % borderColors.length];
                                        return (
                                            <Link href="/apps/mi-hogar/roster" key={shift.id} className="block group">
                                                <div className={`p-3 rounded-xl border border-l-4 ${borderColor} bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 transition-all hover:shadow-sm`}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{shift.title}</span>
                                                        <span className="text-xs bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-700 font-mono">
                                                            {format(new Date(shift.start_time), "HH:mm")} - {format(new Date(shift.end_time), "HH:mm")}
                                                        </span>
                                                    </div>
                                                    {shift.description && (
                                                        <div className="text-sm text-muted-foreground mt-1 mb-1 line-clamp-2">
                                                            {shift.description}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-muted-foreground opacity-80 group-hover:underline">
                                                        Ver en Cuadrante
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="tasks" className="flex-1 h-0 min-h-0 data-[state=active]:flex flex-col">
                        <ScrollArea className="flex-1 pr-4">
                            {loading ? (
                                <p className="text-center py-4"><span className="inline-block h-4 w-24 bg-slate-200/60 rounded animate-pulse" /></p>
                            ) : tasks.length === 0 ? (
                                <div className="text-center py-8 space-y-2">
                                    <div className="w-12 h-12 mx-auto bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
                                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    </div>
                                    <p className="font-medium text-slate-600 dark:text-slate-300">¡Todo al día!</p>
                                    <p className="text-xs text-slate-400">No tienes tareas pendientes.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {tasks.map((task) => (
                                        <div key={task.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group">
                                            <button
                                                onClick={() => toggleTask(task.id, task.is_completed)}
                                                className="mt-1 text-muted-foreground hover:text-primary transition-colors"
                                            >
                                                <Circle className="w-5 h-5" />
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{task.title}</p>
                                                <div className="flex items-center text-xs text-muted-foreground gap-1 mt-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{format(new Date(task.due_date), "HH:mm", { locale: es })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        <div className="mt-2 text-center pt-2 border-t text-xs">
                            <Link href="/apps/mi-hogar/tasks" className="text-muted-foreground hover:text-primary hover:underline">Gestionar Tareas</Link>
                        </div>
                    </TabsContent>

                    <TabsContent value="journal" className="flex-1 h-0 min-h-0 data-[state=active]:flex flex-col">
                        <div className="mb-2 px-1">
                            <Select value={selectedTag} onValueChange={setSelectedTag}>
                                <SelectTrigger className="h-8 text-xs w-full">
                                    <div className="flex items-center gap-2">
                                        <Tag className="w-3 h-3" />
                                        <SelectValue placeholder="Filtrar por etiqueta" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las etiquetas</SelectItem>
                                    {availableTags.map(tag => (
                                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <ScrollArea className="flex-1 pr-4">
                            {loading ? (
                                <p className="text-center py-4"><span className="inline-block h-4 w-24 bg-slate-200/60 rounded animate-pulse" /></p>
                            ) : journalEntries.length === 0 ? (
                                <div className="text-center py-8 space-y-2">
                                    <div className="w-12 h-12 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                        <Book className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <p className="font-medium text-slate-500">Día en blanco</p>
                                    <p className="text-xs text-slate-400">No escribiste nada este día.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {journalEntries
                                        .filter(entry => selectedTag === 'all' || entry.tags?.includes(selectedTag))
                                        .map((entry) => (
                                            <div
                                                key={entry.id}
                                                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                                                onClick={() => openJournalEntry(entry.updated_at)}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(entry.updated_at), "HH:mm", { locale: es })}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground ml-auto truncate max-w-[100px]">
                                                        {entry.context_id}
                                                    </span>
                                                </div>
                                                <p className="text-sm line-clamp-2 text-muted-foreground">
                                                    {getPreviewText(entry.content)}
                                                </p>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
