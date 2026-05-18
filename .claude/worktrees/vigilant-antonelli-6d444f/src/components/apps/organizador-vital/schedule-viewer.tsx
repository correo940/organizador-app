'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Calendar as CalendarIcon, Loader2, CheckCircle2, X, Trash2, CheckSquare } from 'lucide-react';
import { generateSchedule } from '@/lib/smart-scheduler/engine';
import { toast } from 'sonner';

interface ScheduleBlock {
    id: string;
    type: 'fixed' | 'generated' | 'task';
    title: string;
    start: string; // HH:MM
    end: string;   // HH:MM
    date: string;  // YYYY-MM-DD
    color?: string;
    is_completed?: boolean;
}

const parseTimeToDecimal = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h + m / 60;
};

const EVENTS_COLORS = {
    fixed: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', dark: { bg: 'dark:bg-blue-900/20', border: 'dark:border-blue-800', text: 'dark:text-blue-300' } },
    generated: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', dark: { bg: 'dark:bg-green-900/20', border: 'dark:border-green-800', text: 'dark:text-green-300' } },
    task: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', dark: { bg: 'dark:bg-amber-900/20', border: 'dark:border-amber-800', text: 'dark:text-amber-300' } }
};

const DAY_LABELS: any = { Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles', Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo' };

export function ScheduleViewer({ onBack }: { onBack: () => void }) {
    const [loading, setLoading] = useState(false);
    const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
    
    // Multi-selection state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());

    // Default to current week's Monday
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0); // Set to midnight local time
        const day = d.getDay();
        const diff = d.getDate() - day + (day == 0 ? -6 : 1);
        d.setDate(diff);
        return new Date(d);
    });

    useEffect(() => {
        fetchSchedule();
    }, [currentWeekStart]);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Calculate date range
            const startStr = currentWeekStart.toISOString().split('T')[0];
            const endDate = new Date(currentWeekStart);
            endDate.setDate(endDate.getDate() + 6);
            const endStr = endDate.toISOString().split('T')[0];

            // 1. Fetch Fixed Blocks
            const { data: fixed } = await supabase.from('smart_scheduler_fixed_blocks').select('*').eq('user_id', user.id);

            // 2. Fetch Generated Blocks for this week
            const { data: generated, error } = await supabase
                .from('smart_scheduler_generated_blocks')
                .select(`
                    *,
                    activity:smart_scheduler_activities(name)
                `)
                .eq('user_id', user.id)
                .gte('date', startStr)
                .lte('date', endStr);

            if (error) throw error;

            // 3. Fetch Tasks for this week
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', user.id)
                .gte('due_date', startStr) // Assuming due_date is ISO string
                .lte('due_date', endStr + 'T23:59:59');

            // Combine
            const blocks: ScheduleBlock[] = [];

            // Add Fixed Blocks (mapped to dates of this week, handling overnight)
            fixed?.forEach((f: any) => {
                const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(f.day_of_week);
                if (dayIndex >= 0) {
                    const startDec = parseTimeToDecimal(f.start_time);
                    const endDec = parseTimeToDecimal(f.end_time);
                    const crossesMidnight = endDec < startDec;

                    // Piece 1: On the current day
                    const d1 = new Date(currentWeekStart);
                    d1.setDate(d1.getDate() + dayIndex);
                    blocks.push({
                        id: `${f.id}-p1`,
                        type: 'fixed',
                        title: f.label,
                        start: f.start_time.slice(0, 5),
                        end: f.end_time.slice(0, 5),
                        date: d1.toLocaleDateString('en-CA'),
                        color: f.color
                    });

                    // Piece 2: On the next day if it crosses midnight
                    if (crossesMidnight) {
                        const d2 = new Date(currentWeekStart);
                        d2.setDate(d2.getDate() + dayIndex + 1);
                        blocks.push({
                            id: `${f.id}-p2`,
                            type: 'fixed',
                            title: f.label,
                            start: f.start_time.slice(0, 5),
                            end: f.end_time.slice(0, 5),
                            date: d2.toLocaleDateString('en-CA'),
                            color: f.color
                        });
                    }
                }
            });

            // Add Generated Blocks
            generated?.forEach((g: any) => {
                blocks.push({
                    id: g.id,
                    type: 'generated',
                    title: g.activity?.name || 'Actividad',
                    start: g.start_time.slice(0, 5),
                    end: g.end_time.slice(0, 5),
                    date: g.date,
                    color: '#10b981'
                });
            });

            // Add Tasks
            tasks?.forEach((t: any) => {
                // Ensure task has a time, or default to all-day / specific fake time?
                // Tasks usually have a due DATE. If they have time, use it.
                // Assuming due_date is ISO timestamp.
                const d = new Date(t.due_date);
                const dateStr = d.toISOString().split('T')[0];
                const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                blocks.push({
                    id: t.id,
                    type: 'task',
                    title: t.title,
                    start: timeStr,
                    end: '', // Tasks are points in time usually, or just checked off
                    date: dateStr,
                    is_completed: t.is_completed
                });
            });

            setSchedule(blocks);

        } catch (error) {
            console.error(error);
            toast.error('Error cargando la agenda');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBlock = async (blockId: string, type: 'fixed' | 'generated' | 'task') => {
        try {
            // Optimistic update
            setSchedule(prev => prev.filter(b => b.id !== blockId));
            
            let actualId = blockId;
            if (type === 'fixed') {
                actualId = blockId.replace('-p1', '').replace('-p2', '');
                const { error } = await supabase.from('smart_scheduler_fixed_blocks').delete().eq('id', actualId);
                if (error) throw error;
            } else if (type === 'generated') {
                const { error } = await supabase.from('smart_scheduler_generated_blocks').delete().eq('id', actualId);
                if (error) throw error;
            } else if (type === 'task') {
                const { error } = await supabase.from('tasks').delete().eq('id', actualId);
                if (error) throw error;
            }
            toast.success('Bloque eliminado');
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar');
            fetchSchedule(); // Restore on error
        }
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedBlockIds(new Set());
    };

    const handleBlockClick = (blockId: string) => {
        if (!isSelectionMode) return;
        setSelectedBlockIds(prev => {
            const next = new Set(prev);
            if (next.has(blockId)) next.delete(blockId);
            else next.add(blockId);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (selectedBlockIds.size === 0) return;
        
        setLoading(true);
        try {
            const blocksToDelete = schedule.filter(b => selectedBlockIds.has(b.id));
            
            // Optimistic update
            setSchedule(prev => prev.filter(b => !selectedBlockIds.has(b.id)));
            
            const fixedIds = blocksToDelete.filter(b => b.type === 'fixed').map(b => b.id.replace('-p1', '').replace('-p2', ''));
            const generatedIds = blocksToDelete.filter(b => b.type === 'generated').map(b => b.id);
            const taskIds = blocksToDelete.filter(b => b.type === 'task').map(b => b.id);
            
            if (fixedIds.length > 0) {
                await supabase.from('smart_scheduler_fixed_blocks').delete().in('id', fixedIds);
            }
            if (generatedIds.length > 0) {
                await supabase.from('smart_scheduler_generated_blocks').delete().in('id', generatedIds);
            }
            if (taskIds.length > 0) {
                await supabase.from('tasks').delete().in('id', taskIds);
            }
            
            toast.success(`${selectedBlockIds.size} bloques eliminados`);
            setIsSelectionMode(false);
            setSelectedBlockIds(new Set());
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar bloques');
            fetchSchedule(); // Restore on error
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');

            await generateSchedule(user.id, currentWeekStart);
            toast.success('Agenda generada exitosamente');
            fetchSchedule();
        } catch (error) {
            console.error(error);
            toast.error('Error al generar la agenda');
        } finally {
            setLoading(false);
        }
    };

    const getDayDate = (offset: number) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + offset);
        return d;
    };

    return (
        <div className="h-full w-full flex flex-col p-4 bg-slate-50 dark:bg-slate-950">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5" /> Agenda Semanal
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Semana del {currentWeekStart.toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isSelectionMode ? (
                        <>
                            <Button variant="outline" onClick={toggleSelectionMode}>Cancelar</Button>
                            <Button 
                                variant="destructive" 
                                onClick={handleBulkDelete}
                                disabled={selectedBlockIds.size === 0 || loading}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar ({selectedBlockIds.size})
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={toggleSelectionMode} className="bg-white dark:bg-slate-900 border-slate-200 hover:bg-slate-100">
                            <CheckSquare className="w-4 h-4 mr-2" />
                            Seleccionar
                        </Button>
                    )}
                    <Button onClick={handleGenerate} disabled={loading} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Generar Inteligente
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border bg-white dark:bg-slate-900 shadow-sm p-4">
                <div className="grid grid-cols-7 gap-4">
                    {[0, 1, 2, 3, 4, 5, 6].map(i => {
                        const date = getDayDate(i);
                        const dateStr = date.toLocaleDateString('en-CA');
                        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                        const dayBlocks = schedule
                            .filter(b => b.date === dateStr)
                            .sort((a, b) => a.start.localeCompare(b.start));

                        return (
                            <div key={i} className="flex flex-col gap-2">
                                <div className="sticky top-0 bg-white dark:bg-slate-900 pb-2 z-10 border-b mb-2">
                                    <div className="font-semibold text-center">{DAY_LABELS[dayName]}</div>
                                    <div className="text-xs text-center text-muted-foreground">{date.getDate()} {date.toLocaleDateString('es-ES', { month: 'short' })}</div>
                                </div>

                                <div className="space-y-2">
                                    {dayBlocks.length === 0 && (
                                        <div className="text-xs text-center text-muted-foreground py-8 italic border-2 border-dashed rounded-md">
                                            Libre
                                        </div>
                                    )}
                                    {dayBlocks.map(block => {
                                        const styles = EVENTS_COLORS[block.type] || EVENTS_COLORS.fixed;
                                        return (
                                            <div
                                                key={block.id}
                                                onClick={() => handleBlockClick(block.id)}
                                                className={`group relative p-2 rounded-md text-xs border transition-all ${isSelectionMode ? 'cursor-pointer hover:ring-2 hover:ring-slate-400' : ''} ${selectedBlockIds.has(block.id) ? 'ring-2 ring-red-500 ring-offset-1 scale-[0.98]' : ''} ${styles.bg} ${styles.border} ${styles.text} ${styles.dark.bg} ${styles.dark.border} ${styles.dark.text} ${block.is_completed ? 'opacity-50 line-through' : ''}`}
                                            >
                                                <div className="font-bold truncate pr-4 flex items-center gap-1">
                                                    {block.type === 'task' && <CheckCircle2 className="w-3 h-3" />}
                                                    {block.title}
                                                </div>
                                                <div className="opacity-80 font-mono text-[10px]">
                                                    {block.type === 'task' ? 'Tarea' : `${block.start} - ${block.end}`}
                                                </div>
                                                
                                                {!isSelectionMode && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id, block.type); }}
                                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-all text-current"
                                                        title="Eliminar bloque"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {isSelectionMode && selectedBlockIds.has(block.id) && (
                                                    <div className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
