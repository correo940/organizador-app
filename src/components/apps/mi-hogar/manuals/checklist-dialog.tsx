'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, ListChecks, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface ChecklistItem {
    id: string;
    task: string;
    is_completed: boolean;
    frequency_days?: number;
    last_completed?: string;
    next_due?: string;
}

interface ChecklistDialogProps {
    manualId: string;
    manualTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChecklistDialog({ manualId, manualTitle, open, onOpenChange }: ChecklistDialogProps) {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [newTask, setNewTask] = useState('');
    const [frequency, setFrequency] = useState<number | ''>('');

    useEffect(() => {
        if (open) {
            fetchChecklist();
        }
    }, [open]);

    const fetchChecklist = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('maintenance_checklists')
                .select('*')
                .eq('manual_id', manualId)
                .order('created_at', { ascending: true });

            if (error) {
                console.log('Checklist table not available yet');
                return;
            }

            setItems(data || []);
        } catch (error) {
            console.error('Error fetching checklist:', error);
        } finally {
            setLoading(false);
        }
    };

    const addItem = async () => {
        if (!newTask.trim()) return;

        try {
            const newItem = {
                manual_id: manualId,
                task: newTask.trim(),
                is_completed: false,
                frequency_days: frequency || null,
                next_due: frequency ? addDays(new Date(), Number(frequency)).toISOString() : null
            };

            const { data, error } = await supabase
                .from('maintenance_checklists')
                .insert([newItem])
                .select()
                .single();

            if (error) throw error;

            setItems([...items, data]);
            setNewTask('');
            setFrequency('');
            toast.success('Tarea añadida');
        } catch (error) {
            console.error('Error adding checklist item:', error);
            toast.error('Error al añadir tarea');
        }
    };

    const toggleItem = async (id: string, currentStatus: boolean, frequency: number | null) => {
        try {
            const updates: any = { is_completed: !currentStatus };

            // If completing a recurring task, update last_completed and next_due
            if (!currentStatus && frequency) {
                const now = new Date();
                updates.last_completed = now.toISOString();
                updates.next_due = addDays(now, frequency).toISOString();
                // Recurring tasks don't stay completed forever, they just reset for next cycle
                // But visually we might want to show them checked briefly or handle differently
                updates.is_completed = false;
                toast.success('Mantenimiento registrado. Próxima fecha actualizada.');
            }

            const { error } = await supabase
                .from('maintenance_checklists')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            setItems(items.map(item =>
                item.id === id ? { ...item, ...updates } : item
            ));

            if (!frequency) {
                toast.success(currentStatus ? 'Tarea desmarcada' : 'Tarea completada');
            }
        } catch (error) {
            console.error('Error updating checklist:', error);
            toast.error('Error al actualizar tarea');
        }
    };

    const deleteItem = async (id: string) => {
        try {
            const { error } = await supabase
                .from('maintenance_checklists')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setItems(items.filter(item => item.id !== id));
            toast.success('Tarea eliminada');
        } catch (error) {
            console.error('Error deleting checklist item:', error);
            toast.error('Error al eliminar tarea');
        }
    };

    const calculateProgress = () => {
        if (items.length === 0) return 0;
        const completed = items.filter(i => i.is_completed).length;
        return Math.round((completed / items.length) * 100);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader className="bg-gradient-to-r from-green-50 to-white pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2 text-green-950">
                        <ListChecks className="h-5 w-5" />
                        Checklist de Mantenimiento
                    </DialogTitle>
                    <DialogDescription>
                        Tareas y mantenimiento periódico para "{manualTitle}"
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {/* Progress Bar */}
                    {items.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                <span>Progreso</span>
                                <span>{calculateProgress()}%</span>
                            </div>
                            <Progress value={calculateProgress()} className="h-2 bg-green-100" />
                        </div>
                    )}

                    {/* Add New Item */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="task" className="text-xs">Nueva Tarea</Label>
                            <Input
                                id="task"
                                placeholder="Ej: Limpiar filtros"
                                value={newTask}
                                onChange={(e) => setNewTask(e.target.value)}
                                className="h-9 focus:border-green-500"
                            />
                        </div>
                        <div className="w-24 space-y-1">
                            <Label htmlFor="freq" className="text-xs">Días (opc)</Label>
                            <Input
                                id="freq"
                                type="number"
                                placeholder="30"
                                value={frequency}
                                onChange={(e) => setFrequency(Number(e.target.value))}
                                className="h-9 focus:border-green-500"
                            />
                        </div>
                        <Button onClick={addItem} size="sm" className="bg-green-800 hover:bg-green-900 text-white mb-0.5">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Checklist Items */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {items.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No hay tareas de mantenimiento</p>
                            </div>
                        )}

                        {items.map(item => (
                            <div key={item.id} className="group flex items-center justify-between p-3 rounded-lg border hover:border-green-200 hover:bg-green-50/30 transition-all bg-white shadow-sm">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={item.is_completed}
                                        onCheckedChange={() => toggleItem(item.id, item.is_completed, item.frequency_days || null)}
                                        className="border-green-400 data-[state=checked]:bg-green-800 data-[state=checked]:text-white"
                                    />
                                    <div>
                                        <p className={`text-sm font-medium ${item.is_completed ? 'line-through text-muted-foreground' : 'text-slate-800'}`}>
                                            {item.task}
                                        </p>
                                        <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                                            {item.frequency_days && (
                                                <Badge variant="outline" className="text-[10px] h-4 px-1 flex items-center gap-1 border-blue-200 bg-blue-50 text-blue-700">
                                                    <Calendar className="h-2 w-2" />
                                                    Cada {item.frequency_days} días
                                                </Badge>
                                            )}
                                            {item.next_due && (
                                                <span className={`flex items-center gap-1 ${new Date(item.next_due) < new Date() ? 'text-red-500 font-bold' : ''}`}>
                                                    <AlertCircle className="h-2 w-2" />
                                                    Vence {formatDistanceToNow(new Date(item.next_due), { addSuffix: true, locale: es })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => deleteItem(item.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

