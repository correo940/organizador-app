'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
    title: z.string().min(1, 'El título es obligatorio'),
    date: z.string().min(1, 'La fecha es obligatoria'),
    startTime: z.string().min(1, 'La hora de inicio es obligatoria'),
    endTime: z.string().min(1, 'La hora de fin es obligatoria'),
});

interface AddShiftDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export default function AddShiftDialog({ open, onOpenChange, onSuccess }: AddShiftDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            date: new Date().toISOString().split('T')[0],
            startTime: '08:00',
            endTime: '15:00',
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No hay usuario autenticado');

            // Combine date and time
            const startDateTime = new Date(`${values.date}T${values.startTime}`);
            const endDateTime = new Date(`${values.date}T${values.endTime}`);

            // Handle overnight shifts (end time < start time)
            if (endDateTime < startDateTime) {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }

            const { error } = await supabase.from('work_shifts').insert({
                user_id: user.id,
                title: values.title,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
            });

            if (error) throw error;

            toast.success('Turno añadido correctamente');
            form.reset();
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error('Error al añadir el turno');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Añadir Turno</DialogTitle>
                    <DialogDescription>
                        Introduce los detalles del nuevo turno de trabajo.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del Turno</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. Mañana, Tarde, Guardia..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fecha</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="startTime"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Hora Inicio</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="endTime"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Hora Fin</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
