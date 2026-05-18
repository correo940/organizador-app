'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    Plus,
    Trash2,
    Edit2,
    Save,
    Loader2,
    AlertCircle,
    Globe,
    Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface GlobalKnowledgeItem {
    id: string;
    title: string;
    content: string;
    category?: string;
    created_at: string;
    updated_at: string;
}

// ── Sub-componente de tarjeta con texto truncado ─────────────────────────
function KnowledgeCard({
    item,
    onEdit,
    onDelete,
}: {
    item: GlobalKnowledgeItem;
    onEdit: (item: GlobalKnowledgeItem) => void;
    onDelete: (item: GlobalKnowledgeItem) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const PREVIEW_LENGTH = 150;
    const isLong = item.content.length > PREVIEW_LENGTH;
    const displayText = expanded || !isLong ? item.content : item.content.substring(0, PREVIEW_LENGTH) + '…';

    return (
        <Card>
            <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-sm">{item.title}</h4>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                                <Globe className="w-3 h-3 mr-1" />
                                Global
                            </Badge>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                            <p className="whitespace-pre-wrap leading-relaxed">{displayText}</p>
                            {isLong && (
                                <button
                                    onClick={() => setExpanded(v => !v)}
                                    className="mt-2 text-xs font-semibold text-primary hover:underline focus:outline-none"
                                >
                                    {expanded ? 'Ver menos ↑' : 'Ver más ↓'}
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                            Creado: {new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(item)} title="Editar">
                            <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(item)} title="Eliminar">
                            <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminKnowledgeManager() {
    const [items, setItems] = useState<GlobalKnowledgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<GlobalKnowledgeItem | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('General');

    const { toast } = useToast();

    const fetchItems = async () => {
        try {
            const res = await fetch('/api/admin/global-knowledge');
            if (!res.ok) throw new Error('Error loading');
            const data = await res.json();
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching global knowledge:', error);
            toast({
                title: 'Error',
                description: 'No se pudo cargar el conocimiento global',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleNew = () => {
        setSelectedItem(null);
        setTitle('');
        setContent('');
        setCategory('General');
        setDialogOpen(true);
    };

    const handleEdit = (item: GlobalKnowledgeItem) => {
        setSelectedItem(item);
        setTitle(item.title);
        setContent(item.content);
        setCategory(item.category || 'General');
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            toast({
                title: 'Error',
                description: 'Título y contenido son obligatorios',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            const method = selectedItem ? 'PUT' : 'POST';
            const body = selectedItem
                ? { id: selectedItem.id, title, content, category: category.trim() || 'General' }
                : { title, content, category: category.trim() || 'General' };

            const res = await fetch('/api/admin/global-knowledge', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error('Error saving');

            toast({ title: selectedItem ? 'Conocimiento actualizado' : 'Conocimiento creado' });
            setDialogOpen(false);
            fetchItems();
        } catch (error) {
            console.error('Error saving global knowledge:', error);
            toast({
                title: 'Error',
                description: 'No se pudo guardar',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedItem) return;

        try {
            const res = await fetch(`/api/admin/global-knowledge?id=${selectedItem.id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Error deleting');

            toast({ title: 'Conocimiento eliminado' });
            setDeleteDialogOpen(false);
            setSelectedItem(null);
            fetchItems();
        } catch (error) {
            console.error('Error deleting global knowledge:', error);
            toast({
                title: 'Error',
                description: 'No se pudo eliminar',
                variant: 'destructive',
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                        <Brain className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Conocimiento Global de Quioba</h2>
                        <p className="text-sm text-muted-foreground">
                            Conocimiento que la IA usará para TODOS los usuarios
                        </p>
                    </div>
                </div>
                <Button onClick={handleNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Conocimiento
                </Button>
            </div>

            {/* Info Card */}
            <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                <CardContent className="flex items-start gap-3 pt-4">
                    <AlertCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-emerald-700 dark:text-emerald-300">
                        <p className="font-medium mb-1">¿Cómo funciona?</p>
                        <p>El conocimiento que añadas aquí se <strong>inyecta en el system prompt de la IA</strong> para todos los usuarios registrados.
                            Úsalo para enseñar a Quioba datos generales: horarios del servicio, reglas de la app, FAQs, datos de la marca, etc.</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700">
                                <Globe className="w-3 h-3 mr-1" />
                                Visible para todos
                            </Badge>
                            <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                                <Users className="w-3 h-3 mr-1" />
                                Solo tú puedes editarlo
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Items List */}
            <div className="grid gap-6">
                <AnimatePresence mode="popLayout">
                    {items.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <Brain className="w-12 h-12 text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No hay conocimiento global configurado</p>
                                <p className="text-xs text-muted-foreground mt-1">Añade datos que Quioba deba saber para todos los usuarios</p>
                                <Button variant="outline" className="mt-4" onClick={handleNew}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Añadir primer conocimiento
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        Object.entries(
                            items.reduce((acc, item) => {
                                const cat = item.category || 'General';
                                if (!acc[cat]) acc[cat] = [];
                                acc[cat].push(item);
                                return acc;
                            }, {} as Record<string, GlobalKnowledgeItem[]>)
                        ).map(([cat, catItems]) => (
                            <div key={cat} className="space-y-3">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <div className="h-px bg-border flex-1"></div>
                                    {cat}
                                    <div className="h-px bg-border flex-1"></div>
                                </h3>
                                <div className="grid gap-4">
                                    {catItems.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                        >
                                            <KnowledgeCard
                                                item={item}
                                                onEdit={handleEdit}
                                                onDelete={(i) => { setSelectedItem(i); setDeleteDialogOpen(true); }}
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Edit/Create Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedItem ? 'Editar Conocimiento Global' : 'Nuevo Conocimiento Global'}
                        </DialogTitle>
                        <DialogDescription>
                            Este conocimiento estará disponible para la IA de TODOS los usuarios
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="gk-category">Categoría</Label>
                            <Input
                                id="gk-category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="Ej: Reglas, Soporte, FAQs... (Puedes escribir la que quieras)"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="gk-title">Título</Label>
                            <Input
                                id="gk-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ej: Horario de atención de Quioba"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="gk-content">Contenido</Label>
                            <Textarea
                                id="gk-content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Ej: Quioba está disponible 24/7. Los artículos se publican cada lunes y jueves."
                                rows={6}
                            />
                            <p className="text-xs text-muted-foreground">
                                Escribe toda la información que quieras que Quioba sepa. Se inyectará literalmente en su contexto.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar conocimiento global?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. El conocimiento &quot;{selectedItem?.title}&quot; será eliminado y la IA dejará de usarlo para todos los usuarios.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
