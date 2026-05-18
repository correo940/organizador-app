'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Loader2, ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Activity {
    id: string;
    name: string;
    description: string;
    duration_minutes: number;
    intensity_level: string;
    category: string;
    required_physical_level: string;
}

export default function SchedulerActivityManager() {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            const res = await fetch('/api/admin/scheduler-activities');
            if (res.ok) {
                const data = await res.json();
                setActivities(data);
            } else {
                toast.error('Error cargando actividades');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                name,
                description,
                duration_minutes: parseInt(duration),
                intensity_level: intensity,
                category,
                required_physical_level: reqLevel
            };

            const method = editingActivity ? 'PUT' : 'POST';
            const body = editingActivity ? { ...payload, id: editingActivity.id } : payload;

            const res = await fetch('/api/admin/scheduler-activities', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error('Failed to save');

            toast.success(editingActivity ? 'ctividad actualizada' : 'Actividad creada');
            setIsDialogOpen(false);
            setEditingActivity(null);
            fetchActivities();
        } catch (error) {
            toast.error('Error guardando actividad');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que quieres eliminar esta actividad?')) return;

        try {
            const res = await fetch(`/api/admin/scheduler-activities?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Actividad eliminada');
                fetchActivities();
            } else {
                toast.error('Error al eliminar');
            }
        } catch (error) {
            toast.error('Error de conexión');
        }
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
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <ListTodo className="w-6 h-6 text-primary" />
                    <div>
                        <CardTitle>Catálogo de Organizador Vital</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Gestiona las actividades que la IA usará para rellenar huecos.
                        </p>
                    </div>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-2" /> Nueva Actividad
                </Button>
            </CardHeader>

            <CardContent>
                <div className="rounded-md border">
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
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : activities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No hay actividades definidas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                activities.map(act => (
                                    <TableRow key={act.id}>
                                        <TableCell className="font-medium">
                                            {act.name}
                                            {act.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{act.description}</div>}
                                        </TableCell>
                                        <TableCell className="capitalize">{act.category}</TableCell>
                                        <TableCell>{act.duration_minutes} min</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs ${act.intensity_level === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                    act.intensity_level === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                }`}>
                                                {act.intensity_level}
                                            </span>
                                        </TableCell>
                                        <TableCell className="capitalize">{act.required_physical_level === 'any' ? 'Cualquiera' : act.required_physical_level}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(act)}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={() => handleDelete(act.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

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
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles..." />
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
                                <Label>Nivel Físico</Label>
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
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
