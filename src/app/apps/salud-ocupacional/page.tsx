'use client'

import React, { useState, useEffect } from 'react'
import { Activity, Eye, HeartPulse, StretchHorizontal, Monitor, Power, CheckCircle2, Footprints, Droplet, Clock, ChevronRight, X, Info } from 'lucide-react'
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from 'sonner'
import ActiveBreaksTimer from '@/components/salud-ocupacional/active-breaks-timer'
import AssistantSymptoms from '@/components/salud-ocupacional/assistant-symptoms'

const CHECKLIST_ITEMS = [
    {
        title: "Asiento y Pies",
        text: "Ajusta la altura de tu silla. Tus pies deben tocar el suelo firmemente o usar un reposapiés. Rodillas a 90°.",
        icon: Footprints,
        theme: {
            text: "text-amber-500",
            bg: "bg-amber-100 dark:bg-amber-900/30",
            btn: "bg-amber-600 hover:bg-amber-700",
            bar: "bg-amber-500",
            box: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/50"
        },
        illustrationText: "Espacio para Ilustración: \nPersona sentada en silla ergonómica"
    },
    {
        title: "Monitor y Cuello",
        text: "El borde superior de tu pantalla debe estar a la altura de tus ojos y a un brazo de distancia.",
        icon: Monitor,
        theme: {
            text: "text-sky-500",
            bg: "bg-sky-100 dark:bg-sky-900/30",
            btn: "bg-sky-600 hover:bg-sky-700",
            bar: "bg-sky-500",
            box: "bg-sky-50/50 dark:bg-sky-950/20 border-sky-200/50 dark:border-sky-900/50"
        },
        illustrationText: "Espacio para Ilustración: \nMonitor a la altura de los ojos"
    },
    {
        title: "Brazos y Hombros",
        text: "Relaja los hombros. Tus codos deben estar apoyados a 90° sobre la mesa o los reposabrazos.",
        icon: StretchHorizontal,
        theme: {
            text: "text-rose-500",
            bg: "bg-rose-100 dark:bg-rose-900/30",
            btn: "bg-rose-600 hover:bg-rose-700",
            bar: "bg-rose-500",
            box: "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/50"
        },
        illustrationText: "Espacio para Ilustración: \nPostura de hombros relajados"
    },
    {
        title: "Hidratación",
        text: "Prepara agua cerca. Beber frecuentemente ayuda a tus discos intervertebrales y a tu concentración.",
        icon: Droplet,
        theme: {
            text: "text-teal-500",
            bg: "bg-teal-100 dark:bg-teal-900/30",
            btn: "bg-teal-600 hover:bg-teal-700",
            bar: "bg-teal-500",
            box: "bg-teal-50/50 dark:bg-teal-950/20 border-teal-200/50 dark:border-teal-900/50"
        },
        illustrationText: "Espacio para Ilustración: \nBotella de agua en el escritorio"
    }
]

const TIMELINE_EVENTS = [
    {
        time: "Minuto 20-25",
        title: "Pausa Corta: Regla 20-20-20",
        description: "Alerta rápida para descanso visual. Aparta la mirada de la pantalla.",
        theme: {
            badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
            text: "text-sky-500 dark:text-sky-400",
            bg: "bg-sky-500"
        },
        icon: Eye,
        media: "https://images.unsplash.com/photo-1510074377623-8cf13fb86c08?auto=format&fit=crop&q=80&w=600",
        benefits: "Mirar a 6 metros de distancia durante 20 segundos permite que el músculo ciliar del ojo se relaje, reduciendo significativamente la fatiga visual, previniendo el ojo seco y los dolores de cabeza tensionales."
    },
    {
        time: "Minuto 50-55",
        title: "Pausa Activa: Movimiento",
        description: "Levántate, estira y rompe el comportamiento sedentario.",
        theme: {
            badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
            text: "text-rose-500 dark:text-rose-400",
            bg: "bg-rose-500"
        },
        icon: StretchHorizontal,
        media: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=600",
        benefits: "Levantarse de la silla reactiva la circulación sanguínea hacia las extremidades, reduce la presión en los discos lumbares acumulada por la gravedad, y proporciona un reset cognitivo."
    },
    {
        time: "Minuto 120",
        title: "Hidratación y Palming",
        description: "Momento ideal para beber agua y relajar la vista profundamente.",
        theme: {
            badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
            text: "text-teal-500 dark:text-teal-400",
            bg: "bg-teal-500"
        },
        icon: Droplet,
        media: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=600",
        benefits: "La técnica de Palming utiliza el calor de las manos para relajar la musculatura periorbital. Combinado con hidratación sostenida, evitas la pesadez mental."
    },
    {
        time: "Fin de Jornada",
        title: "Registro de Síntomas",
        description: "Abre el asistente IA para reportar molestias.",
        theme: {
            badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
            text: "text-purple-500 dark:text-purple-400",
            bg: "bg-purple-500"
        },
        icon: HeartPulse,
        media: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=600",
        benefits: "Registrar tus molestias alimenta a tu Asistente Inteligente. Esto le permite sugerirte rutinas compensatorias adaptadas a ti para mañana."
    }
]

export default function OccupationalHealthDashboard() {
    const [isWorking, setIsWorking] = useState(false)
    const [showChecklist, setShowChecklist] = useState(false)
    const [checklistStep, setChecklistStep] = useState(0)
    const [selectedEvent, setSelectedEvent] = useState<any>(null)

    // Bloquear scroll de manera segura cuando el modal está abierto (evitando errores SSR)
    useEffect(() => {
        if (typeof window === 'undefined') return

        if (selectedEvent) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }

        return () => {
            document.body.style.overflow = ''
        }
    }, [selectedEvent])

    const handleStartWork = () => setShowChecklist(true)
    const handleStopWork = () => {
        setIsWorking(false)
        setChecklistStep(0)
        toast("Jornada finalizada", { description: "Buen trabajo hoy. Descansa y desconecta." })
    }
    const nextChecklistStep = () => {
        if (checklistStep < CHECKLIST_ITEMS.length - 1) {
            setChecklistStep(prev => prev + 1)
        } else {
            setShowChecklist(false)
            setIsWorking(true)
            toast.success("¡Jornada iniciada!", { description: "Tus temporizadores de pausas han comenzado en background." })
        }
    }

    // 1. PANTALLA DE INICIO (Call to Action)
    if (!isWorking && !showChecklist) {
        return (
            <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 min-h-[80vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
                <div className="text-center space-y-4">
                    <div className="mx-auto bg-teal-100 dark:bg-teal-900/50 text-teal-600 p-4 rounded-full w-24 h-24 flex items-center justify-center mb-6 ring-8 ring-teal-50 dark:ring-teal-950">
                        <HeartPulse className="w-12 h-12" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Tu Salud Importa</h1>
                    <p className="text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
                        Inicia tu sesión de trabajo para activar el mapa de ergonomía y prevenir el dolor y la fatiga muscular.
                    </p>
                </div>

                <Button
                    size="lg"
                    onClick={handleStartWork}
                    className="h-16 px-12 text-lg rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-xl shadow-teal-500/25 hover:scale-105 transition-transform"
                >
                    <Power className="w-6 h-6 mr-3" />
                    Empezar a Trabajar
                </Button>
            </div>
        )
    }

    // 2. CHECKLIST VISUAL
    if (showChecklist) {
        const stepData = CHECKLIST_ITEMS[checklistStep]
        const StepIcon = stepData.icon

        return (
            <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24 min-h-[80vh] flex flex-col items-center justify-center animate-in slide-in-from-bottom-8 duration-500">
                <Card className="w-full overflow-hidden border-border/50 shadow-2xl bg-card">
                    {/* Placeholder visual minimalista para la ilustración */}
                    <div className={`h-64 sm:h-80 w-full relative flex flex-col items-center justify-center p-8 text-center border-b ${stepData.theme.box}`}>
                        <div className={`inline-flex items-center justify-center p-4 rounded-3xl ${stepData.theme.bg} ${stepData.theme.text} mb-6 shadow-sm border border-background/20`}>
                            <StepIcon className="w-12 h-12" />
                        </div>
                        <p className={`text-lg sm:text-xl font-medium max-w-sm whitespace-pre-line opacity-80 ${stepData.theme.text}`}>
                            {stepData.illustrationText}
                        </p>
                    </div>

                    <CardContent className="pt-8 pb-6 px-6 sm:px-10 text-center flex flex-col items-center justify-center">
                        <h2 className="text-3xl font-bold mb-4">{stepData.title}</h2>
                        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                            {stepData.text}
                        </p>
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-6 border-t border-border/50 pt-6 pb-6 px-6 sm:px-10 bg-muted/20">
                        <div className="flex gap-2">
                            {CHECKLIST_ITEMS.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-2.5 rounded-full transition-all duration-500 ${idx === checklistStep ? `w-10 ${stepData.theme.bar}` : idx < checklistStep ? 'w-4 bg-teal-500/40' : 'w-4 bg-slate-200 dark:bg-slate-800'}`}
                                />
                            ))}
                        </div>
                        <Button
                            onClick={nextChecklistStep}
                            size="lg"
                            className={`w-full sm:w-auto ${stepData.theme.btn} text-white rounded-full px-8`}
                        >
                            {checklistStep === CHECKLIST_ITEMS.length - 1 ? (
                                <><CheckCircle2 className="w-5 h-5 mr-2" /> Todo Listo</>
                            ) : (
                                <>Comprobado <ChevronRight className="w-5 h-5 ml-2" /></>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    // 3. DASHBOARD (TIMELINE DEL DÍA)
    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 space-y-12 animate-in fade-in duration-700">
            {/* Modal de Beneficios */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedEvent(null)} />
                    <div className="relative bg-card w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-300">
                        <div className="relative h-56 w-full bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={selectedEvent.media} alt={selectedEvent.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 backdrop-blur-md transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h3 className="absolute bottom-6 left-6 text-2xl font-bold text-white pr-6">{selectedEvent.title}</h3>
                        </div>
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${selectedEvent.theme.badge}`}>
                                <selectedEvent.icon className="w-4 h-4" />
                                {selectedEvent.time}
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-semibold text-lg flex items-center gap-2">
                                    <Info className="w-5 h-5 text-muted-foreground" />
                                    Beneficios de esta acción
                                </h4>
                                <p className="text-muted-foreground leading-relaxed text-[15px]">
                                    {selectedEvent.benefits}
                                </p>
                            </div>
                            <Button onClick={() => setSelectedEvent(null)} className="w-full rounded-full h-12 text-md">
                                Entendido
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Rediseñado */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-muted/30 p-6 rounded-3xl border border-border/50">
                <div className="flex items-center gap-4">
                    <div className="bg-teal-500 text-white p-4 rounded-full shadow-lg shadow-teal-500/20">
                        <Activity className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Jornada Activa</h1>
                        <p className="text-muted-foreground">Monitoreando tu bienestar en segundo plano</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 rounded-full shrink-0"
                    onClick={handleStopWork}
                >
                    <Power className="w-5 h-5 mr-2" />
                    Finalizar
                </Button>
            </header>

            {/* Temporizador Superior (El motor) */}
            <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-2">Motor de Pausas</h2>
                <ActiveBreaksTimer autoStart={isWorking} />
            </div>

            {/* Timeline Educativo */}
            <div className="space-y-6 pt-6">
                <div className="px-2">
                    <h2 className="text-2xl font-bold">El Mapa de tu Día</h2>
                    <p className="text-muted-foreground mt-1">Así transcurrirá tu jornada. Selecciona una tarjeta para ver sus beneficios.</p>
                </div>

                <div className="relative ml-4 sm:ml-8 border-l-2 border-muted-foreground/20 space-y-8 pb-8 mt-6">
                    {TIMELINE_EVENTS.map((event, idx) => {
                        const EventIcon = event.icon
                        return (
                            <div key={idx} className="relative pl-8 sm:pl-10 group mt-4">
                                {/* Nodo del Timeline */}
                                <div className={`absolute -left-[17px] top-6 w-8 h-8 rounded-full border-4 border-background ${event.theme.bg} flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}>
                                    <EventIcon className="w-3.5 h-3.5 text-white" />
                                </div>

                                {/* Tarjeta Clicable */}
                                <Card
                                    className="overflow-hidden border-border/50 hover:border-border cursor-pointer transition-all hover:shadow-md group-hover:-translate-y-1 bg-card/50 backdrop-blur-sm"
                                    onClick={() => setSelectedEvent(event)}
                                >
                                    <div className="flex flex-col sm:flex-row">
                                        <div className="sm:w-1/3 h-40 sm:h-auto overflow-hidden relative">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={event.media}
                                                alt={event.title}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                        </div>
                                        <div className="p-5 sm:w-2/3 flex flex-col justify-center">
                                            <div className={`text-xs font-bold uppercase tracking-wider ${event.theme.text} mb-2 flex items-center gap-1.5`}>
                                                <Clock className="w-3.5 h-3.5" />
                                                {event.time}
                                            </div>
                                            <h3 className="text-lg font-bold mb-1.5 group-hover:text-foreground transition-colors">{event.title}</h3>
                                            <p className="text-muted-foreground text-sm leading-relaxed mb-4">{event.description}</p>

                                            <div className="flex items-center text-sm font-medium text-foreground/70 group-hover:text-foreground transition-colors mt-auto">
                                                Ver beneficios <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Registro de Síntomas al final (Config y Asistente) */}
            <div className="space-y-3 pt-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-2">Ajustes y Asistente</h2>
                <AssistantSymptoms />
            </div>
        </div>
    )
}
