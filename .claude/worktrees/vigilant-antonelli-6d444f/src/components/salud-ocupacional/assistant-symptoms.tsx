'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Bot, BellOff, Stethoscope, ChevronRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/apps/mi-hogar/auth-context'

const PAIN_ZONES = [
    { id: 'neck', label: 'Cuello / Cervicales' },
    { id: 'shoulders', label: 'Hombros' },
    { id: 'upper_back', label: 'Espalda Alta / Romboides' },
    { id: 'lower_back', label: 'Lumbar' },
    { id: 'wrists', label: 'Muñecas / Manos' },
    { id: 'eyes', label: 'Ojos / Fatiga Visual' }
]

export default function AssistantSymptoms() {
    const { user } = useAuth()

    // Configuración Notificaciones
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)
    const [startTime, setStartTime] = useState('09:00')
    const [endTime, setEndTime] = useState('18:00')

    // Registro de Síntomas
    const [painLevel, setPainLevel] = useState([3])
    const [selectedZones, setSelectedZones] = useState<string[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [recommendation, setRecommendation] = useState<string | null>(null)

    useEffect(() => {
        if (!user) return

        // Cargar configuración existente
        const fetchSettings = async () => {
            const { data } = await supabase
                .from('occupational_settings')
                .select('*')
                .eq('user_id', user.id)
                .single()

            if (data) {
                setNotificationsEnabled(data.notifications_enabled)
                if (data.notifications_start_time) setStartTime(data.notifications_start_time.substring(0, 5))
                if (data.notifications_end_time) setEndTime(data.notifications_end_time.substring(0, 5))
            }
        }

        fetchSettings()
    }, [user])

    const toggleZone = (zoneId: string) => {
        setSelectedZones(prev =>
            prev.includes(zoneId)
                ? prev.filter(z => z !== zoneId)
                : [...prev, zoneId]
        )
    }

    const saveSettings = async () => {
        if (!user) return;

        try {
            // Upsert configuration
            const { error } = await supabase
                .from('occupational_settings')
                .upsert({
                    user_id: user.id,
                    notifications_enabled: notificationsEnabled,
                    notifications_start_time: startTime + ':00',
                    notifications_end_time: endTime + ':00'
                }, { onConflict: 'user_id' })

            if (error) throw error
            toast.success("Configuración de notificaciones guardada")
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar la configuración")
        }
    }

    const logSymptoms = async () => {
        if (!user) return
        if (selectedZones.length === 0 && painLevel[0] > 0) {
            toast.error("Por favor, selecciona las zonas de dolor.")
            return
        }

        setIsSubmitting(true)

        try {
            // Generar la prescripción dinámica (Simulación IA Básica basada en reglas)
            let presc = "Basado en tu reporte, te recomendamos: "
            if (painLevel[0] > 7) {
                presc += "Detener el trabajo de inmediato y aplicar una pausa larga. "
            }
            if (selectedZones.includes('eyes')) {
                presc += "Aplicar la Regla 20-20-20 estricta y bajar el brillo de la pantalla. "
            }
            if (selectedZones.includes('neck') || selectedZones.includes('shoulders')) {
                presc += "Pausar cada 30m para realizar Estiramiento Pectoral y Elevaciones Y-T-W. "
            }
            if (selectedZones.includes('lower_back')) {
                presc += "Usar la regla 20-8-2 para cambiar de postura y hacer el Flow de Cadera. "
            }
            if (painLevel[0] <= 3 && selectedZones.length === 0) {
                presc = "¡Excelente! Estás gestionando bien tu esfuerzo. Mantén las pausas cada 25 minutos."
            }

            setRecommendation(presc)

            // Guardar en Supabase
            const { error } = await supabase
                .from('occupational_symptoms')
                .insert({
                    user_id: user.id,
                    pain_level: painLevel[0],
                    pain_zones: selectedZones,
                    notes: presc
                })

            if (error) throw error
            toast.success("Síntomas registrados correctamente")

        } catch (error) {
            console.error(error)
            toast.error("Error al registrar los síntomas")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Panel de Registro de Síntomas */}
            <Card className="border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-purple-500" />
                        Registro Diario de Bienestar
                    </CardTitle>
                    <CardDescription>
                        Registra cualquier molestia para recibir recomendaciones.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label>Nivel General de Dolor / Fatiga</Label>
                            <span className="font-bold text-lg text-purple-600">{painLevel[0]} / 10</span>
                        </div>
                        <Slider
                            value={painLevel}
                            onValueChange={setPainLevel}
                            max={10}
                            step={1}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Sin dolor</span>
                            <span>Moderado</span>
                            <span>Severo</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>¿Dónde sientes la molestia?</Label>
                        <div className="flex flex-wrap gap-2">
                            {PAIN_ZONES.map(zone => (
                                <button
                                    key={zone.id}
                                    onClick={() => toggleZone(zone.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedZones.includes(zone.id)
                                            ? 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/50 dark:border-purple-600 dark:text-purple-300'
                                            : 'bg-muted/50 hover:bg-muted border-transparent text-muted-foreground'
                                        }`}
                                >
                                    {zone.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {recommendation && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mt-4 animate-in fade-in zoom-in duration-300">
                            <h4 className="flex items-center gap-2 font-semibold text-purple-800 dark:text-purple-300 mb-2">
                                <Bot className="w-4 h-4" /> Recomendación IA
                            </h4>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                                {recommendation}
                            </p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-muted/30 border-t flex justify-end p-4">
                    <Button onClick={logSymptoms} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                        {isSubmitting ? "Analizando..." : "Registrar y Obtener Prescripción"}
                    </Button>
                </CardFooter>
            </Card>

            {/* Panel de Configuración Anti-Fatiga */}
            <Card className="border-border">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                        <BellOff className="w-5 h-5 text-slate-500" />
                        Notificaciones Inteligentes
                    </CardTitle>
                    <CardDescription>
                        Evita la fatiga de configuración. Limita cuándo la app puede enviarte alertas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                        <div className="space-y-0.5">
                            <Label className="text-base font-medium">Permitir Notificaciones In-App</Label>
                            <p className="text-xs text-muted-foreground">Alertas silenciosas durante tu jornada.</p>
                        </div>
                        <Switch
                            checked={notificationsEnabled}
                            onCheckedChange={setNotificationsEnabled}
                        />
                    </div>

                    <div className={`space-y-4 transition-opacity ${!notificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <h4 className="text-sm font-semibold text-foreground">Horario de Trabajo (No Molestar fuera de esta franja)</h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start-time">Hora de Inicio</Label>
                                <input
                                    type="time"
                                    id="start-time"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end-time">Hora de Fin</Label>
                                <input
                                    type="time"
                                    id="end-time"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <ul className="text-xs text-muted-foreground space-y-2 mt-4 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/30">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-yellow-500 shrink-0" />
                                <span>Las alertas de pausa (25/5) sólo aparecerán si inicias el temporizador manualmente.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-yellow-500 shrink-0" />
                                <span>Nunca te molestaremos con ruidos fuertes o pop-ups intrusivos fuera de tu jornada.</span>
                            </li>
                        </ul>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t flex justify-end p-4 mt-auto h-full items-end pb-4 pt-4">
                    <Button onClick={saveSettings} variant="outline" className="mt-auto">
                        Guardar Preferencias
                    </Button>
                </CardFooter>
            </Card>

        </div>
    )
}
