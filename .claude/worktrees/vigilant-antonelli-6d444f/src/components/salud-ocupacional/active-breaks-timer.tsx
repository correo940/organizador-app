'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, StretchHorizontal, Footprints, Armchair, ChevronDown } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type TimerMode = 'work' | 'shortBreak' | 'longBreak' | 'movement' | 'standing'

interface TimerConfig {
    work: number;
    shortBreak: number;
    standing: number;
    movement: number;
}

export default function ActiveBreaksTimer({ autoStart = false }: { autoStart?: boolean }) {
    // Configuración base (25m trabajo / 5m pausa)
    // O regla 20-8-2 (20 sentado, 8 pie, 2 mov)
    const [config, setConfig] = useState<TimerConfig>({
        work: 25 * 60,
        shortBreak: 5 * 60,
        standing: 8 * 60,
        movement: 2 * 60,
    })

    const [ruleSet, setRuleSet] = useState<'pomodoro' | '20-8-2' | 'active-sitting'>('pomodoro')

    const [mode, setMode] = useState<TimerMode>('work')
    const [timeLeft, setTimeLeft] = useState(config.work)
    const [isActive, setIsActive] = useState(autoStart) // <--- Cambio aquí para leer autoStart inicial
    const [cycles, setCycles] = useState(0)

    // Auto arrancar si el dashboard le pasa autoStart a true 
    useEffect(() => {
        if (autoStart) {
            setIsActive(true)
        }
    }, [autoStart])

    const switchMode = useCallback((newMode: TimerMode, customDuration?: number) => {
        setMode(newMode)
        setTimeLeft(customDuration || config[newMode as keyof TimerConfig] || config.work)
        setIsActive(false)
    }, [config])

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((time) => time - 1)
            }, 1000)
        } else if (isActive && timeLeft === 0) {
            setIsActive(false)

            // Lógica de transición
            if (ruleSet === 'pomodoro') {
                if (mode === 'work') {
                    toast("¡Tiempo de descansar!", { description: "Realiza tu pausa de 5 minutos." })
                    switchMode('shortBreak')
                    setCycles(c => c + 1)
                } else {
                    toast("¡Fin de la pausa!", { description: "Hora de volver a concentrarse." })
                    switchMode('work')
                }
            } else if (ruleSet === '20-8-2') {
                if (mode === 'work') {
                    toast("¡Hora de levantarse!", { description: "Trabaja de pie." })
                    switchMode('standing')
                } else if (mode === 'standing') {
                    toast("¡A moverse!", { description: "Camina o estira durante 2 minutos." })
                    switchMode('movement')
                } else {
                    toast("¡Vuelve a tu asiento!", { description: "Comienza otro ciclo de 20 min." })
                    switchMode('work', 20 * 60)
                    setCycles(c => c + 1)
                }
            }
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isActive, timeLeft, mode, ruleSet, switchMode])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const getTotalTimeForMode = (m: TimerMode) => {
        if (ruleSet === '20-8-2' && m === 'work') return 20 * 60;
        return config[m as keyof TimerConfig] || config.work
    }

    const progress = ((getTotalTimeForMode(mode) - timeLeft) / getTotalTimeForMode(mode)) * 100

    const toggleTimer = () => setIsActive(!isActive)
    const resetTimer = () => {
        setIsActive(false)
        setTimeLeft(getTotalTimeForMode(mode))
    }

    const applyRuleSet = (type: 'pomodoro' | '20-8-2' | 'active-sitting') => {
        setRuleSet(type)
        if (type === 'pomodoro') {
            setConfig({ ...config, work: 25 * 60, shortBreak: 5 * 60 })
            switchMode('work', 25 * 60)
        } else if (type === '20-8-2') {
            // 20 Sentado, 8 Pie, 2 Movimiento (para escritorio elevable)
            switchMode('work', 20 * 60)
        } else if (type === 'active-sitting') {
            setConfig({ ...config, work: 30 * 60, shortBreak: 3 * 60 }) // Micromovimientos sugeridos cada 30m
            switchMode('work', 30 * 60)
        }
    }

    // Sugerencia dinámica basada en el modo
    const getModeSuggestion = () => {
        switch (mode) {
            case 'work': return "Mantén tu postura ergonómica."
            case 'shortBreak': return "Parpadea conscientemente, estira los brazos y el cuello."
            case 'standing': return "Ajusta la altura del escritorio y distrubuye bien el peso en tus pies."
            case 'movement': return "Aprovecha para rellenar tu botella de agua o caminar por la sala."
            default: return ""
        }
    }

    const getModeColor = () => {
        switch (mode) {
            case 'work': return "rose"
            case 'shortBreak': return "teal"
            case 'standing': return "amber"
            case 'movement': return "sky"
            default: return "slate"
        }
    }

    const colorScheme = getModeColor()

    return (
        <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle>Temporizador y Pausas</CardTitle>
                    <CardDescription>Evita el sedentarismo con alertas guiadas.</CardDescription>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-auto">
                            Regla: {ruleSet === 'pomodoro' ? '25/5' : ruleSet === '20-8-2' ? '20-8-2' : 'Active Sitting'}
                            <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => applyRuleSet('pomodoro')}>
                            Pomodoro Ergonómico (25m trabajo / 5m pausa)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => applyRuleSet('20-8-2')}>
                            Regla 20-8-2 (Escritorio Elevable)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => applyRuleSet('active-sitting')}>
                            Active Sitting (Micro-movimientos cada 30m)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>

            <CardContent className="pt-6 pb-6 text-center space-y-8">
                {/* Timer Circle/Text */}
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center rounded-full border-[12px] border-slate-100 dark:border-slate-800">
                        {/* Indicador de anillo simulado - podría mejorarse con SVG circular */}
                        <div
                            className={`absolute inset-0 rounded-full border-[12px] border-${colorScheme}-500/80 transition-all duration-1000`}
                            style={{ clipPath: `polygon(50% 50%, 50% 0%, ${progress > 12.5 ? '100% 0%,' : ''} ${progress > 37.5 ? '100% 100%,' : ''} ${progress > 62.5 ? '0% 100%,' : ''} ${progress > 87.5 ? '0% 0%,' : ''} ${progress <= 12.5 ? 50 + progress * 4 + '% 0%' : progress <= 37.5 ? '100% ' + (progress - 12.5) * 4 + '%' : progress <= 62.5 ? (100 - (progress - 37.5) * 4) + '% 100%' : progress <= 87.5 ? '0% ' + (100 - (progress - 62.5) * 4) + '%' : (progress - 87.5) * 4 + '% 0%'})` }}
                        />
                        <div className="z-10 flex flex-col items-center">
                            <span className="text-5xl sm:text-7xl font-light tracking-tighter">
                                {formatTime(timeLeft)}
                            </span>
                            <span className={`text-sm font-medium mt-2 text-${colorScheme}-500 uppercase tracking-widest`}>
                                {mode === 'work' ? 'Enfoque' : mode === 'shortBreak' ? 'Descanso' : mode === 'standing' ? 'De pie' : 'Movimiento'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center flex-col items-center gap-1">
                    <p className="text-sm text-muted-foreground max-w-[280px]">
                        {getModeSuggestion()}
                    </p>
                    {cycles > 0 && <p className="text-xs text-foreground/50 mt-2">Ciclos completados: {cycles}</p>}
                </div>

                {/* Controls */}
                <div className="flex justify-center gap-4">
                    <Button variant="outline" size="icon" className="w-12 h-12 rounded-full" onClick={resetTimer}>
                        <RotateCcw className="w-5 h-5" />
                    </Button>
                    <Button
                        size="icon"
                        className={`w-16 h-16 rounded-full bg-${colorScheme}-600 hover:bg-${colorScheme}-700 text-white shadow-lg shadow-${colorScheme}-500/20`}
                        onClick={toggleTimer}
                    >
                        {isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                    </Button>
                    <Button variant="outline" size="icon" className="w-12 h-12 rounded-full" onClick={() => switchMode(mode === 'work' ? 'shortBreak' : 'work')}>
                        <StretchHorizontal className="w-5 h-5" />
                    </Button>
                </div>
            </CardContent>

            <CardFooter className="bg-muted/30 border-t flex justify-around p-4">
                <div className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" onClick={() => applyRuleSet('pomodoro')}>
                    <Armchair className={`w-5 h-5 ${ruleSet === 'pomodoro' ? 'text-teal-500' : ''}`} />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Pomodoro</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" onClick={() => applyRuleSet('20-8-2')}>
                    <Footprints className={`w-5 h-5 ${ruleSet === '20-8-2' ? 'text-amber-500' : ''}`} />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Regla 20-8-2</span>
                </div>
            </CardFooter>
        </Card>
    )
}
