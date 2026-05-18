'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, RotateCcw, Save, X, Settings } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const DEFAULT_SHIFT_TYPES = [
    { code: 'M', label: 'MAÑANA', start_time: '07:00', end_time: '15:00', color: '#eab308' },
    { code: 'T', label: 'TARDE', start_time: '15:00', end_time: '23:00', color: '#f97316' },
    { code: 'N', label: 'NOCHE', start_time: '23:00', end_time: '07:00', color: '#60a5fa' },
    { code: 'SALIENTE', label: 'SALIENTE DE SERVICIO', start_time: '00:00', end_time: '00:00', color: '#64748b' },
    { code: 'L', label: 'LIBRE', start_time: '00:00', end_time: '00:00', color: '#9ca3af' },
    { code: 'DS', label: 'DESCANSO SEMANAL', start_time: '00:00', end_time: '00:00', color: '#4ade80' },
    { code: 'DF', label: 'DESCANSO FESTIVO', start_time: '00:00', end_time: '00:00', color: '#34d399' },
    { code: 'DND', label: 'LIBRE DND', start_time: '00:00', end_time: '00:00', color: '#2dd4bf' },
    { code: 'DAS', label: 'LIBRE DAS', start_time: '00:00', end_time: '00:00', color: '#fb923c' },
    { code: 'PAP', label: 'ASUNTOS PROPIOS', start_time: '00:00', end_time: '00:00', color: '#818cf8' },
    { code: 'V', label: 'VACACIONES', start_time: '00:00', end_time: '00:00', color: '#f472b6' },
    { code: 'BA', label: 'BAJA', start_time: '00:00', end_time: '00:00', color: '#94a3b8' }
];

interface ShiftType {
    id?: string;
    code: string;
    label: string;
    start_time: string;
    end_time: string;
    color: string;
}

interface ShiftSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function ShiftSettingsDialog({ open, onOpenChange }: ShiftSettingsDialogProps) {
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newShift, setNewShift] = useState<ShiftType>({
        code: '',
        label: '',
        start_time: '08:00',
        end_time: '15:00',
        color: '#000000'
    });

    useEffect(() => {
        if (open) {
            console.log("[ShiftSettings] Dialog opened, pre-fetching user...");
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    console.log("[ShiftSettings] User pre-fetched:", user.id);
                    setUserId(user.id);
                } else {
                    console.error("[ShiftSettings] No user found on mount");
                }
            });
            fetchShiftTypes();
        }
    }, [open]);

    const fetchShiftTypes = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error("[ShiftSettings] Cannot fetch types: No user session");
                return;
            }
            if (!userId) setUserId(user.id);

            const { data, error } = await supabase
                .from('shift_types')
                .select('*')
                .order('code', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                console.log("[ShiftSettings] No types found, seeding defaults...");
                // Auto-seed defaults if empty
                const inserts = DEFAULT_SHIFT_TYPES.map(d => ({ ...d, user_id: user.id }));
                const { error: insertError } = await supabase.from('shift_types').insert(inserts);

                if (insertError) {
                    console.error("[ShiftSettings] Error seeding defaults:", insertError);
                    toast.error("Error al cargar valores por defecto: " + insertError.message);
                    setShiftTypes(DEFAULT_SHIFT_TYPES as any); // Fallback to local state
                } else {
                    console.log("[ShiftSettings] Defaults seeded successfully.");
                    fetchShiftTypes();
                }
            } else {
                setShiftTypes(data);
            }
        } catch (error: any) {
            console.error('[ShiftSettings] Error fetching types:', error);
            toast.error("Error al cargar tipos de turno: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreDefaults = async () => {
        if (!confirm('¿Seguro que quieres borrar tu configuración actual y restaurar los valores por defecto?')) return;
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Delete current
            const { error: delError } = await supabase.from('shift_types').delete().eq('user_id', user.id);
            if (delError) throw delError;

            // Insert defaults
            const inserts = DEFAULT_SHIFT_TYPES.map(d => ({ ...d, user_id: user.id }));
            const { error: insError } = await supabase.from('shift_types').insert(inserts);

            if (insError) throw insError;

            toast.success("Valores por defecto restaurados.");
            fetchShiftTypes();
        } catch (e: any) {
            console.error("[ShiftSettings] Error restoring defaults:", e);
            toast.error("Error al restaurar: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este tipo de turno?")) return;
        setIsLoading(true);
        try {
            const { error } = await supabase.from('shift_types').delete().eq('id', id);
            if (error) throw error;
            toast.success("Eliminado correctamente.");
            fetchShiftTypes();
        } catch (e: any) {
            toast.error("Error al eliminar: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper: get user ID with timeout protection
    const getUserIdSafe = async (): Promise<string | null> => {
        // 1. Check cached userId state
        if (userId) return userId;

        // 2. Try getSession first (faster, uses local cache)
        try {
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
            const result = await Promise.race([sessionPromise, timeoutPromise]);

            if (result && 'data' in result && result.data.session?.user) {
                const uid = result.data.session.user.id;
                setUserId(uid);
                return uid;
            }
        } catch (e) {
            console.warn("[ShiftSettings] getSession failed:", e);
        }

        // 3. Fall back to getUser with timeout
        try {
            const userPromise = supabase.auth.getUser();
            const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
            const result = await Promise.race([userPromise, timeoutPromise]);

            if (result && 'data' in result && result.data.user) {
                const uid = result.data.user.id;
                setUserId(uid);
                return uid;
            }
        } catch (e) {
            console.warn("[ShiftSettings] getUser failed:", e);
        }

        return null;
    };

    const handleAdd = async () => {
        try {
            console.log("[ShiftSettings] handleAdd started. Cached userId:", userId);

            if (!newShift.code || !newShift.label) {
                toast.error("Por favor, rellena el código y el nombre del turno.");
                return;
            }

            // Get user ID with timeout protection
            const activeUserId = await getUserIdSafe();
            console.log("[ShiftSettings] Resolved userId:", activeUserId);

            if (!activeUserId) {
                toast.error("No se ha podido detectar tu usuario. Por favor, cierra sesión y vuelve a entrar.");
                return;
            }

            setIsLoading(true);

            // Defensive: ensure time format
            let startTime = newShift.start_time;
            if (startTime.length === 5) startTime += ':00';

            let endTime = newShift.end_time;
            if (endTime.length === 5) endTime += ':00';

            const payload = {
                code: newShift.code.toUpperCase().trim(),
                label: newShift.label.trim(),
                start_time: startTime,
                end_time: endTime,
                color: newShift.color,
                user_id: activeUserId
            };

            console.log("[ShiftSettings] Sending INSERT payload:", JSON.stringify(payload));

            const { data, error } = await supabase
                .from('shift_types')
                .insert([payload])
                .select();

            console.log("[ShiftSettings] Supabase response - data:", data, "error:", error);

            if (error) {
                console.error("[ShiftSettings] INSERT ERROR:", JSON.stringify(error));
                if (error.code === '42501') {
                    throw new Error("Error de permisos. Cierra sesión e inicia de nuevo.");
                }
                if (error.code === '23505') {
                    throw new Error(`El código "${newShift.code}" ya existe.`);
                }
                throw new Error(error.message || "Error desconocido de base de datos");
            }

            console.log("[ShiftSettings] INSERT OK:", data);
            toast.success("Turno añadido correctamente.");

            setNewShift({ code: '', label: '', start_time: '08:00', end_time: '15:00', color: '#000000' });
            await fetchShiftTypes();
        } catch (e: any) {
            console.error("[ShiftSettings] EXCEPTION:", e);
            toast.error(e.message || "Error inesperado al guardar.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdate = async (type: ShiftType) => {
        if (!type.id) return;
        setIsLoading(true);
        try {
            // Defensive: ensure time has :00 if missing
            const startTime = type.start_time.includes(':') && type.start_time.split(':').length === 2
                ? `${type.start_time}:00`
                : type.start_time;

            const endTime = type.end_time.includes(':') && type.end_time.split(':').length === 2
                ? `${type.end_time}:00`
                : type.end_time;

            const { error } = await supabase.from('shift_types').update({
                code: type.code.toUpperCase().trim(),
                label: type.label.trim(),
                start_time: startTime,
                end_time: endTime,
                color: type.color
            }).eq('id', type.id);

            if (error) {
                if (error.code === '23505') {
                    throw new Error(`El código de turno "${type.code}" ya existe.`);
                }
                throw error;
            }

            toast.success("Tipo de turno actualizado correctamente.");
            setEditingId(null);
            fetchShiftTypes();
        } catch (e: any) {
            console.error("[ShiftSettings] Error updating type:", e);
            toast.error(e.message || "Error al actualizar el tipo de turno.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Configuración de Tipos de Turno</DialogTitle>
                    <DialogDescription>
                        Define las abreviaturas (códigos) que detectará el escáner y sus colores.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-end p-2 border-b">
                    <Button variant="outline" size="sm" onClick={handleRestoreDefaults} className="text-xs">
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Restaurar Valores por Defecto
                    </Button>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {/* Add New */}
                    <div className="p-4 border rounded bg-muted/20 flex flex-wrap gap-2 items-end">
                        <div className="w-20">
                            <Label className="text-xs">Código (OCR)</Label>
                            <Input value={newShift.code} onChange={e => setNewShift({ ...newShift, code: e.target.value.toUpperCase() })} placeholder="Ej. M" className="uppercase" />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                            <Label className="text-xs">Nombre</Label>
                            <Input value={newShift.label} onChange={e => setNewShift({ ...newShift, label: e.target.value })} placeholder="Ej. Mañana" />
                        </div>
                        <div className="w-24">
                            <Label className="text-xs">Inicio</Label>
                            <Input type="time" value={newShift.start_time} onChange={e => setNewShift({ ...newShift, start_time: e.target.value })} />
                        </div>
                        <div className="w-24">
                            <Label className="text-xs">Fin</Label>
                            <Input type="time" value={newShift.end_time} onChange={e => setNewShift({ ...newShift, end_time: e.target.value })} />
                        </div>
                        <div className="">
                            <Label className="text-xs block mb-2">Color</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={newShift.color}
                                    onChange={e => setNewShift({ ...newShift, color: e.target.value })}
                                    className="h-9 w-9 p-1 rounded cursor-pointer"
                                />
                            </div>
                        </div>
                        <Button size="icon" onClick={handleAdd} disabled={isLoading} className="mb-0.5">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                        {shiftTypes.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">
                                No hay tipos definidos. Pulsa "Restaurar" para empezar.
                            </p>
                        )}
                        {shiftTypes.map(type => (
                            <div key={type.id} className="flex flex-wrap items-center gap-2 p-2 border rounded bg-card hover:bg-accent/50 transition-colors">
                                {editingId === type.id ? (
                                    <>
                                        <Input className="w-16 uppercase font-bold" value={type.code} onChange={e => {
                                            const newVal = { ...type, code: e.target.value.toUpperCase() };
                                            setShiftTypes(prev => prev.map(p => p.id === type.id ? newVal : p));
                                        }} />
                                        <Input className="flex-1 min-w-[100px]" value={type.label} onChange={e => {
                                            const newVal = { ...type, label: e.target.value };
                                            setShiftTypes(prev => prev.map(p => p.id === type.id ? newVal : p));
                                        }} />
                                        <Input type="time" className="w-24" value={type.start_time} onChange={e => {
                                            const newVal = { ...type, start_time: e.target.value };
                                            setShiftTypes(prev => prev.map(p => p.id === type.id ? newVal : p));
                                        }} />
                                        <Input type="time" className="w-24" value={type.end_time} onChange={e => {
                                            const newVal = { ...type, end_time: e.target.value };
                                            setShiftTypes(prev => prev.map(p => p.id === type.id ? newVal : p));
                                        }} />
                                        <input type="color" className="h-9 w-9 rounded cursor-pointer" value={type.color} onChange={e => {
                                            const newVal = { ...type, color: e.target.value };
                                            setShiftTypes(prev => prev.map(p => p.id === type.id ? newVal : p));
                                        }} />
                                        <Button size="icon" variant="ghost" onClick={() => handleUpdate(type)}><Save className="h-4 w-4 text-green-500" /></Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 font-bold text-lg flex items-center justify-center bg-muted rounded h-9">
                                            {type.code}
                                        </div>
                                        <div className="flex-1 font-medium">{type.label}</div>
                                        <div className="text-xs text-muted-foreground w-32 text-center">
                                            {type.start_time.slice(0, 5)} - {type.end_time.slice(0, 5)}
                                        </div>
                                        <div className="w-6 h-6 rounded-full border shadow-sm" style={{ backgroundColor: type.color }} />
                                        <div className="flex gap-1 ml-auto">
                                            <Button size="icon" variant="ghost" onClick={() => setEditingId(type.id!)}><Settings className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" onClick={() => handleDelete(type.id!)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
