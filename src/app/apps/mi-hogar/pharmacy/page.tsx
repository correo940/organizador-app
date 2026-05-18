'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Trash2, Edit, Camera, Loader2, Sparkles, Pill, AlertTriangle, Calendar, ArrowLeft, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import Webcam from 'react-webcam';
// import { identifyMedicineAction } from '@/app/actions/identify-medicine';
import Link from 'next/link';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getApiUrl } from '@/lib/api-utils';

type Medicine = {
    id: string;
    name: string;
    description?: string;
    expiration_date?: string;
    created_at?: string;
    dosage?: string;
    alarm_times?: string[]; // ["08:00", "20:00"]
};

export default function PharmacyPage() {
    const { user, loading: authLoading } = useAuth();
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Form states
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formExpiry, setFormExpiry] = useState('');
    const [formDosage, setFormDosage] = useState('');
    const [formAlarms, setFormAlarms] = useState<string[]>([]);
    const [newAlarmTime, setNewAlarmTime] = useState('');

    // Webcam
    const webcamRef = useRef<Webcam>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setMedicines([]);
            setLoading(false);
            return;
        }

        fetchMedicines();
    }, [user, authLoading]);

    const fetchMedicines = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('medicines')
                .select('*')
                .eq('user_id', user.id)
                .order('expiration_date', { ascending: true }); // Expiring first

            if (error) throw error;
            setMedicines(data || []);
        } catch (error) {
            console.error('Error fetching medicines:', error);
            toast.error('Error al cargar el botiquín');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user || !formName.trim()) {
            toast.warning('El nombre es obligatorio');
            return;
        }

        try {
            const medicineData = {
                user_id: user.id,
                name: formName,
                description: formDesc,
                expiration_date: formExpiry || null,
                dosage: formDosage,
                alarm_times: formAlarms
            };

            if (currentId) {
                // Update
                const { error } = await supabase
                    .from('medicines')
                    .update(medicineData)
                    .eq('id', currentId);
                if (error) throw error;
                toast.success('Medicamento actualizado');
            } else {
                // Insert
                const { error } = await supabase
                    .from('medicines')
                    .insert([medicineData]);
                if (error) throw error;
                toast.success('Medicamento añadido');
            }

            setIsDialogOpen(false);
            resetForm();
            fetchMedicines();
        } catch (error) {
            console.error('Error saving medicine:', error);
            toast.error('Error al guardar');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que quieres eliminar este medicamento?')) return;
        try {
            const { error } = await supabase.from('medicines').delete().eq('id', id);
            if (error) throw error;
            toast.success('Eliminado');
            setMedicines(medicines.filter(m => m.id !== id));
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Error al eliminar');
        }
    };

    const openEdit = (m: Medicine) => {
        setCurrentId(m.id);
        setFormName(m.name);
        setFormDesc(m.description || '');
        setFormExpiry(m.expiration_date || '');
        setFormDosage(m.dosage || '');
        setFormAlarms(m.alarm_times || []);
        setIsDialogOpen(true);
    };

    const resetForm = () => {
        setCurrentId(null);
        setFormName('');
        setFormDesc('');
        setFormExpiry('');
        setFormDosage('');
        setFormAlarms([]);
        setCapturedImage(null);
    };

    const addAlarm = () => {
        if (newAlarmTime && !formAlarms.includes(newAlarmTime)) {
            setFormAlarms([...formAlarms, newAlarmTime].sort());
            setNewAlarmTime('');
        }
    };

    const removeAlarm = (time: string) => {
        setFormAlarms(formAlarms.filter(t => t !== time));
    };

    const captureAndIdentify = async () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (!imageSrc) return;

        setCapturedImage(imageSrc);
        setIsProcessing(true);
        toast.info("Analizando medicamento con IA...");

        try {
            // const result = await identifyMedicineAction(imageSrc);
            const response = await fetch(getApiUrl('api/mi-hogar/identify-medicine'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64Image: imageSrc })
            });
            const result = await response.json();

            if (result.success && result.data) {
                setFormName(result.data.name);
                setFormDesc(result.data.description);
                if (result.data.expiration_date) {
                    setFormExpiry(result.data.expiration_date);
                }
                toast.success("¡Identificado! Verifica los datos.");
                setIsCameraOpen(false); // Close camera, go back to form
            } else {
                toast.error(result.error || "No se pudo identificar.");
            }
        } catch (error) {
            console.error("Error identifying:", error);
            toast.error("Error al procesar la imagen");
        } finally {
            setIsProcessing(false);
        }
    };

    // Filter
    const filteredMedicines = medicines.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Expiry status helper
    const getExpiryStatus = (dateStr?: string) => {
        if (!dateStr) return { color: "bg-gray-100 text-gray-800", label: "Sin fecha" };
        const days = differenceInDays(parseISO(dateStr), new Date());

        if (days < 0) return { color: "bg-red-100 text-red-800 border-red-200", label: "CADUCADO" };
        if (days <= 30) return { color: "bg-orange-100 text-orange-800 border-orange-200", label: `Caduca en ${days} días` };
        if (days <= 90) return { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: `Caduca en 3 meses` };
        return { color: "bg-green-100 text-green-800 border-green-200", label: format(parseISO(dateStr), 'dd MMM yyyy', { locale: es }) };
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 pb-nav">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <Link href="/apps/mi-hogar">
                            <Button variant="ghost" className="pl-0 mb-2 hover:pl-2 transition-all">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <span className="bg-red-100 dark:bg-red-900/40 p-2 rounded-xl text-red-600 dark:text-red-400">
                                <Pill className="w-8 h-8" />
                            </span>
                            Botiquín
                        </h1>
                        <p className="text-muted-foreground mt-1">Control de caducidad y alarmas de medicación</p>
                    </div>
                    <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="mr-2 h-5 w-5" /> Añadir Medicamento
                    </Button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, dosis o síntoma..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        Cargando botiquín...
                    </div>
                ) : filteredMedicines.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed text-muted-foreground">
                        <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No tienes medicamentos registrados.</p>
                        <Button variant="link" onClick={() => setIsDialogOpen(true)}>Añadir el primero</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredMedicines.map((m) => {
                            const status = getExpiryStatus(m.expiration_date);
                            return (
                                <Card key={m.id} className="group hover:shadow-md transition-shadow relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${status.color.split(' ')[0]}`} />
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{m.name}</CardTitle>
                                                {m.expiration_date && (
                                                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full mt-2 border ${status.color}`}>
                                                        <Calendar className="w-3 h-3 mr-1" />
                                                        {status.label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(m.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {m.description || "Sin descripción"}
                                        </p>

                                        {(m.dosage || (m.alarm_times && m.alarm_times.length > 0)) && (
                                            <div className="pt-2 border-t border-border/50">
                                                {m.dosage && (
                                                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                                                        {m.dosage}
                                                    </p>
                                                )}
                                                {m.alarm_times && m.alarm_times.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {m.alarm_times.map(t => (
                                                            <span key={t} className="inline-flex items-center text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                                                                <Clock className="w-3 h-3 mr-1" /> {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Manual/Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{currentId ? 'Editar Medicamento' : 'Nuevo Medicamento'}</DialogTitle>
                    </DialogHeader>

                    {!currentId && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg flex items-center justify-between mb-4 border border-indigo-100 dark:border-indigo-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-full">
                                    <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="text-sm">
                                    <p className="font-medium text-indigo-900 dark:text-indigo-300">Autocompletar con IA</p>
                                    <p className="text-indigo-700 dark:text-indigo-400/80 text-xs">Escanea la caja del medicamento</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={() => setIsCameraOpen(true)}>
                                <Camera className="w-4 h-4 mr-2" /> Escanear
                            </Button>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nombre del medicamento</Label>
                            <Input placeholder="Ej. Ibuprofeno 600mg" value={formName} onChange={e => setFormName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>¿Para qué sirve?</Label>
                            <Textarea placeholder="Ej. Para el dolor de cabeza y fiebre..." value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Dosis</Label>
                                <Input placeholder="Ej. 1 pastilla" value={formDosage} onChange={e => setFormDosage(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Fecha de Caducidad</Label>
                                <Input type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <Label className="flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Alarmas / Recordatorios
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    type="time"
                                    value={newAlarmTime}
                                    onChange={e => setNewAlarmTime(e.target.value)}
                                    className="flex-1"
                                />
                                <Button size="sm" variant="secondary" onClick={addAlarm} disabled={!newAlarmTime}>
                                    <Plus className="w-4 h-4" /> Añadir Hora
                                </Button>
                            </div>

                            {formAlarms.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {formAlarms.map(time => (
                                        <div key={time} className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm text-sm">
                                            <span>{time}</span>
                                            <button onClick={() => removeAlarm(time)} className="text-slate-400 hover:text-red-500">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Camera Dialog */}
            <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-zinc-800">
                    <div className="relative h-[400px]">
                        {!capturedImage ? (
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="w-full h-full object-cover"
                                videoConstraints={{ facingMode: "environment" }}
                            />
                        ) : (
                            <img src={capturedImage} className="w-full h-full object-contain opacity-50" />
                        )}

                        <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/80 to-transparent">
                            <div className="flex justify-center w-full gap-4">
                                <Button variant="outline" className="border-white/20 text-white hover:bg-white/20" onClick={() => { setCapturedImage(null); setIsCameraOpen(false); }}>
                                    Cancelar
                                </Button>
                                <Button
                                    size="lg"
                                    className="bg-white text-black hover:bg-white/90"
                                    onClick={captureAndIdentify}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white mr-2" />}
                                    {isProcessing ? 'Analizando...' : 'Capturar'}
                                </Button>
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="w-16 h-16 text-indigo-400 animate-pulse" />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
