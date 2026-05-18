'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, Calendar as CalendarIcon, FileText, Image as ImageIcon, X, ZoomIn, ZoomOut, RotateCw, Check, RefreshCw, AlertTriangle, Brain, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, getDaysInMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { DEFAULT_SHIFT_TYPES } from './shift-settings-dialog';
import { scanFullRosterZai, callZaiVision } from '@/lib/zai-ocr'; // Added Z.ai import

interface BulkImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface ShiftType {
    code: string;
    label: string;
    start_time: string;
    end_time: string;
    color: string;
}

export default function BulkImportDialog({ open, onOpenChange, onSuccess }: BulkImportDialogProps) {
    const [activeTab, setActiveTab] = useState('text');
    const [textInput, setTextInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [previewShifts, setPreviewShifts] = useState<any[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [startDay, setStartDay] = useState(1);
    const [aiInstructions, setAiInstructions] = useState(''); // Added AI Instructions state
    const [showWarning, setShowWarning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Configurable Shift Types
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(DEFAULT_SHIFT_TYPES);

    // Fetch Shift Types
    useEffect(() => {
        if (open) {
            const fetchTypes = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase.from('shift_types').select('*').eq('user_id', user.id);
                    if (data && data.length > 0) {
                        setShiftTypes(data);
                    } else {
                        setShiftTypes(DEFAULT_SHIFT_TYPES);
                    }
                }
            };
            fetchTypes();
        }
    }, [open]);

    // Helper: Find shift by code
    const getShiftByCode = (code: string) => {
        return shiftTypes.find(s => s.code === code);
    };

    // Helper: Generate shifts form text
    const generateShiftsFromText = (text: string) => {
        const tokens = text.replace(/\n/g, ' ').split(/[\s,]+/).filter(t => t.trim().length > 0);
        const year = parseInt(selectedMonth.split('-')[0]);
        const monthIndex = parseInt(selectedMonth.split('-')[1]) - 1; // 0-indexed
        const daysInMonth = getDaysInMonth(new Date(year, monthIndex));

        const shifts: any[] = [];
        let dayCounter = startDay; // Use manual start day

        // If tokens contain numbers, we respect them. If not, we increment.
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i].toUpperCase();

            // Check if token is a day number (1-31)
            if (!isNaN(Number(token)) && Number(token) <= 31) {
                dayCounter = Number(token);
                continue; // It's a day marker, next token is the shift
            }

            if (dayCounter > daysInMonth) break;

            // Check if valid code
            const foundShift = getShiftByCode(token);
            if (foundShift || token === "SALIENTE") {
                const date = new Date(year, monthIndex, dayCounter);
                const dateStr = format(date, 'yyyy-MM-dd');
                const displayDate = format(date, 'EEE d', { locale: es });

                if (token === "SALIENTE") {
                    // No-op for Saliente or add as info?
                    // Currently ignored or just used for alignment
                } else if (foundShift) {
                    shifts.push({
                        title: foundShift.label, // Use configured label
                        start: foundShift.start_time,
                        end: foundShift.end_time,
                        color: foundShift.color,
                        dateStr,
                        displayDate,
                        originalToken: token
                    });
                }
                dayCounter++;
            }
        }
        return shifts;
    };

    // --- TEXT PARSER ---
    const parseTextSequence = () => {
        if (!textInput.trim()) return;
        setIsLoading(true);
        const shifts = generateShiftsFromText(textInput);
        setPreviewShifts(shifts);
        setIsLoading(false);
        if (shifts.length === 0) {
            toast.warning("No se detectaron turnos válidos en el texto.");
        }
    };

    // Auto-update preview when text changes (Debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'text' && textInput) {
                const shifts = generateShiftsFromText(textInput);
                setPreviewShifts(shifts);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [textInput, selectedMonth]);


    // --- PHOTO PARSER (Z.AI GLM-4.6V-FLASH) ---
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setPreviewShifts([]);

        // Convert to base64 for preview and sending
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        setImagePreview(base64);
        setShowWarning(true);

        try {
            // Updated Prompt for higher accuracy and better instruction following
            const prompt = `Eres un experto en visión artificial especializado en la lectura de cuadrantes de turnos de trabajo complejos.
            
### CONTEXTO CRÍTICO (Prioridad Máxima - Reglas de Oro):
Estas son las instrucciones proporcionadas por el usuario para este cuadrante específico. Debes seguirlas AL PIE DE LA LETRA:
${aiInstructions || "No hay instrucciones específicas, usa tu lógica estándar para cuadrantes españoles."}

### DICCIONARIO DE TURNOS DISPONIBLES EN EL SISTEMA:
Los códigos válidos que el sistema puede procesar son: ${shiftTypes.map(s => s.code).join(', ')}.
Si el usuario indica que un símbolo significa algo, mapealo a uno de estos códigos o al texto exacto que pida.

### TAREAS:
1. Analiza visualmente la imagen buscando la fila de turnos del empleado (o la secuencia principal).
2. Si ves iconos (estrellas, flechas, puntos) o colores, usa las INSTRUCCIONES DEL USUARIO arriba para traducirlos a códigos.
3. Extrae la secuencia cronológica de turnos.
4. Identifica los días (1, 2, 3...) y emparéjalos con su turno.

### REGLA DE SALIDA:
- Devuelve una cadena de texto plana con el formato: "Día Turno Día Turno...". 
- Ejemplo: "1 M 2 M 3 T 4 T 5 N 6 L".
- NO incluyas introducciones, NO incluyas markdown, NO incluyas bloques de código.
- SOLO la secuencia de texto limpia.`;

            const { content } = await callZaiVision(base64, prompt);

            if (!content) {
                throw new Error("La IA no devolvió ningún contenido.");
            }

            setTextInput(content.trim());
            toast.success("Cuadrante leído correctamente.");

            // Switch to Text Tab to see the result
            setActiveTab('text');

        } catch (err: any) {
            console.error(err);
            toast.error("Ha fallado la lectura. Inténtalo de nuevo, los servidores pueden estar saturados.");
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // --- SAVE ---
    const handleSave = async () => {
        // UX Enhancement: If they have text but no preview (maybe didn't wait for debounce), parse now
        let shiftsToSave = previewShifts;
        if (shiftsToSave.length === 0 && textInput.trim()) {
            shiftsToSave = generateShiftsFromText(textInput);
        }

        if (shiftsToSave.length === 0) {
            toast.error("No hay turnos para importar. Revisa el texto.");
            return;
        }

        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user");

            const inserts = shiftsToSave.map(s => {
                // Normalize times to HH:mm (strip seconds if present)
                const startTime = s.start.substring(0, 5); // "07:00:00" -> "07:00"
                const endTime = s.end.substring(0, 5);

                const start = new Date(`${s.dateStr}T${startTime}:00`);
                let end = new Date(`${s.dateStr}T${endTime}:00`);
                if (end < start) end.setDate(end.getDate() + 1);

                return {
                    user_id: user.id,
                    title: `Turno: ${s.title}`,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                    color: s.color
                };
            });

            const { error } = await supabase.from('work_shifts').insert(inserts);
            if (error) throw error;

            toast.success(`${inserts.length} turnos importados correctamente.`);
            onSuccess();
            onOpenChange(false);
        } catch (e: any) {
            toast.error("Error al guardar: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- IMAGE MANIPULATION STATE ---
    const [zoomLevel, setZoomLevel] = useState(1);
    const [rotation, setRotation] = useState(0);

    const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 3));
    const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 1));
    const rotate = () => setRotation(prev => (prev + 90) % 360);
    const resetImage = () => {
        setImagePreview(null);
        setZoomLevel(1);
        setRotation(0);
        setShowWarning(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[98vw] w-full h-[98vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b shrink-0 bg-background z-10 w-full overflow-hidden flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle>Insertar Cuadrante</DialogTitle>
                        <DialogDescription className="hidden md:block">
                            Copia texto o usa el escáner OCR para importar múltiples turnos.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">

                    {/* LEFT PANEL: IMAGE VIEWER (If Image exists) OR UPLOAD/TABS (If no image) */}
                    {imagePreview ? (
                        <div className="relative w-full md:w-[40%] h-1/3 md:h-full bg-slate-900 overflow-hidden flex flex-col border-b md:border-b-0 md:border-r">
                            {/* Image Controls */}
                            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                                <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-none" onClick={zoomIn}><ZoomIn className="h-4 w-4" /></Button>
                                <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-none" onClick={zoomOut}><ZoomOut className="h-4 w-4" /></Button>
                                <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-none" onClick={rotate}><RotateCw className="h-4 w-4" /></Button>
                                <Button size="icon" variant="destructive" className="h-8 w-8 opacity-80 hover:opacity-100" onClick={resetImage} title="Cerrar Imagen">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Image Container */}
                            <div className="flex-1 w-full h-full overflow-auto relative bg-slate-950 flex items-center justify-center p-4">
                                <div className={`min-w-full min-h-full flex ${zoomLevel > 1 ? 'items-start justify-start' : 'items-center justify-center'}`}>
                                    <img
                                        src={imagePreview}
                                        alt="Roster Preview"
                                        className="transition-transform duration-200 ease-out origin-center"
                                        style={{
                                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                                            maxWidth: zoomLevel === 1 ? '100%' : 'none',
                                            maxHeight: zoomLevel === 1 ? '100%' : 'none',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Loading Overlay */}
                            {isLoading && (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm z-30">
                                    <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                                    <p className="font-semibold animate-pulse">Analizando imagen...</p>
                                </div>
                            )}

                            {/* WARNING OVERLAY */}
                            {showWarning && (
                                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                                    <div className="bg-card border shadow-lg max-w-sm md:max-w-md w-full p-6 rounded-xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
                                        <div className="h-12 w-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-4">
                                            <AlertTriangle className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-lg font-bold mb-2">Verifica el Resultado</h3>
                                        <p className="text-muted-foreground mb-6 text-sm">
                                            Comprueba el resultado mostrado con la fotografía original y modifica los cambios necesarios. La lectura automática puede contener errores.
                                        </p>
                                        <Button className="w-full font-bold" onClick={() => setShowWarning(false)}>
                                            He entendido
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // NO IMAGE: Show Standard Selection (Tabs or just Split)
                        <div className="w-full h-full flex flex-col p-6 bg-muted/10">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4" /> Texto / Manual</TabsTrigger>
                                    <TabsTrigger value="photo"><ImageIcon className="mr-2 h-4 w-4" /> Subir Foto</TabsTrigger>
                                </TabsList>

                                <TabsContent value="text" className="flex-1 flex flex-col gap-4 border p-4 rounded-lg bg-background shadow-sm">
                                    <div className="space-y-4 flex-1 flex flex-col">
                                        <div className="flex items-center gap-4">
                                            <label className="text-sm font-medium whitespace-nowrap">Mes de Destino:</label>
                                            <input
                                                type="month"
                                                value={selectedMonth}
                                                onChange={e => setSelectedMonth(e.target.value)}
                                                className="p-2 border rounded bg-background w-full"
                                            />
                                        </div>
                                        <Textarea
                                            placeholder="Pegar secuencia aquí..."
                                            className="flex-1 resize-none font-mono"
                                            value={textInput}
                                            onChange={e => setTextInput(e.target.value)}
                                        />
                                        <Button onClick={parseTextSequence} disabled={!textInput}>
                                            Procesar Texto
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="photo" className="flex-1 border rounded-lg bg-background shadow-sm flex flex-col border-dashed relative overflow-y-auto custom-scrollbar p-0">
                                    <div className="flex flex-col items-center justify-center min-h-full p-8 space-y-8">
                                        <div className="text-center cursor-pointer hover:bg-muted/50 p-8 rounded-xl transition-all w-full max-w-sm border-2 border-dashed border-primary/20 hover:border-primary/50" onClick={() => fileInputRef.current?.click()}>
                                            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                                <Upload className="h-8 w-8" />
                                            </div>
                                            <h3 className="text-lg font-bold">Subir Cuadrante</h3>
                                            <p className="text-xs text-muted-foreground mt-2">Haz una foto o selecciona un archivo</p>
                                        </div>

                                        <div className="w-full max-w-sm space-y-3 bg-muted/20 p-6 rounded-2xl border border-muted-foreground/10">
                                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                <Brain className="w-3.5 h-3.5 text-indigo-500" />
                                                <span>Instrucciones para la IA</span>
                                            </div>
                                            <Textarea
                                                placeholder="Ej: La estrella es noche, la 'L' es libre, ignora la primera fila..."
                                                className="text-xs resize-none h-24 bg-background border-dashed hover:border-indigo-400 focus:border-indigo-500 transition-colors shadow-sm"
                                                value={aiInstructions}
                                                onChange={(e) => setAiInstructions(e.target.value)}
                                            />
                                            <p className="text-[10px] text-muted-foreground italic leading-tight">
                                                Esto ayuda a la IA a entender mejor tus símbolos personalizados. Estos datos se enviarán junto con la imagen.
                                            </p>
                                        </div>
                                    </div>

                                    <InputFile ref={fileInputRef} onChange={handlePhotoUpload} />
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}

                    {/* RIGHT PANEL: RESULTS / EDITING */}
                    {imagePreview && (
                        <div className="w-full md:w-[60%] h-2/3 md:h-full flex flex-col bg-background border-l">
                            <div className="p-4 border-b flex justify-between items-center bg-muted/20 shrink-0">
                                <h3 className="font-bold flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Texto Detectado / Editar
                                </h3>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium">Mes:</label>
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={e => setSelectedMonth(e.target.value)}
                                        className="p-1 border rounded bg-background text-xs"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
                                {/* Top: Options Row */}
                                <div className="flex flex-wrap gap-4 shrink-0 bg-muted/20 p-2 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-medium">Día Inicio:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={startDay}
                                            onChange={e => setStartDay(parseInt(e.target.value) || 1)}
                                            className="w-12 p-1 border rounded bg-background text-xs text-center"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground">Si el OCR no lee los números de día, ajusta aquí el primer día del cuadrante.</span>
                                    </div>
                                </div>

                                {/* Shared Container for Input and Preview */}
                                <div className="flex-1 min-h-0 flex flex-col gap-4">
                                    {/* Text Input */}
                                    <div className="h-44 shrink-0 flex flex-col min-h-0">
                                        <label className="text-[11px] font-bold mb-1.5 ml-1 text-muted-foreground uppercase tracking-wide">Texto Detectado / Manual</label>
                                        <Textarea
                                            placeholder="El texto detectado aparecerá aquí..."
                                            className="flex-1 resize-none font-mono text-sm p-4 leading-relaxed border-input bg-muted/5 focus:bg-background transition-colors rounded-xl shadow-inner shadow-black/5"
                                            value={textInput}
                                            onChange={e => setTextInput(e.target.value)}
                                        />
                                        <div className="text-[10px] text-muted-foreground mt-1.5 text-right font-medium">
                                            {textInput.length} caracteres
                                        </div>
                                    </div>

                                    {/* Preview Grid */}
                                    <div className="flex-1 flex flex-col min-h-0 border rounded-2xl bg-muted/5 overflow-hidden shadow-inner">
                                        <div className="bg-muted/20 backdrop-blur-sm p-3 text-xs font-bold border-b flex justify-between shrink-0 items-center">
                                            <span className="uppercase tracking-wider opacity-70">Vista Previa ({previewShifts.length} turnos)</span>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs px-3 bg-background/50 hover:bg-background shadow-sm transition-all rounded-full" onClick={parseTextSequence}>
                                                <RefreshCw className="h-3 w-3 mr-2" /> Actualizar
                                            </Button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                            {previewShifts.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-xs p-6 opacity-70">
                                                    <div className="p-4 bg-muted rounded-full mb-3">
                                                        <AlertTriangle className="w-6 h-6" />
                                                    </div>
                                                    <p className="font-semibold text-sm">No se reconocen turnos.</p>
                                                    <p className="mt-1">Verifica que el texto contenga códigos válidos (M, T, N...).</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                    {previewShifts.map((s, i) => (
                                                        <div key={i} className="relative group transition-all duration-300">
                                                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-black/5 dark:from-white/5 dark:to-transparent rounded-xl -z-10 transition-opacity group-hover:opacity-100 opacity-0" />
                                                            <div className="text-xs border rounded-xl p-3 flex flex-col gap-2 bg-background shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all relative overflow-hidden ring-1 ring-black/5">
                                                                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: s.color }} />
                                                                <div className="pl-2 flex justify-between items-start">
                                                                    <span className="font-black text-[10px] uppercase text-muted-foreground/80 tracking-tighter">{s.displayDate}</span>
                                                                    <div className="w-5 h-5 rounded-full bg-muted/30 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                                        {format(new Date(s.dateStr), 'd')}
                                                                    </div>
                                                                </div>
                                                                <div className="pl-2 flex flex-col">
                                                                    <div className="font-bold text-sm tracking-tight text-foreground/90 truncate">
                                                                        {s.title.replace('Turno: ', '')}
                                                                    </div>
                                                                    <div className="text-[10px] font-medium text-muted-foreground/60 flex items-center gap-1 mt-1">
                                                                        <Clock className="w-2.5 h-2.5" />
                                                                        {s.start} - {s.end}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
                                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                                <Button onClick={handleSave} disabled={isLoading || previewShifts.length === 0}>
                                    {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                                    Confirmar e Importar
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

const InputFile = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input type="file" accept="image/*" className="hidden" ref={ref} {...props} />
));
InputFile.displayName = "InputFile";
