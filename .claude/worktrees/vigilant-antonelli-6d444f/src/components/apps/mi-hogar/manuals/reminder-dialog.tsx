'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Bell, Plus, Trash2, Calendar, CheckSquare, Loader2, ArrowRight, Pencil, X, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

interface Reminder {
    id: string;
    title: string;
    description?: string;
    interval_months: number;
    next_date: string;
    is_active: boolean;
}

interface TaskList {
    id: string;
    name: string;
}

interface ReminderDialogProps {
    manualId: string;
    manualTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ReminderDialog({ manualId, manualTitle, open, onOpenChange }: ReminderDialogProps) {
    const { user } = useAuth();
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
    const [taskLists, setTaskLists] = useState<TaskList[]>([]);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [intervalValue, setIntervalValue] = useState('6');
    const [intervalUnit, setIntervalUnit] = useState<'hours' | 'days' | 'months'>('months');
    const [nextDatetime, setNextDatetime] = useState('');
    const [createTask, setCreateTask] = useState(true);
    const [selectedListId, setSelectedListId] = useState('');

    useEffect(() => {
        if (open) {
            fetchReminders();
            fetchTaskLists();
        }
    }, [open]);

    const fetchReminders = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('manual_reminders')
                .select('*')
                .eq('manual_id', manualId)
                .order('next_date');

            if (error) {
                console.log('Reminders table not available yet');
                return;
            }
            setReminders(data || []);
        } catch (error) {
            console.error('Error fetching reminders:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTaskLists = async () => {
        if (!user) return;
        try {
            // Pedir solo id y name, deduplicar en JS por si la política RLS devuelve filas extra
            const { data } = await supabase
                .from('task_lists')
                .select('id, name');
            if (data) {
                const seen = new Set<string>();
                const lists: TaskList[] = [];
                for (const l of data as any[]) {
                    if (!seen.has(l.id)) {
                        seen.add(l.id);
                        lists.push({ id: l.id, name: l.name });
                    }
                }
                setTaskLists(lists);
                if (lists.length > 0 && !selectedListId) {
                    setSelectedListId(lists[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching task lists:', error);
        }
    };

    const openEditForm = (reminder: Reminder) => {
        setEditingReminderId(reminder.id);
        setTitle(reminder.title);
        setDescription(reminder.description || '');
        setIntervalValue(String(reminder.interval_months));
        setIntervalUnit('months');
        // next_date puede ser solo fecha o datetime completo
        const dt = reminder.next_date.includes('T')
            ? reminder.next_date.slice(0, 16)
            : `${reminder.next_date}T09:00`;
        setNextDatetime(dt);
        setCreateTask(false);
        setShowForm(true);
    };

    const saveReminder = async () => {
        if (!title || !nextDatetime) {
            toast.error('Título y fecha son obligatorios');
            return;
        }

        try {
            setSaving(true);

            const intervalMonthsEquiv =
                intervalUnit === 'months' ? parseInt(intervalValue)
                    : intervalUnit === 'days' ? Math.max(1, Math.round(parseInt(intervalValue) / 30))
                        : 1; // horas → mínimo 1

            const nextDateISO = new Date(nextDatetime).toISOString();

            if (editingReminderId) {
                // UPDATE
                const { error } = await supabase
                    .from('manual_reminders')
                    .update({
                        title,
                        description,
                        interval_months: intervalMonthsEquiv,
                        next_date: nextDateISO,
                    })
                    .eq('id', editingReminderId);
                if (error) throw error;
                toast.success('Recordatorio actualizado');
            } else {
                // INSERT
                const { error: reminderError } = await supabase
                    .from('manual_reminders')
                    .insert([{
                        manual_id: manualId,
                        title,
                        description,
                        interval_months: intervalMonthsEquiv,
                        next_date: nextDateISO,
                        is_active: true
                    }]);
                if (reminderError) throw reminderError;

                // Crear tarea automática si el toggle está activo
                if (createTask && user && selectedListId) {
                    const dueDate = new Date(nextDatetime);
                    const taskTitle = `🔧 ${manualTitle} — ${title}`;
                    const { error: taskError } = await supabase.from('tasks').insert([{
                        user_id: user.id,
                        list_id: selectedListId,
                        title: taskTitle,
                        description: description || '',
                        due_date: dueDate.toISOString(),
                        has_alarm: true,
                        priority: 'medium',
                        is_completed: false,
                    }]);
                    if (taskError) {
                        console.error('Error creating task:', taskError);
                        toast.warning('Recordatorio guardado, pero no se pudo crear la tarea');
                    } else {
                        toast.success('✅ Recordatorio y tarea creados');
                    }
                } else {
                    toast.success('Recordatorio añadido');
                }
            }

            setShowForm(false);
            resetForm();
            fetchReminders();
        } catch (error) {
            console.error('Error saving reminder:', error);
            toast.error('Error al guardar recordatorio');
        } finally {
            setSaving(false);
        }
    };

    const deleteReminder = async (id: string) => {
        if (!confirm('¿Eliminar este recordatorio?')) return;
        try {
            const { error } = await supabase.from('manual_reminders').delete().eq('id', id);
            if (error) throw error;
            toast.success('Recordatorio eliminado');
            fetchReminders();
        } catch {
            toast.error('Error al eliminar recordatorio');
        }
    };

    const toggleActive = async (id: string, isActive: boolean) => {
        try {
            const { error } = await supabase.from('manual_reminders').update({ is_active: !isActive }).eq('id', id);
            if (error) throw error;
            toast.success(isActive ? 'Pausado' : 'Activado');
            fetchReminders();
        } catch {
            toast.error('Error al actualizar recordatorio');
        }
    };

    const markAsDone = async (reminder: Reminder) => {
        try {
            // Calcula la siguiente fecha sumando el intervalo
            const currentDate = new Date(reminder.next_date);
            const nextDate = new Date(currentDate);
            nextDate.setMonth(nextDate.getMonth() + reminder.interval_months);

            const { error } = await supabase
                .from('manual_reminders')
                .update({ next_date: nextDate.toISOString() })
                .eq('id', reminder.id);

            if (error) throw error;
            toast.success(`✅ Hecho. Próximo: ${nextDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`);
            fetchReminders();
        } catch {
            toast.error('Error al marcar como hecho');
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setIntervalValue('6');
        setIntervalUnit('months');
        setNextDatetime('');
        setCreateTask(true);
        setEditingReminderId(null);
    };

    const nowMin = new Date().toISOString().slice(0, 16);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col rounded-3xl p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-green-50 to-slate-50 dark:from-green-800-950/30 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <DialogTitle className="flex items-center gap-3 text-lg font-black text-slate-900 dark:text-white">
                        <div className="p-2 bg-green-500/10 rounded-xl">
                            <Bell className="h-5 w-5 text-green-500" />
                        </div>
                        Recordatorios de Mantenimiento
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 ml-11">
                        {manualTitle}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-5 px-6 space-y-4">
                    {/* Recordatorios existentes */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-green-500" />
                        </div>
                    ) : reminders.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Recordatorios activos</p>
                            {reminders.map(reminder => (
                                <div
                                    key={reminder.id}
                                    className={`p-4 border rounded-2xl flex items-start justify-between transition-all ${!reminder.is_active ? 'opacity-50 bg-slate-50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900 shadow-sm border-slate-100 dark:border-slate-800'}`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{reminder.title}</h4>
                                            {!reminder.is_active && (
                                                <Badge variant="outline" className="text-[10px]">Pausado</Badge>
                                            )}
                                        </div>
                                        {reminder.description && (
                                            <p className="text-xs text-muted-foreground mb-2">{reminder.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(reminder.next_date), 'PPP p', { locale: es })}
                                            </span>
                                            <span>Cada {reminder.interval_months} meses</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 ml-3">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 rounded-lg text-green-500 hover:text-green-900 hover:bg-green-50"
                                            onClick={() => markAsDone(reminder)}
                                            title="Marcar como hecho (avanza fecha)"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 rounded-lg text-slate-500 hover:text-green-900 hover:bg-green-50"
                                            onClick={() => openEditForm(reminder)}
                                            title="Editar"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-xs h-8 px-2 rounded-lg" onClick={() => toggleActive(reminder.id, reminder.is_active)}>
                                            {reminder.is_active ? 'Pausar' : 'Activar'}
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => deleteReminder(reminder.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Formulario nuevo / edición */}
                    {!showForm ? (
                        <>
                            <Button
                                variant="outline"
                                className="w-full rounded-2xl border-dashed border-2 border-green-200 dark:border-green-950 text-green-800 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-800-950/30 h-12 font-bold"
                                onClick={() => { resetForm(); setShowForm(true); }}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Añadir Recordatorio
                            </Button>
                            {reminders.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-15" />
                                    <p className="font-semibold text-sm">Sin recordatorios todavía</p>
                                    <p className="text-xs mt-1">Añade cuándo tienes que llamar a mantenimiento, echar cloro, revisar garantías...</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4 p-5 border border-green-100 dark:border-green-950/50 rounded-2xl bg-green-50/40 dark:bg-green-800-950/20">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
                                    {editingReminderId ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
                                </p>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={() => { setShowForm(false); resetForm(); }}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider">Título *</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Echar cloro a la piscina, Llamar a mantenimiento..."
                                    className="rounded-xl"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider">Instrucciones / Notas</Label>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Ej: Añadir 250ml de cloro por 10.000L de agua. Comprobar pH antes..."
                                    rows={3}
                                    className="rounded-xl"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Frecuencia</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={intervalValue}
                                            onChange={(e) => setIntervalValue(e.target.value)}
                                            className="rounded-xl w-20 shrink-0"
                                        />
                                        <Select value={intervalUnit} onValueChange={(v) => setIntervalUnit(v as any)}>
                                            <SelectTrigger className="rounded-xl flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="hours">Horas</SelectItem>
                                                <SelectItem value="days">Días</SelectItem>
                                                <SelectItem value="months">Meses</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Próxima fecha y hora *</Label>
                                    <Input
                                        type="datetime-local"
                                        value={nextDatetime}
                                        onChange={(e) => setNextDatetime(e.target.value)}
                                        min={nowMin}
                                        className="rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* Toggle crear tarea — solo en modo nuevo */}
                            {!editingReminderId && (
                                <div className={`p-4 rounded-2xl border transition-colors ${createTask ? 'bg-green-50 dark:bg-green-800-950/30 border-green-200 dark:border-green-950' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <CheckSquare className={`h-5 w-5 ${createTask ? 'text-green-500' : 'text-slate-400'}`} />
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-white">Crear tarea automática</p>
                                                <p className="text-xs text-muted-foreground">Aparecerá en tu app de Tareas con alarma</p>
                                            </div>
                                        </div>
                                        <Switch checked={createTask} onCheckedChange={setCreateTask} />
                                    </div>

                                    {createTask && taskLists.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <ArrowRight className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                            <Select value={selectedListId} onValueChange={setSelectedListId}>
                                                <SelectTrigger className="h-8 text-xs rounded-lg bg-white dark:bg-slate-900 border-green-200 dark:border-green-950">
                                                    <SelectValue placeholder="Elige lista de tareas..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {taskLists.map(list => (
                                                        <SelectItem key={list.id} value={list.id} className="text-xs">
                                                            {list.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-2 justify-end pt-1">
                                <Button variant="ghost" className="rounded-xl" onClick={() => { setShowForm(false); resetForm(); }}>
                                    Cancelar
                                </Button>
                                <Button className="rounded-xl bg-green-800 hover:bg-green-900 text-white font-bold shadow-md shadow-green-200" onClick={saveReminder} disabled={saving}>
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    {saving ? 'Guardando...' : editingReminderId ? 'Actualizar' : 'Guardar Recordatorio'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

