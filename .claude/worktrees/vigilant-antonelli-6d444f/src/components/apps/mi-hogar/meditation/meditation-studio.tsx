'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    ArrowLeft,
    BookOpen,
    Brain,
    CheckCircle2,
    Clock,
    Heart,
    Pause,
    Play,
    RotateCcw,
    Sparkles,
    Wind
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type MoodKey = 'sereno' | 'cansado' | 'saturado' | 'agradecido' | 'enfocado';

type PauseEntry = {
    id: string;
    createdAt: string;
    mood: MoodKey;
    title: string;
    note: string;
};

type SessionEntry = {
    id: string;
    createdAt: string;
    duration: number;
    mood: MoodKey | null;
};

const STORAGE_KEYS = {
    entries: 'quioba_pause_entries',
    sessions: 'quioba_pause_sessions',
    mood: 'quioba_pause_mood'
};

const MOODS: { key: MoodKey; label: string; tone: string; hint: string }[] = [
    { key: 'sereno', label: 'Sereno', tone: 'bg-green-100 text-green-900 border-green-200', hint: 'Mantener la calma' },
    { key: 'cansado', label: 'Cansado', tone: 'bg-amber-100 text-amber-700 border-amber-200', hint: 'Bajar el ritmo' },
    { key: 'saturado', label: 'Saturado', tone: 'bg-rose-100 text-rose-700 border-rose-200', hint: 'Soltar peso mental' },
    { key: 'agradecido', label: 'Agradecido', tone: 'bg-lime-100 text-lime-700 border-lime-200', hint: 'Reconocer lo bueno' },
    { key: 'enfocado', label: 'Enfocado', tone: 'bg-cyan-100 text-cyan-700 border-cyan-200', hint: 'Entrar en claridad' }
];

const SESSION_PRESETS = [
    { label: '1 min', seconds: 60 },
    { label: '3 min', seconds: 180 },
    { label: '5 min', seconds: 300 },
    { label: '10 min', seconds: 600 }
];

const DAILY_THOUGHTS = [
    'No todo pensamiento necesita una respuesta inmediata.',
    'Respirar despacio tambien es una forma de avanzar.',
    'La claridad suele llegar cuando dejamos de forzarla.',
    'Hoy no hace falta hacerlo perfecto, solo hacerlo con presencia.',
    'A veces descansar la mente es la tarea mas inteligente del dia.',
    'Lo importante puede ser simple si lo miras con calma.',
    'Bajar el ruido tambien es cuidar tu energia.',
    'Tu valor no depende de lo productivo que te sientas.',
    'Una pausa breve puede cambiar el tono de todo el dia.',
    'Pensar mejor empieza por respirar mejor.'
];

function loadJson<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;

    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) as T : fallback;
    } catch {
        return fallback;
    }
}

function saveJson<T>(key: string, value: T) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
}

function formatDuration(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function MeditationStudio() {
    const [selectedDuration, setSelectedDuration] = useState(180);
    const [secondsLeft, setSecondsLeft] = useState(180);
    const [isRunning, setIsRunning] = useState(false);
    const [selectedMood, setSelectedMood] = useState<MoodKey | null>('sereno');
    const [entryTitle, setEntryTitle] = useState('');
    const [entryNote, setEntryNote] = useState('');
    const [entries, setEntries] = useState<PauseEntry[]>([]);
    const [sessions, setSessions] = useState<SessionEntry[]>([]);

    useEffect(() => {
        const storedEntries = loadJson<PauseEntry[]>(STORAGE_KEYS.entries, []);
        const storedSessions = loadJson<SessionEntry[]>(STORAGE_KEYS.sessions, []);
        const storedMood = loadJson<MoodKey | null>(STORAGE_KEYS.mood, 'sereno');

        setEntries(storedEntries);
        setSessions(storedSessions);
        setSelectedMood(storedMood);
    }, []);

    useEffect(() => {
        setSecondsLeft(selectedDuration);
    }, [selectedDuration]);

    useEffect(() => {
        if (!selectedMood) return;
        saveJson(STORAGE_KEYS.mood, selectedMood);
    }, [selectedMood]);

    useEffect(() => {
        if (!isRunning) return;

        const timer = window.setInterval(() => {
            setSecondsLeft((current) => {
                if (current <= 1) {
                    window.clearInterval(timer);
                    setIsRunning(false);

                    const completedSession: SessionEntry = {
                        id: crypto.randomUUID(),
                        createdAt: new Date().toISOString(),
                        duration: selectedDuration,
                        mood: selectedMood
                    };

                    setSessions((prev) => {
                        const updated = [completedSession, ...prev].slice(0, 12);
                        saveJson(STORAGE_KEYS.sessions, updated);
                        return updated;
                    });

                    toast.success('Sesion completada. Tienes un poco mas de aire mental.');
                    return 0;
                }

                return current - 1;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [isRunning, selectedDuration, selectedMood]);

    const thoughtOfTheDay = useMemo(() => {
        const dayIndex = new Date().getDate() % DAILY_THOUGHTS.length;
        return DAILY_THOUGHTS[dayIndex];
    }, []);

    const completedMinutes = useMemo(
        () => sessions.reduce((total, session) => total + Math.round(session.duration / 60), 0),
        [sessions]
    );

    const todaySessions = useMemo(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        return sessions.filter((session) => session.createdAt.startsWith(today)).length;
    }, [sessions]);

    const breathingPhase = useMemo(() => {
        if (!isRunning) return 'Preparando';
        const cycle = (selectedDuration - secondsLeft) % 12;
        if (cycle < 5) return 'Inhala';
        if (cycle < 8) return 'Sostiene';
        return 'Exhala';
    }, [isRunning, secondsLeft, selectedDuration]);

    const breathingScale = useMemo(() => {
        if (!isRunning) return 1;
        const cycle = (selectedDuration - secondsLeft) % 12;
        if (cycle < 5) return 1.12;
        if (cycle < 8) return 1.1;
        return 0.96;
    }, [isRunning, secondsLeft, selectedDuration]);

    const progressValue = selectedDuration > 0
        ? ((selectedDuration - secondsLeft) / selectedDuration) * 100
        : 0;

    const handleSaveEntry = () => {
        if (!entryTitle.trim() && !entryNote.trim()) {
            toast.error('Escribe al menos una idea antes de guardarla.');
            return;
        }

        const newEntry: PauseEntry = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            mood: selectedMood || 'sereno',
            title: entryTitle.trim() || 'Pensamiento breve',
            note: entryNote.trim()
        };

        const updatedEntries = [newEntry, ...entries].slice(0, 8);
        setEntries(updatedEntries);
        saveJson(STORAGE_KEYS.entries, updatedEntries);
        setEntryTitle('');
        setEntryNote('');
        toast.success('Pensamiento guardado en tu espacio mental.');
    };

    const latestSession = sessions[0];

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(134,239,172,0.12),transparent_20%),linear-gradient(180deg,#f7fdf9_0%,#eef8f2_100%)] p-4 md:p-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <div className="flex items-center justify-between">
                    <Link href="/apps/mi-hogar">
                        <Button variant="ghost" size="sm" className="gap-2 rounded-full border border-green-100 bg-white/80 px-4 shadow-sm hover:bg-green-50">
                            <ArrowLeft className="h-4 w-4" />
                            Volver
                        </Button>
                    </Link>
                    <Badge className="rounded-full border border-green-200 bg-white/80 px-4 py-1.5 text-green-900 hover:bg-white/80">
                        Nueva app Quioba
                    </Badge>
                </div>

                <motion.section
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-[2rem] border border-green-100 bg-white/80 shadow-[0_30px_80px_rgba(16,185,129,0.12)] backdrop-blur-xl"
                >
                    <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.4fr_0.9fr] md:px-10 md:py-10">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-900">
                                <Sparkles className="h-4 w-4" />
                                Pausa
                            </div>
                            <div className="space-y-3">
                                <h1 className="max-w-2xl text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
                                    Un espacio para respirar, pensar y volver a ti.
                                </h1>
                                <p className="max-w-2xl text-lg text-slate-600">
                                    Meditacion breve, claridad mental y un rincon para soltar lo que te pesa sin salir del universo Quioba.
                                </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <Card className="rounded-[1.5rem] border-green-100 bg-green-50/80 shadow-none">
                                    <CardContent className="p-5">
                                        <p className="text-xs uppercase tracking-[0.28em] text-green-900/70">Hoy</p>
                                        <p className="mt-3 text-3xl font-black text-slate-900">{todaySessions}</p>
                                        <p className="mt-1 text-sm text-slate-600">sesiones de calma</p>
                                    </CardContent>
                                </Card>
                                <Card className="rounded-[1.5rem] border-green-100 bg-white shadow-none">
                                    <CardContent className="p-5">
                                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Acumulado</p>
                                        <p className="mt-3 text-3xl font-black text-slate-900">{completedMinutes}</p>
                                        <p className="mt-1 text-sm text-slate-600">minutos respirados</p>
                                    </CardContent>
                                </Card>
                                <Card className="rounded-[1.5rem] border-green-100 bg-white shadow-none">
                                    <CardContent className="p-5">
                                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Ultima sesion</p>
                                        <p className="mt-3 text-base font-black text-slate-900">
                                            {latestSession
                                                ? `${Math.round(latestSession.duration / 60)} min`
                                                : 'Sin iniciar'}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-600">
                                            {latestSession
                                                ? format(new Date(latestSession.createdAt), 'dd MMM, HH:mm', { locale: es })
                                                : 'Todavia no has guardado ninguna'}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <Card className="rounded-[1.75rem] border-green-100 bg-gradient-to-br from-green-800 via-green-500 to-lime-400 text-white shadow-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <Brain className="h-5 w-5" />
                                    Pensamiento del dia
                                </CardTitle>
                                <CardDescription className="text-green-50/80">
                                    Una idea breve para bajar el ruido y mirar con mas claridad.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <p className="text-2xl font-semibold leading-relaxed text-white">
                                    "{thoughtOfTheDay}"
                                </p>
                                <div className="rounded-[1.25rem] border border-white/20 bg-white/10 p-4">
                                    <p className="text-xs uppercase tracking-[0.25em] text-white/60">Como estas hoy</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {MOODS.map((mood) => (
                                            <button
                                                key={mood.key}
                                                type="button"
                                                onClick={() => setSelectedMood(mood.key)}
                                                className={`rounded-full px-3 py-2 text-sm font-medium transition-all ${
                                                    selectedMood === mood.key
                                                        ? 'bg-white text-green-900 shadow-lg'
                                                        : 'bg-white/10 text-white hover:bg-white/20'
                                                }`}
                                            >
                                                {mood.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </motion.section>

                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <Card className="rounded-[2rem] border-green-100 bg-white/85 shadow-xl shadow-green-100/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Wind className="h-5 w-5 text-green-800" />
                                Respiracion guiada
                            </CardTitle>
                            <CardDescription>
                                Elige una duracion corta, marca tu estado y date un hueco de presencia.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-wrap gap-2">
                                {SESSION_PRESETS.map((preset) => (
                                    <Button
                                        key={preset.seconds}
                                        type="button"
                                        variant={selectedDuration === preset.seconds ? 'default' : 'outline'}
                                        onClick={() => {
                                            setSelectedDuration(preset.seconds);
                                            setSecondsLeft(preset.seconds);
                                            setIsRunning(false);
                                        }}
                                        className={selectedDuration === preset.seconds ? 'rounded-full bg-green-800 hover:bg-green-900' : 'rounded-full border-green-100 bg-white hover:bg-green-50'}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </div>

                            <div className="grid items-center gap-8 lg:grid-cols-[0.85fr_1.15fr]">
                                <div className="flex flex-col items-center gap-4">
                                    <motion.div
                                        animate={{ scale: breathingScale }}
                                        transition={{ duration: 1.4, ease: 'easeInOut' }}
                                        className="relative flex h-52 w-52 items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.96)_0%,rgba(236,253,245,0.95)_45%,rgba(16,185,129,0.2)_100%)] shadow-[0_30px_80px_rgba(16,185,129,0.22)]"
                                    >
                                        <div className="absolute inset-3 rounded-full border border-green-100" />
                                        <div className="absolute inset-7 rounded-full border border-green-200/80" />
                                        <div className="relative z-10 text-center">
                                            <p className="text-sm uppercase tracking-[0.28em] text-green-900/70">{breathingPhase}</p>
                                            <p className="mt-3 text-5xl font-black tracking-tight text-slate-900">{formatDuration(secondsLeft)}</p>
                                        </div>
                                    </motion.div>
                                    <p className="max-w-sm text-center text-sm text-slate-600">
                                        Sigue el ritmo del circulo: inhala amplio, sostiene con suavidad y exhala sin prisa.
                                    </p>
                                </div>

                                <div className="space-y-5">
                                    <div className="rounded-[1.5rem] border border-green-100 bg-green-50/60 p-5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.25em] text-green-900/70">Progreso</p>
                                                <p className="mt-2 text-lg font-bold text-slate-900">
                                                    {isRunning ? 'Sesion en curso' : 'Listo para empezar'}
                                                </p>
                                            </div>
                                            <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-green-900 shadow-sm">
                                                {Math.round(progressValue)}%
                                            </div>
                                        </div>
                                        <Progress value={progressValue} className="mt-4 h-3 bg-green-100" />
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <Button
                                            type="button"
                                            onClick={() => setIsRunning((current) => !current)}
                                            className="h-12 rounded-2xl bg-green-800 text-white hover:bg-green-900"
                                        >
                                            {isRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                                            {isRunning ? 'Pausar' : 'Empezar'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setIsRunning(false);
                                                setSecondsLeft(selectedDuration);
                                            }}
                                            className="h-12 rounded-2xl border-green-100 bg-white hover:bg-green-50"
                                        >
                                            <RotateCcw className="mr-2 h-4 w-4" />
                                            Reiniciar
                                        </Button>
                                        <div className="flex items-center rounded-2xl border border-green-100 bg-white px-4 text-sm text-slate-600">
                                            <Clock className="mr-2 h-4 w-4 text-green-800" />
                                            {Math.round(selectedDuration / 60)} min de foco
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {MOODS.map((mood) => (
                                            <button
                                                key={mood.key}
                                                type="button"
                                                onClick={() => setSelectedMood(mood.key)}
                                                className={`rounded-[1.25rem] border p-4 text-left transition-all ${
                                                    selectedMood === mood.key
                                                        ? `${mood.tone} shadow-lg`
                                                        : 'border-slate-200 bg-white hover:border-green-100 hover:bg-green-50/40'
                                                }`}
                                            >
                                                <p className="font-semibold">{mood.label}</p>
                                                <p className="mt-1 text-sm opacity-75">{mood.hint}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col gap-6">
                        <Card className="rounded-[2rem] border-green-100 bg-white/85 shadow-xl shadow-green-100/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <BookOpen className="h-5 w-5 text-green-800" />
                                    Vaciar la mente
                                </CardTitle>
                                <CardDescription>
                                    Una nota breve para dejar fuera lo que te ocupa por dentro.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Input
                                    value={entryTitle}
                                    onChange={(event) => setEntryTitle(event.target.value)}
                                    placeholder="Ponle un titulo breve a este momento"
                                    className="h-12 rounded-2xl border-green-100 bg-white focus-visible:border-green-500 focus-visible:ring-green-500/20"
                                />
                                <Textarea
                                    value={entryNote}
                                    onChange={(event) => setEntryNote(event.target.value)}
                                    placeholder="Que te ronda ahora mismo? Que necesitas recordar? Que te gustaria soltar?"
                                    className="min-h-[160px] rounded-[1.5rem] border-green-100 bg-white focus-visible:border-green-500 focus-visible:ring-green-500/20"
                                />
                                <div className="flex items-center justify-between gap-4">
                                    <div className="text-sm text-slate-500">
                                        Estado actual:{' '}
                                        <span className="font-semibold text-slate-900">
                                            {selectedMood ? MOODS.find((mood) => mood.key === selectedMood)?.label : 'Sin elegir'}
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleSaveEntry}
                                        className="rounded-2xl bg-green-800 px-5 text-white hover:bg-green-900"
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Guardar pensamiento
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2rem] border-green-100 bg-white/85 shadow-xl shadow-green-100/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <Heart className="h-5 w-5 text-green-800" />
                                    Tu espacio reciente
                                </CardTitle>
                                <CardDescription>
                                    Un historial corto de pausas y pensamientos guardados solo en este dispositivo.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {entries.length === 0 ? (
                                    <div className="rounded-[1.5rem] border border-dashed border-green-200 bg-green-50/50 p-6 text-center text-sm text-slate-500">
                                        Todavia no has guardado ningun pensamiento. Cuando lo hagas, aparecera aqui como un pequeño refugio mental.
                                    </div>
                                ) : (
                                    entries.map((entry) => {
                                        const mood = MOODS.find((item) => item.key === entry.mood);

                                        return (
                                            <div key={entry.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-lg font-bold text-slate-900">{entry.title}</p>
                                                        <p className="mt-1 text-sm text-slate-500">
                                                            {format(new Date(entry.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                                                        </p>
                                                    </div>
                                                    <Badge className={`rounded-full border px-3 py-1 ${mood?.tone || 'bg-green-100 text-green-900 border-green-200'}`}>
                                                        {mood?.label || 'Sereno'}
                                                    </Badge>
                                                </div>
                                                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{entry.note}</p>
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

