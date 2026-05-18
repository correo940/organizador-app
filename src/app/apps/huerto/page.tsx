'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
    ArrowLeft,
    Leaf,
    Droplets,
    Sun,
    Camera,
    Sprout,
    AlertCircle,
    CheckCircle2,
    Trash2,
    Loader2,
    RotateCcw,
    History as HistoryIcon,
    Image as ImageIcon,
    PencilLine,
    X as XIcon
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { getApiUrl } from '@/lib/api-utils';
import { motion, AnimatePresence } from 'framer-motion';

type Plant = {
    id: string;
    name: string;
    species: string;
    common_name: string;
    watering_frequency_days: number;
    sunlight_needs: string;
    health_status: string;
    care_instructions: string;
    image_b64: string;
    last_watered_date: string;
    next_watering_date: string;
    user_notes?: string;
};

type PlantHistoryEntry = {
    id: string;
    plant_id: string;
    species: string | null;
    common_name: string | null;
    watering_frequency_days: number | null;
    sunlight_needs: string | null;
    health_status: string | null;
    care_instructions: string | null;
    image_b64: string | null;
    action_type?: string | null;
    scanned_at: string;
};

export default function HuertoPage() {
    const { user } = useAuth();
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    type HuertoTab = 'jardin' | 'hoy' | 'consejos' | 'historial' | 'galeria';
    const [tab, setTab] = useState<HuertoTab>('jardin');

    // Historial (re-escaneos)
    const [historyPlantId, setHistoryPlantId] = useState<string | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyEntries, setHistoryEntries] = useState<PlantHistoryEntry[]>([]);

    // Notas por planta (persistidas en Supabase)
    const [notesExpanded, setNotesExpanded] = useState<Record<string, boolean>>({});
    const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

    // Checklist local (no persistido)
    const [checklistDone, setChecklistDone] = useState<Record<string, boolean[]>>({});

    // Re-escaneo (modal)
    const [rescanPlant, setRescanPlant] = useState<Plant | null>(null);
    const [rescanAnalyzing, setRescanAnalyzing] = useState(false);
    const rescanFileInputRef = useRef<HTMLInputElement>(null);

    // Acciones en lote / persistencia
    const [bulkWatering, setBulkWatering] = useState(false);
    const [savingNotesForPlantId, setSavingNotesForPlantId] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchPlants();
        }
    }, [user]);

    const fetchPlants = async () => {
        try {
            const { data, error } = await supabase
                .from('huerto_plants')
                .select('*')
                .eq('user_id', user?.id)
                .order('next_watering_date', { ascending: true });

            if (error) throw error;
            setPlants(data || []);
        } catch (error) {
            console.error('Error fetching plants:', error);
            toast.error('Error al cargar tu huerto');
        } finally {
            setLoading(false);
        }
    };

    // Mantener los borradores de notas sin destruir lo que el usuario edita
    useEffect(() => {
        if (!plants || plants.length === 0) return;
        setNoteDrafts(prev => {
            const next = { ...prev };
            for (const p of plants) {
                if (next[p.id] === undefined) next[p.id] = p.user_notes ?? '';
            }
            return next;
        });
    }, [plants]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Validations
        if (file.size > 5 * 1024 * 1024) {
            return toast.error('La imagen debe pesar menos de 5MB');
        }

        setAnalyzing(true);
        const reader = new FileReader();

        reader.onloadend = async () => {
            const base64String = reader.result as string;

            try {
                toast.loading('La IA de Pl@ntNet y Groq está analizando tu planta...', { id: 'analyze' });

                const apiUrl = getApiUrl('api/plants/analyze');
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageB64: base64String, userId: user.id }),
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Error en el análisis');
                }

                const plantData = await res.json();
                
                // Save to Supabase
                const today = new Date();
                const nextWatering = new Date(today);
                nextWatering.setDate(nextWatering.getDate() + (plantData.watering_frequency_days || 7));

                const newPlant = {
                    user_id: user.id,
                    name: plantData.common_name,
                    species: plantData.species,
                    common_name: plantData.common_name,
                    watering_frequency_days: plantData.watering_frequency_days,
                    sunlight_needs: plantData.sunlight_needs,
                    health_status: plantData.health_status,
                    care_instructions: plantData.care_instructions,
                    image_b64: base64String,
                    last_watered_date: today.toISOString().split('T')[0],
                    next_watering_date: nextWatering.toISOString().split('T')[0]
                };

                const { data: inserted, error: dbError } = await supabase
                    .from('huerto_plants')
                    .insert(newPlant)
                    .select('id')
                    .single();

                if (dbError) throw dbError;

                // Guardar también el primer análisis en historial
                if (inserted?.id) {
                    const { error: historyError } = await supabase.from('huerto_plant_history').insert({
                        user_id: user.id,
                        plant_id: inserted.id,
                        species: plantData.species,
                        common_name: plantData.common_name,
                        watering_frequency_days: plantData.watering_frequency_days,
                        sunlight_needs: plantData.sunlight_needs,
                        health_status: plantData.health_status,
                        care_instructions: plantData.care_instructions,
                        image_b64: base64String,
                        action_type: 'scan'
                    });

                    if (historyError) {
                        // No bloqueamos el flujo principal si falla el historial
                        console.warn('Huerto historial: error al guardar scan inicial', historyError);
                    }
                }

                toast.success(`¡Misterio resuelto! Es un/una ${plantData.common_name}`, { id: 'analyze' });
                fetchPlants();
            } catch (error: any) {
                console.error(error);
                toast.error(error.message || 'Error analizando la planta', { id: 'analyze' });
            } finally {
                setAnalyzing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        reader.readAsDataURL(file);
    };

    const handleWaterPlant = async (plant: Plant) => {
        try {
            const today = new Date();
            const nextWatering = new Date(today);
            nextWatering.setDate(today.getDate() + plant.watering_frequency_days);

            const { error } = await supabase
                .from('huerto_plants')
                .update({
                    last_watered_date: today.toISOString().split('T')[0],
                    next_watering_date: nextWatering.toISOString().split('T')[0]
                })
                .eq('id', plant.id);

            if (error) throw error;
            toast.success(`Has regado a: ${plant.name}`);
            fetchPlants();
        } catch (error) {
            console.error(error);
            toast.error('Error al registrar riego');
        }
    };

    const handleDeletePlant = async (id: string) => {
        if (!window.confirm('¿Eliminar esta planta de tu huerto?')) return;
        try {
            const { error } = await supabase.from('huerto_plants').delete().eq('id', id);
            if (error) throw error;
            toast.success('Planta eliminada');
            fetchPlants();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const handleSaveNotes = async (plantId: string) => {
        if (!user) return;
        try {
            setSavingNotesForPlantId(plantId);
            const notes = noteDrafts[plantId] ?? '';
            const { error } = await supabase
                .from('huerto_plants')
                .update({ user_notes: notes })
                .eq('id', plantId);

            if (error) throw error;
            toast.success('Notas guardadas');
            fetchPlants();
            setNotesExpanded(prev => ({ ...prev, [plantId]: false }));
        } catch (err) {
            console.error(err);
            toast.error('Error guardando notas');
        } finally {
            setSavingNotesForPlantId(null);
        }
    };

    const handleWaterPlantsBulk = async (plantsToWater: Plant[]) => {
        if (!user) return;
        if (!plantsToWater || plantsToWater.length === 0) return;

        try {
            setBulkWatering(true);
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            await Promise.all(
                plantsToWater.map(async (p) => {
                    const next = new Date(today);
                    next.setDate(today.getDate() + (p.watering_frequency_days || 7));
                    const nextStr = next.toISOString().split('T')[0];
                    const { error } = await supabase
                        .from('huerto_plants')
                        .update({
                            last_watered_date: todayStr,
                            next_watering_date: nextStr
                        })
                        .eq('id', p.id);
                    if (error) throw error;
                })
            );

            toast.success(`Regadas ${plantsToWater.length} planta(s)`);
            fetchPlants();
        } catch (err) {
            console.error(err);
            toast.error('Error al regar en lote');
        } finally {
            setBulkWatering(false);
        }
    };

    const fetchPlantHistory = async (plantId: string) => {
        if (!user) return;
        try {
            setHistoryLoading(true);
            const { data, error } = await supabase
                .from('huerto_plant_history')
                .select('id, plant_id, species, common_name, watering_frequency_days, sunlight_needs, health_status, care_instructions, image_b64, action_type, scanned_at')
                .eq('user_id', user.id)
                .eq('plant_id', plantId)
                .order('scanned_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setHistoryEntries(data || []);
        } catch (err) {
            console.error(err);
            toast.error('Error al cargar historial');
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleRescanFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !rescanPlant) return;

        // Validations
        if (file.size > 5 * 1024 * 1024) {
            toast.error('La imagen debe pesar menos de 5MB');
            return;
        }

        const currentPlant = rescanPlant; // snapshot for async
        setRescanAnalyzing(true);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            try {
                toast.loading('Re-escaneando con IA...', { id: 'rescan' });

                const apiUrl = getApiUrl('api/plants/analyze');
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageB64: base64String, userId: user.id }),
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Error en el re-escaneo');
                }

                const plantData = await res.json();

                const today = new Date();
                const nextWatering = new Date(today);
                nextWatering.setDate(nextWatering.getDate() + (plantData.watering_frequency_days || currentPlant.watering_frequency_days || 7));

                // 1) Guardar entrada en historial
                const { error: historyError } = await supabase.from('huerto_plant_history').insert({
                    user_id: user.id,
                    plant_id: currentPlant.id,
                    species: plantData.species,
                    common_name: plantData.common_name,
                    watering_frequency_days: plantData.watering_frequency_days,
                    sunlight_needs: plantData.sunlight_needs,
                    health_status: plantData.health_status,
                    care_instructions: plantData.care_instructions,
                    image_b64: base64String,
                    action_type: 'scan'
                });

                if (historyError) throw historyError;

                // 2) Actualizar la planta actual
                const { error: dbError } = await supabase.from('huerto_plants').update({
                    name: plantData.common_name,
                    species: plantData.species,
                    common_name: plantData.common_name,
                    watering_frequency_days: plantData.watering_frequency_days,
                    sunlight_needs: plantData.sunlight_needs,
                    health_status: plantData.health_status,
                    care_instructions: plantData.care_instructions,
                    image_b64: base64String,
                    next_watering_date: nextWatering.toISOString().split('T')[0]
                }).eq('id', currentPlant.id);

                if (dbError) throw dbError;

                toast.success(`Re-escaneo listo: ${plantData.common_name}`, { id: 'rescan' });
                setRescanPlant(null);
                // Fetch único al final
                fetchPlants();
                if (tab === 'historial') {
                    setHistoryPlantId(currentPlant.id);
                    fetchPlantHistory(currentPlant.id);
                }
            } catch (err: any) {
                console.error(err);
                toast.error(err.message || 'Error en el re-escaneo', { id: 'rescan' });
            } finally {
                setRescanAnalyzing(false);
                if (rescanFileInputRef.current) rescanFileInputRef.current.value = '';
            }
        };

        reader.readAsDataURL(file);
    };

    // Mantener selección de planta cuando entras a Historial
    useEffect(() => {
        if (tab !== 'historial') return;
        if (!plants || plants.length === 0) return;
        if (historyPlantId) return;
        setHistoryPlantId(plants[0].id);
    }, [tab, plants, historyPlantId]);

    // Cargar historial al cambiar de planta en la vista Historial
    useEffect(() => {
        if (tab !== 'historial') return;
        if (!user || !historyPlantId) return;
        fetchPlantHistory(historyPlantId);
    }, [tab, historyPlantId, user]);

    const startOfLocalDay = (d: Date) => {
        const next = new Date(d);
        next.setHours(0, 0, 0, 0);
        return next;
    };

    const getDaysUntilWatering = (nextWateringDate: string | null | undefined) => {
        if (!nextWateringDate) return null;
        const today = startOfLocalDay(new Date());
        const nextDate = startOfLocalDay(new Date(nextWateringDate));
        return differenceInDays(nextDate, today);
    };

    const getWateringStatus = (nextWateringDate: string) => {
        const diff = getDaysUntilWatering(nextWateringDate);
        if (diff === null) return { text: 'Sin fecha', color: 'text-slate-500 font-bold', bg: 'bg-slate-100 dark:bg-slate-900/20' };
        if (diff < 0) return { text: `Vencido (hace ${Math.abs(diff)} días)`, color: 'text-red-500 font-bold', bg: 'bg-red-100 dark:bg-red-900/30' };
        if (diff === 0) return { text: '¡Toca hoy!', color: 'text-orange-500 font-bold', bg: 'bg-orange-100 dark:bg-orange-900/30' };
        if (diff === 1) return { text: 'Mañana', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
        return { text: `En ${diff} días`, color: 'text-green-800 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/20' };
    };

    const parseCareInstructionsToSteps = (care?: string | null) => {
        if (!care) return [];
        return care
            .split('\n')
            .flatMap(line => line.split('.'))
            .flatMap(part => part.split(';'))
            .map(s => s.trim().replace(/^[-*•]\s*/g, ''))
            .map(s => s.endsWith(',') ? s.slice(0, -1) : s)
            .filter(s => s.length >= 4)
            .slice(0, 6);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-green-50/30 dark:bg-green-800-950/20"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>;
    }

    const plantsDueNow = plants.filter(p => {
        const diff = getDaysUntilWatering(p.next_watering_date);
        return diff !== null && diff <= 0;
    });

    const plantsDueTomorrow = plants.filter(p => getDaysUntilWatering(p.next_watering_date) === 1);

    const plantsDueThisWeek = plants.filter(p => {
        const diff = getDaysUntilWatering(p.next_watering_date);
        return diff !== null && diff > 0 && diff <= 7;
    });

    const urgentPlantsForAdvice = [...plants].sort((a, b) => {
        const da = getDaysUntilWatering(a.next_watering_date);
        const db = getDaysUntilWatering(b.next_watering_date);
        // null goes last
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
    }).slice(0, 4);

    return (
        <div className="min-h-screen bg-green-50/30 dark:bg-[#0B120F] pb-24 text-slate-900 dark:text-slate-100 font-sans">
            <div className="container mx-auto p-4 max-w-6xl space-y-6">
                
                {/* Header */}
                <div className="flex justify-between items-center">
                    <Link href="/apps/mi-hogar">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" /> Volver
                        </Button>
                    </Link>
                </div>

                {/* Hero Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-green-700 via-green-950 to-teal-900 p-8 text-white shadow-2xl shadow-green-950/30 border border-green-500/20"
                >
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl opacity-50" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-sm font-medium">
                                <Sprout className="w-4 h-4 text-green-300" />
                                <span>Mi Huerto Inteligente</span>
                            </div>
                            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Cuidemos tus Plantas.</h1>
                            <p className="text-green-100 max-w-xl text-lg opacity-90">
                                Sube una foto de tu maceta u hoja enferma. Nuestra IA botánica identificará la especie y creará un plan de cuidados perfecto al instante.
                            </p>
                        </div>

                        <div className="w-full md:w-auto flex flex-col items-center gap-3">
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileUpload} 
                            />
                            <Button 
                                size="lg" 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={analyzing}
                                className="w-full md:w-auto h-16 rounded-2xl bg-white text-green-950 hover:bg-green-50 hover:scale-105 active:scale-95 transition-all text-lg font-bold shadow-xl flex gap-3"
                            >
                                {analyzing ? (
                                    <><Loader2 className="w-6 h-6 animate-spin" /> Analizando ADN...</>
                                ) : (
                                  <><Camera className="w-6 h-6" /> Escanear Planta</>
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Huerto Tabs */}
                <div className="pt-6">
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                        <button
                            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                                tab === 'jardin' ? 'bg-white/70 border-white/60 text-green-950' : 'bg-white/35 border-white/20 text-slate-700 hover:bg-white/60'
                            }`}
                            onClick={() => setTab('jardin')}
                        >
                            Plantas
                        </button>
                        <button
                            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                                tab === 'hoy' ? 'bg-white/70 border-white/60 text-green-950' : 'bg-white/35 border-white/20 text-slate-700 hover:bg-white/60'
                            }`}
                            onClick={() => setTab('hoy')}
                        >
                            Hoy
                        </button>
                        <button
                            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                                tab === 'consejos' ? 'bg-white/70 border-white/60 text-green-950' : 'bg-white/35 border-white/20 text-slate-700 hover:bg-white/60'
                            }`}
                            onClick={() => setTab('consejos')}
                        >
                            Consejos
                        </button>
                        <button
                            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                                tab === 'historial' ? 'bg-white/70 border-white/60 text-green-950' : 'bg-white/35 border-white/20 text-slate-700 hover:bg-white/60'
                            }`}
                            onClick={() => setTab('historial')}
                            disabled={plants.length === 0}
                        >
                            Historial
                        </button>
                        <button
                            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                                tab === 'galeria' ? 'bg-white/70 border-white/60 text-green-950' : 'bg-white/35 border-white/20 text-slate-700 hover:bg-white/60'
                            }`}
                            onClick={() => setTab('galeria')}
                        >
                            Galería
                        </button>
                    </div>

                    {tab === 'jardin' && (
                        <>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <Leaf className="text-green-500" /> Tu Jardín Botánico
                            </h2>

                            {plants.length === 0 ? (
                                <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed border-green-200 dark:border-green-950 bg-green-50/50 dark:bg-green-950/10">
                                    <div className="w-20 h-20 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Sprout className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-green-950 dark:text-green-100 mb-2">Aún no hay plantas</h3>
                                    <p className="text-green-900/70 dark:text-green-300/70 max-w-md mx-auto">
                                        Toca en "Escanear Planta" para añadir tu primera compañera verde. Identificaremos qué cuidados necesita.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <AnimatePresence>
                                        {plants.map((plant) => {
                                            const status = getWateringStatus(plant.next_watering_date);
                                            const steps = parseCareInstructionsToSteps(plant.care_instructions);
                                            const done = checklistDone[plant.id] || new Array(steps.length).fill(false);
                                            const expandedNotes = !!notesExpanded[plant.id];

                                            return (
                                                <motion.div
                                                    key={plant.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                >
                                                    <Card className="overflow-hidden border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group hover:-translate-y-1 transition-all h-full flex flex-col">
                                                        <div className="h-48 relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                            {plant.image_b64 ? (
                                                                <img
                                                                    src={plant.image_b64}
                                                                    alt={plant.name}
                                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Leaf className="w-12 h-12 text-slate-300" />
                                                                </div>
                                                            )}

                                                            {/* Overlays */}
                                                            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />

                                                            <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                                                                <div className={`px-3 py-1 rounded-full backdrop-blur-md shadow-sm text-xs font-semibold ${status.bg} ${status.color} border border-white/20`}>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Droplets className="w-3.5 h-3.5" /> {status.text}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeletePlant(plant.id)}
                                                                    className="p-2 bg-black/30 hover:bg-red-500/80 text-white rounded-full backdrop-blur-md transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <CardContent className="p-5 flex-1 space-y-4">
                                                            <div>
                                                                <h3 className="text-xl font-bold line-clamp-1">{plant.name}</h3>
                                                                <p className="text-sm font-mono text-green-800 dark:text-green-400 italic line-clamp-1">{plant.species}</p>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                                                                        <Sun className="w-3.5 h-3.5" /> Luz
                                                                    </div>
                                                                    <span className="font-medium">{plant.sunlight_needs}</span>
                                                                </div>
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                                                                        <Droplets className="w-3.5 h-3.5" /> Riego
                                                                    </div>
                                                                    <span className="font-medium">Cada {plant.watering_frequency_days} días</span>
                                                                </div>
                                                            </div>

                                                            <div className="bg-green-50/50 dark:bg-green-950/10 p-3 rounded-xl border border-green-100 dark:border-green-950/50">
                                                                <div className="flex gap-2 items-start">
                                                                    {plant.health_status?.toLowerCase().includes('enferm') || plant.health_status?.toLowerCase().includes('sec') ? (
                                                                        <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                                                                    ) : (
                                                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                                                    )}
                                                                    <div className="text-sm">
                                                                        <span className="font-semibold block mb-0.5 text-slate-700 dark:text-slate-200">Estado</span>
                                                                        <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{plant.health_status}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Checklist */}
                                                            <div className="bg-white/40 dark:bg-white/5 p-3 rounded-xl border border-white/40">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <span className="font-semibold block text-slate-800 dark:text-slate-200 text-sm mb-0.5">
                                                                            Checklist de cuidados
                                                                        </span>
                                                                        <p className="text-xs text-slate-500">Marca lo que ya has hecho.</p>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-3 space-y-2">
                                                                    {steps.length === 0 ? (
                                                                        <p className="text-xs text-slate-500">Sin instrucciones.</p>
                                                                    ) : (
                                                                        steps.map((step, idx) => (
                                                                            <label key={`${plant.id}-step-${idx}`} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="mt-0.5"
                                                                                    checked={done[idx] ?? false}
                                                                                    onChange={() => {
                                                                                        setChecklistDone(prev => {
                                                                                            const cur = prev[plant.id] || new Array(steps.length).fill(false);
                                                                                            const next = [...cur];
                                                                                            next[idx] = !(cur[idx] ?? false);
                                                                                            return { ...prev, [plant.id]: next };
                                                                                        });
                                                                                    }}
                                                                                />
                                                                                <span className="leading-snug">{step}</span>
                                                                            </label>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Notas */}
                                                            <div className="bg-white/40 dark:bg-white/5 p-3 rounded-xl border border-white/40">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">Notas</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-muted-foreground hover:text-green-900"
                                                                        onClick={() => setNotesExpanded(prev => ({ ...prev, [plant.id]: !prev[plant.id] }))}
                                                                    >
                                                                        <PencilLine className="w-4 h-4 mr-1" />
                                                                        {expandedNotes ? 'Cerrar' : 'Editar'}
                                                                    </Button>
                                                                </div>

                                                                {expandedNotes && (
                                                                    <div className="mt-3 space-y-2">
                                                                        <textarea
                                                                            value={noteDrafts[plant.id] ?? ''}
                                                                            onChange={(ev) => setNoteDrafts(prev => ({ ...prev, [plant.id]: ev.target.value }))}
                                                                            rows={3}
                                                                            className="w-full rounded-xl border border-white/60 bg-white/60 dark:bg-black/20 p-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-green-200"
                                                                        />
                                                                        <div className="flex items-center gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                className="bg-green-800 hover:bg-green-900 text-white"
                                                                                disabled={savingNotesForPlantId === plant.id}
                                                                                onClick={() => handleSaveNotes(plant.id)}
                                                                            >
                                                                                {savingNotesForPlantId === plant.id ? 'Guardando...' : 'Guardar'}
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="border-white/50 bg-white/20 hover:bg-white/30"
                                                                                disabled={savingNotesForPlantId === plant.id}
                                                                                onClick={() => {
                                                                                    setNotesExpanded(prev => ({ ...prev, [plant.id]: false }));
                                                                                    setNoteDrafts(prev => ({ ...prev, [plant.id]: plant.user_notes ?? '' }));
                                                                                }}
                                                                            >
                                                                                Cancelar
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardContent>

                                                        <CardFooter className="p-5 pt-0">
                                                            <div className="space-y-2 w-full">
                                                                <Button
                                                                    className="w-full bg-green-800 hover:bg-green-900 text-white shadow-lg shadow-green-500/20"
                                                                    onClick={() => handleWaterPlant(plant)}
                                                                >
                                                                    <Droplets className="w-4 h-4 mr-2" /> Regar Planta
                                                                </Button>
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        variant="secondary"
                                                                        className="flex-1"
                                                                        onClick={() => setRescanPlant(plant)}
                                                                    >
                                                                        <RotateCcw className="w-4 h-4 mr-1" /> Re-escaneo
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="flex-1 border-white/50 bg-white/20 hover:bg-white/30"
                                                                        onClick={() => {
                                                                            setHistoryPlantId(plant.id);
                                                                            setTab('historial');
                                                                        }}
                                                                    >
                                                                        <HistoryIcon className="w-4 h-4 mr-1" /> Historial
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </CardFooter>
                                                    </Card>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </>
                    )}

                    {tab === 'hoy' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <Droplets className="text-green-500" /> Hoy y esta semana
                            </h2>

                            {plants.length === 0 ? (
                                <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed border-green-200 dark:border-green-950 bg-green-50/50 dark:bg-green-950/10">
                                    <p className="text-slate-700 dark:text-slate-200 font-semibold">Escanea tu primera planta para empezar.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="rounded-3xl border border-white/30 bg-white/30 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Regar hoy</p>
                                                <p className="text-xs text-slate-500">Incluye vencidas y las que tocan hoy.</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="bg-green-800 hover:bg-green-900 text-white"
                                                disabled={bulkWatering || plantsDueNow.length === 0}
                                                onClick={() => handleWaterPlantsBulk(plantsDueNow)}
                                            >
                                                {bulkWatering ? 'Regando...' : `Regar todo (${plantsDueNow.length})`}
                                            </Button>
                                        </div>

                                        <div className="mt-4 space-y-3">
                                            {plantsDueNow.length === 0 ? (
                                                <p className="text-sm text-slate-600 dark:text-slate-300">Perfecto: no hay riegos urgentes hoy.</p>
                                            ) : (
                                                plantsDueNow.map((p) => {
                                                    const st = getWateringStatus(p.next_watering_date);
                                                    return (
                                                        <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 dark:bg-black/10 border border-white/40 p-3">
                                                            <div className="min-w-0">
                                                                <p className="font-semibold truncate">{p.name}</p>
                                                                <p className="text-xs text-slate-500 truncate">{p.species}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${st.bg} ${st.color} border-white/20`}>
                                                                    {st.text}
                                                                </div>
                                                                <Button size="sm" variant="secondary" onClick={() => handleWaterPlant(p)}>
                                                                    Regar
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-white/30 bg-white/30 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mañana</p>
                                                <p className="text-xs text-slate-500">Preparación rápida.</p>
                                            </div>
                                            <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                                {plantsDueTomorrow.length} planta(s)
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-3">
                                            {plantsDueTomorrow.length === 0 ? (
                                                <p className="text-sm text-slate-600 dark:text-slate-300">Mañana está despejado.</p>
                                            ) : (
                                                plantsDueTomorrow.map((p) => (
                                                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 dark:bg-black/10 border border-white/40 p-3">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold truncate">{p.name}</p>
                                                            <p className="text-xs text-slate-500 truncate">Cada {p.watering_frequency_days} días</p>
                                                        </div>
                                                        <Button size="sm" variant="outline" className="border-white/50 bg-white/20 hover:bg-white/30" onClick={() => handleWaterPlant(p)}>
                                                            Regar
                                                        </Button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-white/30 bg-white/30 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Esta semana</p>
                                                <p className="text-xs text-slate-500">Próximos riegos (2 a 7 días).</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-3">
                                            {(() => {
                                                const dueNext = plantsDueThisWeek.filter(p => {
                                                    const d = getDaysUntilWatering(p.next_watering_date);
                                                    return d !== null && d >= 2;
                                                });

                                                if (dueNext.length === 0) {
                                                    return <p className="text-sm text-slate-600 dark:text-slate-300">Ningún riego en el rango (2-7 días).</p>;
                                                }

                                                return dueNext.map((p) => (
                                                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 dark:bg-black/10 border border-white/40 p-3">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold truncate">{p.name}</p>
                                                            <p className="text-xs text-slate-500 truncate">{getWateringStatus(p.next_watering_date).text}</p>
                                                        </div>
                                                        <Button size="sm" variant="outline" className="border-white/50 bg-white/20 hover:bg-white/30" onClick={() => setRescanPlant(p)}>
                                                            Re-escaneo
                                                        </Button>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'consejos' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <HistoryIcon className="text-green-500" /> Consejos de Quioba
                            </h2>

                            {plants.length === 0 ? (
                                <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed border-green-200 dark:border-green-950 bg-green-50/50 dark:bg-green-950/10">
                                    <p className="text-slate-700 dark:text-slate-200 font-semibold">Escanea una planta y te saldrán planes de cuidados.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="rounded-3xl border border-white/30 bg-white/30 p-4">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Tu mezcla de Planner + IA</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300">
                                            Te marco prioridades según el calendario de riego y te recuerdo lo que ya te sugirió la IA (luz, riego y cuidados).
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {urgentPlantsForAdvice.map((p) => {
                                            const diff = getDaysUntilWatering(p.next_watering_date);
                                            const st = getWateringStatus(p.next_watering_date);
                                            const steps = parseCareInstructionsToSteps(p.care_instructions);
                                            const done = checklistDone[p.id] || new Array(steps.length).fill(false);

                                            const prioridad =
                                                diff === null || diff < 0
                                                    ? 'Prioridad alta'
                                                    : diff === 0
                                                        ? 'Hoy toca'
                                                        : diff === 1
                                                            ? 'Mañana toca'
                                                            : 'Próximo riego';

                                            const recommendedAction =
                                                diff === null || diff < 0
                                                    ? 'Riega y revisa la humedad del sustrato antes de volver a dejarla “a ojo”.'
                                                    : diff === 0
                                                        ? 'Haz el riego hoy y confirma que la planta responde bien (no te pases de agua).'
                                                        : diff === 1
                                                            ? 'Prepara el riego para mañana: revisa luz y coloca donde le toque.'
                                                            : 'Agenda el riego y revisa si hay señales de estrés en las hojas.';

                                            return (
                                                <Card key={p.id} className="bg-white/70 dark:bg-black/10 border-white/50 rounded-3xl">
                                                    <CardContent className="p-4 space-y-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="font-bold truncate">{p.name}</p>
                                                                <p className="text-xs text-slate-500 truncate">{p.species}</p>
                                                            </div>
                                                            <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${st.bg} ${st.color} border-white/20`}>
                                                                {prioridad}
                                                            </div>
                                                        </div>

                                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Acción recomendada</p>
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{recommendedAction}</p>

                                                        <div className="bg-white/40 dark:bg-white/5 rounded-2xl p-3 border border-white/40">
                                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">Según tu IA</p>
                                                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                                                <span className="font-semibold">{p.sunlight_needs}</span>
                                                                {' '}| {p.care_instructions}
                                                            </p>
                                                        </div>

                                                        <div className="bg-white/40 dark:bg-white/5 rounded-2xl p-3 border border-white/40">
                                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">Checklist de cuidados</p>
                                                            {steps.length === 0 ? (
                                                                <p className="text-xs text-slate-500">Sin instrucciones separadas.</p>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {steps.slice(0, 5).map((step, idx) => (
                                                                        <label key={`${p.id}-advice-step-${idx}`} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="mt-0.5"
                                                                                checked={done[idx] ?? false}
                                                                                onChange={() => {
                                                                                    setChecklistDone(prev => {
                                                                                        const cur = prev[p.id] || new Array(steps.length).fill(false);
                                                                                        const next = [...cur];
                                                                                        next[idx] = !(cur[idx] ?? false);
                                                                                        return { ...prev, [p.id]: next };
                                                                                    });
                                                                                }}
                                                                            />
                                                                            <span className="leading-snug">{step}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                className="bg-green-800 hover:bg-green-900 text-white flex-1"
                                                                onClick={() => handleWaterPlant(p)}
                                                            >
                                                                <Droplets className="w-4 h-4 mr-1" /> Regar
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                className="flex-1"
                                                                onClick={() => setRescanPlant(p)}
                                                            >
                                                                <RotateCcw className="w-4 h-4 mr-1" /> Re-escaneo
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'historial' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <HistoryIcon className="text-green-500" /> Historial de re-escaneos
                            </h2>

                            {plants.length === 0 ? (
                                <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed border-green-200 dark:border-green-950 bg-green-50/50 dark:bg-green-950/10">
                                    <p className="text-slate-700 dark:text-slate-200 font-semibold">Aún no tienes plantas.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Planta</p>
                                            <p className="text-xs text-slate-500">Filtra por una planta concreta.</p>
                                        </div>

                                        <select
                                            value={historyPlantId ?? ''}
                                            onChange={(e) => setHistoryPlantId(e.target.value)}
                                            className="rounded-xl border border-white/50 bg-white/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                                        >
                                            {plants.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {historyLoading ? (
                                        <div className="rounded-3xl border border-white/30 bg-white/30 p-6 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                                        </div>
                                    ) : historyEntries.length === 0 ? (
                                        <div className="rounded-3xl border border-white/30 bg-white/30 p-6 text-sm text-slate-700 dark:text-slate-300">
                                            Aún no hay re-escaneos para esta planta.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {historyEntries.map((h) => (
                                                <div key={h.id} className="flex items-start gap-3 rounded-2xl border border-white/40 bg-white/70 dark:bg-black/10 p-3">
                                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-white/30 flex-shrink-0">
                                                        {h.image_b64 ? (
                                                            <img src={h.image_b64} alt={h.common_name ?? 'planta'} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Leaf className="w-6 h-6 text-slate-300" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="font-bold truncate">{h.common_name ?? 'Planta'}</p>
                                                                <p className="text-xs text-slate-500 truncate">{h.health_status ?? 'Diagnóstico'}</p>
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 whitespace-nowrap">
                                                                {h.scanned_at ? new Date(h.scanned_at).toLocaleString('es-ES') : ''}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                                                            {h.care_instructions ?? ''}
                                                        </p>
                                                        {h.sunlight_needs && (
                                                            <p className="text-[11px] text-slate-500 mt-1">
                                                                Luz: {h.sunlight_needs} · Riego: cada {h.watering_frequency_days ?? '?'} días
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'galeria' && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <ImageIcon className="text-green-500" /> Galería
                            </h2>

                            {plants.length === 0 ? (
                                <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed border-green-200 dark:border-green-950 bg-green-50/50 dark:bg-green-950/10">
                                    <p className="text-slate-700 dark:text-slate-200 font-semibold">Añade una planta para ver su galería.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {plants.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setHistoryPlantId(p.id)}
                                            className="text-left rounded-3xl overflow-hidden border border-white/40 bg-white/60 hover:bg-white/80 transition-colors"
                                        >
                                            <div className="relative h-28 bg-slate-100">
                                                {p.image_b64 ? (
                                                    <img src={p.image_b64} alt={p.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Leaf className="w-8 h-8 text-slate-300" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-x-0 bottom-0 bg-black/40 p-2">
                                                    <p className="text-white text-xs font-bold truncate">{p.name}</p>
                                                </div>
                                            </div>
                                            <div className="p-3 space-y-2">
                                                <p className="text-[11px] text-slate-500 truncate">{p.species}</p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="bg-green-800 hover:bg-green-900 text-white flex-1"
                                                        onClick={(ev) => {
                                                            ev.stopPropagation();
                                                            handleWaterPlant(p);
                                                        }}
                                                    >
                                                        <Droplets className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="secondary"
                                                        className="flex-1"
                                                        onClick={(ev) => {
                                                            ev.stopPropagation();
                                                            setRescanPlant(p);
                                                        }}
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rescan modal */}
                    <AnimatePresence>
                        {rescanPlant && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end justify-center sm:items-center p-4"
                                onClick={(e) => {
                                    if (e.target === e.currentTarget) setRescanPlant(null);
                                }}
                            >
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                    className="bg-white rounded-t-[32px] sm:rounded-3xl w-full max-w-lg p-6 pb-10 shadow-2xl"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="min-w-0">
                                            <h3 className="text-xl font-bold text-slate-900 truncate">
                                                Re-escaneo: {rescanPlant.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Sube otra foto y Quioba recalculará salud, luz y riego.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setRescanPlant(null)}
                                            className="p-2 rounded-full hover:bg-slate-100 text-slate-700"
                                            aria-label="Cerrar"
                                        >
                                            <XIcon className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        ref={rescanFileInputRef}
                                        onChange={handleRescanFileUpload}
                                    />

                                    <div className="space-y-4">
                                        <Button
                                            className="w-full bg-green-800 hover:bg-green-900 text-white h-14 rounded-2xl"
                                            disabled={rescanAnalyzing}
                                            onClick={() => rescanFileInputRef.current?.click()}
                                        >
                                            {rescanAnalyzing ? (
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            ) : (
                                                <Camera className="w-5 h-5 mr-2" />
                                            )}
                                            {rescanAnalyzing ? 'Analizando...' : 'Elegir foto para re-escaneo'}
                                        </Button>

                                        {rescanPlant.image_b64 && (
                                            <div className="rounded-3xl overflow-hidden border border-slate-100 bg-slate-50">
                                                <img src={rescanPlant.image_b64} alt={rescanPlant.name} className="w-full max-h-72 object-cover" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-5 flex items-center justify-between gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-slate-200 hover:bg-slate-50"
                                            onClick={() => {
                                                setRescanPlant(null);
                                                if (rescanFileInputRef.current) rescanFileInputRef.current.value = '';
                                            }}
                                        >
                                            Cancelar
                                        </Button>
                                        <div className="text-[11px] text-slate-500">
                                            Consejo: usa buena luz para mejores resultados.
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

