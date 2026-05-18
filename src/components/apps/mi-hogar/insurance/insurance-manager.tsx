'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Shield, Plus, Calendar, DollarSign, AlertTriangle, CheckCircle, Trash2, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO, addYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

type Insurance = {
    id: string;
    type: string;
    company: string;
    price: number;
    expirationDate: string; // YYYY-MM-DD
    notes: string;
};

export default function InsuranceManager() {
    const [policies, setPolicies] = useState<Insurance[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    // Form
    const [type, setType] = useState('');
    const [company, setCompany] = useState('');
    const [price, setPrice] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (user) {
            fetchPolicies();
        } else {
            setPolicies([]);
            setLoading(false);
        }
    }, [user]);

    const fetchPolicies = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('insurances')
                .select('*')
                .order('expiration_date', { ascending: true });

            if (error) throw error;

            const mappedPolicies: Insurance[] = data.map((item: any) => ({
                id: item.id,
                type: item.name,
                company: item.provider || '',
                price: Number(item.cost) || 0,
                expirationDate: item.expiration_date,
                notes: item.notes || '',
            }));

            setPolicies(mappedPolicies);
        } catch (error) {
            console.error('Error fetching policies:', error);
            toast.error('Error al cargar los seguros');
        } finally {
            setLoading(false);
        }
    };

    const addPolicy = async () => {
        if (!type || !company || !expirationDate || !user) {
            toast.error('Tipo, Compañía y Fecha son obligatorios');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('insurances')
                .insert([
                    {
                        user_id: user.id,
                        name: type,
                        provider: company,
                        cost: Number(price) || 0,
                        expiration_date: expirationDate,
                        notes: notes,
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            const newPolicy: Insurance = {
                id: data.id,
                type: data.name,
                company: data.provider || '',
                price: Number(data.cost) || 0,
                expirationDate: data.expiration_date,
                notes: data.notes || '',
            };

            setPolicies([...policies, newPolicy].sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()));
            setIsDialogOpen(false);
            resetForm();
            toast.success('Seguro añadido');
        } catch (error) {
            console.error('Error adding policy:', error);
            toast.error('Error al guardar el seguro');
        }
    };

    const deletePolicy = async (id: string) => {
        if (!confirm('¿Eliminar este seguro?')) return;

        try {
            const { error } = await supabase
                .from('insurances')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setPolicies(policies.filter(p => p.id !== id));
            toast.success('Seguro eliminado');
        } catch (error) {
            console.error('Error deleting policy:', error);
            toast.error('Error al eliminar el seguro');
        }
    };

    const resetForm = () => {
        setType('');
        setCompany('');
        setPrice('');
        setExpirationDate('');
        setNotes('');
    };

    const getStatusColor = (days: number) => {
        if (days < 0) return 'text-destructive border-destructive/50 bg-destructive/10';
        if (days < 30) return 'text-amber-500 border-amber-500/50 bg-amber-500/10';
        return 'text-green-500 border-green-500/50 bg-green-500/10';
    };

    const getStatusText = (days: number) => {
        if (days < 0) return 'Vencido';
        if (days < 30) return 'Vence pronto';
        return 'Activo';
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <Shield className="h-6 w-6 text-primary" />
                    <h2 className="text-xl font-semibold">Mis Pólizas</h2>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}>
                            <Plus className="mr-2 h-4 w-4" /> Añadir Seguro
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Nuevo Seguro</DialogTitle>
                            <DialogDescription>Registra los detalles de tu póliza para recibir alertas.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tipo de Seguro</Label>
                                    <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Ej. Hogar, Vida, Coche..." />
                                </div>
                                <div className="space-y-2">
                                    <Label>Compañía</Label>
                                    <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ej. Mapfre, Allianz..." />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Precio Anual (€)</Label>
                                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fecha Vencimiento</Label>
                                    <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Notas</Label>
                                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Teléfono asistencia, nº póliza..." />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button onClick={addPolicy}>Guardar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {policies.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                    <Shield className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">No tienes seguros registrados.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {policies.map(policy => {
                        const daysLeft = differenceInDays(parseISO(policy.expirationDate), new Date());
                        const statusColor = getStatusColor(daysLeft);

                        return (
                            <Card key={policy.id} className="relative overflow-hidden hover:shadow-md transition-shadow">
                                <div className={`absolute top-0 left-0 w-1 h-full ${daysLeft < 0 ? 'bg-destructive' : daysLeft < 30 ? 'bg-amber-500' : 'bg-green-500'}`} />
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg">{policy.type}</CardTitle>
                                            <CardDescription className="flex items-center mt-1">
                                                <Building2 className="h-3 w-3 mr-1" />
                                                {policy.company}
                                            </CardDescription>
                                        </div>
                                        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColor}`}>
                                            {getStatusText(daysLeft)}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-2">
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground flex items-center"><Calendar className="h-3 w-3 mr-1" /> Vence:</span>
                                            <span className="font-medium">{format(parseISO(policy.expirationDate), 'd MMM yyyy', { locale: es })}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground flex items-center"><DollarSign className="h-3 w-3 mr-1" /> Precio:</span>
                                            <span className="font-medium">{policy.price} €</span>
                                        </div>
                                        {policy.notes && (
                                            <div className="pt-2 text-xs text-muted-foreground border-t mt-2">
                                                {policy.notes}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="pt-2 flex justify-between items-center bg-secondary/10">
                                    <div className="text-xs font-medium">
                                        {daysLeft < 0 ? (
                                            <span className="text-destructive flex items-center"><AlertTriangle className="h-3 w-3 mr-1" /> ¡Caducado hace {Math.abs(daysLeft)} días!</span>
                                        ) : (
                                            <span className={daysLeft < 30 ? 'text-amber-600' : 'text-green-600'}>
                                                Quedan {daysLeft} días
                                            </span>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deletePolicy(policy.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
