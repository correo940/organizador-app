'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, FileImage, Check, AlertCircle, Maximize2, ZoomIn, ZoomOut, RotateCw, Trash2, Plus, Camera, ImagePlus } from 'lucide-react';
import { findUserShiftZai, scanFullRosterZai } from '@/lib/zai-ocr';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DEFAULT_SHIFT_TYPES } from './shift-settings-dialog';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface ScanRosterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface ColleagueRow {
    name: string;
    startTime: string;
    endTime: string;
}

export default function ScanRosterDialog({ open, onOpenChange, onSuccess }: ScanRosterDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [digitalRoster, setDigitalRoster] = useState<{ date: string, columns: any[] } | null>(null);
    const [debugText, setDebugText] = useState<string>('');
    const [mySearchName, setMySearchName] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Editing states (single source of truth for the form)
    const [editedShiftTitle, setEditedShiftTitle] = useState<string>('');
    const [editedDate, setEditedDate] = useState<string>('');
    const [editedStartTime, setEditedStartTime] = useState<string>('');
    const [editedEndTime, setEditedEndTime] = useState<string>('');
    const [editedService, setEditedService] = useState<string>('');

    // New Structured Colleague State
    const [editedColleagueRows, setEditedColleagueRows] = useState<ColleagueRow[]>([]);

    const [searchResult, setSearchResult] = useState<any>(null); // Keep original result for reference

    // DEBUG: Store raw API response for visual debugging
    const [debugInfo, setDebugInfo] = useState<string>('');

    // Image manipulation state
    const [zoomLevel, setZoomLevel] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Configurable Shift Types
    const [shiftTypes, setShiftTypes] = useState<any[]>(DEFAULT_SHIFT_TYPES);

    // Fetch Shift Types
    useEffect(() => {
        if (open) {
            const fetchTypes = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase.from('shift_types').select('*').eq('user_id', user.id);
                    if (data && data.length > 0) {
                        setShiftTypes(data);
                    }
                }
            };
            fetchTypes();
        }
    }, [open]);

    const resetState = () => {
        setPreviewUrl(null);
        setDigitalRoster(null);
        setSearchResult(null);
        setDebugText('');
        setZoomLevel(1);
        setRotation(0);
        setEditedShiftTitle('');
        setEditedDate('');
        setEditedStartTime('');
        setEditedEndTime('');
        setEditedColleagueRows([]);
        setEditedService('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Capture photo with device camera (Capacitor)
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
            console.error('Camera capture error:', error);
            // User cancelled or permission denied - don't show error toast for cancel
            if (error.message !== 'User cancelled photos app') {
                toast.error('No se pudo acceder a la cámara');
            }
        }
    };

    const handleAnalyze = async () => {
        if (!previewUrl) return;

        setIsLoading(true);
        setDigitalRoster(null);
        setSearchResult(null);
        setDebugText('');

        try {
            // STRATEGY A: Detective Mode (Name Provided)
            if (mySearchName.length > 2) {
                setDebugText("Analizando cuadrante con IA de Visión (Z.ai)...");
                const result = await findUserShiftZai(previewUrl, mySearchName);

                if (result && result.found) {
                    console.log('[Z.AI] ✅ Result received:', JSON.stringify(result, null, 2));

                    // DEBUG: Store raw result for visual display
                    setDebugInfo(`📊 RESPUESTA Z.AI GLM-4.6V-Flash:
found: ${result.found}
shift: "${result.shift || '(vacío)'}"
service: "${result.service || '(vacío)'}"
startTime: "${result.startTime || '(vacío)'}"
endTime: "${result.endTime || '(vacío)'}"
date: "${result.date || '(vacío)'}"
targetName: "${result.targetName || '(vacío)'}"
colleagues: ${JSON.stringify(result.colleagues || [])}
rawContext: "${result.rawContext || '(vacío)'}"`);

                    setSearchResult(result);
                    // Pre-fill form
                    setEditedShiftTitle(result.shift || 'TEXTO DETECTADO');
                    setEditedDate(result.date || format(new Date(), 'yyyy-MM-dd'));
                    setEditedStartTime(result.startTime || '');
                    setEditedEndTime(result.endTime || '');
                    setEditedService(result.service || '');

                    // Map colleagues
                    if (result.colleagues && result.colleagues.length > 0) {
                        setEditedColleagueRows(result.colleagues.map((c: string) => {
                            if (c.includes('|')) {
                                const [name, start, end] = c.split('|');
                                return { name, startTime: start, endTime: end };
                            }
                            return {
                                name: c,
                                startTime: result.startTime || '',
                                endTime: result.endTime || ''
                            };
                        }));
                    } else {
                        setEditedColleagueRows([]);
                    }
                    toast.success('¡Turno encontrado con IA!');
                } else {
                    setSearchResult(null);
                    toast.error('No se encontró tu nombre en el cuadrante');
                    setDebugText("No se encontró el nombre. Intenta mejorar la imagen o buscar con mejor iluminación.");
                }
            }
            // STRATEGY B: Full Scan (No Name)
            else {
                const result = await scanFullRosterZai(previewUrl);
                if (result) {
                    setDebugText(result.rawText);
                    if (result.columns && result.columns.length > 0) {
                        setDigitalRoster(result);
                        toast.success(`Digitalización completada: ${result.date}`);
                    } else {
                        toast.error('No se pudo estructurar el cuadrante');
                    }
                }
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al analizar la imagen');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        resetState();
        onOpenChange(false);
    };

    // Helper to manage colleague rows
    const updateColleagueRow = (index: number, field: keyof ColleagueRow, value: string) => {
        const newRows = [...editedColleagueRows];
        newRows[index] = { ...newRows[index], [field]: value };
        setEditedColleagueRows(newRows);
    };

    const removeColleagueRow = (index: number) => {
        const newRows = [...editedColleagueRows];
        newRows.splice(index, 1);
        setEditedColleagueRows(newRows);
    };

    const addColleagueRow = () => {
        setEditedColleagueRows([...editedColleagueRows, { name: "", startTime: editedStartTime, endTime: editedEndTime }]);
    };


    const handleSaveToCalendar = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No usuario");

            // Use EDITED values
            // Fix: Strip seconds if present (HH:MM:SS -> HH:MM)
            let start = (editedStartTime || "").trim();
            if (start.length > 5 && start.includes(':')) {
                start = start.substring(0, 5);
            }

            let end = (editedEndTime || "").trim();
            if (end.length > 5 && end.includes(':')) {
                end = end.substring(0, 5);
            }
            const date = editedDate || format(new Date(), 'yyyy-MM-dd');

            // Validate format H:MM or HH:MM
            console.log('DEBUG SAVE ATTEMPT:', { start, end, date });
            // Regex permits "9:00" (d:dd) or "09:00" (dd:dd)
            const timeRegex = /^\d{1,2}:\d{2}$/;

            if (!timeRegex.test(start) || !timeRegex.test(end)) {
                toast.error(`Horario inválido. Inicio: "${start}", Fin: "${end}". Asegúrate de usar el formato HH:MM (ej. 09:00)`);
                setIsSaving(false);
                return;
            }

            // Construct Timestamps
            // Safely construct dates
            const startTimestamp = new Date(`${date}T${start}:00`).toISOString();
            let endTimestampCheck = new Date(`${date}T${end}:00`);

            // Handle Night Shift crossing midnight
            const sDate = new Date(`${date}T${start}:00`);
            if (isNaN(sDate.getTime()) || isNaN(endTimestampCheck.getTime())) {
                toast.error("Error en el formato de fecha/hora.");
                setIsSaving(false);
                return;
            }

            if (endTimestampCheck < sDate) {
                endTimestampCheck.setDate(endTimestampCheck.getDate() + 1);
            }
            const endTimestamp = endTimestampCheck.toISOString();

            // Prepare description with colleagues
            // Format: "Con: Juan (08:00-15:00), Pepe (09:00-17:00)"
            let description: string | undefined = undefined;
            if (editedColleagueRows.length > 0) {
                const colleagueStrings = editedColleagueRows
                    .filter(r => r.name.trim().length > 0)
                    .map(r => {
                        // Check if times differ from main shift to avoid clutter? 
                        // Let's always show time if it matches the format HH:MM
                        if (r.startTime && r.endTime) {
                            return `${r.name} (${r.startTime}-${r.endTime})`;
                        }
                        return r.name;
                    });

                if (colleagueStrings.length > 0) {
                    description = `Con:\n${colleagueStrings.join('\n')}`;
                }
            }

            // Combine Service into title if present
            let finalTitle = `Turno: ${editedShiftTitle}`;
            if (editedService.trim().length > 0) {
                finalTitle += ` (${editedService.toUpperCase()})`;
            }

            // Determine color based on title text
            const upperTitle = editedShiftTitle.toUpperCase();
            const color = upperTitle.includes("NOCHE") ? "#1e293b" : upperTitle.includes("TARDE") ? "#f97316" : "#eab308";

            const { error } = await supabase.from('work_shifts').insert({
                user_id: user.id,
                title: finalTitle,
                description: description,
                start_time: startTimestamp,
                end_time: endTimestamp,
                color: color,
                style: 'dot'
            });

            if (error) throw error;

            toast.success("Turno guardado en el calendario");
            onSuccess();
            handleClose();

        } catch (e: any) {
            console.error(e);
            toast.error("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Zoom/Pan controls
    const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.05, 3));
    const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.05, 1));
    const rotate = () => setRotation(prev => (prev + 90) % 360);

    // Helper to apply fallback schedule
    const applyFallbackSchedule = (type: 'M' | 'T' | 'N') => {
        let s = "", e = "";
        if (type === 'M') { s = "06:00"; e = "14:00"; }
        if (type === 'T') { s = "14:00"; e = "22:00"; }
        if (type === 'N') { s = "22:00"; e = "06:00"; }

        setEditedStartTime(s);
        setEditedEndTime(e);
        // Also update title if empty? Maybe not, keep what OCR found or empty.
        // But we can append to title if it's generic
        if (!editedShiftTitle || editedShiftTitle === "HORARIO NO DETECTADO") {
            setEditedShiftTitle(type === 'M' ? "MAÑANA" : type === 'T' ? "TARDE" : "NOCHE");
        }
    };

    const isTimeMissing = !editedStartTime || editedStartTime === "--:--" || !editedEndTime || editedEndTime === "--:--";

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b shrink-0 bg-background z-10 w-full overflow-hidden">
                    <DialogTitle>Escanear Cuadrante</DialogTitle>
                    <DialogDescription className="text-xs md:text-sm whitespace-normal">
                        Sube la imagen de tu cuadrante, escribe tu nombre o apellido ( la mejor forma de buscarte) y la IA te encontrara, una vez te encuentre, comprueba que los datos sean correctos y guarda para que lo veas en tu cuadrante
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* LEFT (or TOP): Image Area - Always visible if image exists */}
                    {previewUrl ? (
                        <div className={`
                            relative bg-slate-900 overflow-hidden flex flex-col
                            ${searchResult ? 'w-full md:w-1/2 h-1/3 md:h-full border-b md:border-b-0 md:border-r' : 'w-full h-full'}
                         `}>
                            {/* Image Controls */}
                            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                                <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-none" onClick={zoomIn}><ZoomIn className="h-4 w-4" /></Button>
                                <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-none" onClick={zoomOut}><ZoomOut className="h-4 w-4" /></Button>
                                <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-none" onClick={rotate}><RotateCw className="h-4 w-4" /></Button>
                                <Button size="icon" variant="destructive" className="h-8 w-8 opacity-80 hover:opacity-100" onClick={resetState} title="Cambiar imagen"><Upload className="h-4 w-4" /></Button>
                            </div>

                            {/* Image Container with Scroll support */}
                            <div className="flex-1 w-full h-full overflow-auto relative bg-slate-950">
                                <div className={`min-w-full min-h-full flex ${zoomLevel > 1 ? 'items-start justify-start p-0' : 'items-center justify-center p-4'}`}>
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="transition-transform duration-200 ease-out origin-top-left"
                                        style={{
                                            transform: zoomLevel > 1 ? `scale(${zoomLevel})` : `rotate(${rotation}deg)`,
                                            // When not zoomed, we let it fit contained. When zoomed, we let it expand natural size * scale
                                            maxWidth: zoomLevel === 1 ? '100%' : 'none',
                                            maxHeight: zoomLevel === 1 ? '100%' : 'none',
                                            // Rotation logic for fit mode needs specific handling if rotated 90deg, 
                                            // simpler to just apply rotation style if zoom is 1. 
                                            // If zoomed, rotation + scale is complex in CSS without container. 
                                            // For V1 simple zoom:
                                        }}
                                    />
                                    {/* Rotation helper for zoomed state if needed, but simplification: Apply rotation to img always, handle container */}
                                </div>
                            </div>

                            {/* Initial Controls (Overlaid if no result yet) */}
                            {!searchResult && !digitalRoster && !isLoading && (
                                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-4 items-center z-10">
                                    <div className="w-full max-w-sm space-y-2">
                                        <Label className="text-white">Tu Nombre (para resaltar)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Ej. GARCIA"
                                                value={mySearchName}
                                                onChange={(e) => setMySearchName(e.target.value)}
                                                className="bg-white/90 text-black border-none"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                                            />
                                            <Button onClick={handleAnalyze} disabled={mySearchName.length < 3}>
                                                <Maximize2 className="mr-2 h-4 w-4" />
                                                Analizar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isLoading && (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm z-30">
                                    <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                                    <p className="font-semibold animate-pulse">Analizando cuadrante...</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // NO IMAGE STATE - New attractive dual-option UI
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                            {/* Header */}
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                    <FileImage className="h-8 w-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Añade tu Cuadrante</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                                    Elige cómo quieres añadir la imagen de tu cuadrante de turnos
                                </p>
                            </div>

                            {/* Two Option Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                                {/* Gallery Option */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                                >
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-bl-[60px] -mr-4 -mt-4 group-hover:scale-125 transition-transform duration-300" />
                                    <div className="relative z-10">
                                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300">
                                            <ImagePlus className="h-7 w-7 text-white" />
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Subir Foto</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Selecciona una imagen de tu galería</p>
                                    </div>
                                </button>

                                {/* Camera Option */}
                                <button
                                    onClick={handleCameraCapture}
                                    className="group relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-800"
                                >
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-400/20 to-green-400/20 rounded-bl-[60px] -mr-4 -mt-4 group-hover:scale-125 transition-transform duration-300" />
                                    <div className="relative z-10">
                                        <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-500 rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300">
                                            <Camera className="h-7 w-7 text-white" />
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Hacer Foto</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Usa la cámara para fotografiar</p>
                                    </div>
                                </button>
                            </div>

                            {/* Hidden file input */}
                            <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

                            {/* Helper text */}
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-8 text-center max-w-md">
                                💡 Tip: Para mejores resultados, asegúrate de que la imagen esté bien iluminada y los nombres sean legibles
                            </p>
                        </div>
                    )}

                    {/* RIGHT (or BOTTOM): Result / Form Area - Only visible if we have a result */}
                    {searchResult && (
                        <div className="w-full md:w-1/2 h-2/3 md:h-full flex flex-col bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                            <div className="p-6 flex-1 overflow-y-auto">
                                <div className="mb-6 flex items-center gap-3 text-green-600 dark:text-green-500">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                                        <Check className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg leading-none">¡Turno Encontrado!</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Por favor verifica los datos antes de guardar.</p>
                                    </div>
                                </div>

                                {/* DEBUG PANEL - Shows raw IA response */}
                                {debugInfo && (
                                    <details className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs">
                                        <summary className="font-bold cursor-pointer text-blue-600 dark:text-blue-400">🔍 Ver respuesta de IA (DEBUG)</summary>
                                        <pre className="mt-2 whitespace-pre-wrap overflow-x-auto text-[10px] leading-relaxed font-mono">{debugInfo}</pre>
                                    </details>
                                )}

                                {/* FALLBACK WARNING & OPTIONS */}
                                {isTimeMissing && (
                                    <div className="mb-6 p-4 border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900 rounded-lg">
                                        <div className="flex gap-2 items-start mb-3">
                                            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-500 mt-0.5" />
                                            <div>
                                                <h4 className="font-semibold text-orange-800 dark:text-orange-400">Horario no detectado</h4>
                                                <p className="text-sm text-orange-700 dark:text-orange-300">
                                                    No hemos podido leer las horas exactas. Selecciona una opción rápida:
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                                                onClick={() => applyFallbackSchedule('M')}
                                            >
                                                <div className="flex flex-col items-center py-1">
                                                    <span className="font-bold">Mañana</span>
                                                    <span className="text-[10px]">06:00 - 14:00</span>
                                                </div>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="flex-1 border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                                                onClick={() => applyFallbackSchedule('T')}
                                            >
                                                <div className="flex flex-col items-center py-1">
                                                    <span className="font-bold">Tarde</span>
                                                    <span className="text-[10px]">14:00 - 22:00</span>
                                                </div>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="flex-1 border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                                                onClick={() => applyFallbackSchedule('N')}
                                            >
                                                <div className="flex flex-col items-center py-1">
                                                    <span className="font-bold">Noche</span>
                                                    <span className="text-[10px]">22:00 - 06:00</span>
                                                </div>
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <Label>Nombre del Turno</Label>
                                            <Input
                                                value={editedShiftTitle}
                                                onChange={(e) => setEditedShiftTitle(e.target.value)}
                                                className="font-bold text-lg"
                                            />
                                        </div>

                                        <div className="col-span-2 sm:col-span-1">
                                            <Label>Fecha</Label>
                                            <Input
                                                type="date"
                                                value={editedDate}
                                                onChange={(e) => setEditedDate(e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <Label>Fecha (Original)</Label>
                                            <div className="text-xs p-2 bg-muted rounded border mt-1 truncate">
                                                {searchResult.date}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Hora Inicio</Label>
                                            <Input
                                                type="time"
                                                value={editedStartTime}
                                                onChange={(e) => setEditedStartTime(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label>Hora Fin</Label>
                                            <Input
                                                type="time"
                                                value={editedEndTime}
                                                onChange={(e) => setEditedEndTime(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* STRUCTURED COLLEAGUES LIST */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <Label>Compañeros y Horarios</Label>
                                            <Button variant="ghost" size="sm" onClick={addColleagueRow} className="h-6 px-2 text-xs">
                                                <Plus className="h-3 w-3 mr-1" /> Añadir
                                            </Button>
                                        </div>

                                        <div className="space-y-2 border rounded-md p-2 bg-muted/10 max-h-60 overflow-y-auto">
                                            {editedColleagueRows.length === 0 && (
                                                <p className="text-xs text-muted-foreground text-center py-2">No se han detectado compañeros.</p>
                                            )}

                                            {editedColleagueRows.map((row, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <Input
                                                        value={row.name}
                                                        onChange={(e) => updateColleagueRow(idx, 'name', e.target.value)}
                                                        placeholder="Nombre"
                                                        className="flex-1 h-8 text-xs"
                                                    />
                                                    <Input
                                                        type="time"
                                                        value={row.startTime}
                                                        onChange={(e) => updateColleagueRow(idx, 'startTime', e.target.value)}
                                                        className="w-20 h-8 text-xs px-1"
                                                    />
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                    <Input
                                                        type="time"
                                                        value={row.endTime}
                                                        onChange={(e) => updateColleagueRow(idx, 'endTime', e.target.value)}
                                                        className="w-20 h-8 text-xs px-1"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                                        onClick={() => removeColleagueRow(idx)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Ajusta los horarios individuales para cada compañero si difieren de tu turno.
                                        </p>
                                    </div>

                                    <div>
                                        <Label>Servicio / Puesto</Label>
                                        <Input
                                            value={editedService}
                                            onChange={(e) => setEditedService(e.target.value)}
                                            placeholder="Ej. PUERTAS, RASTRILLO..."
                                        />
                                    </div>

                                    {/* Raw Context for Reference */}
                                    <div className="mt-6 pt-4 border-t">
                                        <Label className="text-xs text-muted-foreground mb-2 block">Contexto Original (Referencia):</Label>
                                        <div className="text-xs font-mono bg-muted/50 p-3 rounded max-h-32 overflow-y-auto whitespace-pre-wrap border select-all">
                                            {searchResult.rawContext}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t bg-background shrink-0 flex gap-3">
                                <Button variant="outline" onClick={() => setSearchResult(null)} className="flex-1">
                                    Reintentar / Cancelar
                                </Button>
                                <Button onClick={handleSaveToCalendar} disabled={isSaving} className="flex-[2]">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                    Confirmar y Guardar
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Fallback View */}
                    {digitalRoster && !searchResult && (
                        <div className="w-full md:w-1/2 h-full bg-background p-4 overflow-y-auto">
                            <h3 className="font-bold text-center mb-4">Vista Digital (Modo Exploración)</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {digitalRoster.columns.map((col: any, idx: number) => (
                                    <div key={idx} className="border p-2 rounded text-xs">
                                        <div className="font-bold bg-muted p-1 mb-1">{col.title}</div>
                                        <div>{col.names.join(', ')}</div>
                                    </div>
                                ))}
                            </div>
                            <Button className="w-full mt-4" variant="outline" onClick={() => setDigitalRoster(null)}>Volver</Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

