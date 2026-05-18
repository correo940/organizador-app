'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Lightbulb, Activity, Zap, ShieldAlert, Cpu } from 'lucide-react';
import Image from 'next/image';

interface CardProps {
    title: string;
    frontIcon: React.ReactNode;
    subtitle: string;
    content: React.ReactNode;
    color?: string;
}

const Card = ({ title, frontIcon, subtitle, content, color = "bg-green-800" }: CardProps) => {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div 
            className="group h-[400px] w-full [perspective:1000px] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <motion.div 
                className="relative h-full w-full transition-all duration-500 [transform-style:preserve-3d]"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
            >
                {/* Front */}
                <div className={`absolute inset-0 [backface-visibility:hidden] ${color} rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-xl border border-white/10 overflow-hidden`}>
                    {/* Decorative Background Elements */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-black/10 rounded-full blur-3xl group-hover:bg-black/20 transition-colors" />
                    
                    <div className="relative z-10 space-y-6">
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl inline-block border border-white/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                            {frontIcon}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tight mb-2 leading-tight">
                                {title}
                            </h3>
                            <p className="text-green-100/70 text-sm font-medium px-4">
                                {subtitle}
                            </p>
                        </div>
                    </div>

                    <div className="absolute bottom-8 flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">
                        <Zap size={10} className="text-yellow-400" />
                        Toca para profundizar
                    </div>
                </div>

                {/* Back */}
                <div 
                    className="absolute inset-0 h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-zinc-50 rounded-[32px] p-8 flex flex-col border border-zinc-200 shadow-2xl overflow-hidden"
                >
                    <div className="flex items-center gap-3 mb-6 border-b border-zinc-100 pb-4">
                        <div className={`p-2 rounded-xl ${color} text-white`}>
                            {frontIcon}
                        </div>
                        <h4 className="font-black text-zinc-900 text-lg">{title}</h4>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="text-zinc-700 leading-relaxed text-sm space-y-4">
                            {content}
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-100 flex justify-center">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            Volver al frente <Activity size={10} />
                        </span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export const NSQCards = () => {
    const cards = [
        {
            title: "El Reloj Maestro",
            subtitle: "Núcleo Supraquiasmático (NSQ)",
            frontIcon: (
                <div className="relative w-24 h-24">
                    <Image 
                        src="/images/articles/3d-brain-v2.png" 
                        alt="3D Brain" 
                        fill 
                        className="object-contain drop-shadow-[0_0_20px_rgba(255,100,200,0.5)] scale-125 mix-blend-screen"
                    />
                </div>
            ),
            color: "bg-green-800",
            content: (
                <>
                    <p>
                        Situado en el <strong>hipotálamo anterior</strong>, justo encima del quiasma óptico, es el centro de mando que asume el papel de marcapasos central.
                    </p>
                    <p>
                        Se le llama el "director de orquesta" porque coordina miles de relojes periféricos en el <strong>hígado, corazón, músculos y tejido adiposo</strong>.
                    </p>
                    <div className="bg-green-50 p-4 rounded-2xl border border-green-100 mt-2">
                        <p className="text-xs text-green-800 font-bold mb-1">DATO CLAVE</p>
                        <p className="text-xs text-green-700">Compuesto por aproximadamente 20.000 neuronas densamente empaquetadas.</p>
                    </div>
                </>
            )
        },
        {
            title: "La Luz: La Batuta",
            subtitle: "Sincronizador Principal (Zeitgeber)",
            frontIcon: <Lightbulb className="w-10 h-10 text-yellow-300" />,
            color: "bg-green-900",
            content: (
                <>
                    <p>
                        Para dirigir la orquesta, el NSQ utiliza la luz como su señal principal. La información llega desde los ojos por la <strong>vía retinohipotalámica</strong>.
                    </p>
                    <p>
                        Esta vía se origina en células ganglionares con <strong>melanopsina</strong>, un pigmento sensible a la <strong>luz azul</strong> que mide la luminosidad ambiental, no formas ni colores.
                    </p>
                </>
            )
        },
        {
            title: "Arquitectura Interna",
            subtitle: "Core (Núcleo) y Shell (Concha)",
            frontIcon: <Cpu className="w-10 h-10 text-blue-300" />,
            color: "bg-zinc-900",
            content: (
                <div className="space-y-4">
                    <div className="border-l-4 border-blue-400 pl-3">
                        <p className="font-bold text-zinc-900 text-xs uppercase mb-1">Región Ventrolateral (Core)</p>
                        <p className="text-xs">Recibe las señales de luz. Usa el neurotransmisor <strong>VIP</strong> para transmitir la sincronización al resto del NSQ.</p>
                    </div>
                    <div className="border-l-4 border-purple-400 pl-3">
                        <p className="font-bold text-zinc-900 text-xs uppercase mb-1">Región Dorsomedial (Shell)</p>
                        <p className="text-xs">Expresa <strong>AVP</strong>. Es responsable de estabilizar el ritmo y aportar robustez a los ciclos de 24 horas.</p>
                    </div>
                </div>
            )
        },
        {
            title: "Control Hormonal",
            subtitle: "La Partitura de la Vida",
            frontIcon: <Activity className="w-10 h-10 text-orange-300" />,
            color: "bg-green-800",
            content: (
                <div className="space-y-4">
                    <p>El NSQ controla múltiples sistemas a través de señales neuronales y humorales:</p>
                    <ul className="text-xs space-y-2">
                        <li className="flex gap-2">
                            <span className="text-indigo-600">🌙</span>
                            <strong>Melatonina:</strong> Secretada por la pineal al detectar oscuridad.
                        </li>
                        <li className="flex gap-2">
                            <span className="text-orange-500">☀️</span>
                            <strong>Cortisol:</strong> Liberado al despertar para activarte.
                        </li>
                        <li className="flex gap-2">
                            <span className="text-red-500">🌡️</span>
                            <strong>Temperatura:</strong> Coordina las fluctuaciones diarias corporales.
                        </li>
                    </ul>
                </div>
            )
        },
        {
            title: "Autonomía Intrínseca",
            subtitle: "Maquinaria Molecular",
            frontIcon: <Zap className="w-10 h-10 text-cyan-300" />,
            color: "bg-slate-900",
            content: (
                <>
                    <p>
                        El NSQ es fascinante porque es <strong>autónomo</strong>. Incluso cultivado in vitro, sigue emitiendo señales con un ritmo de 24 horas.
                    </p>
                    <p>
                        Esto ocurre por un bucle de retroalimentación de genes reloj: <strong>CLOCK, BMAL1, PER y CRY</strong>. Moléculas como el cAMP coordinan que todas las neuronas oscilen juntas.
                    </p>
                </>
            )
        },
        {
            title: "El Ritmo Perdido",
            subtitle: "Impacto de la Desincronización",
            frontIcon: <ShieldAlert className="w-10 h-10 text-red-400" />,
            color: "bg-red-900",
            content: (
                <>
                    <p>
                        Cuando el NSQ recibe señales contradictorias (pantallas de noche, jet lag, turnos), la orquesta pierde el compás.
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-red-50 p-2 rounded-xl text-[10px] text-red-800 font-bold">
                            CORTO PLAZO: Insomnio y fatiga mental.
                        </div>
                        <div className="bg-red-100 p-2 rounded-xl text-[10px] text-red-900 font-bold">
                            LARGO PLAZO: Trastornos metabólicos y cardiovasculares.
                        </div>
                    </div>
                </>
            )
        }
    ];

    return (
        <section className="py-20 px-6 max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-4xl md:text-5xl font-black text-green-800 tracking-tight">
                    Arquitectura del <span className="text-green-600">Reloj Maestro</span>
                </h2>
                <p className="text-zinc-500 max-w-2xl mx-auto text-lg">
                    Explora en detalle cómo el Núcleo Supraquiasmático gobierna tu biología interna a través de estos pilares fundamentales.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {cards.map((card, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <Card {...card} />
                    </motion.div>
                ))}
            </div>
            
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </section>
    );
};
