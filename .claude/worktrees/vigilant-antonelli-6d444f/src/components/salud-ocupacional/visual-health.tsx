'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Focus, SunMedium, Play, RotateCcw, Glasses } from 'lucide-react'

export default function VisualHealth() {
    const [timerActive, setTimerActive] = useState(false)
    const [timeLeft, setTimeLeft] = useState(20)

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(t => t - 1)
            }, 1000)
        } else if (timerActive && timeLeft === 0) {
            setTimerActive(false)
            // Aquí podríamos reproducir un sonido de notificación sutil
        }
        return () => {
            if (interval) clearInterval(interval)
        }
    }, [timerActive, timeLeft])

    const startTimer = () => {
        setTimeLeft(20)
        setTimerActive(true)
    }

    const resetTimer = () => {
        setTimerActive(false)
        setTimeLeft(20)
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Regla 20-20-20 */}
                <Card className="border-sky-500/20 bg-sky-500/5 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
                            <Eye className="w-5 h-5" />
                            Regla 20-20-20
                        </CardTitle>
                        <CardDescription className="text-sky-800/70 dark:text-sky-300/70">
                            El estándar de oro para prevenir la fatiga visual.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm">
                            Cada <strong>20 minutos</strong>, mira a un objeto situado a una distancia de <strong>20 pies (aprox. 6 metros)</strong> durante <strong>20 segundos</strong>.
                        </p>

                        <div className="bg-sky-100 dark:bg-sky-900/30 rounded-xl p-6 flex flex-col items-center justify-center space-y-4">
                            <span className="text-5xl font-light text-sky-600 dark:text-sky-400 tracking-tighter">
                                00:{timeLeft.toString().padStart(2, '0')}
                            </span>

                            <div className="flex gap-2">
                                <Button
                                    onClick={startTimer}
                                    className="bg-sky-600 hover:bg-sky-700 text-white"
                                    disabled={timerActive}
                                >
                                    <Play className="w-4 h-4 mr-2" /> Iniciar (20s)
                                </Button>
                                <Button variant="outline" size="icon" onClick={resetTimer} className="border-sky-200 text-sky-700 hover:bg-sky-100">
                                    <RotateCcw className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Técnica de Palming */}
                <Card className="border-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2">
                            <SunMedium className="w-5 h-5 text-amber-500" />
                            Técnica de Palming
                        </CardTitle>
                        <CardDescription>
                            Relación profunda del sistema visual.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>Siéntate cómodamente y apoya los codos sobre tu escritorio.</li>
                            <li>Frota tus palmas durante unos segundos para generar calor.</li>
                            <li>Ahueca las palmas de las manos y colócalas suavemente sobre tus ojos cerrados.</li>
                            <li>Asegúrate de bloquear toda la luz sin presionar los globos oculares.</li>
                            <li>Respira profundamente y mantén la posición de 1 a 3 minutos.</li>
                        </ol>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Enfoque Alterno */}
                <Card className="border-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2">
                            <Focus className="w-5 h-5 text-indigo-500" />
                            Enfoque Alterno
                        </CardTitle>
                        <CardDescription>Entrenamiento del músculo ciliar.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                        <p>Coloca tu pulgar a unos 25cm de tu cara y elige un objeto distante (más de 6m).</p>
                        <ul className="space-y-2 border-l-2 border-indigo-500/30 pl-4 py-2">
                            <li className="flex gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" /> Enfoca tu pulgar durante 5 segundos.</li>
                            <li className="flex gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500/50 mt-1.5" /> Cambia el enfoque al objeto distante rápido y sin mover la cabeza por 5s.</li>
                            <li className="flex gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500/20 mt-1.5" /> Repite este ciclo 5 veces seguidas.</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Parpadeo y Entorno */}
                <Card className="border-border bg-slate-50 dark:bg-slate-900/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2">
                            <Glasses className="w-5 h-5 text-green-500" />
                            Parpadeo y Entorno
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                        <p>Cuando miramos pantallas, <strong>nuestra tasa de parpadeo se reduce a la mitad</strong>, provocando sequedad y fatiga.</p>
                        <ul className="space-y-2 list-disc pl-5">
                            <li>Pestañea fuerte y conscientemente 10 veces seguidas como "reset".</li>
                            <li>Ajusta el brillo de tu pantalla: no debe ser la única fuente de luz de la habitación, ni debe deslumbrarte.</li>
                            <li>Reduce la luz azul en tu monitor mediante software, sobre todo al atardecer.</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

