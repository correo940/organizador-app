'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Bell, CalendarClock, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export type DocumentReminder = {
    id: string;
    document_id: string;
    title: string;
    description?: string | null;
    kind: string;
    offset_days?: number | null;
    interval_months?: number | null;
    next_date: string;
    channel: string;
    is_active: boolean;
    created_at: string;
};

interface DocumentReminderDialogProps {
    documentId: string;
    documentTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRemindersChange?: () => Promise<void> | void;
}

export function DocumentReminderDialog({
    documentId,
    documentTitle,
    open,
    onOpenChange,
    onRemindersChange,
}: DocumentReminderDialogProps) {
    const [reminders, setReminders] = useState<DocumentReminder[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [intervalMonths, setIntervalMonths] = useState('12');
    const [nextDate, setNextDate] = useState('');

    useEffect(() => {
        if (open) {
            void fetchReminders();
        }
    }, [open, documentId]);

    const fetchReminders = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('document_reminders')
                .select('*')
                .eq('document_id', documentId)
                .order('next_date');

            if (error) {
                console.error('Error fetching document reminders:', error);
                return;
            }

            setReminders((data || []) as DocumentReminder[]);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setIntervalMonths('12');
        setNextDate('');
    };

    const addReminder = async () => {
        if (!title || !nextDate) {
            toast.error('Titulo y fecha son obligatorios');
            return;
        }

        try {
            const { error } = await supabase
                .from('document_reminders')
                .insert([{
                    document_id: documentId,
                    title,
                    description: description || null,
                    kind: 'custom',
                    interval_months: Number(intervalMonths),
                    next_date: nextDate,
                    channel: 'in_app',
                    is_active: true,
                }]);

            if (error) throw error;

            toast.success('Recordatorio creado');
            setShowForm(false);
            resetForm();
            await fetchReminders();
            await onRemindersChange?.();
        } catch (error) {
            console.error('Error adding document reminder:', error);
            toast.error('No se pudo crear el recordatorio');
        }
    };

    const deleteReminder = async (id: string) => {
        if (!confirm('Eliminar este recordatorio?')) return;

        try {
            const { error } = await supabase
                .from('document_reminders')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Recordatorio eliminado');
            await fetchReminders();
            await onRemindersChange?.();
        } catch (error) {
            console.error('Error deleting document reminder:', error);
            toast.error('No se pudo eliminar el recordatorio');
        }
    };

    const toggleReminder = async (reminder: DocumentReminder) => {
        try {
            const { error } = await supabase
                .from('document_reminders')
                .update({ is_active: !reminder.is_active })
                .eq('id', reminder.id);

            if (error) throw error;

            toast.success(reminder.is_active ? 'Recordatorio pausado' : 'Recordatorio activado');
            await fetchReminders();
            await onRemindersChange?.();
        } catch (error) {
            console.error('Error toggling document reminder:', error);
            toast.error('No se pudo actualizar el recordatorio');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-amber-600" />
                        Recordatorios documentales
                    </DialogTitle>
                    <DialogDescription>
                        Gestiona avisos y renovaciones para "{documentTitle}".
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {loading ? (
                        <div className="text-sm text-muted-foreground">Cargando recordatorios...</div>
                    ) : reminders.length > 0 ? (
                        <div className="space-y-3">
                            {reminders.map((reminder) => (
                                <div key={reminder.id} className="rounded-xl border p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="font-medium">{reminder.title}</div>
                                                <Badge variant="outline">{reminder.kind === 'expiry' ? 'Automatico' : 'Personalizado'}</Badge>
                                                {!reminder.is_active ? <Badge variant="secondary">Pausado</Badge> : null}
                                            </div>
                                            {reminder.description ? <p className="text-sm text-muted-foreground mt-1">{reminder.description}</p> : null}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => toggleReminder(reminder)}>
                                                {reminder.is_active ? 'Pausar' : 'Activar'}
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => deleteReminder(reminder.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                                        <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Proximo aviso: {format(new Date(reminder.next_date), 'PPP', { locale: es })}</span>
                                        {reminder.interval_months ? <span>Se repite cada {reminder.interval_months} meses</span> : null}
                                        {typeof reminder.offset_days === 'number' ? <span>{reminder.offset_days} dias antes del vencimiento</span> : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No hay recordatorios configurados para este documento.
                        </div>
                    )}

                    {!showForm ? (
                        <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
                            <Plus className="h-4 w-4 mr-2" /> Nuevo recordatorio personalizado
                        </Button>
                    ) : (
                        <div className="rounded-xl border bg-slate-50/60 p-4 space-y-4">
                            <div className="grid gap-2">
                                <Label>Titulo</Label>
                                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Renovar antes del viaje" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Descripcion</Label>
                                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contexto del aviso o pasos de renovacion" className="min-h-[90px]" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Frecuencia</Label>
                                    <Select value={intervalMonths} onValueChange={setIntervalMonths}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Cada mes</SelectItem>
                                            <SelectItem value="3">Cada 3 meses</SelectItem>
                                            <SelectItem value="6">Cada 6 meses</SelectItem>
                                            <SelectItem value="12">Cada ano</SelectItem>
                                            <SelectItem value="24">Cada 2 anos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Proxima fecha</Label>
                                    <Input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
                                <Button onClick={() => void addReminder()}>Guardar</Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

