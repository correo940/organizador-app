'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FixedBlock {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    label: string;
    color: string;
}

interface TaskBlock {
    id: string;
    title: string;
    due_date: string;
    start_time: string;
    end_time: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MIN_VISIBLE_HOURS = 8;
const DEFAULT_VISIBLE_START = 8;
const DEFAULT_VISIBLE_END = 20;

const parseTimeToDecimal = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h + m / 60;
};

const isSleepBlock = (label: string) => {
    const l = label.toLowerCase();
    return l.includes('durmiendo') || l.includes('sueño') || l.includes('dormir');
};

export function FixedScheduleEditor({ onBack }: { onBack: () => void }) {
    const router = useRouter();
    const [blocks, setBlocks] = useState<FixedBlock[]>([]);
    const [tasks, setTasks] = useState<TaskBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBlock, setEditingBlock] = useState<FixedBlock | null>(null);

    const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

    const [day, setDay] = useState('monday');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    const [label, setLabel] = useState('');
    const [color, setColor] = useState('#3b82f6');
    const [frequency, setFrequency] = useState<'single' | 'workweek' | 'everyday'>('single');

    const [status, setStatus] = useState<'idle' | 'confirming'>('idle');
    const [conflictingTasks, setConflictingTasks] = useState<TaskBlock[]>([]);

    useEffect(() => {
        fetchData();
    }, [weekStart]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: fixedData } = await supabase
                .from('smart_scheduler_fixed_blocks')
                .select('*')
                .eq('user_id', user.id);

            if (fixedData) {
                console.log('DEBUG_BLOCKS: Raw data from Supabase:', fixedData);
                console.log('DEBUG_BLOCKS: Count of Durmiendo:', fixedData.filter(b => b.label === 'Durmiendo').length);
                setBlocks(fixedData);
            } else {
                console.log('DEBUG_BLOCKS: No data returned from Supabase');
            }

            const startStr = weekStart.toISOString();
            const endStr = addDays(weekStart, 7).toISOString();

            const { data: taskData } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', user.id)
                .gte('due_date', startStr)
                .lte('due_date', endStr);

            if (taskData) {
                const mappedTasks: TaskBlock[] = taskData.map((t: any) => {
                    const d = new Date(t.due_date);
                    const hours = d.getHours();
                    const minutes = d.getMinutes();
                    const start = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

                    let endHours = hours + 1;
                    if (endHours > 23) endHours = 23;
                    const end = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

                    return {
                        id: t.id,
                        title: t.title,
                        due_date: t.due_date,
                        start_time: start,
                        end_time: end
                    };
                });
                setTasks(mappedTasks);
            }

        } catch (error) {
            console.error(error);
            toast.error('Error cargando datos');
        } finally {
            setLoading(false);
        }
    };

    const checkForConflicts = (targetDays: string[]) => {
        const conflicts: TaskBlock[] = [];

        targetDays.forEach(dayName => {
            const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(dayName);
            if (dayIndex === -1) return;

            const targetDate = addDays(weekStart, dayIndex);
            const daysTasks = tasks.filter(t => isSameDay(new Date(t.due_date), targetDate));

            const startDecimal = parseTimeToDecimal(startTime);
            const endDecimal = parseTimeToDecimal(endTime);
            const crossesMidnight = endDecimal < startDecimal;

            daysTasks.forEach(task => {
                const tStart = parseTimeToDecimal(task.start_time);
                const tEnd = parseTimeToDecimal(task.end_time);

                // Simple check: overlaps if (start < tEnd && end > tStart)
                // For midnight crossing, we check both pieces
                if (crossesMidnight) {
                    // Piece 1: startTime to 23:59
                    if (startDecimal < tEnd && 24 > tStart) {
                        conflicts.push(task);
                    }
                    // Piece 2: 00:00 to endTime (on next day)
                    // We'd need to check next day's tasks too, but for simplicity let's stay here
                } else {
                    if (startDecimal < tEnd && endDecimal > tStart) {
                        conflicts.push(task);
                    }
                }
            });
        });

        return conflicts;
    };

    const getTargetDays = () => {
        if (frequency === 'single') return [day];
        if (frequency === 'workweek') return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        if (frequency === 'everyday') return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        return [day];
    };

    const handleSave = async () => {
        if (status === 'confirming') {
            await executeSave();
            return;
        }

        const targetDays = getTargetDays();
        const conflicts = checkForConflicts(targetDays);
        if (conflicts.length > 0) {
            setConflictingTasks(conflicts);
            setStatus('confirming');
            return;
        }

        await executeSave();
    };

    const executeSave = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const targetDays = getTargetDays();

            const promises = targetDays.map(async (targetDay, index) => {
                const payload = {
                    user_id: user.id,
                    day_of_week: targetDay,
                    start_time: startTime,
                    end_time: endTime,
                    label,
                    color
                };

                if (editingBlock && index === 0) {
                    return supabase
                        .from('smart_scheduler_fixed_blocks')
                        .update(payload)
                        .eq('id', editingBlock.id);
                } else {
                    return supabase
                        .from('smart_scheduler_fixed_blocks')
                        .insert(payload);
                }
            });

            await Promise.all(promises);

            toast.success(editingBlock ? 'Bloque(s) actualizado(s)' : 'Bloque(s) creado(s)');
            setIsDialogOpen(false);
            setEditingBlock(null);
            setStatus('idle');
            setConflictingTasks([]);
            resetForm();
            fetchData();

        } catch (error) {
            console.error(error);
            toast.error('Error guardando bloque');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('smart_scheduler_fixed_blocks')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Bloque eliminado');
            setIsDialogOpen(false);
            setEditingBlock(null);
            resetForm();
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Error eliminando bloque');
        }
    };

    const resetForm = () => {
        setDay('monday');
        setStartTime('09:00');
        setEndTime('17:00');
        setLabel('');
        setColor('#3b82f6');
        setFrequency('single');
        setStatus('idle');
        setConflictingTasks([]);
    };

    const openNewBlockDialog = (preselectDay?: string, preselectHour?: number) => {
        setEditingBlock(null);
        resetForm();
        if (preselectDay) setDay(preselectDay);
        if (preselectHour !== undefined) {
            const timeStr = `${preselectHour.toString().padStart(2, '0')}:00`;
            setStartTime(timeStr);
            setEndTime(`${(preselectHour + 1).toString().padStart(2, '0')}:00`);
        }
        setIsDialogOpen(true);
    };

    const openEditDialog = (block: FixedBlock) => {
        setEditingBlock(block);
        setDay(block.day_of_week);
        setStartTime(block.start_time.slice(0, 5));
        setEndTime(block.end_time.slice(0, 5));
        setLabel(block.label);
        setColor(block.color || '#3b82f6');
        setFrequency('single');
        setIsDialogOpen(true);
    };

    const handleTaskClick = (taskId: string) => {
        router.push(`/apps/mi-hogar/tasks?highlight=${taskId}`);
    };

    const visibleRange = useMemo(() => {
        const scheduledItems: { start: string, end: string }[] = [];
        
        blocks.forEach(b => {
            if (isSleepBlock(b.label)) return;
            const startDec = parseTimeToDecimal(b.start_time);
            const endDec = parseTimeToDecimal(b.end_time);
            if (endDec < startDec) {
                scheduledItems.push({ start: b.start_time, end: '23:59' });
                scheduledItems.push({ start: '00:00', end: b.end_time });
            } else {
                scheduledItems.push({ start: b.start_time, end: b.end_time });
            }
        });
        
        tasks.forEach(task => {
            scheduledItems.push({ start: task.start_time, end: task.end_time });
        });

        const items = scheduledItems.filter(item => item.start && item.end);

        if (items.length === 0) {
            return {
                startHour: DEFAULT_VISIBLE_START,
                endHour: DEFAULT_VISIBLE_END,
                hours: Array.from({ length: MIN_VISIBLE_HOURS }, (_, index) => DEFAULT_VISIBLE_START + index),
            };
        }

        const earliest = Math.min(...items.map(item => parseTimeToDecimal(item.start)));
        const latest = Math.max(...items.map(item => parseTimeToDecimal(item.end)));

        // Ensure we show at least the range of blocks
        let startHour = Math.floor(earliest);
        let endHour = Math.ceil(latest);
        
        // Clamp to 0-24
        startHour = Math.max(0, startHour);
        endHour = Math.min(24, endHour);

        if (endHour - startHour < MIN_VISIBLE_HOURS) {
            const missingHours = MIN_VISIBLE_HOURS - (endHour - startHour);
            const addBefore = Math.floor(missingHours / 2);
            const addAfter = missingHours - addBefore;

            startHour = Math.max(0, startHour - addBefore);
            endHour = Math.min(24, endHour + addAfter);

            if (endHour - startHour < MIN_VISIBLE_HOURS) {
                if (startHour === 0) endHour = Math.min(24, MIN_VISIBLE_HOURS);
                if (endHour === 24) startHour = Math.max(0, 24 - MIN_VISIBLE_HOURS);
            }
        }

        return {
            startHour,
            endHour,
            hours: Array.from({ length: endHour - startHour }, (_, index) => startHour + index),
        };
    }, [blocks, tasks]);

    const getBlockStyle = (start: string, end: string, color?: string, isTask?: boolean) => {
        const startDecimal = parseTimeToDecimal(start);
        const endDecimal = parseTimeToDecimal(end);

        const top = (startDecimal - visibleRange.startHour) * 60;
        const height = (endDecimal - startDecimal) * 60;

        return {
            top: `${Math.max(top, 0)}px`,
            height: `${Math.max(height, 20)}px`,
            backgroundColor: isTask ? 'rgba(251, 191, 36, 0.2)' : (color + 'CC'),
            border: isTask ? '1px dashed rgb(245, 158, 11)' : 'none',
            color: isTask ? 'rgb(180, 83, 9)' : 'white',
            cursor: 'pointer'
        };
    };

    const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return {
            date,
            dayName: format(date, 'EEEE').toLowerCase(),
            dayLabel: format(date, 'EEEE', { locale: es }),
            dayNumber: format(date, 'd', { locale: es })
        };
    });

    const getEnglishDay = (dayName: string) => {
        const mapping: any = { 'lunes': 'monday', 'martes': 'tuesday', 'miércoles': 'wednesday', 'jueves': 'thursday', 'viernes': 'friday', 'sábado': 'saturday', 'domingo': 'sunday' };
        const lower = dayName.toLowerCase();
        return mapping[lower] || lower;
    };

    return (
        <div className="h-full w-full flex flex-col px-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-600" /> Horario Fijo Semanal
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Semana del {format(weekStart, 'd MMMM', { locale: es })}
                        </p>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <Button onClick={() => openNewBlockDialog()}>
                        <Plus className="w-4 h-4 mr-2" /> Agregar Bloque
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto border rounded-md relative bg-white dark:bg-slate-950">
                <ScrollArea className="h-full">
                    <div className="grid grid-cols-[50px_repeat(7,1fr)] min-w-[800px]">
                        <div className="border-r bg-slate-50 dark:bg-slate-900 z-10 sticky left-0 flex flex-col">
                            <div className="h-[40px] border-b shrink-0"></div>
                            
                            {/* Sleep Row Spacer */}
                            <div className="h-[60px] border-b bg-indigo-50/30 flex flex-col justify-center items-end pr-2 shrink-0">
                                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">🌙 Sueño</span>
                            </div>

                            {visibleRange.hours.map(hour => (
                                <div key={hour} className="h-[60px] border-b text-xs text-muted-foreground p-1 text-right pr-2 shrink-0">
                                    {hour.toString().padStart(2, '0')}:00
                                </div>
                            ))}
                        </div>

                        {daysOfWeek.map((dayObj) => {
                            const englishDay = getEnglishDay(dayObj.dayLabel);
                            const dayTasks = tasks.filter(t => isSameDay(new Date(t.due_date), dayObj.date));
                            const dayBlocks = blocks.filter(b => b.day_of_week === englishDay);
                            const sleepBlocks = dayBlocks.filter(b => isSleepBlock(b.label));

                            return (
                                <div key={dayObj.date.toISOString()} className="relative border-r min-w-[100px] flex flex-col">
                                    <div className="sticky top-0 h-[40px] border-b bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center z-10 p-1 shrink-0">
                                        <span className="font-medium capitalize text-sm">{dayObj.dayLabel}</span>
                                        <span className="text-xs text-muted-foreground">{dayObj.dayNumber}</span>
                                    </div>

                                    {/* Dedicated Sleep Row (Always 60px to align with left column) */}
                                    <div className="h-[60px] bg-indigo-50/50 dark:bg-indigo-950/20 border-b p-1 flex flex-col justify-center gap-1 z-10 shrink-0 overflow-y-auto">
                                        {sleepBlocks.map((sb, idx) => (
                                            <div 
                                                key={`${sb.id}-${idx}`} 
                                                className="bg-indigo-600 text-white rounded text-[10px] leading-tight px-1 py-0.5 text-center font-medium shadow-sm cursor-pointer hover:bg-indigo-500 transition-colors shrink-0"
                                                onClick={() => openEditDialog(sb)}
                                                title="Click para editar"
                                            >
                                                🌙 {sb.start_time.substring(0, 5)} - {sb.end_time.substring(0, 5)}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="relative" style={{ height: `${visibleRange.hours.length * 60}px` }}>
                                        {visibleRange.hours.map(hour => (
                                            <div
                                                key={hour}
                                                className="h-[60px] border-b border-dashed border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                                                onClick={() => openNewBlockDialog(englishDay, hour)}
                                            ></div>
                                        ))}

                                        {dayTasks.map(task => (
                                            <div
                                                key={task.id}
                                                className="absolute left-1 right-1 rounded p-1 text-xs overflow-hidden z-20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors group"
                                                style={getBlockStyle(task.start_time, task.end_time, undefined, true)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleTaskClick(task.id);
                                                }}
                                                title="Click para editar tarea"
                                            >
                                                <div className="font-bold flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3 group-hover:text-amber-600" />
                                                    <span className="truncate group-hover:underline">{task.title}</span>
                                                </div>
                                                <div className="opacity-80">{task.start_time}</div>
                                            </div>
                                        ))}

                                        {(() => {
                                            const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                                            const currentDay = dayObj.dayName;
                                            const dayIndex = dayOrder.indexOf(currentDay);
                                            const prevDay = dayOrder[(dayIndex + 6) % 7];
                                            
                                            const renderedPieces: { block: FixedBlock, start: string, end: string }[] = [];
                                            
                                            blocks.forEach(b => {
                                                if (isSleepBlock(b.label)) return;
                                                const bStart = parseTimeToDecimal(b.start_time);
                                                const bEnd = parseTimeToDecimal(b.end_time);
                                                const bCrosses = bEnd < bStart;
                                                const bDay = b.day_of_week?.toLowerCase().trim();
                                                
                                                if (bDay === currentDay) {
                                                    if (bCrosses) {
                                                        renderedPieces.push({ block: b, start: b.start_time, end: '23:59' });
                                                    } else {
                                                        renderedPieces.push({ block: b, start: b.start_time, end: b.end_time });
                                                    }
                                                } else if (bDay === prevDay && bCrosses) {
                                                    renderedPieces.push({ block: b, start: '00:00', end: b.end_time });
                                                }
                                            });
                                            return renderedPieces.map((piece, idx) => (
                                                <div
                                                    key={`${piece.block.id}-${idx}`}
                                                    className="absolute left-1.5 right-1.5 rounded-md p-1.5 text-[10px] leading-tight text-white overflow-hidden cursor-pointer hover:brightness-110 shadow-sm z-30 flex flex-col justify-center items-center text-center transition-all border border-white/20"
                                                    style={getBlockStyle(piece.start, piece.end, piece.block.color)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditDialog(piece.block);
                                                    }}
                                                >
                                                    <div className="font-bold truncate w-full">{piece.block.label}</div>
                                                    <div className="opacity-95 font-medium">
                                                        {piece.block.start_time.slice(0, 5)} - {piece.block.end_time.slice(0, 5)}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsDialogOpen(open);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {status === 'confirming' ? 'Advertencia de Solapamiento' : (editingBlock ? 'Editar Bloque Fijo' : 'Nuevo Bloque Fijo')}
                        </DialogTitle>
                    </DialogHeader>

                    {status === 'confirming' ? (
                        <div className="py-4 space-y-4">
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>¡Atención!</AlertTitle>
                                <AlertDescription>
                                    Este bloque coincide con {conflictingTasks.length} tarea(s) agendada(s) para esta semana.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2 max-h-[200px] overflow-auto border rounded p-2 bg-slate-50 dark:bg-slate-900">
                                {conflictingTasks.map(task => (
                                    <div key={task.id} className="text-sm p-2 border-b last:border-0 flex items-center justify-between">
                                        <span className="font-medium">{task.title}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(task.due_date), "EEEE d", { locale: es })} • {task.start_time}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                ¿Deseas crear el bloque fijo de todas formas? La tarea se mantendrá, pero visualmente se solapará.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Nombre (Ej: Trabajo, Gimnasio)</Label>
                                <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Agrega un título" />
                            </div>

                            <div className="grid gap-2">
                                <Label>Frecuencia</Label>
                                <Select value={frequency} onValueChange={(val: 'single' | 'workweek' | 'everyday') => setFrequency(val)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="single">Día único</SelectItem>
                                        <SelectItem value="workweek">De Lunes a Viernes</SelectItem>
                                        <SelectItem value="everyday">Todos los días (Lun-Dom)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {frequency === 'single' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Día</Label>
                                        <Select value={day} onValueChange={setDay}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries({ 'monday': 'Lunes', 'tuesday': 'Martes', 'wednesday': 'Miércoles', 'thursday': 'Jueves', 'friday': 'Viernes', 'saturday': 'Sábado', 'sunday': 'Domingo' }).map(([key, value]) => (
                                                    <SelectItem key={key} value={key}>{value}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Color</Label>
                                        <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-full p-1" />
                                    </div>
                                </div>
                            )}

                            {frequency !== 'single' && (
                                <div className="grid gap-2">
                                    <Label>Color</Label>
                                    <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-full p-1" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Inicio</Label>
                                    <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Fin</Label>
                                    <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:justify-between">
                        {status !== 'confirming' && editingBlock && (
                            <Button variant="destructive" size="icon" onClick={() => handleDelete(editingBlock.id)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        {status === 'confirming' ? (
                            <div className="flex gap-2 w-full justify-end">
                                <Button variant="outline" onClick={() => setStatus('idle')}>Volver</Button>
                                <Button onClick={executeSave} variant="destructive">Crear de todas formas</Button>
                            </div>
                        ) : (
                            <div className="flex gap-2 justify-end w-full">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSave}>Guardar</Button>
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
