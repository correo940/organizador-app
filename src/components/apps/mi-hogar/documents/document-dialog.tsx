'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Loader2,
    Save,
    FileText,
    Lock,
    Sparkles,
    Tags,
    NotebookPen,
    Building2,
    FileBadge2,
    ScrollText,
    Flag,
    Plus,
    ShieldCheck,
    AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

export type DocumentMetadata = Record<string, string | number | boolean | null>;

export type DocumentForm = {
    id?: string;
    title: string;
    category: string;
    expiration_date?: string;
    file_url?: string;
    file_type?: string;
    is_favorite?: boolean;
    tags: string[];
    notes: string;
    issuer: string;
    summary: string;
    document_type: string;
    metadata: DocumentMetadata;
    lifecycle_status: string;
    renewal_of?: string | null;
};

export type DocumentAnalysisResult = {
    title: string;
    category: string;
    expiration_date: string | null;
    issuer: string | null;
    summary: string;
    tags: string[];
    confidence: number;
    document_type: string | null;
    metadata: DocumentMetadata;
    extracted_text_preview?: string;
};

interface DocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    form: DocumentForm;
    setForm: (form: DocumentForm) => void;
    onSave: (file?: File) => void;
    onAnalyze?: (file: File) => Promise<DocumentAnalysisResult | null>;
    selectedFile: File | null;
    setSelectedFile: (file: File | null) => void;
    analysis?: DocumentAnalysisResult | null;
    analysisError?: string | null;
    analyzing?: boolean;
    uploading?: boolean;
}

const CATEGORIES = ['Identidad', 'Vehículo', 'Seguro', 'Hogar', 'Salud', 'Finanzas', 'Otros'];
const LIFECYCLE_OPTIONS = [
    { value: 'activo', label: 'Activo' },
    { value: 'pendiente_revision', label: 'Pendiente de revisión' },
    { value: 'pendiente_renovacion', label: 'Pendiente de renovación' },
    { value: 'archivado', label: 'Archivado' },
];
const IDENTITY_TAGS = ['dni', 'nie', 'pasaporte', 'carnet'];

function normalizeTags(value: string) {
    return Array.from(new Set(
        value
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
    ));
}

function formatMetadataLabel(key: string) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function DocumentDialog({
    open,
    onOpenChange,
    form,
    setForm,
    onSave,
    onAnalyze,
    selectedFile,
    setSelectedFile,
    analysis,
    analysisError,
    analyzing,
    uploading,
}: DocumentDialogProps) {
    const [tagsInput, setTagsInput] = useState('');

    useEffect(() => {
        if (!open) {
            setSelectedFile(null);
        }
    }, [open, setSelectedFile]);

    useEffect(() => {
        setTagsInput((form.tags || []).join(', '));
    }, [form.tags, open]);

    const tagPreview = useMemo(() => normalizeTags(tagsInput), [tagsInput]);
    const isIdentityDocument =
        form.category === 'Identidad' ||
        tagPreview.some((tag) => IDENTITY_TAGS.includes(tag.toLowerCase())) ||
        IDENTITY_TAGS.some((tag) => form.title.toLowerCase().includes(tag)) ||
        IDENTITY_TAGS.some((tag) => form.document_type.toLowerCase().includes(tag));

    const metadataEntries = useMemo(
        () => Object.entries(form.metadata || {}).filter(([, value]) => value !== null && value !== ''),
        [form.metadata]
    );

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setSelectedFile(file);

        if (file && onAnalyze) {
            await onAnalyze(file);
        }
    };

    const handleSave = () => {
        if (!form.title || !form.category) {
            toast.warning('Titulo y categoria son obligatorios');
            return;
        }
        if (!form.id && !selectedFile) {
            toast.warning('Debes subir un archivo para el documento nuevo');
            return;
        }
        onSave(selectedFile || undefined);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-amber-500" />
                        {form.id ? 'Editar documento' : 'Nuevo documento inteligente'}
                    </DialogTitle>
                    <DialogDescription>
                        Guarda el archivo, revisa los metadatos detectados y completa solo lo que falte.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-4 p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
                        <Input
                            type="file"
                            id="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            onChange={handleFileChange}
                            accept="image/*,.pdf"
                        />
                        <div className="flex flex-col items-center justify-center gap-3 py-4 relative z-10">
                            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none group-hover:scale-110 transition-transform duration-500">
                                <Plus className="w-8 h-8 text-amber-500" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg">Suelta tu archivo aquí</p>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Soporta PDF e Imágenes</p>
                            </div>
                        </div>

                        {analyzing && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                            >
                                <div className="relative w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        animate={{ x: [-200, 200] }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                                    />
                                </div>
                                <div className="flex items-center gap-2 font-black text-amber-600 dark:text-amber-400 text-xs uppercase tracking-widest animate-pulse">
                                    <Sparkles className="w-4 h-4" /> Quioba IA Analizando...
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {form.file_url && !selectedFile ? (
                        <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-800 dark:text-green-400 text-xs font-bold flex items-center gap-2 justify-center">
                            <ShieldCheck className="w-4 h-4" /> ARCHIVO ACTUAL PROTEGIDO EN LA NUBE
                        </div>
                    ) : null}

                    {analysisError ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 p-4 space-y-2"
                        >
                            <div className="flex items-center gap-2 text-rose-600 font-black text-xs uppercase">
                                <AlertTriangle className="w-4 h-4" /> Fallo en el análisis inteligente
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{analysisError}</p>
                        </motion.div>
                    ) : null}

                    {analysis ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-3xl border border-amber-200/50 dark:border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-slate-900/50 dark:to-slate-800/50 p-6 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Sparkles className="w-16 h-16 text-amber-500" />
                            </div>

                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-sm uppercase tracking-widest">
                                    <Sparkles className="w-5 h-5" /> Quioba Insights
                                </div>

                                <p className="text-base text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">
                                    {analysis.summary}
                                </p>

                                <div className="flex flex-wrap gap-2 pt-2">
                                    <Badge className="bg-amber-500 text-white border-none font-bold text-[10px] px-3 h-6">
                                        CAT: {analysis.category}
                                    </Badge>
                                    {analysis.document_type && (
                                        <Badge variant="outline" className="border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 font-bold text-[10px] px-3 h-6">
                                            TIPO: {analysis.document_type}
                                        </Badge>
                                    )}
                                    <Badge className="bg-green-500/10 text-green-800 border-none font-bold text-[10px] px-3 h-6">
                                        CONFIANZA: {Math.round(analysis.confidence * 100)}%
                                    </Badge>
                                </div>
                            </div>
                        </motion.div>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Título</Label>
                            <Input
                                id="title"
                                placeholder="Ej. DNI, póliza del coche o contrato"
                                value={form.title}
                                onChange={(event) => setForm({ ...form, title: event.target.value })}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="category">Categoría</Label>
                            <Select
                                value={form.category}
                                onValueChange={(value) => setForm({ ...form, category: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Tipo documental</Label>
                            <div className="relative">
                                <FileBadge2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    placeholder="Ej. DNI, ITV, Póliza, Factura"
                                    value={form.document_type}
                                    onChange={(event) => setForm({ ...form, document_type: event.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Emisor o entidad</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    placeholder="Ej. Dirección General de la Policía"
                                    value={form.issuer}
                                    onChange={(event) => setForm({ ...form, issuer: event.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2 md:col-span-2">
                            <Label>Estado documental</Label>
                            <Select value={form.lifecycle_status} onValueChange={(value) => setForm({ ...form, lifecycle_status: value })}>
                                <SelectTrigger>
                                    <Flag className="mr-2 h-4 w-4 text-muted-foreground" />
                                    <SelectValue placeholder="Estado documental" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LIFECYCLE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Resumen detectado</Label>
                        <div className="relative">
                            <ScrollText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Textarea
                                className="min-h-[110px] pl-9"
                                placeholder="Resumen del documento y datos clave detectados"
                                value={form.summary}
                                onChange={(event) => setForm({ ...form, summary: event.target.value })}
                            />
                        </div>
                    </div>

                    {metadataEntries.length > 0 ? (
                        <div className="grid gap-2">
                            <Label>Metadatos detectados</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                {metadataEntries.map(([key, value]) => (
                                    <div key={key} className="rounded-lg border bg-white px-3 py-2 text-sm">
                                        <div className="text-xs text-muted-foreground">{formatMetadataLabel(key)}</div>
                                        <div className="font-medium break-words">{String(value)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <div className="grid gap-2">
                        <Label>Etiquetas</Label>
                        <Input
                            placeholder="Ej. dni, coche, seguro, fiscal"
                            value={tagsInput}
                            onChange={(event) => {
                                setTagsInput(event.target.value);
                                setForm({ ...form, tags: normalizeTags(event.target.value) });
                            }}
                        />
                        {tagPreview.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {tagPreview.map((tag) => (
                                    <Badge key={tag} variant="secondary">{tag}</Badge>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label>Notas</Label>
                        <Textarea
                            placeholder="Anotaciones manuales, renovación, ubicación del original, observaciones..."
                            value={form.notes}
                            onChange={(event) => setForm({ ...form, notes: event.target.value })}
                            className="min-h-[110px]"
                        />
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <NotebookPen className="w-3 h-3" /> Usa este campo para guardar contexto manual que no deba sobrescribirse.
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Fecha de caducidad (opcional)</Label>
                        <Input
                            type="date"
                            value={form.expiration_date || ''}
                            onChange={(event) => setForm({ ...form, expiration_date: event.target.value })}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading || analyzing}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={uploading || analyzing}>
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        {uploading ? 'Subiendo...' : 'Guardar documento'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


