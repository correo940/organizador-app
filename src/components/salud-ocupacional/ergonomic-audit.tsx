'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, ChevronRight, ChevronLeft, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/apps/mi-hogar/auth-context'
import { toast } from 'sonner'
import type { OccupationalAudit } from '@/types/occupational-health'

const AUDIT_STEPS = [
    {
        id: 'feet_alignment',
        title: 'Pies y Piernas',
        description: 'Verifica el apoyo de tus pies.',
        question: '¿Están tus pies completamente apoyados en el suelo o sobre un reposapiés?',
        options: [
            { value: 'perfect', label: 'Sí, firmemente apoyados', score: 10 },
            { value: 'partial', label: 'A veces cruzo las piernas o quedan colgando', score: 5 },
            { value: 'bad', label: 'No, no alcanzo el suelo o no uso reposapiés', score: 0 },
        ]
    },
    {
        id: 'knees_alignment',
        title: 'Rodillas',
        description: 'Alineación respecto a la cadera.',
        question: '¿Forman tus rodillas un ángulo de 90° a 100°, al nivel o por debajo de las caderas?',
        options: [
            { value: 'perfect', label: 'Sí, ángulo correcto', score: 10 },
            { value: 'bad', label: 'No, mis rodillas están más altas que la cadera', score: 0 },
        ]
    },
    {
        id: 'pelvis_alignment',
        title: 'Pelvis y Espalda',
        description: 'Postura en el asiento.',
        question: '¿Están tus caderas situadas al fondo de la silla y tu espalda bien apoyada?',
        options: [
            { value: 'perfect', label: 'Sí, uso todo el asiento', score: 10 },
            { value: 'partial', label: 'Me siento en el borde de la silla a menudo', score: 3 },
            { value: 'bad', label: 'Mi espalda no toca el respaldo', score: 0 },
        ]
    },
    {
        id: 'lumbar_support',
        title: 'Soporte Lumbar',
        description: 'Cuidado de la curva natural.',
        question: '¿Tu zona lumbar tiene apoyo que mantiene su curva natural?',
        options: [
            { value: 'perfect', label: 'Sí, la silla tiene soporte o uso un cojín lumbar', score: 10 },
            { value: 'bad', label: 'No, siento un hueco en la espalda baja', score: 0 },
        ]
    },
    {
        id: 'arms_alignment',
        title: 'Brazos',
        description: 'Tensión en los hombros.',
        question: '¿Están tus hombros relajados y los codos pegados al cuerpo (90°)?',
        options: [
            { value: 'perfect', label: 'Sí, hombros relajados y codos apoyados', score: 10 },
            { value: 'partial', label: 'Mis codos están apoyados pero mis hombros encogidos', score: 5 },
            { value: 'bad', label: 'No hay soporte para mis brazos / Codos en el aire', score: 0 },
        ]
    },
    {
        id: 'wrists_alignment',
        title: 'Muñecas',
        description: 'Posición al teclear o usar el ratón.',
        question: '¿Tus muñecas se mantienen rectas (sin apoyo en bordes duros) al trabajar?',
        options: [
            { value: 'perfect', label: 'Sí, están rectas y neutras', score: 10 },
            { value: 'partial', label: 'Están un poco dobladas hacia arriba', score: 5 },
            { value: 'bad', label: 'Suelo apoyarlas sobre el borde de la mesa/portátil', score: 0 },
        ]
    },
    {
        id: 'monitor_alignment',
        title: 'Monitor',
        description: 'Altura y distancia visual.',
        question: '¿Está la pantalla a la altura de tus ojos y a un brazo de distancia?',
        options: [
            { value: 'perfect', label: 'Sí, ambas condiciones se cumplen', score: 10 },
            { value: 'partial', label: 'La distancia es buena, pero miro hacia abajo', score: 5 },
            { value: 'bad', label: 'El monitor está muy cerca y bajo', score: 0 },
        ]
    },
    {
        id: 'neck_alignment',
        title: 'Cuello',
        description: 'Evitar tensión cervical.',
        question: '¿Tu cuello permanece recto, sin "postura de tortuga" (inclinado adelante)?',
        options: [
            { value: 'perfect', label: 'Sí, mantengo la cabeza alineada', score: 10 },
            { value: 'partial', label: 'A veces me sorprendo inclinando el cuello', score: 5 },
            { value: 'bad', label: 'No, tiendo a adelantar mucho la cabeza', score: 0 },
        ]
    }
]

export default function ErgonomicAudit() {
    const { user } = useAuth()
    const [currentStep, setCurrentStep] = useState(0)
    const [answers, setAnswers] = useState<Record<string, { value: string, score: number }>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isCompleted, setIsCompleted] = useState(false)
    const [finalScore, setFinalScore] = useState(0)

    const stepInfo = AUDIT_STEPS[currentStep]
    const isLastStep = currentStep === AUDIT_STEPS.length - 1
    const progress = ((currentStep) / AUDIT_STEPS.length) * 100

    const handleSelect = (value: string) => {
        const option = stepInfo.options.find(o => o.value === value)
        if (option) {
            setAnswers(prev => ({
                ...prev,
                [stepInfo.id]: { value: option.value, score: option.score }
            }))
        }
    }

    const currentAnswer = answers[stepInfo?.id]?.value

    const nextStep = () => {
        if (currentAnswer) {
            setCurrentStep(prev => Math.min(prev + 1, AUDIT_STEPS.length - 1))
        }
    }

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0))
    }

    const calculateTotalScore = () => {
        const maxPossible = AUDIT_STEPS.length * 10
        const earned = Object.values(answers).reduce((acc, curr) => acc + curr.score, 0)
        return Math.round((earned / maxPossible) * 100)
    }

    const finishAudit = async () => {
        if (!user) return
        setIsSubmitting(true)

        const calculatedScore = calculateTotalScore()

        try {
            const auditData: Partial<OccupationalAudit> = {
                user_id: user.id,
                score: calculatedScore,
                feet_alignment: answers.feet_alignment?.value,
                knees_alignment: answers.knees_alignment?.value,
                pelvis_alignment: answers.pelvis_alignment?.value,
                lumbar_support: answers.lumbar_support?.value,
                arms_alignment: answers.arms_alignment?.value,
                wrists_alignment: answers.wrists_alignment?.value,
                monitor_alignment: answers.monitor_alignment?.value,
                neck_alignment: answers.neck_alignment?.value,
            }

            const { error } = await supabase
                .from('occupational_audits')
                .insert(auditData)

            if (error) throw error

            setFinalScore(calculatedScore)
            setIsCompleted(true)
            toast.success("Auditoría guardada correctamente")
        } catch (error) {
            console.error("Error saving audit:", error)
            toast.error("Hubo un error al guardar la auditoría")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isCompleted) {
        return (
            <Card className="border-teal-500/30 bg-teal-500/5 shadow-none">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-teal-100 dark:bg-teal-900/50 text-teal-600 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-2xl">¡Auditoría Completada!</CardTitle>
                    <CardDescription>Tu puntuación ergonómica es del {finalScore}%</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-muted-foreground">
                        {finalScore >= 80
                            ? "Excelente postura de trabajo. Mantén los buenos hábitos."
                            : finalScore >= 50
                                ? "Tienes áreas de mejora. Revisa el Módulo de Rutinas de Compensación."
                                : "Tu postura requiere atención inmediata. Te recomendamos ajustar tu mobiliario y seguir las pausas activas."}
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button variant="outline" onClick={() => {
                        setIsCompleted(false)
                        setCurrentStep(0)
                        setAnswers({})
                    }}>
                        Realizar nueva evaluación
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="border-border shadow-sm">
            <CardHeader>
                <div className="flex justify-between items-center mb-4">
                    <CardTitle className="text-xl">Auditoría Ergonómica</CardTitle>
                    <span className="text-sm text-teal-600 font-medium">{currentStep + 1} / {AUDIT_STEPS.length}</span>
                </div>
                <Progress value={progress} className="h-2 bg-slate-100 dark:bg-slate-800" indicatorClassName="bg-teal-500" />
            </CardHeader>

            <CardContent className="min-h-[250px] space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">{stepInfo.title}</h3>
                    <p className="text-sm text-muted-foreground">{stepInfo.description}</p>
                </div>

                <div className="space-y-4">
                    <p className="font-medium">{stepInfo.question}</p>

                    <RadioGroup
                        value={currentAnswer}
                        onValueChange={handleSelect}
                        className="space-y-3"
                    >
                        {stepInfo.options.map((option) => (
                            <div key={option.value} className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors hover:bg-muted/50 ${currentAnswer === option.value ? 'border-teal-500 bg-teal-500/5 dark:bg-teal-500/10' : 'border-border'}`} onClick={() => handleSelect(option.value)}>
                                <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                                <Label htmlFor={option.value} className="font-normal cursor-pointer flex-1 text-base leading-snug">
                                    {option.label}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t pt-6">
                <Button
                    variant="ghost"
                    onClick={prevStep}
                    disabled={currentStep === 0 || isSubmitting}
                >
                    <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
                </Button>

                {isLastStep ? (
                    <Button
                        onClick={finishAudit}
                        disabled={!currentAnswer || isSubmitting}
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                        {isSubmitting ? (
                            <span className="animate-pulse flex items-center gap-2">Guardando...</span>
                        ) : (
                            <><Save className="w-4 h-4 mr-2" /> Guardar Auditoría</>
                        )}
                    </Button>
                ) : (
                    <Button
                        onClick={nextStep}
                        disabled={!currentAnswer}
                        className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                        Siguiente <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
}
