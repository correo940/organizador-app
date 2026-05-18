'use client';

import React, { useState, useEffect } from 'react';
import {
    Book,
    FileText,
    Globe,
    Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface JournalEntry {
    id: string;
    title: string;
    entry_type: 'note' | 'book' | 'article' | 'webpage' | 'document';
    metadata: any;
    updated_at: string;
}

interface JournalDetailPanelProps {
    entry: JournalEntry | null;
    onUpdateEntry: () => void; // Refresh triggering
    onDeleteEntry: (id: string) => void;
}

export function JournalDetailPanel({ entry, onUpdateEntry, onDeleteEntry }: JournalDetailPanelProps) {
    const [formData, setFormData] = useState<any>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (entry) {
            setFormData({
                entry_type: entry.entry_type || 'note',
                title: entry.metadata?.title || '',
                author: entry.metadata?.author || '',
                date: entry.metadata?.date || '',
                url: entry.metadata?.url || '',
                abstract: entry.metadata?.abstract || '',
                publication: entry.metadata?.publication || '',
                volume: entry.metadata?.volume || '',
                issue: entry.metadata?.issue || '',
                pages: entry.metadata?.pages || '',
                isbn: entry.metadata?.isbn || '',
            });
        }
    }, [entry]);

    const handleSave = async (field: string, value: any) => {
        if (!entry) return;

        const newMetadata = { ...entry.metadata, ...formData, [field]: value };
        // Clean undefined

        // Update local state immediately for responsiveness
        setFormData((prev: any) => ({ ...prev, [field]: value }));

        // Debounce update to server could be better, but implementing direct save on blur/change for now
        const { error } = await supabase
            .from('journal_entries')
            .update({
                entry_type: field === 'entry_type' ? value : entry.entry_type,
                metadata: newMetadata,
                updated_at: new Date().toISOString()
            })
            .eq('id', entry.id);

        if (error) {
            console.error('Error updating entry:', error);
            toast.error('Error al guardar cambios');
        } else {
            // Quiet success or toast.success('Guardado');
            onUpdateEntry();
        }
    };

    if (!entry) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-900 text-muted-foreground p-8 text-center bg-dots-pattern">
                <div>
                    <Book className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Selecciona un elemento para ver sus detalles</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-900 border-l border-border">
            <div className="p-4 border-b border-border flex justify-between items-center bg-white dark:bg-zinc-950">
                <span className="font-semibold text-sm uppercase tracking-wide">Información</span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => onDeleteEntry(entry.id)}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-6">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Tipo de Elemento</Label>
                        <Select
                            value={formData.entry_type}
                            onValueChange={(val) => handleSave('entry_type', val)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="note">Nota</SelectItem>
                                <SelectItem value="book">Libro</SelectItem>
                                <SelectItem value="article">Artículo de Revista</SelectItem>
                                <SelectItem value="webpage">Página Web</SelectItem>
                                <SelectItem value="document">Documento</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Título</Label>
                        <Input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            onBlur={(e) => handleSave('title', e.target.value)}
                            className="font-medium"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Autor / Creador</Label>
                            <Input
                                value={formData.author}
                                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                onBlur={(e) => handleSave('author', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Fecha / Año</Label>
                            <Input
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                onBlur={(e) => handleSave('date', e.target.value)}
                                placeholder="YYYY-MM-DD"
                            />
                        </div>
                    </div>

                    {formData.entry_type === 'webpage' && (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">URL</Label>
                            <Input
                                value={formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                onBlur={(e) => handleSave('url', e.target.value)}
                                className="text-blue-500 underline cursor-pointer"
                            />
                        </div>
                    )}

                    {(formData.entry_type === 'book' || formData.entry_type === 'article') && (
                        <>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Publicación / Editorial</Label>
                                <Input
                                    value={formData.publication}
                                    onChange={(e) => setFormData({ ...formData, publication: e.target.value })}
                                    onBlur={(e) => handleSave('publication', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Volumen</Label>
                                    <Input
                                        value={formData.volume}
                                        onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                                        onBlur={(e) => handleSave('volume', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Número</Label>
                                    <Input
                                        value={formData.issue}
                                        onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
                                        onBlur={(e) => handleSave('issue', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Páginas</Label>
                                    <Input
                                        value={formData.pages}
                                        onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                                        onBlur={(e) => handleSave('pages', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">ISBN / DOI</Label>
                                <Input
                                    value={formData.isbn}
                                    onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                                    onBlur={(e) => handleSave('isbn', e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Resumen / Abstract</Label>
                        <Textarea
                            value={formData.abstract}
                            onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
                            onBlur={(e) => handleSave('abstract', e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
