'use client';

import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const circadianData = [
    { time: 0, icon: "😴", title: "00:00 - Medianoche", desc: "Secreción de melatonina en proceso. Supresión de movimientos intestinales." },
    { time: 1, icon: "💤", title: "01:00", desc: "El cuerpo entra en fases de sueño profundo (ondas lentas)." },
    { time: 2, icon: "🛌", title: "02:00 - Sueño Profundo", desc: "Pico de sueño más profundo. Máxima reparación de tejidos y consolidación de memoria." },
    { time: 3, icon: "📉", title: "03:00", desc: "La temperatura corporal continúa descendiendo." },
    { time: 4, icon: "🥶", title: "04:30 - Temperatura Mínima", desc: "Temperatura corporal basal alcanza su punto más bajo." },
    { time: 5, icon: "🌅", title: "05:00", desc: "El cuerpo comienza a prepararse para despertar. La melatonina empieza a disminuir." },
    { time: 6, icon: "📈", title: "06:45 - Presión Sanguínea", desc: "Aumento brusco de la presión arterial (mayor riesgo de eventos cardiovasculares agudos)." },
    { time: 7, icon: "🚫", title: "07:30 - Fin Melatonina", desc: "Cese de la secreción de melatonina. Inicio de la vigilancia diurna." },
    { time: 8, icon: "☕", title: "08:30 - Despertar", desc: "Aumento de la motilidad intestinal." },
    { time: 9, icon: "🚀", title: "09:00 - Pico de Testosterona", desc: "Niveles más altos de testosterona (en hombres y mujeres)." },
    { time: 10, icon: "🧠", title: "10:00 - Alerta Máxima", desc: "Máximo estado de alerta y capacidad de concentración cognitiva." },
    { time: 11, icon: "💼", title: "11:00", desc: "Excelente momento para resolución de problemas complejos." },
    { time: 12, icon: "🕛", title: "12:00 - Mediodía", desc: "El cuerpo está completamente activado." },
    { time: 13, icon: "🍽️", title: "13:00", desc: "Descenso post-prandial natural (ligera somnolencia, caída en alerta)." },
    { time: 14, icon: "📉", title: "14:00", desc: "Coordinación y tiempo de reacción empiezan a mejorar nuevamente tras la comida." },
    { time: 15, icon: "🎯", title: "15:30 - Coordinación", desc: "Mejor tiempo de reacción y máxima coordinación neuromuscular." },
    { time: 16, icon: "⚡", title: "16:00", desc: "Pico de agudeza visual." },
    { time: 17, icon: "💪", title: "17:00 - Eficiencia Muscular", desc: "Mayor eficiencia cardiovascular y fuerza muscular (ideal para entrenamiento físico)." },
    { time: 18, icon: "🌡️", title: "18:30 - Temperatura Máxima", desc: "Temperatura corporal máxima del día." },
    { time: 19, icon: "🩺", title: "19:00 - Presión Arterial", desc: "Presión arterial más alta del ciclo diario normal." },
    { time: 20, icon: "🌇", title: "20:00", desc: "El reloj biológico empieza a anticipar la noche." },
    { time: 21, icon: "🌙", title: "21:00 - Inicio Melatonina", desc: "La glándula pineal comienza la secreción de melatonina (si el entorno está oscuro)." },
    { time: 22, icon: "🛑", title: "22:30 - Intestinos Lentos", desc: "Los movimientos intestinales se suprimen." },
    { time: 23, icon: "🥱", title: "23:00", desc: "Disminución del estado de alerta y preparación fisiológica para el sueño." }
];

const hormoneDataArray = [
    { time: '00:00', melatonina: 90, cortisol: 10 },
    { time: '04:00', melatonina: 85, cortisol: 30 },
    { time: '08:00', melatonina: 10, cortisol: 95 },
    { time: '12:00', melatonina: 5, cortisol: 60 },
    { time: '16:00', melatonina: 5, cortisol: 40 },
    { time: '20:00', melatonina: 40, cortisol: 15 },
    { time: '23:59', melatonina: 80, cortisol: 10 },
];

const riskDataArray = [
    { name: 'Trastornos del Sueño', riesgo: 85, fill: '#ef4444' }, // red-500
    { name: 'Gastrointestinales', riesgo: 50, fill: '#f97316' }, // orange-500
    { name: 'Sínd. Metabólico', riesgo: 40, fill: '#f59e0b' }, // amber-500
    { name: 'Enf. Cardiovascular', riesgo: 30, fill: '#eab308' }, // yellow-500
    { name: 'Deterioro Cognitivo', riesgo: 25, fill: '#84cc16' } // lime-500
];

export function AnalisisCientificoTab() {
    const [sliderValue, setSliderValue] = useState<number>(8);
    const activeData = circadianData.find(d => d.time === sliderValue) || circadianData[0];

    return (
        <div className="bg-white min-h-screen text-zinc-800 font-sans pb-32">

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-24">

                {/* Header / Intro */}
                <section id="introduccion" className="text-center space-y-6 max-w-3xl mx-auto pt-10">
                    <div className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold tracking-wide uppercase mb-2 mx-auto">
                        Análisis Científico
                    </div>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-yellow-500 leading-tight text-center">
                        Los Ciclos Circadianos: El Reloj Maestro de tu Salud
                    </h1>
                    <p className="text-lg text-stone-600">
                        Una síntesis de la investigación científica actual sobre cómo nuestro reloj biológico interno de 24 horas regula el sueño, el metabolismo, la cognición y el bienestar general. Descubre cómo la sincronización con los ciclos naturales de luz y oscuridad es fundamental para la biología humana.
                    </p>
                </section>

                {/* Section 1: Fisiología 24h */}
                <section id="fisiologia" className="space-y-12 bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-zinc-100">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4 text-center">La Fisiología de 24 Horas</h2>
                        <p className="text-zinc-600">
                            Esta sección desglosa el comportamiento interno de nuestro cuerpo a lo largo del día. El Núcleo Supraquiasmático (NSQ) en el cerebro actúa como el director de orquesta, utilizando la luz para regular la producción hormonal. Interactúa con el control deslizante y la gráfica para observar estos cambios.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

                        {/* Interactive Timeline */}
                        <div className="space-y-8 bg-stone-50 p-6 rounded-2xl border border-stone-200">
                            <h3 className="text-xl font-semibold text-stone-800">El Reloj en Tiempo Real</h3>
                            <p className="text-sm text-stone-500 mb-6">Desliza el control para ver la actividad fisiológica predominante según la literatura científica.</p>

                            <div className="relative pt-1">
                                <input
                                    type="range"
                                    min="0"
                                    max="23"
                                    value={sliderValue}
                                    onChange={(e) => setSliderValue(Number(e.target.value))}
                                    className="w-full appearance-none bg-zinc-200 h-2 rounded-full outline-none focus:ring-2 focus:ring-green-800 transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-green-800 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
                                />
                                <div className="flex justify-between text-xs text-stone-400 mt-2 font-medium">
                                    <span>00:00</span>
                                    <span>06:00</span>
                                    <span>12:00</span>
                                    <span>18:00</span>
                                    <span>23:59</span>
                                </div>
                            </div>

                            <div className="mt-8 text-center transition-all duration-300">
                                <div className="text-6xl mb-4">{activeData.icon}</div>
                                <h4 className="text-2xl font-bold text-green-900 mb-2">{activeData.title}</h4>
                                <p className="text-zinc-600 min-h-[80px]">{activeData.desc}</p>
                            </div>
                        </div>

                        {/* Hormonal Chart */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold text-stone-800">Danza Hormonal: Cortisol vs Melatonina</h3>
                                <p className="text-sm text-stone-500">El cortisol nos despierta y prepara para la acción, mientras que la melatonina nos induce al sueño y la reparación celular. Observe su relación inversamente proporcional.</p>
                            </div>
                            <div className="w-full h-[300px] md:h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={hormoneDataArray} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                        <CartesianGrid stroke="#f5f5f4" vertical={false} />
                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: 'rgba(28, 25, 23, 0.9)', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Line type="monotone" dataKey="melatonina" name="Melatonina (Hormona del Sueño)" stroke="#166534" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        <Line type="monotone" dataKey="cortisol" name="Cortisol (Hormona de Alerta)" stroke="#eab308" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Section 2: Impacto y Desincronización */}
                <section id="impacto" className="space-y-12">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-yellow-500 mb-4 text-center">Cronodisrupción y Salud</h2>
                        <p className="text-slate-600">
                            La "Cronodisrupción" ocurre cuando nuestro estilo de vida (trabajo por turnos, luz artificial nocturna) se desalinea con nuestro reloj interno. La evidencia científica muestra correlaciones directas entre esta desincronización y diversas patologías metabólicas y cognitivas.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Info Cards */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-2xl shadow-sm">
                                <div className="text-2xl mb-2">💡</div>
                                <h4 className="font-bold text-stone-900 mb-2">Los "Zeitgebers"</h4>
                                <p className="text-sm text-stone-700">Son las señales externas que sincronizan nuestro reloj. La <strong>luz solar</strong> es el más potente, seguido de los horarios de alimentación y la temperatura ambiente.</p>
                            </div>
                            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-2xl shadow-sm">
                                <div className="text-2xl mb-2">📱</div>
                                <h4 className="font-bold text-green-950 mb-2">El Problema de la Luz Azul</h4>
                                <p className="text-sm text-zinc-700">La luz emitida por las pantallas suprime fuertemente la secreción de melatonina de la glándula pineal, engañando al cerebro para que piense que es de día.</p>
                            </div>
                        </div>

                        {/* Risk Chart */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
                            <div>
                                <h3 className="text-xl font-semibold text-green-950 mb-2">Incremento del Riesgo Relativo (%)</h3>
                                <p className="text-sm text-stone-500 mb-6">Datos epidemiológicos comparando poblaciones con desincronización crónica (ej. trabajadores nocturnos) vs ritmo diurno normal.</p>
                            </div>
                            <div className="w-full h-[300px] md:h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={riskDataArray} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid stroke="#f5f5f4" horizontal={false} />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#78716c' }} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#78716c', fontSize: 12 }} width={140} />
                                        <RechartsTooltip
                                            cursor={{ fill: '#f5f5f4' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#166534', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                            formatter={(value) => [`+${value}% incremento de riesgo`, 'Riesgo']}
                                        />
                                        <Bar dataKey="riesgo" radius={[0, 6, 6, 0]}>
                                            {riskDataArray.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="optimizacion" className="bg-green-50 text-zinc-900 p-8 md:p-12 rounded-3xl shadow-sm border border-green-100 space-y-10">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl font-serif font-bold text-green-800 mb-4">Protocolos de Optimización Circadiana</h2>
                        <p className="text-zinc-600">
                            Basado en la literatura científica de la cronobiología, aquí se presentan las intervenciones conductuales más efectivas para resincronizar tu reloj biológico y mejorar la calidad del sueño y el rendimiento diurno.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Morning */}
                        <div className="bg-white border border-green-100 p-6 rounded-2xl hover:shadow-md transition-all group">
                            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🌅</div>
                            <h4 className="text-xl font-bold text-green-800 mb-3">Mañana</h4>
                            <ul className="space-y-3 text-sm text-zinc-600">
                                <li className="flex items-start">
                                    <span className="mr-2 text-green-800">▶</span>
                                    Exposición a luz solar directa (10-30 min) en la primera hora tras despertar.
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2 text-green-800">▶</span>
                                    Retrasar la ingesta de cafeína 90 minutos para evitar el "crash" de la tarde (regulación de adenosina).
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2 text-green-800">▶</span>
                                    Mantener un horario de despertar constante, incluso fines de semana.
                                </li>
                            </ul>
                        </div>

                        {/* Day */}
                        <div className="bg-white border border-yellow-100 p-6 rounded-2xl hover:shadow-md transition-all group">
                            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">☀️</div>
                            <h4 className="text-xl font-bold text-yellow-700 mb-3">Día</h4>
                            <ul className="space-y-3 text-sm text-zinc-600">
                                <li className="flex items-start">
                                    <span className="mr-2 text-yellow-500">▶</span>
                                    Concentrar el trabajo cognitivo exigente durante los picos de alerta (generalmente 10:00 - 14:00).
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2 text-yellow-500">▶</span>
                                    Restringir la ventana de alimentación a 10-12 horas diarias para sincronizar relojes periféricos (hígado, intestino).
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2 text-yellow-500">▶</span>
                                    Ejercicio físico óptimo cardiovascular por la tarde (15:00 - 17:00) cuando la coordinación y fuerza son mayores.
                                </li>
                            </ul>
                        </div>

                        {/* Night */}
                        <div className="bg-white border border-green-100 p-6 rounded-2xl hover:shadow-md transition-all group">
                            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🌙</div>
                            <h4 className="text-xl font-bold text-green-800 mb-3">Noche</h4>
                            <ul className="space-y-3 text-sm text-zinc-600">
                                <li className="flex items-start">
                                    <span className="mr-2 text-green-800">▶</span>
                                    Reducir luces cenitales y pantallas 2 horas antes de dormir; usar filtros de luz azul.
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2 text-green-800">▶</span>
                                    Bajar la temperatura de la habitación (18-20°C) para facilitar la caída térmica corporal necesaria para el sueño profundo.
                                </li>
                                <li className="flex items-start">
                                    <span className="mr-2 text-green-800">▶</span>
                                    Evitar comidas copiosas 3 horas antes de dormir.
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="text-center pb-8 pt-4 border-t border-stone-200">
                    <p className="text-stone-500 text-sm">Resumen de investigación simulado con fines de demostración de arquitectura de información e interactividad.</p>
                </footer>

            </main>
        </div>
    );
}

