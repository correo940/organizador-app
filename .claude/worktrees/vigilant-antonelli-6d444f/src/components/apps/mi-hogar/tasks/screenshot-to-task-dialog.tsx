'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Loader2, Upload, FileImage, Check, AlertCircle,
    Camera, ImagePlus, CalendarPlus, Sparkles, Trash2, Clock
} from 'lucide-react';
import { analyzeScreenshotForEvents, ExtractedEvent } from '@/lib/zai-ocr';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface ScreenshotToTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    /** Pre-loaded image from share intent */
    sharedImageBase64?: string | null;
    /** Current task list ID to save tasks to */
    listId?: string;
}

export default function ScreenshotToTaskDialog({
    open,
    onOpenChange,
    onSuccess,
    sharedImageBase64,
    listId
}: ScreenshotToTaskDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [events, setEvents] = useState<(ExtractedEvent & { selected: boolean })[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // If shared image arrives, auto-load and analyze
    useEffect(() => {
        if (open && sharedImageBase64) {
            setPreviewUrl(sharedImageBase64);
            // Auto-analyze
            handleAnalyze(sharedImageBase64);
        }
    }, [open, sharedImageBase64]);

    const resetState = () => {
        setPreviewUrl(null);
        setEvents([]);
    };

    const handleClose = () => {
        resetState();
        onOpenChange(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setPreviewUrl(dataUrl);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCameraCapture = async () => {
        try {
            const image = await CapCamera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Camera,
                correctOrientation: true
            });
            if (image.dataUrl) {
                setPreviewUrl(image.dataUrl);
            }
        } catch (error: any) {
            if (error.message !== 'User cancelled photos app') {
                toast.error('No se pudo acceder a la cámara');
            }
        }
    };

    const handleAnalyze = async (imageUrl?: string) => {
        const img = imageUrl || previewUrl;
        if (!img) return;

        setIsLoading(true);
        setEvents([]);

        try {
            const extractedEvents = await analyzeScreenshotForEvents(img);

            if (extractedEvents.length > 0) {
                setEvents(extractedEvents.map(evt => ({ ...evt, selected: true })));
                toast.success(`¡${extractedEvents.length} evento(s) detectado(s)!`);
            } else {
                toast.error('No se detectaron eventos con fecha en la imagen');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al analizar la imagen');
        } finally {
            setIsLoading(false);
        }
    };

    const updateEvent = (index: number, field: keyof ExtractedEvent, value: string | number) => {
        setEvents(prev => prev.map((evt, i) =>
            i === index ? { ...evt, [field]: value } : evt
        ));
    };

    const toggleEventSelection = (index: number) => {
        setEvents(prev => prev.map((evt, i) =>
            i === index ? { ...evt, selected: !evt.selected } : evt
        ));
    };

    const removeEvent = (index: number) => {
        setEvents(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveSelected = async () => {
        const selectedEvents = events.filter(e => e.selected);
        if (selectedEvents.length === 0) {
            toast.error('Selecciona al menos un evento');
            return;
        }

        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No usuario");

            let savedCount = 0;
            for (const evt of selectedEvents) {
                const dueDate = new Date(`${evt.date}T${evt.time || '09:00'}:00`);
                if (isNaN(dueDate.getTime())) {
                    console.error('Invalid date for event:', evt);
                    continue;
                }

                // Build description combining source and details
                const descParts = [];
                if (evt.source) descParts.push(`📩 ${evt.source}`);
                if (evt.description) descParts.push(evt.description);
                const description = descParts.join('\n');

                const insertData: any = {
                    user_id: user.id,
                    title: evt.title,
                    description: description || null,
                    due_date: dueDate.toISOString(),
                    has_alarm: true,
                    is_completed: false,
                };

                // If we have a list ID, assign to that list
                if (listId) {
                    insertData.list_id = listId;
                } else {
                    // Find or create default list
                    const { data: lists } = await supabase
                        .from('task_lists')
                        .select('id')
                        .eq('owner_id', user.id)
                        .limit(1);

                    if (lists && lists.length > 0) {
                        insertData.list_id = lists[0].id;
                    }
                }

                const { error } = await supabase.from('tasks').insert(insertData);
                if (error) {
                    console.error('Error saving event:', error);
                } else {
                    savedCount++;
                }
            }

            if (savedCount > 0) {
                toast.success(`✅ ${savedCount} tarea(s) guardada(s) en el calendario`);
                onSuccess();
                handleClose();
            } else {
                toast.error('No se pudo guardar ninguna tarea');
            }
        } catch (error: any) {
            console.error(error);
            toast.error('Error al guardar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const selectedCount = events.filter(e => e.selected).length;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-[95vw] md:max-w-2xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-500" />
                        Escanear Evento
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Sube una captura de pantalla de un mensaje y la IA extraerá los eventos para tu calendario
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">
                    {/* STATE 1: No image yet - Show upload options */}
                    {!previewUrl && !isLoading && (
                        <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <FileImage className="h-8 w-8 text-white" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Añade tu Captura</h2>
                            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                                Captura el email, WhatsApp o mensaje con la información del evento
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                                {/* Gallery */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300"
                                >
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-400/20 to-cyan-400/20 rounded-bl-[60px] -mr-4 -mt-4 group-hover:scale-125 transition-transform duration-300" />
                                    <div className="relative z-10">
                                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300">
                                            <ImagePlus className="h-7 w-7 text-white" />
                                        </div>
                                        <h3 className="font-bold text-lg mb-1">Subir Foto</h3>
                                        <p className="text-xs text-muted-foreground">Selecciona la captura de tu galería</p>
                                    </div>
                                </button>

                                {/* Camera */}
                                <button
                                    onClick={handleCameraCapture}
                                    className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:border-green-300"
                                >
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-400/20 to-green-400/20 rounded-bl-[60px] -mr-4 -mt-4 group-hover:scale-125 transition-transform duration-300" />
                                    <div className="relative z-10">
                                        <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-500 rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300">
                                            <Camera className="h-7 w-7 text-white" />
                                        </div>
                                        <h3 className="font-bold text-lg mb-1">Hacer Foto</h3>
                                        <p className="text-xs text-muted-foreground">Fotografía la pantalla</p>
                                    </div>
                                </button>
                            </div>

                            <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

                            <p className="text-xs text-muted-foreground mt-6 text-center">
                                💡 También puedes compartir una captura directamente desde la galería usando <strong>Compartir → Quioba</strong>
                            </p>
                        </div>
                    )}

                    {/* STATE: Image loaded but not analyzed yet */}
                    {previewUrl && events.length === 0 && !isLoading && (
                        <div className="flex flex-col">
                            <div className="relative bg-slate-900 p-4 flex items-center justify-center max-h-[250px] overflow-hidden">
                                <img
                                    src={previewUrl}
                                    alt="Captura"
                                    className="max-w-full max-h-[230px] object-contain rounded-lg"
                                />
                                <Button
                                    size="icon"
                                    variant="destructive"
                                    className="absolute top-2 right-2 h-8 w-8 opacity-80"
                                    onClick={resetState}
                                    title="Cambiar imagen"
                                >
                                    <Upload className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="p-6 flex flex-col items-center gap-4">
                                <p className="text-sm text-muted-foreground text-center">
                                    Imagen cargada. Pulsa analizar para que la IA extraiga los eventos.
                                </p>
                                <Button
                                    onClick={() => handleAnalyze()}
                                    size="lg"
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
                                >
                                    <Sparkles className="mr-2 h-5 w-5" />
                                    Analizar con IA
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STATE: Loading */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
                            <div className="relative">
                                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                                </div>
                            </div>
                            <p className="font-semibold mt-4 animate-pulse">Analizando mensaje...</p>
                            <p className="text-xs text-muted-foreground mt-1">La IA está leyendo el contenido</p>
                        </div>
                    )}

                    {/* STATE: Results - Editable event cards */}
                    {events.length > 0 && !isLoading && (
                        <div className="p-4 space-y-4">
                            {/* Preview thumbnail */}
                            {previewUrl && (
                                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="w-12 h-12 object-cover rounded-md border"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">Captura analizada</p>
                                        <p className="text-xs text-muted-foreground">{events.length} evento(s) detectado(s)</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => { resetState(); }}>
                                        Cambiar
                                    </Button>
                                </div>
                            )}

                            {/* Success header */}
                            <div className="flex items-center gap-3 text-green-600 dark:text-green-500">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                                    <Check className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold leading-none">¡Eventos Detectados!</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Revisa y edita los datos. Marca los que quieras guardar.
                                    </p>
                                </div>
                            </div>

                            {/* Event cards */}
                            {events.map((evt, idx) => (
                                <div
                                    key={idx}
                                    className={`border rounded-xl p-4 transition-all ${evt.selected
                                            ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                                            : 'border-slate-200 dark:border-slate-700 opacity-60'
                                        }`}
                                >
                                    {/* Header with checkbox and delete */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={evt.selected}
                                                onCheckedChange={() => toggleEventSelection(idx)}
                                                id={`evt-${idx}`}
                                            />
                                            <label htmlFor={`evt-${idx}`} className="text-xs font-medium text-muted-foreground cursor-pointer">
                                                Evento {idx + 1}
                                                {evt.confidence >= 80 && (
                                                    <span className="ml-2 text-green-600">✓ Alta confianza</span>
                                                )}
                                            </label>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeEvent(idx)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    {/* Title */}
                                    <div className="mb-3">
                                        <Label className="text-xs">Título</Label>
                                        <Input
                                            value={evt.title}
                                            onChange={(e) => updateEvent(idx, 'title', e.target.value)}
                                            className="font-semibold"
                                            placeholder="Ej: Prueba de Matemáticas"
                                        />
                                    </div>

                                    {/* Date and Time */}
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <Label className="text-xs">📅 Fecha</Label>
                                            <Input
                                                type="date"
                                                value={evt.date}
                                                onChange={(e) => updateEvent(idx, 'date', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">⏰ Hora</Label>
                                            <Input
                                                type="time"
                                                value={evt.time}
                                                onChange={(e) => updateEvent(idx, 'time', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="mb-2">
                                        <Label className="text-xs">📝 Descripción / Notas</Label>
                                        <Textarea
                                            value={evt.description}
                                            onChange={(e) => updateEvent(idx, 'description', e.target.value)}
                                            rows={2}
                                            className="text-sm resize-none"
                                            placeholder="Páginas, temario, material necesario..."
                                        />
                                    </div>

                                    {/* Source */}
                                    {evt.source && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <span>📩</span> {evt.source}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with actions */}
                {events.length > 0 && !isLoading && (
                    <div className="p-4 border-t bg-background shrink-0 flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setEvents([])}
                            className="flex-1"
                        >
                            Reintentar
                        </Button>
                        <Button
                            onClick={handleSaveSelected}
                            disabled={isSaving || selectedCount === 0}
                            className="flex-[2] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                        >
                            {isSaving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <CalendarPlus className="mr-2 h-4 w-4" />
                            )}
                            Guardar {selectedCount} Tarea{selectedCount !== 1 ? 's' : ''}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

