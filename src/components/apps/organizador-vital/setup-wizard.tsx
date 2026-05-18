'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Dumbbell, Battery, CheckCircle2, Loader2, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

interface SetupWizardProps {
    onComplete: (profile: any) => void;
}

const ALL_DAYS = [
    { value: 'monday', label: 'Lunes', short: 'L' },
    { value: 'tuesday', label: 'Martes', short: 'M' },
    { value: 'wednesday', label: 'Miércoles', short: 'X' },
    { value: 'thursday', label: 'Jueves', short: 'J' },
    { value: 'friday', label: 'Viernes', short: 'V' },
    { value: 'saturday', label: 'Sábado', short: 'S' },
    { value: 'sunday', label: 'Domingo', short: 'D' },
];

interface DaySleepConfig {
    enabled: boolean;
    sleepTime: string;
    wakeTime: string;
}

type SleepSchedule = Record<string, DaySleepConfig>;

const defaultSchedule = (): SleepSchedule => {
    const schedule: SleepSchedule = {};
    ALL_DAYS.forEach(d => {
        schedule[d.value] = { enabled: true, sleepTime: '23:00', wakeTime: '07:00' };
    });
    return schedule;
};

const parseTimeToDecimal = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h + m / 60;
};

export function SetupWizard({ onComplete }: SetupWizardProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [physicalLevel, setPhysicalLevel] = useState<string>('active');
    const [availability, setAvailability] = useState<string>('medium');
    const [sleepMode, setSleepMode] = useState<'same' | 'custom'>('same');

    // Modo "mismo horario"
    const [globalSleep, setGlobalSleep] = useState('23:00');
    const [globalWake, setGlobalWake] = useState('07:00');

    // Modo "por día"
    const [schedule, setSchedule] = useState<SleepSchedule>(defaultSchedule());

    const updateDay = (day: string, field: keyof DaySleepConfig, value: string | boolean) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Robust auth check
            const { data: { session } } = await supabase.auth.getSession();
            let user = session?.user ?? null;
            
            if (!user) {
                const { data: { user: u } } = await supabase.auth.getUser();
                user = u;
            }

            if (!user) {
                console.error('DEBUG_AUTH: Auth state:', await supabase.auth.getSession());
                throw new Error('No se encontró una sesión de usuario activa. Por favor, asegúrate de estar logueado.');
            }

            // Determinar la hora más temprana de despertar para el perfil
            let earliestWake = '07:00';
            let latestSleep = '23:00';
            if (sleepMode === 'same') {
                earliestWake = globalWake;
                latestSleep = globalSleep;
            } else {
                const enabledDays = ALL_DAYS.filter(d => schedule[d.value].enabled);
                if (enabledDays.length > 0) {
                    earliestWake = enabledDays.reduce((min, d) => 
                        schedule[d.value].wakeTime < min ? schedule[d.value].wakeTime : min
                    , '23:59');
                    latestSleep = enabledDays.reduce((max, d) => 
                        schedule[d.value].sleepTime > max ? schedule[d.value].sleepTime : max
                    , '00:00');
                }
            }

            // 1. Guardar perfil
            console.log('DEBUG_SAVE: Upserting profile...');
            const { data, error } = await supabase
                .from('smart_scheduler_profiles')
                .upsert({
                    id: user.id,
                    physical_level: physicalLevel,
                    availability_intensity: availability,
                    wake_time: earliestWake,
                    sleep_time: latestSleep,
                }, { onConflict: 'id' })
                .select()
                .single();

            if (error) {
                console.error('DEBUG_SAVE: Profile upsert error:', error);
                throw error;
            }

            // 2. Borrar bloques de sueño anteriores (limpieza profunda)
            console.log('DEBUG_SAVE: Deleting old sleep blocks...');
            const { error: deleteError } = await supabase
                .from('smart_scheduler_fixed_blocks')
                .delete()
                .eq('user_id', user.id)
                .or('label.eq.Durmiendo,label.eq.Sueño,label.eq.Dormir');
            
            if (deleteError) {
                console.error('DEBUG_SAVE: Delete error:', deleteError);
            }

            // 3. Crear bloques de sueño
            const sleepBlocks: any[] = [];
            const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

            const addSleepBlock = (dayValue: string, sleep: string, wake: string) => {
                const sleepDec = parseTimeToDecimal(sleep);
                const wakeDec = parseTimeToDecimal(wake);

                if (wakeDec < sleepDec) {
                    // Cruza medianoche: 
                    // Parte 1: Hoy de 'sleep' a las 23:59
                    sleepBlocks.push({
                        user_id: user.id,
                        day_of_week: dayValue,
                        start_time: sleep,
                        end_time: '23:59:59',
                        label: 'Durmiendo',
                        color: '#4338ca'
                    });
                    
                    // Parte 2: Mañana de las 00:00 a 'wake'
                    const currentIndex = dayOrder.indexOf(dayValue);
                    const nextDay = dayOrder[(currentIndex + 1) % 7];
                    
                    sleepBlocks.push({
                        user_id: user.id,
                        day_of_week: nextDay,
                        start_time: '00:00:00',
                        end_time: wake,
                        label: 'Durmiendo',
                        color: '#4338ca'
                    });
                } else {
                    // Bloque normal
                    sleepBlocks.push({
                        user_id: user.id,
                        day_of_week: dayValue,
                        start_time: sleep,
                        end_time: wake,
                        label: 'Durmiendo',
                        color: '#4338ca'
                    });
                }
            };

            if (sleepMode === 'same') {
                ALL_DAYS.forEach(d => addSleepBlock(d.value, globalSleep, globalWake));
            } else {
                ALL_DAYS.forEach(d => {
                    const cfg = schedule[d.value];
                    if (cfg.enabled) {
                        addSleepBlock(d.value, cfg.sleepTime, cfg.wakeTime);
                    }
                });
            }

            if (sleepBlocks.length > 0) {
                console.log('DEBUG_SAVE: Inserting', sleepBlocks.length, 'blocks:', sleepBlocks);
                const { error: blockError } = await supabase
                    .from('smart_scheduler_fixed_blocks')
                    .insert(sleepBlocks);

                if (blockError) {
                    console.error('DEBUG_SAVE: Block insert error:', blockError);
                    alert('Error al insertar bloques: ' + JSON.stringify(blockError));
                    toast.error('Error con los bloques de sueño');
                } else {
                    console.log('DEBUG_SAVE: Blocks saved successfully');
                    alert('¡Éxito! Se han guardado ' + sleepBlocks.length + ' bloques de sueño.');
                }
            } else {
                console.log('DEBUG_SAVE: No blocks to save');
                alert('Aviso: No se han seleccionado días para el sueño.');
            }

            toast.success('Perfil configurado correctamente');
            onComplete(data);
        } catch (error: any) {
            console.error('DEBUG_SAVE: Catch block error:', error);
            alert('Error crítico al guardar: ' + (error.message || JSON.stringify(error)));
            toast.error('Error al guardar el perfil');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-full w-full items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 overflow-auto">
            <Card className="w-full max-w-lg shadow-xl my-8">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">Bienvenido al Organizador Vital</CardTitle>
                    <CardDescription className="text-center">
                        Para empezar, necesitamos conocer un poco sobre tu ritmo de vida para adaptar tu agenda.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Physical Level Section */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold flex items-center gap-2">
                            <Dumbbell className="w-4 h-4" /> Nivel de Actividad Física
                        </Label>
                        <RadioGroup value={physicalLevel} onValueChange={setPhysicalLevel} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                                { value: 'sedentary', emoji: '🧘', label: 'Sedentario' },
                                { value: 'active', emoji: '🏃', label: 'Activo' },
                                { value: 'athlete', emoji: '🏋️', label: 'Atleta' },
                            ].map(opt => (
                                <Label
                                    key={opt.value}
                                    htmlFor={opt.value}
                                    className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all ${physicalLevel === opt.value ? 'border-primary ring-2 ring-primary/20' : ''}`}
                                >
                                    <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
                                    <span className="mb-2 text-2xl">{opt.emoji}</span>
                                    <span className="font-medium">{opt.label}</span>
                                </Label>
                            ))}
                        </RadioGroup>
                    </div>

                    {/* Availability Section */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold flex items-center gap-2">
                            <Battery className="w-4 h-4" /> Intensidad de Agenda
                        </Label>
                        <RadioGroup value={availability} onValueChange={setAvailability} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                                { value: 'low', emoji: '🍃', label: 'Relajada' },
                                { value: 'medium', emoji: '⚖️', label: 'Media' },
                                { value: 'high', emoji: '⚡', label: 'Intensa' },
                            ].map(opt => (
                                <Label
                                    key={opt.value}
                                    htmlFor={`avail-${opt.value}`}
                                    className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all ${availability === opt.value ? 'border-primary ring-2 ring-primary/20' : ''}`}
                                >
                                    <RadioGroupItem value={opt.value} id={`avail-${opt.value}`} className="sr-only" />
                                    <span className="mb-2 text-2xl">{opt.emoji}</span>
                                    <span className="font-medium">{opt.label}</span>
                                </Label>
                            ))}
                        </RadioGroup>
                    </div>

                    {/* Sleep Section */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold flex items-center gap-2">
                            <Moon className="w-4 h-4" /> Tu horario de sueño
                        </Label>

                        {/* Mode selector */}
                        <RadioGroup value={sleepMode} onValueChange={(val: 'same' | 'custom') => setSleepMode(val)} className="flex gap-3">
                            <Label
                                htmlFor="sleep-same"
                                className={`flex-1 text-center rounded-md border-2 border-muted bg-popover px-4 py-2.5 cursor-pointer transition-all ${sleepMode === 'same' ? 'border-primary ring-2 ring-primary/20' : ''}`}
                            >
                                <RadioGroupItem value="same" id="sleep-same" className="sr-only" />
                                <span className="text-sm font-medium">Igual todos los días</span>
                            </Label>
                            <Label
                                htmlFor="sleep-custom"
                                className={`flex-1 text-center rounded-md border-2 border-muted bg-popover px-4 py-2.5 cursor-pointer transition-all ${sleepMode === 'custom' ? 'border-primary ring-2 ring-primary/20' : ''}`}
                            >
                                <RadioGroupItem value="custom" id="sleep-custom" className="sr-only" />
                                <span className="text-sm font-medium">Diferente por día</span>
                            </Label>
                        </RadioGroup>

                        {sleepMode === 'same' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                                        <Moon className="w-3.5 h-3.5 text-indigo-500" /> Me acuesto
                                    </Label>
                                    <Input
                                        type="time"
                                        value={globalSleep}
                                        onChange={e => setGlobalSleep(e.target.value)}
                                        className="text-center font-mono text-lg h-12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                                        <Sun className="w-3.5 h-3.5 text-amber-500" /> Me levanto
                                    </Label>
                                    <Input
                                        type="time"
                                        value={globalWake}
                                        onChange={e => setGlobalWake(e.target.value)}
                                        className="text-center font-mono text-lg h-12"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {ALL_DAYS.map(day => {
                                    const cfg = schedule[day.value];
                                    return (
                                        <div key={day.value} className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${cfg.enabled ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-900/50 border-dashed border-slate-200 dark:border-slate-800 opacity-50'}`}>
                                            <button
                                                type="button"
                                                onClick={() => updateDay(day.value, 'enabled', !cfg.enabled)}
                                                className={`w-9 h-9 rounded-full text-xs font-bold shrink-0 transition-all ${cfg.enabled ? 'bg-indigo-600 text-white shadow-md' : 'bg-muted text-muted-foreground'}`}
                                            >
                                                {day.short}
                                            </button>
                                            {cfg.enabled ? (
                                                <>
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        <Moon className="w-3 h-3 text-indigo-400 shrink-0" />
                                                        <Input
                                                            type="time"
                                                            value={cfg.sleepTime}
                                                            onChange={e => updateDay(day.value, 'sleepTime', e.target.value)}
                                                            className="h-8 text-xs font-mono text-center px-1"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                                                        <Input
                                                            type="time"
                                                            value={cfg.wakeTime}
                                                            onChange={e => updateDay(day.value, 'wakeTime', e.target.value)}
                                                            className="h-8 text-xs font-mono text-center px-1"
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Sin horario de sueño</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground text-center">
                            Se creará un bloque "Durmiendo" en tu horario fijo automáticamente.
                        </p>
                    </div>

                </CardContent>
                <CardFooter>
                    <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                        Comenzar
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
