'use client';

import React from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';

const newHormoneData = [
    { time: "00:00", cortisol: 10, melatonina: 90 },
    { time: "04:00", cortisol: 30, melatonina: 80 },
    { time: "06:00", cortisol: 60, melatonina: 40 },
    { time: "08:00", cortisol: 100, melatonina: 5 },
    { time: "12:00", cortisol: 60, melatonina: 2 },
    { time: "16:00", cortisol: 40, melatonina: 5 },
    { time: "20:00", cortisol: 20, melatonina: 40 },
    { time: "00:00", cortisol: 10, melatonina: 90 }
];

const chronotypeData = [
    { name: "Oso (Intermedio)", value: 50, fill: "#f97316" },
    { name: "Lobo (Vespertino)", value: 20, fill: "#8b5cf6" },
    { name: "León (Matutino)", value: 15, fill: "#06b6d4" },
    { name: "Delfín (Irregular)", value: 15, fill: "#ec4899" }
];

const newRiskData = [
    { name: "Obesidad", value: 65, fill: "#166534" },
    { name: "S. Metabólico", value: 50, fill: "#166534" },
    { name: "Cardiovasculares", value: 40, fill: "#166534" },
    { name: "Depresión", value: 35, fill: "#166534" },
    { name: "Det. Inmune", value: 25, fill: "#166534" }
];

export function InfografiaInteractiva() {
    return (
        <div className="font-sans antialiased text-[#0f172a] mt-24">
            <header className="bg-white text-black py-20 px-6 border-b-8 border-green-800 relative overflow-hidden rounded-3xl shadow-sm border border-zinc-100">
                <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none text-[20rem] leading-none select-none text-zinc-200">⏳</div>
                <div className="max-w-6xl mx-auto relative z-10 text-center">
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-center text-yellow-500">
                        Los Ciclos Circadianos
                    </h1>
                    <p className="text-xl md:text-2xl font-light text-zinc-500 max-w-3xl mx-auto">
                        La investigación científica revela cómo nuestro reloj biológico maestro controla cada aspecto de nuestra fisiología, desde el sueño y el metabolismo hasta la salud mental y celular.
                    </p>
                </div>
            </header>

            <div className="max-w-6xl mx-auto space-y-24 mt-12">
                {/* Métricas */}
                <section>
                    <div className="mb-10 text-center max-w-4xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4 text-center">El Reloj Maestro en Números</h2>
                        <p className="text-slate-600 text-lg">
                            El Núcleo Supraquiasmático (NSQ) en el hipotálamo sincroniza trillones de células en nuestro cuerpo. A continuación, las métricas fundamentales descubiertas por la cronobiología moderna.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-white/95 backdrop-blur border border-white/20 shadow-sm p-8 rounded-2xl text-center border-t-4 border-t-cyan-500 transition-transform hover:-translate-y-2">
                            <div className="text-5xl mb-4">⏱️</div>
                            <div className="text-5xl font-black text-green-900 mb-2">24.2h</div>
                            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Ciclo Intrínseco</h3>
                            <p className="text-sm text-slate-500 mt-3">Duración promedio del reloj interno humano en ausencia de luz solar externa.</p>
                        </div>
                        <div className="bg-white/95 backdrop-blur border border-white/20 shadow-sm p-8 rounded-2xl text-center border-t-4 border-t-orange-500 transition-transform hover:-translate-y-2">
                            <div className="text-5xl mb-4">🧬</div>
                            <div className="text-5xl font-black text-slate-900 mb-2">&gt;10%</div>
                            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Genoma Dinámico</h3>
                            <p className="text-sm text-slate-500 mt-3">Más del 10% de todos nuestros genes se expresan de forma rítmica dependiente de la hora.</p>
                        </div>
                        <div className="bg-white/95 backdrop-blur border border-white/20 shadow-sm p-8 rounded-2xl text-center border-t-4 border-t-violet-500 transition-transform hover:-translate-y-2">
                            <div className="text-5xl mb-4">💡</div>
                            <div className="text-5xl font-black text-slate-900 mb-2">10,000</div>
                            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Lux Necesarios</h3>
                            <p className="text-sm text-slate-500 mt-3">Intensidad de luz solar matutina recomendada para resetear el ciclo circadiano eficazmente.</p>
                        </div>
                    </div>
                </section>

                {/* Gráfico 1: Cortisol vs Melatonina */}
                <section className="bg-white p-8 md:p-12 rounded-3xl shadow-lg border border-slate-100">
                    <div className="mb-10 text-center max-w-4xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold text-yellow-500 mb-4 text-center">La Danza Hormonal: Melatonina vs Cortisol</h2>
                        <p className="text-slate-600 text-lg">La interacción entre la luz y nuestro cerebro regula dos hormonas críticas. El cortisol nos prepara para el estrés y la actividad matutina, mientras que la melatonina facilita el inicio y mantenimiento del sueño profundo celular nocturno.</p>
                    </div>
                    <div className="w-full h-[350px] md:h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={newHormoneData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line type="monotone" dataKey="cortisol" name="Nivel de Cortisol (Activación)" stroke="#f97316" strokeWidth={4} activeDot={{ r: 8 }} dot={{ r: 5 }} fill="rgba(249, 115, 22, 0.1)" />
                                <Line type="monotone" dataKey="melatonina" name="Nivel de Melatonina (Sueño)" stroke="#8b5cf6" strokeWidth={4} activeDot={{ r: 8 }} dot={{ r: 5 }} fill="rgba(139, 92, 246, 0.1)" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Gráfico 2: Cronotipos */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-6 text-center">Diversidad Fenotípica: Los Cronotipos</h2>
                        <p className="text-slate-600 text-lg mb-6">No todos los relojes biológicos son idénticos. La genética determina nuestro "cronotipo", el cual dicta nuestra preferencia natural por las horas de sueño y nuestros picos de energía cognitiva y física durante el día.</p>
                        <div className="space-y-4">
                            <div className="flex items-center p-4 bg-slate-50 rounded-lg border-l-4 border-cyan-500">
                                <div className="text-3xl mr-4">🦁</div>
                                <div>
                                    <h4 className="font-bold text-slate-900">Matutino Extremo (León)</h4>
                                    <p className="text-sm text-slate-500">Despiertan temprano, pico de productividad en la mañana.</p>
                                </div>
                            </div>
                            <div className="flex items-center p-4 bg-slate-50 rounded-lg border-l-4 border-orange-500">
                                <div className="text-3xl mr-4">🐻</div>
                                <div>
                                    <h4 className="font-bold text-slate-900">Diurno Intermedio (Oso)</h4>
                                    <p className="text-sm text-slate-500">Siguen el ciclo solar estándar. Representan la mayoría.</p>
                                </div>
                            </div>
                            <div className="flex items-center p-4 bg-slate-50 rounded-lg border-l-4 border-violet-500">
                                <div className="text-3xl mr-4">🐺</div>
                                <div>
                                    <h4 className="font-bold text-slate-900">Vespertino (Lobo)</h4>
                                    <p className="text-sm text-slate-500">Se activan por la tarde/noche. Dificultad para madrugar.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/95 backdrop-blur border border-white/20 shadow-xl p-6 rounded-3xl h-[450px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chronotypeData}
                                    cx="50%" cy="50%"
                                    innerRadius={90}
                                    outerRadius={140}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {chronotypeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value) => [`${value}% de la población`, 'Cronotipo']}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Gráfico 3: Cronodisrupción */}
                <section className="bg-white p-8 md:p-12 rounded-3xl shadow-lg border border-slate-100">
                    <div className="mb-10 text-center max-w-4xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold text-yellow-500 mb-4 text-center">El Costo de la Cronodisrupción</h2>
                        <p className="text-slate-600 text-lg">La desalineación crónica entre nuestro reloj interno y el entorno (debido al trabajo por turnos, jet lag social, o luz artificial nocturna) se correlaciona fuertemente con el desarrollo de severas patologías sistémicas.</p>
                    </div>
                    <div className="w-full h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={newRiskData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                                <CartesianGrid stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} width={120} />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: '#0f172a' }}
                                    formatter={(value) => [`+${value}% riesgo respecto al control`, 'Incremento Porcentual (%)']}
                                />
                                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                    {newRiskData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Zeitgebers */}
                <section>
                    <div className="mb-10 text-center max-w-4xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-bold text-green-800 mb-4 text-center">Sincronizadores Ambientales (Zeitgebers)</h2>
                        <p className="text-slate-600 text-lg">Para mantener la salud fisiológica, debemos alinear nuestro reloj interno utilizando "dadores de tiempo" externos. Aquí se detallan los factores más influyentes en orden de prioridad científica.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white shadow-md p-6 rounded-2xl flex flex-col items-center text-center border-t border-slate-100">
                            <div className="w-20 h-20 rounded-full bg-cyan-500 flex items-center justify-center text-4xl mb-4 text-white shadow-lg shadow-cyan-500/30">☀️</div>
                            <h3 className="font-bold text-xl text-slate-900 mb-2">1. Exposición Lumínica</h3>
                            <p className="text-sm text-slate-600">El regulador principal. Luz solar intensa en la mañana activa el NSQ; la oscuridad nocturna permite la liberación de melatonina.</p>
                        </div>

                        <div className="bg-white shadow-md p-6 rounded-2xl flex flex-col items-center text-center border-t border-slate-100">
                            <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-4xl mb-4 text-white shadow-lg shadow-orange-500/30">🍽️</div>
                            <h3 className="font-bold text-xl text-slate-900 mb-2">2. Horarios de Alimentación</h3>
                            <p className="text-sm text-slate-600">Sincroniza los relojes periféricos (hígado, páncreas). Ingerir alimentos tarde en la noche confunde al sistema metabólico.</p>
                        </div>

                        <div className="bg-white shadow-md p-6 rounded-2xl flex flex-col items-center text-center border-t border-slate-100">
                            <div className="w-20 h-20 rounded-full bg-violet-500 flex items-center justify-center text-4xl mb-4 text-white shadow-lg shadow-violet-500/30">🏃‍♂️</div>
                            <h3 className="font-bold text-xl text-slate-900 mb-2">3. Actividad Física</h3>
                            <p className="text-sm text-slate-600">El ejercicio genera señales térmicas y químicas celulares que ayudan a anclar los ritmos de vigilia y sueño.</p>
                        </div>

                        <div className="bg-white shadow-md p-6 rounded-2xl flex flex-col items-center text-center border-t border-slate-100">
                            <div className="w-20 h-20 rounded-full bg-pink-500 flex items-center justify-center text-4xl mb-4 text-white shadow-lg shadow-pink-500/30">🌡️</div>
                            <h3 className="font-bold text-xl text-slate-900 mb-2">4. Fluctuación Térmica</h3>
                            <p className="text-sm text-slate-600">El cuerpo necesita una caída en la temperatura central de aproximadamente 1°C para iniciar y mantener el sueño reparador.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
