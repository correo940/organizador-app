'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dumbbell, Activity, ShieldCheck, HeartPulse } from 'lucide-react'

const ROUTINES = {
    stretching: [
        {
            title: 'Estiramiento Pectoral',
            description: 'Busca el marco de una puerta, apoya el antebrazo en ángulo de 90° y gira el tronco suavemente. Sostén 30s por lado.',
            tags: ['Postura en C', 'Relajación'],
            frequency: 'Diario'
        },
        {
            title: 'Estiramiento de Psoas',
            description: 'En estilo zancada, con una rodilla en el suelo. Empuja la cadera hacia adelante suavemente manteniendo la espalda recta. 30s por lado.',
            tags: ['Cadera', 'Sedentarismo'],
            frequency: 'Diario'
        },
        {
            title: 'Activación de Romboides',
            description: 'Junta tus escápulas imaginando que aprietas un lápiz entre ellas. Sostén 5s y relaja. 10 repeticiones.',
            tags: ['Espalda Alta', 'Activación'],
            frequency: '3x al día'
        }
    ],
    flow: [
        {
            title: 'Flow Columna Torácica',
            description: 'En cuadrupedia (a gatas), realiza "Gato-Vaca". Primero arqueando la espalda hacia el techo, y luego hundiendo, mirando al frente. 10 ciclos suaves.',
            tags: ['Movilidad', 'Columna'],
            duration: '5 min'
        },
        {
            title: 'Flow de Cadera y Cintura Escapular',
            description: 'Sentadilla profunda isométrica (si puedes) o rotaciones torácicas tumbado de lado. Libera tensión acumulada al estar sentado.',
            tags: ['Caderas', 'Liberación'],
            duration: '10 min'
        }
    ],
    strength: [
        {
            title: 'Remos con Banda Elástica',
            description: 'Fija una banda elástica frente a ti y tira hacia el pecho, manteniendo los codos cerca del cuerpo. 3 series de 15.',
            tags: ['Fuerza', 'Hombros'],
            equipment: 'Banda Elástica'
        },
        {
            title: 'Elevaciones Laterales e "Y-T-W"',
            description: 'Para fortalecer los estabilizadores del hombro. Forma las letras Y, T y W con tus brazos (puedes usar algo de peso ligero). 3 series de 12 por letra.',
            tags: ['Hombros', 'Prevención'],
            equipment: 'Mancuernas Ligeras'
        }
    ]
}

export default function PhysicalRoutines() {
    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="pb-4 border-b">
                <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-500" />
                    Rutinas de Compensación y Fuerza
                </CardTitle>
                <CardDescription>
                    Programas diseñados para revertir la "postura en C" (cabeza adelantada y hombros caídos).
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Tabs defaultValue="stretching" className="w-full">
                    <div className="p-4 border-b bg-muted/20">
                        <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 gap-2 h-auto">
                            <TabsTrigger value="stretching" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 border py-2 text-xs md:text-sm">
                                <HeartPulse className="w-4 h-4 mr-2" />
                                Estiramientos
                            </TabsTrigger>
                            <TabsTrigger value="flow" className="data-[state=active]:bg-teal-100 data-[state=active]:text-teal-900 border py-2 text-xs md:text-sm">
                                <Activity className="w-4 h-4 mr-2" />
                                Rutinas Flow
                            </TabsTrigger>
                            <TabsTrigger value="strength" className="data-[state=active]:bg-rose-100 data-[state=active]:text-rose-900 border py-2 text-xs md:text-sm">
                                <Dumbbell className="w-4 h-4 mr-2" />
                                Fuerza (Cuello y Hombros)
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-4 md:p-6">
                        <TabsContent value="stretching" className="m-0 space-y-4">
                            {ROUTINES.stretching.map((routine, idx) => (
                                <RoutineCard key={idx} routine={routine} color="amber" />
                            ))}
                        </TabsContent>

                        <TabsContent value="flow" className="m-0 space-y-4">
                            {ROUTINES.flow.map((routine, idx) => (
                                <RoutineCard key={idx} routine={routine} color="teal" />
                            ))}
                        </TabsContent>

                        <TabsContent value="strength" className="m-0 space-y-4">
                            {ROUTINES.strength.map((routine, idx) => (
                                <RoutineCard key={idx} routine={routine} color="rose" />
                            ))}
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    )
}

function RoutineCard({ routine, color }: { routine: any, color: string }) {
    return (
        <div className={`p-4 rounded-xl border border-${color}-500/20 bg-${color}-500/5 hover:bg-${color}-500/10 transition-colors`}>
            <div className="flex justify-between items-start mb-2">
                <h4 className={`font-semibold text-${color}-700 dark:text-${color}-400`}>{routine.title}</h4>
                {routine.frequency && (
                    <Badge variant="outline" className={`border-${color}-200 text-${color}-600 bg-white dark:bg-black`}>
                        {routine.frequency}
                    </Badge>
                )}
                {routine.duration && (
                    <Badge variant="outline" className={`border-${color}-200 text-${color}-600 bg-white dark:bg-black`}>
                        {routine.duration}
                    </Badge>
                )}
                {routine.equipment && (
                    <Badge variant="outline" className={`border-${color}-200 text-${color}-600 bg-white dark:bg-black`}>
                        {routine.equipment}
                    </Badge>
                )}
            </div>
            <p className="text-sm text-foreground/80 mb-4">{routine.description}</p>
            <div className="flex gap-2 flex-wrap">
                {routine.tags.map((tag: string) => (
                    <span key={tag} className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-${color}-100 dark:bg-${color}-900/50 text-${color}-700 dark:text-${color}-300`}>
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    )
}
