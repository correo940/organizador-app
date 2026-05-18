'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, StickyNote, Wrench, Lightbulb, AlertTriangle, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface Note {
    id: string;
    note_type: 'general' | 'repair' | 'tip' | 'problem';
    title: string;
    content: string;
    created_at: string;
}

interface NotesDialogProps {
    manualId: string;
    manualTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const NOTE_TYPES = {
    general: { label: 'General', icon: StickyNote, color: 'bg-blue-100 text-blue-800 border-blue-200' },
    repair: { label: 'Reparación', icon: Wrench, color: 'bg-orange-100 text-orange-800 border-orange-200' },
    tip: { label: 'Consejo', icon: Lightbulb, color: 'bg-green-100 text-green-800 border-green-200' },
    problem: { label: 'Problema', icon: AlertTriangle, color: 'bg-red-100 text-red-800 border-red-200' }
};

export function NotesDialog({ manualId, manualTitle, open, onOpenChange }: NotesDialogProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [noteType, setNoteType] = useState<'general' | 'repair' | 'tip' | 'problem'>('general');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            fetchNotes();
        }
    }, [open]);

    const fetchNotes = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('manual_notes')
                .select('*')
                .eq('manual_id', manualId)
                .order('created_at', { ascending: false });

            if (error) {
                console.log('Notes table not available yet');
                return;
            }

            setNotes(data || []);
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoading(false);
        }
    };

    const addNote = async () => {
        if (!title.trim() || !content.trim()) {
            toast.error('Título y contenido son obligatorios');
            return;
        }

        try {
            const { error } = await supabase
                .from('manual_notes')
                .insert([{
                    manual_id: manualId,
                    note_type: noteType,
                    title: title.trim(),
                    content: content.trim()
                }]);

            if (error) throw error;

            toast.success('Nota añadida');
            resetForm();
            fetchNotes();
        } catch (error) {
            console.error('Error adding note:', error);
            toast.error('Error al añadir nota');
        }
    };

    const updateNote = async () => {
        if (!title.trim() || !content.trim() || !editingId) {
            toast.error('Título y contenido son obligatorios');
            return;
        }

        try {
            const { error } = await supabase
                .from('manual_notes')
                .update({
                    note_type: noteType,
                    title: title.trim(),
                    content: content.trim()
                })
                .eq('id', editingId);

            if (error) throw error;

            toast.success('Nota actualizada');
            resetForm();
            fetchNotes();
        } catch (error) {
            console.error('Error updating note:', error);
            toast.error('Error al actualizar nota');
        }
    };

    const deleteNote = async (id: string) => {
        if (!confirm('¿Eliminar esta nota?')) return;

        try {
            const { error } = await supabase
                .from('manual_notes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Nota eliminada');
            fetchNotes();
        } catch (error) {
            console.error('Error deleting note:', error);
            toast.error('Error al eliminar nota');
        }
    };

    const startEdit = (note: Note) => {
        setEditingId(note.id);
        setNoteType(note.note_type);
        setTitle(note.title);
        setContent(note.content);
        setShowForm(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setNoteType('general');
        setTitle('');
        setContent('');
        setShowForm(false);
    };

    const handleSubmit = () => {
        if (editingId) {
            updateNote();
        } else {
            addNote();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Notas y Comentarios
                    </DialogTitle>
                    <DialogDescription>
                        Añade reparaciones, consejos y notas sobre "{manualTitle}"
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                    {/* Existing Notes */}
                    {!showForm && notes.length > 0 && (
                        <div className="space-y-3">
                            {notes.map(note => {
                                const NoteIcon = NOTE_TYPES[note.note_type].icon;
                                return (
                                    <div
                                        key={note.id}
                                        className={`p-4 border-2 rounded-lg ${NOTE_TYPES[note.note_type].color}`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <NoteIcon className="h-4 w-4" />
                                                <Badge variant="outline" className="text-xs">
                                                    {NOTE_TYPES[note.note_type].label}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(note.created_at), {
                                                        addSuffix: true,
                                                        locale: es
                                                    })}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7"
                                                    onClick={() => startEdit(note)}
                                                >
                                                    Editar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 hover:text-destructive"
                                                    onClick={() => deleteNote(note.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        <h4 className="font-semibold mb-1">{note.title}</h4>
                                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Add/Edit Form */}
                    {!showForm && (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setShowForm(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Nota
                        </Button>
                    )}

                    {showForm && (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">
                                    {editingId ? 'Editar Nota' : 'Nueva Nota'}
                                </Label>
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo *</Label>
                                <Select value={noteType} onValueChange={(value: any) => setNoteType(value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(NOTE_TYPES).map(([key, config]) => {
                                            const Icon = config.icon;
                                            return (
                                                <SelectItem key={key} value={key}>
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="h-4 w-4" />
                                                        {config.label}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Título *</Label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Cambio de filtro, Error E03, Truco útil..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Contenido *</Label>
                                <Textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Describe el detalle de la nota..."
                                    rows={4}
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="outline" onClick={resetForm}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleSubmit}>
                                    {editingId ? 'Actualizar' : 'Crear'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {!showForm && notes.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>No hay notas todavía</p>
                            <p className="text-xs mt-1">Añade reparaciones, consejos o problemas</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
