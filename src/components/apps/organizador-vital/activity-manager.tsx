'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Activity {
    id: string;
    name: string;
    description: string;
    duration_minutes: number;
    intensity_level: string;
    category: string;
    required_physical_level: string;
}

export function ActivityManager({ onBack }: { onBack: () => void }) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

    // Form
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState('30');
    const [intensity, setIntensity] = useState('medium');
    const [category, setCategory] = useState('leisure');
    const [reqLevel, setReqLevel] = useState('any');

    useEffect(() => {
        fetchActivities();
    }, []);

    const fetchActivities = async () => {
        try {
            const { data, error } = await supabase
                .from('smart_scheduler_activities')
                .select('*')
                .order('name');
            if (data) setActivities(data);
        } catch (error) {
            toast.error('Error cargando actividades');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const payload = {
                name,
                description,
                duration_minutes: parseInt(duration),
                intensity_level: intensity,
                category,
                required_physical_level: reqLevel
            };

            if (editingActivity) {
                await supabase.from('smart_scheduler_activities').update(payload).eq('id', editingActivity.id);
                toast.success('Actividad actualizada');
            } else {
                await supabase.from('smart_scheduler_activities').insert(payload);
                toast.success('Actividad creada');
            }

            setIsDialogOpen(false);
            setEditingActivity(null);
            fetchActivities();
        } catch (error) {
            toast.error('Error guardando actividad');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que quieres eliminar esta actividad?')) return;
        await supabase.from('smart_scheduler_activities').delete().eq('id', id);
        toast.success('Actividad eliminada');
        fetchActivities();
    };

    const openCreate = () => {
        setEditingActivity(null);
        setName('');
        setDescription('');
        setDuration('30');
        setIntensity('medium');
        setCategory('leisure');
        setReqLevel('any');
        setIsDialogOpen(true);
    };

    const openEdit = (act: Activity) => {
        setEditingActivity(act);
        setName(act.name);
        setDescription(act.description || '');
        setDuration(act.duration_minutes.toString());
        setIntensity(act.intensity_level);
        setCategory(act.category);
        setReqLevel(act.required_physical_level);
        setIsDialogOpen(true);
    };

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-bold">Catálogo de Actividades</h2>
                        <p className="text-sm text-muted-foreground">Define qué actividades se usarán para rellenar huecos.</p>
                    </div>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-2" /> Nueva Actividad
                </Button>
            </div>

            <div className="rounded-md border bg-white dark:bg-slate-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Duración</TableHead>
                            <TableHead>Intensidad</TableHead>
                            <TableHead>Nivel Req.</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activities.map(act => (
                            <TableRow key={act.id}>
                                <TableCell className="font-medium">
                                    {act.name}
                                    {act.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{act.description}</div>}
                                </TableCell>
                                <TableCell className="capitalize">{act.category}</TableCell>
                                <TableCell>{act.duration_minutes} min</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded-full text-xs ${act.intensity_level === 'high' ? 'bg-red-100 text-red-700' :
                                        act.intensity_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                        {act.intensity_level}
                                    </span>
                                </TableCell>
                                <TableCell className="capitalize">{act.required_physical_level === 'any' ? 'Cualquiera' : act.required_physical_level}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(act)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(act.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {activities.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No hay actividades definidas. Crea unas cuantas para empezar.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingActivity ? 'Editar Actividad' : 'Nueva Actividad'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Nombre</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Caminata Ligera" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Descripción</Label>
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles de la actividad..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Duración (min)</Label>
                                <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} min={5} step={5} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Categoría</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="physical">Física</SelectItem>
                                        <SelectItem value="mental">Mental</SelectItem>
                                        <SelectItem value="leisure">Ocio</SelectItem>
                                        <SelectItem value="household">Hogar</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Intensidad</Label>
                                <Select value={intensity} onValueChange={setIntensity}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baja</SelectItem>
                                        <SelectItem value="medium">Media</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Nivel Físico Requerido</Label>
                                <Select value={reqLevel} onValueChange={setReqLevel}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Cualquiera</SelectItem>
                                        <SelectItem value="active">Activo +</SelectItem>
                                        <SelectItem value="athlete">Atleta Solo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
