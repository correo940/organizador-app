'use client';

import React, { useState } from 'react';
import CalendarWidget from './widgets/calendar-widget';
import OrganizerWidget from './widgets/organizer-widget';
import AppsSummaryWidget from './widgets/apps-summary-widget';
import QuickActionFab from './quick-action-fab';
import { usePlatform } from '@/hooks/use-platform';
import MobileDashboard from './mobile-dashboard';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

export default function HomeDashboard() {
    // Hooks SIEMPRE deben estar al principio, antes de cualquier return condicional
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const platformInfo = usePlatform();
    const { isMobile } = platformInfo;
    // ✅ Leer el user UNA sola vez desde el AuthProvider global
    const { user } = useAuth();

    // Si es móvil (iOS o Android), mostrar el dashboard móvil
    if (isMobile) {
        return <MobileDashboard />;
    }

    // Si es web, mostrar el dashboard original de 3 columnas

    return (
        <>
            <div className="container mx-auto px-4 py-1 pb-32 max-w-7xl lg:h-[calc(100vh-100px)] flex flex-col">

                <div className="flex flex-col gap-4 flex-1 min-h-0">
                    {/* Fila Superior: Resumen General */}
                    <div className="w-full shrink-0">
                        <AppsSummaryWidget selectedDate={selectedDate} user={user} />
                    </div>

                    {/* Grid Principal: 3 Columnas en pantallas grandes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 flex-1 min-h-0 mb-8">

                        {/* Columna 1: Calendario (Izquierda) */}
                        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
                            <CalendarWidget date={selectedDate} onDateSelect={setSelectedDate} user={user} />
                        </div>

                        {/* Columna 2: Organizador (Centro y Derecha) */}
                        <div className="lg:col-span-8 flex flex-col h-full min-h-0">
                            <OrganizerWidget selectedDate={selectedDate} user={user} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
