'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FixedScheduleEditor } from "./fixed-schedule-editor";
import { ScheduleViewer } from "./schedule-viewer";
import { Calendar, Play, Settings } from "lucide-react";

interface MainDashboardProps {
    profile: any;
    onReconfigure: () => void;
}

type View = 'dashboard' | 'fixed-schedule' | 'generator';

export function MainDashboard({ profile, onReconfigure }: MainDashboardProps) {
    const [view, setView] = useState<View>('dashboard');

    if (view === 'fixed-schedule') {
        return <FixedScheduleEditor onBack={() => setView('dashboard')} />;
    }

    // Generator view
    if (view === 'generator') {
        return <ScheduleViewer onBack={() => setView('dashboard')} />;
    }

    return (
        <div className="p-6 max-w-full mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Organizador Vital
                </h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
                    <span>🏃 <strong className="capitalize text-foreground">{profile.physical_level}</strong></span>
                    <span>⚡ <strong className="capitalize text-foreground">{profile.availability_intensity}</strong></span>
                    {profile.wake_time && <span>☀️ <strong className="text-foreground">{profile.wake_time}</strong></span>}
                    {profile.sleep_time && <span>🌙 <strong className="text-foreground">{profile.sleep_time}</strong></span>}
                </div>
                <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={onReconfigure}>
                        <Settings className="w-4 h-4 mr-2" /> Reconfigurar Perfil
                    </Button>
                </div>
            </header>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

                {/* Fixed Schedule Card */}
                <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => setView('fixed-schedule')}>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="p-6">
                        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">1. Horario Fijo</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            Define tus bloques inamovibles: trabajo, clases, sueño. El sistema respetará estos espacios.
                        </p>
                        <Button className="w-full" variant="secondary">Editar Horario</Button>
                    </div>
                </div>

                {/* Generate Card - Now secondary option */}
                <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow hover:shadow-lg transition-all cursor-pointer ring-1 ring-primary/20"
                    onClick={() => setView('generator')}>
                    <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent dark:from-green-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="p-6">
                        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300">
                            <Play className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">2. Generar Agenda</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            Combina tu horario fijo y el catálogo para crear tu plan semanal ideal automáticamente.
                        </p>
                        <Button className="w-full">Generar Ahora</Button>
                    </div>
                </div>

            </div>
        </div>
    );
}
