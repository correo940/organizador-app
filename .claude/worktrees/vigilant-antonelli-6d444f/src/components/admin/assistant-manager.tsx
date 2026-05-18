'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot,
    Plus,
    Trash2,
    Edit2,
    Save,
    X,
    MessageSquare,
    Tag,
    ToggleLeft,
    ToggleRight,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface AssistantResponse {
    id: string;
    keywords: string[];
    category: string;
    response_template: string;
    priority: number;
    is_active: boolean;
    created_at: string;
}

const CATEGORIES = [
    { value: 'greeting', label: 'Saludos', color: 'bg-green-500' },
    { value: 'farewell', label: 'Despedidas', color: 'bg-blue-500' },
    { value: 'help', label: 'Ayuda', color: 'bg-yellow-500' },
    { value: 'about', label: 'Sobre el bot', color: 'bg-purple-500' },
    { value: 'custom', label: 'Personalizado', color: 'bg-gray-500' },
];

export default function AssistantManager() {
    const [responses, setResponses] = useState<AssistantResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedResponse, setSelectedResponse] = useState<AssistantResponse | null>(null);

    // Form state
    const [keywords, setKeywords] = useState('');
    const [category, setCategory] = useState('custom');
    const [template, setTemplate] = useState('');
    const [priority, setPriority] = useState(50);
    const [isActive, setIsActive] = useState(true);

    const { toast } = useToast();

    // Fetch responses
    const fetchResponses = async () => {
        try {
            const { data, error } = await supabase
                .from('assistant_responses')
                .select('*')
                .order('priority', { ascending: false });

            if (error) throw error;
            setResponses(data || []);
        } catch (error) {
            console.error('Error fetching responses:', error);
            toast({
                title: 'Error',
                description: 'No se pudieron cargar las respuestas',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResponses();
    }, []);

    // Open dialog for new response
    const handleNew = () => {
        setSelectedResponse(null);
        setKeywords('');
        setCategory('custom');
        setTemplate('');
        setPriority(50);
        setIsActive(true);
        setDialogOpen(true);
    };

    // Open dialog for editing
    const handleEdit = (response: AssistantResponse) => {
        setSelectedResponse(response);
        setKeywords(response.keywords.join(', '));
        setCategory(response.category);
        setTemplate(response.response_template);
        setPriority(response.priority);
        setIsActive(response.is_active);
        setDialogOpen(true);
    };

    // Save response
    const handleSave = async () => {
        if (!keywords.trim() || !template.trim()) {
            toast({
                title: 'Error',
                description: 'Keywords y respuesta son obligatorios',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            const keywordArray = keywords
                .split(',')
                .map(k => k.trim().toLowerCase())
                .filter(k => k.length > 0);

            const data = {
                keywords: keywordArray,
                category,
                response_template: template,
                priority,
                is_active: isActive,
                updated_at: new Date().toISOString(),
            };

            if (selectedResponse) {
                // Update
                const { error } = await supabase
                    .from('assistant_responses')
                    .update(data)
                    .eq('id', selectedResponse.id);

                if (error) throw error;
                toast({ title: 'Respuesta actualizada' });
            } else {
                // Insert
                const { error } = await supabase
                    .from('assistant_responses')
                    .insert(data);

                if (error) throw error;
                toast({ title: 'Respuesta creada' });
            }

            setDialogOpen(false);
            fetchResponses();
        } catch (error) {
            console.error('Error saving response:', error);
            toast({
                title: 'Error',
                description: 'No se pudo guardar la respuesta',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    // Delete response
    const handleDelete = async () => {
        if (!selectedResponse) return;

        try {
            const { error } = await supabase
                .from('assistant_responses')
                .delete()
                .eq('id', selectedResponse.id);

            if (error) throw error;
            toast({ title: 'Respuesta eliminada' });
            setDeleteDialogOpen(false);
            setSelectedResponse(null);
            fetchResponses();
        } catch (error) {
            console.error('Error deleting response:', error);
            toast({
                title: 'Error',
                description: 'No se pudo eliminar la respuesta',
                variant: 'destructive',
            });
        }
    };

    // Toggle active status
    const handleToggleActive = async (response: AssistantResponse) => {
        try {
            const { error } = await supabase
                .from('assistant_responses')
                .update({
                    is_active: !response.is_active,
                    updated_at: new Date().toISOString()
                })
                .eq('id', response.id);

            if (error) throw error;
            fetchResponses();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const getCategoryInfo = (cat: string) => {
        return CATEGORIES.find(c => c.value === cat) || CATEGORIES[4];
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                        <Bot className="w-6 h-6 text-violet-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Gestor del Asistente</h2>
                        <p className="text-sm text-muted-foreground">
                            Configura las respuestas predefinidas del asistente
                        </p>
                    </div>
                </div>
                <Button onClick={handleNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Respuesta
                </Button>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardContent className="flex items-start gap-3 pt-4">
                    <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">¿Cómo funciona?</p>
                        <p>El asistente busca coincidencias con los <strong>keywords</strong> que definas.
                            Si el usuario escribe algo similar a un keyword, responderá con el template asociado.</p>
                        <p className="mt-1">Puedes usar <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{user_name}'}</code> en
                            el template para incluir el nombre del usuario.</p>
                    </div>
                </CardContent>
            </Card>

            {/* Responses List */}
            <div className="grid gap-4">
                <AnimatePresence mode="popLayout">
                    {responses.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No hay respuestas configuradas</p>
                                <Button variant="outline" className="mt-4" onClick={handleNew}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Crear primera respuesta
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        responses.map((response) => {
                            const catInfo = getCategoryInfo(response.category);
                            return (
                                <motion.div
                                    key={response.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <Card className={`transition-opacity ${!response.is_active ? 'opacity-50' : ''}`}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge variant="secondary" className={`${catInfo.color} text-white`}>
                                                            {catInfo.label}
                                                        </Badge>
                                                        <Badge variant="outline">Prioridad: {response.priority}</Badge>
                                                        {!response.is_active && (
                                                            <Badge variant="destructive">Inactivo</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {response.keywords.map((kw, idx) => (
                                                            <Badge key={idx} variant="outline" className="text-xs">
                                                                <Tag className="w-3 h-3 mr-1" />
                                                                {kw}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleToggleActive(response)}
                                                        title={response.is_active ? 'Desactivar' : 'Activar'}
                                                    >
                                                        {response.is_active ? (
                                                            <ToggleRight className="w-5 h-5 text-green-500" />
                                                        ) : (
                                                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(response)}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setSelectedResponse(response);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                                                {response.response_template}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>

            {/* Edit/Create Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedResponse ? 'Editar Respuesta' : 'Nueva Respuesta'}
                        </DialogTitle>
                        <DialogDescription>
                            Define los keywords que activarán esta respuesta
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="keywords">Keywords (separados por coma)</Label>
                            <Input
                                id="keywords"
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                placeholder="hola, buenos días, saludos"
                            />
                            <p className="text-xs text-muted-foreground">
                                El asistente buscará coincidencias con estas palabras
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="category">Categoría</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="priority">Prioridad (0-100)</Label>
                                <Input
                                    id="priority"
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={priority}
                                    onChange={(e) => setPriority(Number(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="template">Respuesta</Label>
                            <Textarea
                                id="template"
                                value={template}
                                onChange={(e) => setTemplate(e.target.value)}
                                placeholder="¡Hola {user_name}! ¿En qué puedo ayudarte?"
                                rows={4}
                            />
                            <p className="text-xs text-muted-foreground">
                                Usa <code className="bg-muted px-1 rounded">{'{user_name}'}</code> para incluir el nombre del usuario
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsActive(!isActive)}
                            >
                                {isActive ? (
                                    <>
                                        <ToggleRight className="w-4 h-4 mr-2 text-green-500" />
                                        Activo
                                    </>
                                ) : (
                                    <>
                                        <ToggleLeft className="w-4 h-4 mr-2" />
                                        Inactivo
                                    </>
                                )}
                            </Button>
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
                        <AlertDialogTitle>¿Eliminar respuesta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. La respuesta será eliminada permanentemente.
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
