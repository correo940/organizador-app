'use client';

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Snowflake, Lightbulb, CheckCircle2 } from "lucide-react";

function parseTime(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
}

function formatTime(decimalTime: number) {
    const h = Math.floor(decimalTime);
    const m = Math.floor((decimalTime - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function SimuladorCircadianoAPP() {
    const [sleep, setSleep] = useState("23:00");
    const [wake, setWake] = useState("07:00");
    const [season, setSeason] = useState<"verano" | "invierno">("verano");

    const [simulatedTime, setSimulatedTime] = useState<number>(7);

    const getBiologicalState = (time: number) => {
        const W = parseTime(wake);
        const S = parseTime(sleep);

        // Sincronizamos las comidas con el despertar (7h después desayuno/almuerzo y 14h después cena)
        const L = (W + 7) % 24;
        const D = (W + 14) % 24;

        const dist = (target: number) => {
            let diff = time - target;
            if (diff < -12) diff += 24;
            if (diff > 12) diff -= 24;
            return diff;
        };

        const dw = dist(W);
        const ds = dist(S);
        const dl = dist(L);
        const dd = dist(D);

        // --- MAÑANA / DESPERTAR ---
        if (Math.abs(dw) < 0.5) return {
            title: "Pico de Cortisol Vascular",
            desc: "Activación simpática masiva. La presión arterial sube rápido y aumenta el ritmo cardíaco de forma natural.",
            icon: "🫀", color: "text-red-600",
            hack: "Espera 90 min para el café. Exponte 10 min a luz natural directa para resetear tu reloj biológico."
        };
        if (dw >= 0.5 && dw < 3.5) return {
            title: "Alta Sensibilidad a Insulina",
            desc: "Tus células musculares son extremadamente eficientes absorbiendo azúcares y proteínas ahora mismo.",
            icon: "🩸", color: "text-amber-500",
            hack: "El mejor momento para ingerir carbohidratos complejos o snacks sin picos de grasa masivos."
        };
        if (dw >= 3.5 && dw < 5.5) return {
            title: "Alerta Cognitiva Máxima",
            desc: "Cerebro libre de adenosina. Retención de datos y pensamiento claro en su punto más alto del día.",
            icon: "🧠", color: "text-green-600",
            hack: "Activa 'No Molestar'. Trabaja en tu proyecto más difícil ahora y evita distracciones superficiales."
        };

        // --- TARDE / COMIDA ---
        if (Math.abs(dl) < 0.5) return {
            title: "Drenaje Sanguíneo Digestivo",
            desc: "Tu estómago requiere mucha energía para procesar alimentos. Se drena vitalidad del resto del cuerpo.",
            icon: "🥗", color: "text-orange-500",
            hack: "Come con calma y camina suavemente 10 min tras terminar para reducir el impacto glucémico."
        };
        if (dl >= 0.5 && dl < 2.5) return {
            title: "Desplome de Vigilancia",
            desc: "La caída térmica genera fatiga natural. Es el bache circadiano post-comida fisiológico.",
            icon: "🥱", color: "text-zinc-500",
            hack: "Cierra los ojos y entra en un descanso profundo (power nap o Yoga Nidra) por solo 15-20 minutos."
        };

        // --- TARDE-NOCHE / RENDIMIENTO ---
        if (dw >= 8 && dw < 11 && dl >= 2.5) return {
            title: "Máxima Coordinación Motora",
            desc: "Articulaciones oxigenadas y nervios hiper-respondedores. Máximo potencial de fuerza física.",
            icon: "🏋️", color: "text-red-500",
            hack: "Momento estelar para el gimnasio o deporte intenso. El riesgo de lesiones es el más bajo del día."
        };

        // --- NOCHE / CENA ---
        if (Math.abs(dd) < 1) return {
            title: "Cierre Pancreático",
            desc: "La insulina pierde eficiencia. Tu cuerpo entra en fase de almacenamiento de grasa profunda.",
            icon: "⛔", color: "text-orange-700",
            hack: "Cena ligera (proteína y vegetales). Evita carbohidratos refinados o postres azucarados ahora."
        };

        // --- PRE-SUEÑO ---
        if (ds > -2.5 && ds < -0.5) return {
            title: "Descenso Pineal de Presión",
            desc: "Caída programada de la presión sanguínea. Secreción de Melatonina provocando descenso térmico.",
            icon: "🎚️", color: "text-indigo-400",
            hack: "Elimina luces de techo blancas. Usa lámparas tenues color ámbar a la altura de la vista o inferiores."
        };

        if (Math.abs(ds) <= 0.5) return {
            title: "Pico de Vasopresina",
            desc: "El hipotálamo ordena a los riñones dejar de producir orina para permitir un sueño ininterrumpido.",
            icon: "💤", color: "text-indigo-600",
            hack: "Deja de ingerir líquidos 90 minutos antes de dormir para no interrumpir este proceso nocturno."
        };

        // --- SUEÑO PROFUNDO / REPARACIÓN ---
        if ((ds > 0.5 && ds < 12) || (time < W && time > S && S < W) || (time < W && S > W)) {
            const fromSleep = ds > 0 ? ds : time + (24 - S);
            if (fromSleep > 0.5 && fromSleep < 3) return {
                title: "Lavado Cerebral Glinfático",
                desc: "Tu sistema linfático cerebral drena toxinas y residuos metabólicos acumulados durante el día.",
                icon: "🧬", color: "text-purple-600",
                hack: "Mantén el cuarto fresco (18°C) para facilitar esta limpieza y consolidar la temperatura de curación."
            };
            if (fromSleep >= 3 && fromSleep < 6) return {
                title: "Reparación Inmunológica",
                desc: "Linfocitos activados. El cuerpo detecta y elimina patógenos consolidando tu defensa celular.",
                icon: "🦠", color: "text-green-800",
                hack: "Oscuridad total. Incluso un poco de luz puede frenar esta feroz reparación del sistema inmune."
            };
            return {
                title: "Arquitectura de Memoria REM",
                desc: "Consolidación de recuerdos y procesamiento emocional. El cerebro organiza lo aprendido.",
                icon: "✨", color: "text-blue-400",
                hack: "Evita alarmas estridentes. Despertar suavemente protege la transición final de este ciclo neurológico."
            };
        }

        return {
            title: "Mantenimiento Circadiano",
            desc: "Niveles proactivos estables. Estado neutro ideal para actividades de voluntad consciente.",
            icon: "🛡️", color: "text-zinc-600",
            hack: "Mirada al horizonte: descansa la vista 1 minuto por cada 40 de enfoque para relajar la fóvea óptica."
        };
    };

    const bioState = getBiologicalState(simulatedTime);

    const sunrise = season === "verano" ? 6 : 8;
    const sunset = season === "verano" ? 21 : 18;

    const getSkyColor = (t: number) => {
        if (t >= sunrise - 1 && t < sunrise + 1) return "from-orange-400 to-amber-200";
        if (t >= sunrise + 1 && t < sunset - 1) return "from-sky-400 to-blue-200";
        if (t >= sunset - 1 && t < sunset + 0.5) return "from-purple-500 to-orange-400";
        if (t >= sunset + 0.5 && t < sunset + 2) return "from-indigo-900 to-purple-800";
        return "from-slate-900 to-black";
    };

    const isNight = simulatedTime < sunrise || simulatedTime > sunset + 1;
    const rotationOffset = 6;

    return (
        <div className="w-full flex justify-center px-3 pt-2 pb-24 md:px-6 md:pt-2 md:pb-24 font-sans text-slate-800">
            <div className="w-full max-w-6xl flex flex-col gap-3">

                {/* Cabecera Ultra-Compacta */}
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-white shadow-sm px-4 py-2.5 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-black text-slate-800 tracking-tight">
                            Simulador <span className="text-green-800">Circadiano</span>
                        </h1>
                        <div className="flex items-center gap-1 border-l pl-3 border-zinc-200">
                            <button onClick={() => setSeason("verano")}
                                className={`p-1.5 rounded-lg transition-all ${season === 'verano' ? 'bg-amber-100 text-amber-600' : 'text-zinc-400 hover:bg-zinc-50'}`}>
                                <Sun size={14} />
                            </button>
                            <button onClick={() => setSeason("invierno")}
                                className={`p-1.5 rounded-lg transition-all ${season === 'invierno' ? 'bg-cyan-50 text-cyan-600' : 'text-zinc-400 hover:bg-zinc-50'}`}>
                                <Snowflake size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {[
                            { label: 'Despertar', val: wake, set: setWake, color: 'border-amber-200' },
                            { label: 'Dormir', val: sleep, set: setSleep, color: 'border-indigo-200' }
                        ].map((inp) => (
                            <div key={inp.label} className="flex flex-col items-center">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">{inp.label}</span>
                                <input type="time" value={inp.val} onChange={e => inp.set(e.target.value)}
                                    className={`bg-zinc-50 border ${inp.color} rounded-lg px-2 py-1 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-green-800`} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2 COLUMNAS VERTICALES de alto completo */}
                <div className="flex flex-col md:flex-row gap-3" style={{ height: 'clamp(320px, 55vh, 500px)' }}>

                    {/* COLUMNA IZQUIERDA: Cielo (mitad del ancho) */}
                    <div className="flex-1 relative rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-lg border border-zinc-200 bg-black">

                        {/* Degradado del cielo */}
                        <div className={`absolute inset-0 bg-gradient-to-b transition-colors duration-1000 ${getSkyColor(simulatedTime)}`}>
                            {isNight && (
                                <div className="absolute inset-0 opacity-40 mix-blend-screen transition-opacity duration-1000"
                                    style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
                            )}
                        </div>

                        {/* ─── SLIDER EN LA FRANJA SUPERIOR DEL CIELO ─── */}
                        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-2 bg-gradient-to-b from-black/50 to-transparent">
                            <div className="flex justify-between items-center mb-1 text-[9px] font-black text-white/80 uppercase tracking-widest">
                                <span>◀ Mueve el Tiempo ▶</span>
                                <span>{formatTime(simulatedTime)} · 24H</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="23.99" step="0.05"
                                value={simulatedTime}
                                onChange={(e) => setSimulatedTime(Number(e.target.value))}
                                className={`w-full appearance-none h-5 rounded-full outline-none cursor-grab active:cursor-grabbing border border-white/30
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-green-800 [&::-webkit-slider-thumb]:shadow-lg
                                ${season === 'verano' ? 'bg-white/20' : 'bg-white/15'}`}
                            />
                            <div className="flex justify-between mt-1 text-white/50 font-mono text-[9px] font-bold pointer-events-none">
                                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>00:00</span>
                            </div>
                        </div>

                        {/* Sol / Luna orbitando */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-12">
                            <motion.div
                                className="relative w-[150px] md:w-[200px] aspect-square rounded-full flex items-center justify-center"
                                animate={{ rotate: ((simulatedTime - rotationOffset) / 24) * 360 }}
                                transition={{ ease: "linear", duration: 0.05 }}
                            >
                                <div className="absolute left-0 -translate-x-1/2 w-10 h-10 md:w-14 md:h-14 bg-yellow-300 rounded-full shadow-[0_0_60px_20px_#fde047] flex items-center justify-center">
                                    <Sun className="text-amber-500 w-6 h-6" />
                                </div>
                                <div className="absolute right-0 translate-x-1/2 w-8 h-8 md:w-10 md:h-10 bg-slate-100 rounded-full shadow-[0_0_30px_10px_#e2e8f0] flex items-center justify-center overflow-hidden">
                                    <Moon className="text-slate-400 w-5 h-5 absolute" />
                                </div>
                            </motion.div>
                        </div>

                        {/* Tierra / hora */}
                        <div className={`absolute bottom-0 w-full h-[55px] md:h-[75px] bg-gradient-to-t ${season === 'verano' ? 'from-green-900 via-green-800 to-green-800 border-green-400' : 'from-green-800-950 via-teal-900 to-cyan-900 border-teal-600'} z-10 rounded-t-[50%] flex justify-center items-start pt-2 md:pt-4 border-t-[3px] transition-colors duration-1000`}>
                            <div className="font-mono text-xl md:text-2xl tracking-widest font-black text-white bg-black/40 px-4 py-1 rounded-full border border-white/20 drop-shadow">
                                {formatTime(simulatedTime)}
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: Dos paneles de texto apilados (cada uno ~50% de alto) */}
                    <div className="flex-1 flex flex-col gap-3">

                        {/* Panel Bio-Estado */}
                        <div className="flex-1 bg-white rounded-[1.2rem] md:rounded-[1.8rem] p-4 shadow-sm border border-zinc-100 flex flex-col justify-center items-center text-center relative overflow-hidden">
                            <div className="absolute top-2 left-0 w-full text-[9px] font-black tracking-widest text-zinc-300 uppercase">
                                Bio-Estado
                            </div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={bioState.title}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex flex-col items-center w-full px-2 pt-3"
                                >
                                    <div className="text-3xl md:text-4xl mb-1">{bioState.icon}</div>
                                    <h2 className={`text-sm md:text-base font-black mb-1 tracking-tight leading-tight ${bioState.color}`}>
                                        {bioState.title}
                                    </h2>
                                    <p className="text-[11px] text-slate-500 font-semibold leading-snug max-w-xs">
                                        {bioState.desc}
                                    </p>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Panel Hack Científico */}
                        <div className="flex-1 bg-gradient-to-br from-green-50 to-yellow-50/70 rounded-[1.2rem] md:rounded-[1.8rem] p-4 shadow-sm border border-green-100 flex flex-col justify-center">
                            <div className="text-[9px] font-black tracking-widest text-green-800 uppercase mb-2 flex items-center gap-1.5">
                                <Lightbulb size={12} className="text-yellow-600" />
                                Hack Científico
                            </div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={bioState.hack}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-start gap-2"
                                >
                                    <CheckCircle2 size={16} className="text-green-800 shrink-0 mt-0.5" strokeWidth={3} />
                                    <p className="text-[11px] md:text-[12px] text-green-900 font-bold leading-snug">
                                        {bioState.hack}
                                    </p>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}


