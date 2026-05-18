'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AdminPostItManager() {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [audience, setAudience] = useState<'all' | 'premium' | 'free'>('all');
    const [daysToExpire, setDaysToExpire] = useState('7');
    const [eventDate, setEventDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        const res = await fetch('/api/admin/post-its');
        if (res.ok) setHistory(await res.json());
    };

    const handleEdit = (postIt: any) => {
        setTitle(postIt.title);
        setContent(postIt.content);
        setAudience(postIt.target_audience);
        setEditingId(postIt.id);

        // Calculate days remaining or set default
        if (postIt.expires_at) {
            const diff = Math.ceil((new Date(postIt.expires_at).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
            setDaysToExpire(diff > 0 ? diff.toString() : '7');
        }

        if (postIt.event_date) {
            // Format for datetime-local: YYYY-MM-DDTHH:mm
            const date = new Date(postIt.event_date);
            const formatted = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setEventDate(formatted);
        } else {
            setEventDate('');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleRepeat = (postIt: any) => {
        setTitle(postIt.title);
        setContent(postIt.content);
        setAudience(postIt.target_audience);
        setEditingId(null); // New post-it
        setEventDate(''); // Clear event date for safety or keep it? user can set.
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast.info('Datos cargados. Ajusta las fechas y publica.');
    };

    const handleCancelEdit = () => {
        setTitle('');
        setContent('');
        setAudience('all');
        setEventDate('');
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que quieres borrar este post-it?')) return;
        const res = await fetch(`/api/admin/post-its?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            toast.success('Post-it eliminado');
            fetchHistory();
        } else {
            toast.error('Error al eliminar');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(daysToExpire));

            let bgColor = 'bg-yellow-200 dark:bg-yellow-600';
            if (audience === 'premium') bgColor = 'bg-amber-200 dark:bg-amber-600';
            if (audience === 'free') bgColor = 'bg-gray-200 dark:bg-gray-600';

            const url = editingId ? '/api/admin/post-its' : '/api/admin/post-its';
            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: editingId, // Only used for PUT
                    title,
                    content,
                    target_audience: audience,
                    expires_at: expiresAt.toISOString(),
                    event_date: eventDate ? new Date(eventDate).toISOString() : null,
                    bg_color: bgColor
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create post-it');
            }

            toast.success(editingId ? 'Post-it actualizado' : 'Post-it publicado correctamente');
            setTitle('');
            setContent('');
            setAudience('all');
            setEventDate('');
            setEditingId(null);
            fetchHistory();
        } catch (error) {
            console.error(error);
            toast.error('Error al publicar post-it');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Publicar Aviso (Post-it)</CardTitle>
                <CardDescription>Envía notificaciones tipo post-it a los dashboards de los usuarios.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Título</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej: Nuevo artículo disponible"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Contenido</Label>
                        <Textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="El mensaje breve para el post-it..."
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Audiencia</Label>
                            <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los usuarios</SelectItem>
                                    <SelectItem value="premium">Solo Premium</SelectItem>
                                    <SelectItem value="free">Solo Gratuitos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Duración</Label>
                            <Select value={daysToExpire} onValueChange={setDaysToExpire}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 día</SelectItem>
                                    <SelectItem value="2">2 días</SelectItem>
                                    <SelectItem value="3">3 días</SelectItem>
                                    <SelectItem value="7">1 semana</SelectItem>
                                    <SelectItem value="30">1 mes</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Fecha del Evento (Opcional - Para cuenta atrás)</Label>
                        <Input
                            type="datetime-local"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2">
                        {editingId && (
                            <Button type="button" variant="secondary" onClick={handleCancelEdit} disabled={isSubmitting} className="w-full">
                                Cancelar
                            </Button>
                        )}
                        <Button type="submit" disabled={isSubmitting} className="w-full">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {editingId ? 'Guardar Cambios' : 'Publicar Post-it'}
                        </Button>
                    </div>
                </form>
            </CardContent>

            <div className="border-t p-6">
                <h3 className="text-lg font-bold mb-4">Historial de Post-its</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left">
                                <th className="pb-2">Título</th>
                                <th className="pb-2">Audiencia</th>
                                <th className="pb-2">Evento</th>
                                <th className="pb-2">Expira</th>
                                <th className="pb-2">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((postIt) => (
                                <tr key={postIt.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="py-2 font-medium">{postIt.title}</td>
                                    <td className="py-2 capitalize">{postIt.target_audience}</td>
                                    <td className="py-2">{postIt.event_date ? new Date(postIt.event_date).toLocaleString() : '-'}</td>
                                    <td className="py-2">{new Date(postIt.expires_at).toLocaleDateString()}</td>
                                    <td className="py-2">
                                        <div className="flex gap-1 justify-end">
                                            <Button variant="outline" size="sm" onClick={() => handleRepeat(postIt)} title="Repetir (Crear copia)">
                                                🔁
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleEdit(postIt)} title="Editar">
                                                ✏️
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleDelete(postIt.id)} title="Borrar">
                                                🗑️
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-4 text-center text-muted-foreground">
                                        No hay post-its creados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Card>
    );
}
