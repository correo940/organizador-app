'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Sun, Moon, Zap, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { AnalisisCientificoTab } from './AnalisisCientificoTab';
import { InfografiaInteractiva } from './InfografiaInteractiva';
import { SimuladorCircadianoAPP } from './SimuladorCircadianoAPP';
import Image from 'next/image';
import { NSQCards } from './NSQCards';

// ── Parallax hook ──────────────────────────────────────────────────────────────
function useParallax(speed = 0.3) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const onScroll = () => {
            const rect = el.getBoundingClientRect();
            const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed;
            el.style.transform = `translateY(${offset}px)`;
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [speed]);
    return ref;
}

// ── Fade-in on scroll (with guaranteed fallback) ───────────────────────────────
function FadeIn({
    children,
    delay = 0,
    className = '',
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Always show after delay + 700 ms even if observer never fires
        const fallback = setTimeout(() => setVisible(true), delay * 1000 + 700);

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    clearTimeout(fallback);
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
        );
        observer.observe(el);

        return () => {
            observer.disconnect();
            clearTimeout(fallback);
        };
    }, [delay]);

    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(30px)',
                transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
            }}
        >
            {children}
        </div>
    );
}

// ── Section divider ────────────────────────────────────────────────────────────
function SectionDivider({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
    return (
        <div
            className={`h-20 ${variant === 'dark'
                ? 'bg-gradient-to-b from-transparent to-zinc-50'
                : 'bg-gradient-to-b from-transparent to-white'
                }`}
        />
    );
}

// ── Problem Card Component ──────────────────────────────────────────────────
function ProblemCard({ icon, q, detailContent }: { icon: string; q: string; detailContent?: React.ReactNode }) {
    const [isFlipped, setIsFlipped] = useState(false);
    const { user, loading } = useAuth();

    if (!detailContent) {
        return (
            <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6 text-left h-full">
                <div className="text-3xl mb-3">{icon}</div>
                <p className="text-zinc-600 text-sm leading-relaxed font-medium">{q}</p>
            </div>
        );
    }

    return (
        <div
            className="group h-[320px] [perspective:1000px] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div
                className={`relative h-full w-full transition-all duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
                {/* Front */}
                <div className="absolute inset-0 [backface-visibility:hidden] bg-zinc-50 border border-zinc-100 rounded-2xl p-8 flex flex-col justify-center text-left">
                    <div className="text-4xl mb-4">{icon}</div>
                    <p className="text-zinc-800 font-bold text-lg leading-relaxed">{q}</p>
                    
                    <div className="mt-8 flex items-center gap-2 text-[10px] text-green-700 font-bold uppercase tracking-widest">
                        <Zap 
                            size={12} 
                            className="text-blue-400 fill-blue-400 animate-pulse filter drop-shadow-[0_0_3px_rgba(96,165,250,0.8)]" 
                        /> 
                        Hacer clic para saber por qué
                    </div>
                </div>

                {/* Back */}
                <div
                    className="absolute inset-0 h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white border border-yellow-200 rounded-2xl p-6 overflow-y-auto shadow-inner"
                >
                    {!user && !loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                <Lock className="text-yellow-600 w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-zinc-900 text-sm">Contenido Protegido</p>
                                <p className="text-[11px] text-zinc-500 leading-relaxed">
                                    Debes ser miembro de Quioba para ver este análisis detallado.
                                </p>
                            </div>
                            <Link 
                                href="/apps/mi-hogar/login"
                                onClick={(e) => e.stopPropagation()}
                                className="bg-green-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors shadow-md"
                            >
                                Ser Miembro
                            </Link>
                        </div>
                    ) : loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-800"></div>
                        </div>
                    ) : (
                        <div className="text-[13px] text-zinc-700 space-y-4 leading-relaxed">
                            {detailContent}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Master Clock Card Component ──────────────────────────────────────────────
function MasterClockCard({ detailContent }: { detailContent: React.ReactNode }) {
    const [isFlipped, setIsFlipped] = useState(false);
    const { user, loading } = useAuth();

    return (
        <div
            className="group h-[320px] [perspective:1000px] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div
                className={`relative h-full w-full transition-all duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
                {/* Front */}
                <div className="absolute inset-0 [backface-visibility:hidden] bg-green-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl border border-white/10 overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-black/10 rounded-full blur-3xl group-hover:bg-black/20 transition-colors" />
                    
                    <div className="relative z-10 space-y-4">
                        <div className="relative w-24 h-24 mx-auto">
                            <Image 
                                src="/images/articles/3d-brain-v2.png" 
                                alt="3D Brain" 
                                fill 
                                className="object-contain drop-shadow-[0_0_15px_rgba(255,100,200,0.4)] scale-125 mix-blend-screen"
                            />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tight mb-2">El Reloj Maestro</h3>
                            <p className="text-green-100/70 text-sm leading-relaxed px-4">
                                Núcleo Supraquiasmático — actúa como el director de orquesta.
                            </p>
                        </div>
                    </div>

                    <div className="absolute bottom-6 flex items-center gap-2 text-[10px] text-green-200/50 font-bold uppercase tracking-widest">
                        <Zap 
                            size={12} 
                            className="text-blue-400 fill-blue-400 animate-pulse filter drop-shadow-[0_0_3px_rgba(96,165,250,0.8)]" 
                        /> 
                        Hacer clic para saber más
                    </div>
                </div>

                {/* Back */}
                <div
                    className="absolute inset-0 h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white border border-yellow-200 rounded-3xl p-6 overflow-y-auto shadow-inner"
                >
                    {!user && !loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                <Lock className="text-yellow-600 w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-zinc-900 text-sm">Contenido Protegido</p>
                                <p className="text-[11px] text-zinc-500 leading-relaxed">
                                    Debes ser miembro de Quioba para ver este análisis detallado.
                                </p>
                            </div>
                            <Link 
                                href="/apps/mi-hogar/login"
                                onClick={(e) => e.stopPropagation()}
                                className="bg-green-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-700 transition-colors shadow-md"
                            >
                                Ser Miembro
                            </Link>
                        </div>
                    ) : loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-800"></div>
                        </div>
                    ) : (
                        <div className="text-[13px] text-zinc-700 space-y-4 leading-relaxed">
                            {detailContent}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Interactive Organ Card Component ──────────────────────────────────────────
function InteractiveOrganCard({ 
    name, 
    sub, 
    icon, 
    detailContent,
    className = ""
}: { 
    name: string; 
    sub: string; 
    icon: React.ReactNode; 
    detailContent: React.ReactNode;
    className?: string;
}) {
    const [isFlipped, setIsFlipped] = useState(false);
    const { user, loading } = useAuth();

    return (
        <div
            className={`group h-[200px] [perspective:1000px] cursor-pointer ${className}`}
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div
                className={`relative h-full w-full transition-all duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
                {/* Front */}
                <div className="absolute inset-0 [backface-visibility:hidden] bg-yellow-500 border border-yellow-600/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-xl hover:shadow-2xl transition-all">
                    <div className="mb-4 group-hover:scale-110 transition-transform bg-zinc-900 rounded-full p-2 w-16 h-16 flex items-center justify-center border border-white/20 shadow-inner relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-yellow-600/20 to-transparent" />
                        <div className="relative w-12 h-12">
                            {icon}
                        </div>
                    </div>
                    <p className="font-black text-yellow-950 text-sm leading-tight uppercase tracking-tight">{name}</p>
                    <p className="text-yellow-900/60 text-[10px] mb-3 font-bold">{sub}</p>
                    
                    <div className="flex items-center gap-1 text-[9px] text-yellow-950 font-black uppercase tracking-wider mt-auto pt-2 border-t border-yellow-600/20 w-full justify-center">
                        <Zap size={10} className="text-blue-400 fill-blue-400 animate-pulse" />
                        Saber más
                    </div>
                </div>

                {/* Back */}
                <div
                    className="absolute inset-0 h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-zinc-50 border border-green-100 rounded-2xl p-4 overflow-y-auto shadow-inner"
                >
                    {!user && !loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                            <Lock className="text-yellow-600 w-5 h-5 opacity-40" />
                            <p className="font-bold text-zinc-400 text-[10px] leading-tight">Acceso<br/>Miembros</p>
                            <Link 
                                href="/apps/mi-hogar/login"
                                onClick={(e) => e.stopPropagation()}
                                className="bg-green-800 text-white px-3 py-1.5 rounded-xl text-[9px] font-black hover:bg-green-700 transition-colors shadow-sm"
                            >
                                Entrar
                            </Link>
                        </div>
                    ) : loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-800"></div>
                        </div>
                    ) : (
                        <div className="text-[11px] text-zinc-700 leading-relaxed space-y-2">
                            {detailContent}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Locked Section Component ────────────────────────────────────────────────
function LockedSection() {
    return (
        <section className="relative py-24 px-6 overflow-hidden bg-zinc-50/50 border border-zinc-100 rounded-3xl my-12">
            <div className="max-w-2xl mx-auto text-center space-y-6 relative z-10">
                <div className="w-20 h-20 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-400/30">
                    <Lock className="text-yellow-600 w-8 h-8" />
                </div>
                
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">
                    Contenido Exclusivo para Usuarios Quioba
                </h2>
                
                <p className="text-zinc-600 text-base leading-relaxed">
                    Sincronizar tus ritmos biológicos es el paso más importante para recuperar tu energía. Regístrate para acceder a la guía completa, análisis científicos y herramientas interactivas.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                    <Link 
                        href="/apps/mi-hogar/login"
                        className="bg-green-800 text-white px-8 py-4 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg hover:shadow-green-900/20 flex items-center justify-center gap-2"
                    >
                        Registrarse
                    </Link>
                </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-64 bg-green-500/5 rounded-full blur-3xl -z-0" />
        </section>
    );
}

export default function CiclosCircadianosPage() {
    const { user, loading } = useAuth();
    const heroParallax = useParallax(0.4);

    return (
        <div className="min-h-screen font-sans">
            {/* ── HERO ── */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
                <div
                    ref={heroParallax}
                    className="absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(34,197,94,0.1) 0%, rgba(255,255,255,0) 70%), radial-gradient(ellipse 60% 50% at 80% 70%, rgba(234,179,8,0.1) 0%, transparent 60%)',
                    }}
                />

                {/* Clock rings */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-10">
                    {[320, 420, 520, 620].map((size, i) => (
                        <div
                            key={i}
                            className="absolute rounded-full border border-black/5"
                            style={{
                                width: size,
                                height: size,
                                animation: `spin ${20 + i * 8}s linear infinite ${i % 2 === 0 ? '' : 'reverse'}`,
                            }}
                        />
                    ))}
                </div>

                <div className="relative z-10 px-6 max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-12">
                        <Link
                            href="/articles"
                            className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors text-sm"
                        >
                            <ArrowLeft size={14} /> Volver a artículos
                        </Link>

                        <div className="inline-flex items-center gap-2 bg-yellow-400/20 text-yellow-700 text-xs font-semibold px-4 py-2 rounded-full border border-yellow-400/30">
                            <Clock size={12} /> SALUD FÍSICA · BIENESTAR
                        </div>
                    </div>

                    <div className="text-center max-w-4xl mx-auto">
                        <h1 className="text-5xl md:text-7xl font-black text-yellow-500 leading-[1.05] mb-6">
                        Tu Cuerpo Tiene{' '}
                        <span
                            className="block"
                            style={{
                                background: 'linear-gradient(135deg, #15803d, #eab308)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Un Reloj Maestro
                        </span>
                    </h1>

                    <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-10">
                        Los ciclos circadianos organizan prácticamente todo lo que ocurre en tu cuerpo.
                        No es solo estar despierto o dormido — es decidir{' '}
                        <strong className="text-green-950">cuándo</strong> ejecutar tus funciones vitales.
                    </p>

                    <div className="flex flex-wrap justify-center gap-4 text-sm text-black/50">
                        <span className="flex items-center gap-1">
                            <Sun size={14} className="text-yellow-600" /> Rendimiento y Defensa
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                            <Moon size={14} className="text-green-600" /> Reparación y Limpieza
                        </span>
                    </div>
                </div>
            </div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-black/40 text-xs animate-bounce">
                    <div className="w-px h-10 bg-gradient-to-b from-black/0 to-black/40" />
                    <span>Scroll</span>
                </div>

                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </section>

            {/* ── SECCIONES PRINCIPALES (TABS) ── */}


            <Tabs defaultValue="completo" className="w-full">
                <div className="bg-white border-b border-black/5 py-6 sticky top-0 z-50 flex justify-center backdrop-blur-md bg-opacity-80">
                    <TabsList className="bg-zinc-100 border border-zinc-200 p-1 rounded-full text-zinc-600">
                        <TabsTrigger
                            value="completo"
                            className="rounded-full px-6 py-2 data-[state=active]:bg-green-800 data-[state=active]:text-white"
                        >
                            Artículo Completo
                        </TabsTrigger>
                        <TabsTrigger
                            value="resumen"
                            className="rounded-full px-6 py-2 data-[state=active]:bg-green-800 data-[state=active]:text-white"
                        >
                            Resumen Rápido
                        </TabsTrigger>
                        <TabsTrigger
                            value="analisis"
                            className="rounded-full px-6 py-2 data-[state=active]:bg-green-800 data-[state=active]:text-white"
                        >
                            Análisis Científico
                        </TabsTrigger>
                        <TabsTrigger
                            value="aplicacion"
                            className="rounded-full px-6 py-2 data-[state=active]:bg-green-800 data-[state=active]:text-white"
                        >
                            Aplicación
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="completo" className="m-0 focus-visible:outline-none">
                    {/* ── SLIDE 1: ¿Qué son? ── */}
                    <section className="bg-white py-24 px-6">
                        <div className="max-w-5xl mx-auto">
                            <FadeIn>
                                <p className="text-green-600 font-semibold text-sm tracking-widest uppercase mb-3 text-center">Concepto base</p>
                                <h2 className="text-4xl md:text-5xl font-black text-center mb-6 text-green-800">
                                    ¿Qué son los Ciclos Circadianos?
                                </h2>
                                <p className="text-xl text-zinc-600 max-w-3xl mx-auto text-center leading-relaxed mb-16">
                                    El sistema biológico de 24 horas que organiza prácticamente todo lo que ocurre en tu cuerpo.
                                    No es solo estar despierto o dormido; es decidir cuándo tu cuerpo ejecuta sus funciones vitales.
                                </p>
                            </FadeIn>

                            <div className="grid md:grid-cols-2 gap-6">
                                {[
                                    {
                                        icon: '🌅',
                                        title: 'DURANTE EL DÍA',
                                        color: 'from-green-50 to-green-50',
                                        border: 'border-green-200',
                                        description: 'Tu reloj interno configura tu fisiología para gastar energía, asimilar nutrientes, rendir mental y físicamente, y defenderte de las amenazas del entorno, reservando la noche exclusivamente para los procesos de "limpieza" y reparación celular.',
                                        items: []
                                    },
                                    {
                                        icon: '🌙',
                                        title: 'DURANTE LA NOCHE',
                                        color: 'from-green-50 to-teal-50',
                                        border: 'border-green-200',
                                        description: 'La noche biológica no es un estado de inactividad, sino un periodo de intenso trabajo interno donde tus células se reparan, tu cerebro se limpia y tus hormonas se reinician para que puedas despertar con vitalidad.',
                                        items: []
                                    },
                                ].map((card, i) => (
                                    <FadeIn key={card.title} delay={i * 0.15}>
                                        <div className={`bg-gradient-to-br ${card.color} border ${card.border} rounded-2xl p-8 h-full`}>
                                            <div className="text-4xl mb-4">{card.icon}</div>
                                            <h3 className="text-xl font-bold text-green-950 text-center mb-4">{card.title}</h3>
                                            {card.description ? (
                                                <p className="text-zinc-700 text-sm leading-relaxed text-center">
                                                    {card.description}
                                                </p>
                                            ) : (
                                                <ul className="space-y-2">
                                                    {card.items?.map((item) => (
                                                        <li key={item} className="flex items-center gap-3 text-zinc-700">
                                                            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </FadeIn>
                                ))}
                            </div>
                        </div>
                    </section>

                    <SectionDivider variant="dark" />

                    {/* ── SLIDE 2: El Problema ── */}
                    <section className="bg-white py-24 px-6 border-t border-zinc-100">
                        <div className="max-w-4xl mx-auto text-center">
                            <FadeIn>
                                <p className="text-yellow-600 font-semibold text-sm tracking-widest uppercase mb-6 text-center">
                                    ¿Por qué te sientes mal?
                                </p>
                            </FadeIn>

                            <div className="grid md:grid-cols-3 gap-6 mb-16">
                                <FadeIn delay={0.1}>
                                    <ProblemCard
                                        icon="🔋"
                                        q="¿Te levantas cansado sin importar cuánto duermas?"
                                        detailContent={
                                            <>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-yellow-600 text-sm uppercase tracking-tight">Cronodisrupción</p>
                                                    <p className="font-medium text-zinc-900 italic">"Jet lag social"</p>
                                                </div>
                                                
                                                <p>
                                                    Si te levantas cansado sin importar cuántas horas duermas, lo más probable es que tu problema no sea la cantidad de sueño, sino que tu reloj biológico interno está desajustado.
                                                </p>

                                                <div className="space-y-2">
                                                    <p className="font-bold text-green-800 border-b border-green-100 pb-1">¿Por qué te sientes mal?</p>
                                                    <p className="text-xs">
                                                        Nuestro cuerpo se rige por ritmos circadianos de 24 horas, controlados por un "reloj maestro" en el cerebro que se sincroniza con la luz. El estilo de vida moderno nos lleva a vivir contra nuestra biología.
                                                    </p>
                                                </div>

                                                <div className="bg-zinc-50 p-4 rounded-xl space-y-3">
                                                    <p className="font-bold text-black text-[11px] uppercase tracking-wider flex items-center gap-2">
                                                        <AlertCircle size={14} className="text-red-500" /> Señales contradictorias:
                                                    </p>
                                                    <div className="space-y-3 text-xs text-zinc-600">
                                                        <p><strong>📱 Pantallas:</strong> La luz azul engaña a tu cerebro, inhibiendo la melatonina e interrumpiendo el sueño profundo.</p>
                                                        <p><strong>✈️ Horarios:</strong> Variar tus horas de sueño los fines de semana provoca fatiga y aturdimiento matutino.</p>
                                                        <p><strong>🍽️ Digestión:</strong> Cenar tarde obliga al sistema digestivo a trabajar, impidiendo un sueño reparador.</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-2">
                                                    <p className="font-bold text-green-700">¿Cuál es la solución?</p>
                                                    <div className="grid gap-3 text-xs">
                                                        <div className="flex gap-3">
                                                            <span className="text-yellow-500 shrink-0">☀️</span>
                                                            <p><strong>Luz:</strong> Sal al exterior 20-30 min al despertar y evita pantallas 2h antes de dormir.</p>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <span className="text-blue-500 shrink-0">⏰</span>
                                                            <p><strong>Rutina:</strong> Mantén la misma hora de despertar siempre (máx 1h de diferencia).</p>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <span className="text-green-500 shrink-0">🥗</span>
                                                            <p><strong>Nutrición:</strong> Come en una ventana de 8-10h y termina 3-4h antes de acostarte.</p>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <span className="text-indigo-500 shrink-0">❄️</span>
                                                            <p><strong>Entorno:</strong> Habitación oscura, silenciosa y fresca (aprox. 18ºC).</p>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <span className="text-red-500 shrink-0">🚫</span>
                                                            <p><strong>Control:</strong> Siestas de máx 20 min y evita cafeína/ejercicio tarde.</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <p className="italic text-[11px] text-zinc-500 border-t border-zinc-100 pt-4">
                                                    La solución no es solo dormir más, sino hacer las cosas en el momento biológico correcto.
                                                </p>
                                            </>
                                        }
                                    />
                                </FadeIn>
                                <FadeIn delay={0.2}>
                                    <ProblemCard
                                        icon="👁️"
                                        q="¿Sufres de insomnio o te cuesta conciliar el sueño?"
                                        detailContent={
                                            <>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-blue-600 text-sm uppercase tracking-tight">Insomnio</p>
                                                    <p className="font-medium text-zinc-900 italic">Trastorno del sueño frecuente</p>
                                                </div>
                                                
                                                <p>
                                                    Si sufres de insomnio o te cuesta conciliar el sueño, no estás solo: se calcula que entre un 20% y un 30% de las personas tienen dificultades para dormirse.
                                                </p>

                                                <div className="space-y-2">
                                                    <p className="font-bold text-indigo-800 border-b border-indigo-100 pb-1">El mito de la luz azul</p>
                                                    <p className="text-xs">
                                                        Aunque se culpa a la luz azul, estudios revelan que su impacto exclusivo retrasa el sueño solo unos 10 minutos. <strong>El verdadero problema es la activación mental</strong> por el contenido estimulante.
                                                    </p>
                                                </div>

                                                <div className="bg-zinc-50 p-4 rounded-xl space-y-3">
                                                    <p className="font-bold text-black text-[11px] uppercase tracking-wider flex items-center gap-2">
                                                        <CheckCircle2 size={14} className="text-green-500" /> Estrategias efectivas:
                                                    </p>
                                                    <div className="space-y-3 text-xs text-zinc-600">
                                                        <p><strong>⏱️ Regla de los 20 min:</strong> Si no te duermes en 20 min, levántate. Haz algo relajante con luz tenue fuera de la cama.</p>
                                                        <p><strong>🧘 Ritual de transición:</strong> 20-30 min antes de dormir, baja las luces, lee o medita para inducir calma.</p>
                                                        <p><strong>📵 Desconexión digital:</strong> Apaga pantallas 1h antes. Reserva la cama solo para dormir e intimidad.</p>
                                                        <p><strong>🦇 Cueva de sueño:</strong> Habitación oscura, silenciosa y fresca. Usa antifaces o ruido blanco si es necesario.</p>
                                                        <p><strong>☕ Cuidado con ingestas:</strong> Evita cenas pesadas, limita el alcohol y elimina la cafeína por la tarde.</p>
                                                        <p><strong>🏃 Ejercicio:</strong> No realices actividad física intensa 3-4 horas antes de acostarte.</p>
                                                    </div>
                                                </div>

                                                <p className="italic text-[11px] text-zinc-500 border-t border-zinc-100 pt-4">
                                                    Si el insomnio persiste más de 3-4 semanas, consulta a un profesional médico.
                                                </p>
                                            </>
                                        }
                                    />
                                </FadeIn>
                                <FadeIn delay={0.3}>
                                    <ProblemCard
                                        icon="🍎"
                                        q="¿Sientes un hambre incontrolable a deshoras?"
                                        detailContent={
                                            <>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-orange-600 text-sm uppercase tracking-tight">Cronodisrupción</p>
                                                    <p className="font-medium text-zinc-900 italic">Hambre a deshoras</p>
                                                </div>
                                                
                                                <p>
                                                    Sentir un hambre incontrolable a deshoras (especialmente por la noche) es un síntoma clásico de que tus ciclos circadianos están desajustados.
                                                </p>

                                                <div className="space-y-2">
                                                    <p className="font-bold text-red-800 border-b border-red-100 pb-1">El cortocircuito hormonal</p>
                                                    <p className="text-xs">
                                                        La falta de sincronía aumenta la <strong>grelina</strong> (estimula el apetito) y reduce la <strong>leptina</strong> (señal de saciedad). Tu cerebro no recibe el mensaje de que ya has comido suficiente.
                                                    </p>
                                                </div>

                                                <div className="bg-zinc-50 p-4 rounded-xl space-y-3">
                                                    <p className="font-bold text-black text-[11px] uppercase tracking-wider flex items-center gap-2">
                                                        <AlertCircle size={14} className="text-orange-500" /> ¿Qué ocurre en tu cuerpo?
                                                    </p>
                                                    <div className="space-y-3 text-xs text-zinc-600">
                                                        <p><strong>🧠 Pérdida de freno:</strong> Se desactivan genes que inhiben el hambre en el hipotálamo, empujándote a comer en exceso.</p>
                                                        <p><strong>🍔 Atracción por ultraprocesados:</strong> La cronodisrupción altera tus preferencias, buscando instintivamente grasas y carbohidratos (+250 kcal/día).</p>
                                                        <p><strong>🔄 Círculo vicioso:</strong> Comer de noche frena la quema de grasas y genera desalineamiento entre el cerebro y el hígado.</p>
                                                    </div>
                                                </div>

                                                <p className="italic text-[11px] text-zinc-500 border-t border-zinc-100 pt-4">
                                                    No es falta de voluntad; es una respuesta fisiológica de un cuerpo desincronizado.
                                                </p>
                                            </>
                                        }
                                    />
                                </FadeIn>
                            </div>

                            <FadeIn>
                                <div
                                    className="rounded-3xl p-10 mb-8"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(234,179,8,0.05))',
                                        border: '1px solid rgba(0,0,0,0.05)',
                                    }}
                                >
                                    <p className="text-3xl md:text-4xl font-black text-yellow-500 leading-tight mb-4">
                                        No es falta de disciplina.<br />
                                        <span>Es tu reloj interno desajustado.</span>
                                    </p>
                                    <p className="text-zinc-500 text-lg">
                                        Este desajuste no solo drena tu energía hoy; altera tu{' '}
                                        <strong className="text-black">metabolismo</strong>, tus{' '}
                                        <strong className="text-black">hormonas</strong> y tu{' '}
                                        <strong className="text-black">salud</strong> a largo plazo.
                                    </p>
                                </div>
                            </FadeIn>
                        </div>
                    </section>

                    <SectionDivider variant="light" />

                    {/* ── SLIDE 3: El Reloj Maestro ── */}
                    <section className="bg-white py-24 px-6">
                        <div className="max-w-5xl mx-auto">
                            <FadeIn className="max-w-3xl mx-auto">
                                <p className="text-green-800 font-semibold text-sm tracking-widest uppercase mb-3 text-center">La arquitectura</p>
                                <h2 className="text-4xl md:text-5xl font-black text-green-800 text-center mb-4">
                                    No tienes un solo reloj.<br />
                                    <span>Tienes millones.</span>
                                </h2>
                                <p className="text-xl text-zinc-600 text-center max-w-3xl mx-auto mb-12">
                                    Tu salud depende de que todos estos órganos estén sincronizados entre sí y con tu entorno.
                                </p>
                            </FadeIn>

                            <div className="grid md:grid-cols-5 gap-6 items-center">
                                <FadeIn delay={0} className="md:col-span-2">
                                    <MasterClockCard 
                                        detailContent={
                                            <div className="space-y-4">
                                                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                                    <h4 className="font-bold text-green-800 text-sm mb-2 uppercase tracking-wider">El Reloj Maestro (NSQ)</h4>
                                                    <p className="text-[12px] leading-relaxed">El núcleo supraquiasmático, situado en el hipotálamo anterior, es el marcapasos central de tu organismo. Compuesto por 20.000 neuronas, coordina a los relojes periféricos de todos tus órganos.</p>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    <p className="font-bold text-zinc-900 border-b pb-1 text-xs">Claves de su Liderazgo:</p>
                                                    <div className="text-[11px] space-y-3 leading-relaxed">
                                                        <p><strong>1. La Batuta:</strong> La luz entra por la vía retinohipotalámica. Las células con <strong>melanopsina</strong> miden la luminosidad ambiental.</p>
                                                        <p><strong>2. Organización:</strong> Se divide en <strong>Core</strong> (recibe luz, usa VIP) y <strong>Shell</strong> (estabiliza el ritmo, usa AVP).</p>
                                                        <p><strong>3. La Partitura:</strong> Envía órdenes a la glándula pineal para secretar melatonina en la oscuridad. También regula cortisol, temperatura e insulina.</p>
                                                        <p><strong>4. Autonomía:</strong> Funciona incluso aislado del cuerpo gracias a genes reloj (CLOCK, BMAL1, PER, CRY) y al AMP cíclico.</p>
                                                    </div>
                                                </div>

                                                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                                    <p className="text-[11px] text-red-800 leading-relaxed font-medium">
                                                        Cuando este núcleo falla por pantallas o jet lag, toda la "orquesta" pierde el ritmo, provocando insomnio y fatiga crónica.
                                                    </p>
                                                </div>
                                            </div>
                                        }
                                    />
                                </FadeIn>

                                <div className="hidden md:flex justify-center text-4xl text-slate-400">→</div>

                                <FadeIn delay={0.2} className="md:col-span-2 grid grid-cols-2 gap-4">
                                    <InteractiveOrganCard 
                                        name="Hígado"
                                        sub="Metabolismo"
                                        icon={
                                            <div className="relative w-12 h-12">
                                                <Image 
                                                    src="/images/articles/3d-liver.png" 
                                                    alt="3D Liver" 
                                                    fill 
                                                    className="object-contain drop-shadow-[0_0_8px_rgba(239,68,68,0.3)] mix-blend-screen"
                                                />
                                            </div>
                                        }
                                        detailContent={
                                            <div className="space-y-2">
                                                <p className="font-black text-green-800 uppercase tracking-tighter text-[9px] border-b border-green-100 pb-1">El Reloj Hepático</p>
                                                <p>Su principal sincronizador es el <strong>horario de comidas</strong>, no la luz.</p>
                                                <div className="space-y-1.5 mt-2">
                                                    <p><strong>• Glucosa:</strong> Absorbe azúcar y frena la gluconeogénesis durante el día.</p>
                                                    <p><strong>• Grasas:</strong> El fallo del reloj (REV-ERB) causa acumulación de triglicéridos e <strong>hígado graso</strong>.</p>
                                                    <p><strong>• Conflicto:</strong> Comer tarde desincroniza al hígado del cerebro, bloqueando la quema de grasas.</p>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <InteractiveOrganCard 
                                        name="Sistema Inmune"
                                        sub="Defensas"
                                        icon={
                                            <div className="relative w-12 h-12">
                                                <Image 
                                                    src="/images/articles/3d-immune.png" 
                                                    alt="3D Immune" 
                                                    fill 
                                                    className="object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] mix-blend-screen"
                                                />
                                            </div>
                                        }
                                        detailContent={
                                            <div className="space-y-2 text-left">
                                                <p className="font-black text-blue-800 uppercase tracking-tighter text-[9px] border-b border-blue-100 pb-1">Defensa Circadiana</p>
                                                <p>Tus células inmunes tienen su propio reloj para optimizar su eficacia según la hora.</p>
                                                <div className="space-y-1.5 mt-2">
                                                    <p><strong>• Día (Alerta):</strong> Preparadas para interceptar virus y bacterias mientras estás activo.</p>
                                                    <p><strong>• Noche (Memoria):</strong> Consolidan el registro de patógenos y regeneran tejidos.</p>
                                                    <p><strong>• Control:</strong> El cortisol y la melatonina coordinan la migración de las "tropas" de defensa.</p>
                                                    <p className="text-red-700 text-[10px] pt-1 font-medium">La cronodisrupción causa inflamación y riesgo de enfermedades autoinmunes.</p>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <InteractiveOrganCard 
                                        name="Músculos"
                                        sub="Rendimiento"
                                        icon={
                                            <div className="relative w-12 h-12">
                                                <Image 
                                                    src="/images/articles/3d-muscles.png" 
                                                    alt="3D Muscles" 
                                                    fill 
                                                    className="object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] mix-blend-screen"
                                                />
                                            </div>
                                        }
                                        detailContent={
                                            <div className="space-y-2 text-left">
                                                <p className="font-black text-orange-800 uppercase tracking-tighter text-[9px] border-b border-orange-100 pb-1">Rendimiento Muscular</p>
                                                <p>Tus músculos tienen relojes que regulan la energía y la sensibilidad a la insulina según la hora.</p>
                                                <div className="space-y-1.5 mt-2">
                                                    <p><strong>• La Tarde (Pico):</strong> Máximo rendimiento y flexibilidad. Ideal para fuerza e intensidad.</p>
                                                    <p><strong>• La Mañana:</strong> Excelente para activar el metabolismo y el estado de ánimo.</p>
                                                    <p><strong>• La Noche:</strong> Evita el ejercicio intenso. Eleva el cortisol y bloquea el sueño reparador.</p>
                                                    <p className="text-zinc-500 text-[10px] pt-1 italic leading-tight">Entrenar con el reloj optimiza la quema de grasas y previene lesiones.</p>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <InteractiveOrganCard 
                                        name="Tejido Adiposo"
                                        sub="Almacenamiento"
                                        icon={
                                            <div className="relative w-12 h-12">
                                                <Image 
                                                    src="/images/articles/3d-adipose.png" 
                                                    alt="3D Adipose" 
                                                    fill 
                                                    className="object-contain drop-shadow-[0_0_8px_rgba(251,191,36,0.3)] mix-blend-screen"
                                                />
                                            </div>
                                        }
                                        detailContent={
                                            <div className="space-y-2 text-left">
                                                <p className="font-black text-amber-800 uppercase tracking-tighter text-[9px] border-b border-amber-100 pb-1">Gestión de Grasa</p>
                                                <p>Tus células grasas tienen un reloj que dicta cuándo acumular energía y cuándo quemarla.</p>
                                                <div className="space-y-1.5 mt-2">
                                                    <p><strong>• El Freno (REV-ERB):</strong> Bloquea la formación de nueva grasa (adipogénesis) de forma rítmica.</p>
                                                    <p><strong>• Sensibilidad:</strong> Durante el día, procesas la energía eficientemente. De noche, priorizas el almacenamiento.</p>
                                                    <p><strong>• Ventana Diurna:</strong> Comer solo de día sincroniza estos relojes, reduciendo la masa grasa acumulada.</p>
                                                    <p className="text-red-700 text-[10px] pt-1 font-medium leading-tight">Comer tarde bloquea la quema de grasas (lipólisis) y acelera la obesidad.</p>
                                                </div>
                                            </div>
                                        }
                                    />
                                </FadeIn>
                            </div>

                            {/* ── SECCIÓN ELIMINADA: NSQCards se movió dentro de la tarjeta maestra ── */}
                        </div>
                    </section>

                    {/* ── SLIDE 4: La Luz ── */}
                    <section
                        className="relative py-24 px-6 overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #f0fdf4, #f8fafc)' }}
                    >
                        <div className="max-w-5xl mx-auto">
                            <FadeIn>
                                <p className="text-green-600 font-semibold text-sm tracking-widest uppercase mb-3 text-center">
                                    El interruptor principal
                                </p>
                                <h2 className="text-4xl md:text-5xl font-black text-yellow-500 text-center mb-6">
                                    La Luz: El Director de la Orquesta Biológica
                                </h2>
                                <p className="text-xl text-zinc-700 text-center max-w-2xl mx-auto mb-12">
                                    La retina contiene células sensibles a la luz que envían señales directas al reloj maestro en el cerebro.
                                </p>
                            </FadeIn>

                            <FadeIn delay={0.1}>
                                <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-16">
                                    <InteractiveOrganCard 
                                        name="Retina"
                                        sub="Sensor de Luz"
                                        className="w-[180px]"
                                        icon={
                                            <div className="relative w-12 h-12">
                                                <Image 
                                                    src="/images/articles/3d-eye.png" 
                                                    alt="3D Eye" 
                                                    fill 
                                                    className="object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] mix-blend-screen"
                                                />
                                            </div>
                                        }
                                        detailContent={
                                            <div className="space-y-2 text-left">
                                                <p className="font-black text-yellow-800 uppercase tracking-tighter text-[9px] border-b border-yellow-100 pb-1">Vía Retinohipotalámica</p>
                                                <p>El mecanismo que permite a tu cuerpo sincronizarse con el entorno.</p>
                                                <div className="space-y-1.5 mt-2 text-[11px] leading-relaxed">
                                                    <p><strong>• ipRGCs:</strong> Células especiales que solo miden la luminosidad, no forman imágenes.</p>
                                                    <p><strong>• Melanopsina:</strong> Fotopigmento hipersensible a la luz azul (~480nm).</p>
                                                    <p><strong>• La Autopista:</strong> Envío directo al NSQ mediante glutamato.</p>
                                                    <p><strong>• El Ajuste:</strong> La señal inhibe la melatonina y "resetea" tus genes reloj.</p>
                                                    <p className="text-red-700 font-bold mt-1">⚠️ Mirar pantallas de noche engaña al cerebro: "todavía es de día".</p>
                                                </div>
                                            </div>
                                        }
                                    />

                                    <div className="hidden md:flex flex-col items-center gap-2">
                                        <div className="text-yellow-400 font-bold text-xs uppercase tracking-widest animate-pulse">Sincronización</div>
                                        <div className="w-32 h-[2px] bg-gradient-to-r from-yellow-400 to-green-500 relative">
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
                                        </div>
                                    </div>

                                    <div className="h-40 w-[180px]">
                                        <div className="h-full w-full bg-green-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg border border-green-700/50">
                                            <div className="relative w-12 h-12 mb-2">
                                                <Image 
                                                    src="/images/articles/3d-brain-v2.png" 
                                                    alt="3D Brain" 
                                                    fill 
                                                    className="object-contain mix-blend-screen"
                                                />
                                            </div>
                                            <p className="font-bold text-white text-sm">Reloj Maestro</p>
                                            <p className="text-green-200 text-[10px]">Núcleo Supraquiasmático</p>
                                        </div>
                                    </div>
                                </div>
                            </FadeIn>

                            <div className="grid md:grid-cols-2 gap-6">
                                <FadeIn delay={0.2}>
                                    <div className="bg-yellow-500 rounded-2xl p-8 border border-yellow-600/20 shadow-xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all" />
                                        <div className="text-4xl mb-4">🌅</div>
                                        <h3 className="text-xl font-black text-yellow-950 mb-2 uppercase tracking-tight">Luz Natural (Mañana)</h3>
                                        <p className="text-yellow-900 font-bold mb-2">Efecto: Activación Biológica.</p>
                                        <p className="text-yellow-950/70 leading-relaxed">
                                            Sincroniza el cuerpo para el día, detiene la melatonina y eleva el cortisol natural.
                                        </p>
                                    </div>
                                </FadeIn>
                                <FadeIn delay={0.3}>
                                    <div className="bg-indigo-950 rounded-2xl p-8 border border-white/5 shadow-xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-500/20 transition-all" />
                                        <div className="text-4xl mb-4">📱</div>
                                        <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Luz Artificial (Noche)</h3>
                                        <p className="text-blue-400 font-bold mb-2">Efecto: Cronodisrupción.</p>
                                        <p className="text-zinc-300 leading-relaxed">
                                            Engaña al cerebro haciéndole creer que es de día, bloqueando el descanso profundo.
                                        </p>
                                    </div>
                                </FadeIn>
                            </div>
                        </div>
                    </section>

                    <SectionDivider variant="dark" />

                    {/* ── SLIDE 5: Sinfonía Hormonal ── */}
                    <section className="bg-white py-24 px-6 border-t border-zinc-100">
                        <div className="max-w-5xl mx-auto">
                            <FadeIn>
                                <p className="text-green-400 font-semibold text-sm tracking-widest uppercase mb-3 text-center">Tu química interna</p>
                                <h2 className="text-4xl md:text-5xl font-black text-green-800 text-center mb-4">
                                    La Sinfonía Hormonal de 24 Horas
                                </h2>
                                <p className="text-zinc-500 text-center mb-12">Cada hormona tiene su ventana horaria óptima. Respetarla lo cambia todo.</p>
                            </FadeIn>

                            <FadeIn delay={0.1}>
                                <div className="relative mb-12">
                                    <div
                                        className="h-4 rounded-full mb-8"
                                        style={{
                                            background:
                                                'linear-gradient(90deg, #064e3b 0%, #166534 50%, #064e3b 100%)',
                                        }}
                                    />
                                    <div className="flex justify-between text-zinc-400 text-sm">
                                        {['06:00', '09:00', '12:00', '18:00', '00:00', '06:00'].map((t) => (
                                            <span key={t}>{t}</span>
                                        ))}
                                    </div>
                                </div>
                            </FadeIn>

                            <div className="grid md:grid-cols-2 gap-6">
                                {[
                                    {
                                        gradient: 'from-green-800/20 to-green-950/20',
                                        border: 'border-green-800/30',
                                        badge: '☀️ Hormonas de Activación',
                                        hormones: [
                                            { name: 'Cortisol', time: '06:00 – 12:00', desc: 'Te despierta y activa.' },
                                            { name: 'Insulina', time: '12:00 – 18:00', desc: 'Máxima eficiencia para procesar alimentos.' },
                                        ],
                                    },
                                    {
                                        gradient: 'from-green-950/20 to-teal-800/20',
                                        border: 'border-green-950/30',
                                        badge: '🌙 Hormonas de Recuperación',
                                        hormones: [
                                            { name: 'Melatonina', time: '19:00 – 23:00', desc: 'Induce el sueño.' },
                                            {
                                                name: 'Hormona del Crecimiento',
                                                time: '00:00 – 03:00',
                                                desc: 'Repara tejidos durante el sueño profundo.',
                                            },
                                        ],
                                    },
                                ].map((group, i) => (
                                    <FadeIn key={group.badge} delay={i * 0.15}>
                                        <div
                                            className={`bg-gradient-to-br ${group.gradient} border ${group.border} rounded-2xl p-6`}
                                        >
                                            <p className="text-zinc-800 font-semibold mb-4">{group.badge}</p>
                                            <div className="space-y-4">
                                                {group.hormones.map((h) => (
                                                    <div key={h.name} className="bg-white/50 border border-zinc-100 rounded-xl p-4 shadow-sm">
                                                        <div className="flex items-baseline justify-between mb-1">
                                                            <h4 className="text-black font-bold">{h.name}</h4>
                                                            <span className="text-zinc-400 text-xs">{h.time}</span>
                                                        </div>
                                                        <p className="text-zinc-600 text-sm">{h.desc}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </FadeIn>
                                ))}
                            </div>

                            <FadeIn delay={0.3}>
                                <div className="mt-8 bg-zinc-50 border border-zinc-100 rounded-2xl p-6">
                                    <p className="text-black font-semibold mb-2">🍽️ El Control del Apetito</p>
                                    <p className="text-zinc-600">
                                        Las hormonas del hambre (Grelina) y saciedad (Leptina) también siguen este ritmo. Por eso, no
                                        procesas igual la comida por la mañana que por la noche.
                                    </p>
                                </div>
                            </FadeIn>
                        </div>
                    </section>

                    <SectionDivider variant="light" />

                    {/* ── SLIDE 6: Relojes Secundarios ── */}
                    <section className="bg-white py-24 px-6">
                        <div className="max-w-5xl mx-auto">
                            <FadeIn>
                                <p className="text-green-600 font-semibold text-sm tracking-widest uppercase mb-3 text-center">La comida importa</p>
                                <h2 className="text-4xl md:text-5xl font-black text-yellow-500 text-center mb-4">
                                    Comida y Movimiento: Los Relojes Secundarios
                                </h2>
                                <p className="text-xl text-zinc-600 text-center max-w-3xl mx-auto mb-4">
                                    La luz no es el único interruptor. Si comes a deshoras, puedes desajustar órganos como el hígado
                                    hasta <strong>12 horas</strong> respecto a tu cerebro.
                                </p>
                                <p className="text-zinc-500 italic mb-12">
                                    Es como si cada parte de tu cuerpo viviera en una zona horaria distinta.
                                </p>
                            </FadeIn>

                            <div className="grid md:grid-cols-2 gap-8 mb-10">
                                <FadeIn delay={0.1}>
                                    <div className="flex gap-6 items-start">
                                        <div className="bg-green-100 rounded-2xl p-4 text-center shrink-0">
                                            <div className="text-3xl">🧠</div>
                                            <p className="text-green-700 font-bold text-sm mt-1">22:00</p>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-black mb-1">Cerebro → En modo noche</h3>
                                            <p className="text-zinc-600 text-sm">
                                                El reloj maestro indica que es hora de recuperar y descansar.
                                            </p>
                                        </div>
                                    </div>
                                </FadeIn>
                                <FadeIn delay={0.15}>
                                    <div className="flex gap-6 items-start">
                                        <div className="bg-green-100 rounded-2xl p-4 text-center shrink-0">
                                            <div className="text-3xl">🫀</div>
                                            <p className="text-green-900 font-bold text-sm mt-1">10:00</p>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-black mb-1">Hígado → En modo día</h3>
                                            <p className="text-zinc-600 text-sm">
                                                Si comes tarde, el hígado recibe señales de que aún es de día.
                                            </p>
                                        </div>
                                    </div>
                                </FadeIn>
                            </div>

                            <FadeIn delay={0.25}>
                                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6">
                                    <p className="text-black font-semibold mb-3 flex items-center gap-2">
                                        <AlertCircle size={16} /> Comer tarde (cuando la melatonina está alta) favorece:
                                    </p>
                                    <ul className="space-y-2 text-zinc-700">
                                        <li className="flex items-center gap-2">⚠️ Mayor almacenamiento de grasa.</li>
                                        <li className="flex items-center gap-2">⚠️ Peor control del azúcar en la sangre.</li>
                                    </ul>
                                </div>
                            </FadeIn>
                        </div>
                    </section>

                    {/* ── SLIDE 7: El Precio ── */}
                    <section
                        className="relative py-24 px-6 overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #f0fdf4, #fefce8)' }}
                    >
                        <div className="max-w-5xl mx-auto">
                            <FadeIn>
                                <p className="text-green-700 font-semibold text-sm tracking-widest uppercase mb-3 text-center">Las consecuencias</p>
                                <h2 className="text-4xl md:text-5xl font-black text-green-800 text-center mb-3">
                                    El Precio de la Desincronización
                                </h2>
                                <p className="text-green-800 text-center mb-12 text-lg italic">Un estrés silencioso y constante en el cuerpo.</p>
                            </FadeIn>

                            <div className="grid md:grid-cols-2 gap-6">
                                <FadeIn delay={0.1}>
                                    <div className="bg-white/80 backdrop-blur border border-green-200 rounded-2xl p-8 shadow-sm">
                                        <p className="text-green-700 font-bold mb-4 flex items-center gap-2">
                                            <Zap size={16} /> Corto Plazo — Impacto Inmediato
                                        </p>
                                        <ul className="space-y-3">
                                            {[
                                                'Cansancio crónico y fatiga.',
                                                'Insomnio y mala calidad de sueño.',
                                                'Mala concentración (niebla mental).',
                                                'Alteración de la microbiota intestinal.',
                                            ].map((item) => (
                                                <li key={item} className="flex items-start gap-3 text-green-900/80">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2 shrink-0" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </FadeIn>
                                <FadeIn delay={0.2}>
                                    <div className="bg-white/80 backdrop-blur border border-yellow-200 rounded-2xl p-8 shadow-sm">
                                        <p className="text-yellow-700 font-bold mb-4 flex items-center gap-2">
                                            <AlertCircle size={16} /> Largo Plazo — Riesgos Sistémicos
                                        </p>
                                        <ul className="space-y-3">
                                            {[
                                                'Obesidad y Diabetes.',
                                                'Hipertensión y problemas cardiovasculares.',
                                                'Impacto en salud mental y neurodegeneración.',
                                                'Mayor riesgo de ciertos cánceres en exposiciones prolongadas.',
                                            ].map((item) => (
                                                <li key={item} className="flex items-start gap-3 text-zinc-700">
                                                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2 shrink-0" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </FadeIn>
                            </div>
                        </div>
                    </section>

                    <SectionDivider variant="light" />

                    {/* ── PROTOCOLOS: Día y Noche ── */}
                    <section className="bg-white py-24 px-6">
                        <div className="max-w-5xl mx-auto">
                            <FadeIn>
                                <p className="text-green-600 font-semibold text-sm tracking-widest uppercase mb-3 text-center">El plan de acción</p>
                                <h2 className="text-4xl md:text-5xl font-black text-yellow-500 text-center mb-4">
                                    Protocolo de Sincronización
                                </h2>
                                <p className="text-xl text-zinc-600 text-center mx-auto mb-16">
                                    6 hábitos basados en evidencia para alinear tu reloj biológico.
                                </p>
                            </FadeIn>

                            <div className="grid md:grid-cols-2 gap-12">
                                {/* Día */}
                                <div>
                                    <FadeIn>
                                        <div className="flex items-center justify-center gap-3 mb-8">
                                            <Sun className="text-green-500" size={24} />
                                            <h3 className="text-2xl font-black text-green-800-950">El Día</h3>
                                        </div>
                                    </FadeIn>
                                    <div className="space-y-6">
                                        {[
                                            {
                                                n: 1,
                                                title: 'Luz Matutina',
                                                action: 'Sal al exterior 20–30 minutos al despertar.',
                                                why: 'Recibir luz natural (incluso nublado) detiene la melatonina y activa el reloj maestro.',
                                            },
                                            {
                                                n: 2,
                                                title: 'Ventana de Alimentación',
                                                action: 'Consume tus comidas en una ventana de 8 a 10 horas.',
                                                why: 'Alinea tu digestión con las horas de mayor eficiencia metabólica e insulínica.',
                                            },
                                            {
                                                n: 3,
                                                title: 'Movimiento',
                                                action: 'Haz ejercicio físico.',
                                                why: 'El movimiento ayuda a sincronizar el sistema periférico muscular y garantiza un sueño más profundo por la noche.',
                                            },
                                        ].map((step, i) => (
                                            <FadeIn key={step.n} delay={i * 0.1}>
                                                <div className="flex gap-5">
                                                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-700 font-black text-xl shrink-0">
                                                        {step.n}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-black mb-1">{step.title}</h4>
                                                        <p className="text-zinc-700 text-sm mb-2">{step.action}</p>
                                                        <p className="text-zinc-500 text-xs">
                                                            <strong>Por qué:</strong> {step.why}
                                                        </p>
                                                    </div>
                                                </div>
                                            </FadeIn>
                                        ))}
                                    </div>
                                </div>

                                {/* Noche */}
                                <div>
                                    <FadeIn>
                                        <div className="flex items-center justify-center gap-3 mb-8">
                                            <Moon className="text-green-500" size={24} />
                                            <h3 className="text-2xl font-black text-green-800-950">La Noche</h3>
                                        </div>
                                    </FadeIn>
                                    <div className="space-y-6">
                                        {[
                                            {
                                                n: 4,
                                                title: 'Toque de Queda Digital',
                                                action: 'Reduce pantallas y luz azul 2–3 horas antes de dormir.',
                                                why: 'Asegura la oscuridad necesaria para la liberación de melatonina.',
                                            },
                                            {
                                                n: 5,
                                                title: 'Ayuno Nocturno',
                                                action: 'Evita cenar muy tarde.',
                                                why: 'Evita que el hígado trabaje durante las horas de reparación, previniendo el almacenamiento de grasa.',
                                            },
                                            {
                                                n: 6,
                                                title: 'Entorno y Consistencia',
                                                action: 'Mantén horarios estables en una habitación oscura y fresca.',
                                                why: 'La consistencia térmica y lumínica regula todo tu sistema sin interrupciones.',
                                            },
                                        ].map((step, i) => (
                                            <FadeIn key={step.n} delay={i * 0.1}>
                                                <div className="flex gap-5">
                                                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-900 font-black text-xl shrink-0">
                                                        {step.n}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-black mb-1">{step.title}</h4>
                                                        <p className="text-zinc-700 text-sm mb-2">{step.action}</p>
                                                        <p className="text-zinc-500 text-xs">
                                                            <strong>Por qué:</strong> {step.why}
                                                        </p>
                                                    </div>
                                                </div>
                                            </FadeIn>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── SLIDE 10: Biología = Estilo de Vida ── */}
                    <section
                        className="relative py-24 px-6 overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}
                    >
                        <div className="max-w-4xl mx-auto text-center">
                            <FadeIn>
                                <h2 className="text-4xl md:text-5xl font-black text-green-800 text-center mb-6">
                                    Tu Biología no es Genética, es tu Estilo de Vida.
                                </h2>
                            </FadeIn>
                            <FadeIn delay={0.1}>
                                <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-lg inline-block max-w-xl mb-10">
                                    <p className="text-2xl font-black text-black mb-3">No necesitas hacer más cosas.</p>
                                    <p className="text-xl text-zinc-700">
                                        Necesitas hacerlas{' '}
                                        <strong className="text-green-600">en el momento correcto.</strong>
                                    </p>
                                </div>
                            </FadeIn>
                            <FadeIn delay={0.2}>
                                <p className="text-zinc-600 text-lg max-w-2xl mx-auto">
                                    Los ciclos circadianos le dicen a cada célula cuándo hacer su trabajo. Respetarlos no es una moda:
                                    es una de las bases más potentes de la salud.
                                </p>
                            </FadeIn>
                        </div>
                    </section>

                    {/* ── CTA Final ── */}
                    <section className="relative py-32 px-6 overflow-hidden bg-white border-t border-zinc-100">
                        <div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 pointer-events-none"
                            style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.3) 0%, transparent 70%)' }}
                        />
                        <div
                            className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full opacity-10 pointer-events-none"
                            style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.3) 0%, transparent 70%)' }}
                        />

                        <div className="relative z-10 max-w-3xl mx-auto text-center">
                            <FadeIn>
                                <h2 className="text-5xl md:text-6xl font-black text-yellow-500 text-center mb-6">
                                    Sincroniza tu Vida
                                </h2>
                            </FadeIn>

                            <FadeIn delay={0.1}>
                                <p className="text-zinc-600 text-xl mb-10 max-w-xl mx-auto">
                                    El secreto de la energía inagotable y la salud metabólica no es trabajar en contra de tu cuerpo,
                                    sino rotar en perfecta sincronía con él.
                                </p>
                            </FadeIn>

                            <FadeIn delay={0.2}>
                                <div className="flex flex-wrap justify-center gap-4 mb-12">
                                    {[
                                        { icon: '☀️', label: 'Luz Matutina' },
                                        { icon: '🍽️', label: 'Ventana de Alimentación' },
                                        { icon: '📵', label: 'Bloqueo Digital' },
                                        { icon: '🛌', label: 'Sueño Profundo' },
                                    ].map((pillar) => (
                                        <div
                                            key={pillar.label}
                                            className="bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-center backdrop-blur-sm"
                                        >
                                            <div className="text-2xl mb-1">{pillar.icon}</div>
                                            <p className="text-white/80 text-sm font-semibold">{pillar.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </FadeIn>

                            <FadeIn delay={0.3}>
                                <blockquote
                                    className="text-2xl font-black text-white mb-10 px-8 py-5 rounded-2xl"
                                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                                >
                                    "El cuándo es tu mayor ventaja biológica."
                                </blockquote>
                            </FadeIn>

                            <FadeIn delay={0.4}>
                                <Link
                                    href="/articles"
                                    className="inline-flex items-center gap-2 bg-green-800 text-white font-bold px-8 py-4 rounded-2xl hover:bg-green-900 transition-all"
                                >
                                    <ArrowLeft size={16} /> Explorar más artículos
                                </Link>
                            </FadeIn>
                        </div>
                    </section>
                </TabsContent>

                {/* ── PESTAÑA DE RESUMEN ── */}
                <TabsContent value="resumen" className="m-0 focus-visible:outline-none bg-slate-50 min-h-screen pb-32">
                    <div className="max-w-6xl mx-auto py-24 px-6">
                        <div className="mb-12">
                            <h2 className="text-3xl md:text-5xl font-black text-black mb-4">
                                Resumen de <span className="text-green-800">Ciclos Circadianos</span> e Hábitos Saludables
                            </h2>
                            <p className="text-zinc-600 text-lg">Basado en la ciencia de los ritmos biológicos</p>
                        </div>

                        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[900px]">
                                    <thead>
                                        <tr className="border-b border-zinc-200 bg-zinc-50 text-sm uppercase tracking-wider">
                                            <th className="p-6 font-bold text-zinc-700 border-l-4 border-green-800 w-1/6">Factor Biológico o Hábito</th>
                                            <th className="p-6 font-bold text-zinc-700 w-1/6">Función o Proceso Relacionado</th>
                                            <th className="p-6 font-bold text-zinc-700 w-1/6">Hormonas Involucradas</th>
                                            <th className="p-6 font-bold text-zinc-700 w-1/6">Impacto en la Salud</th>
                                            <th className="p-6 font-bold text-zinc-700 w-1/6">Recomendación de Hábito</th>
                                            <th className="p-6 font-bold text-zinc-700 w-1/6">Consecuencia de Desajuste</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                                            <td className="p-6 align-top">
                                                <span className="font-bold text-black text-base">Exposición a la Luz</span>
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                Sincronización del reloj maestro (núcleo supraquiasmático) y activación diaria
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                <span className="text-green-800 font-semibold">Cortisol</span> (sube por la mañana), <span className="text-indigo-600 font-semibold">Melatonina</span> (se inhibe con luz)
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                Regulación de la energía y ciclo sueño-vigilia
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                Salir al exterior 20-30 minutos al despertar y reducir pantallas 2-3 horas antes de dormir
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                Confusión del sistema, insomnio y mala concentración
                                            </td>
                                        </tr>

                                        <tr className="hover:bg-zinc-50 transition-colors">
                                            <td className="p-6 align-top">
                                                <span className="font-bold text-black text-base">Alimentación</span><br />
                                                <span className="text-zinc-500 text-sm mt-1 block">(Ventana de ingesta)</span>
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                Metabolismo y digestión coordinada con órganos como el hígado
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                <span className="text-blue-600 font-semibold">Insulina</span>, <span className="text-orange-600 font-semibold">Grelina</span>, <span className="text-red-600 font-semibold">Leptina</span> y <span className="text-indigo-600 font-semibold">Melatonina</span>
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                Control del azúcar y almacenamiento de grasa
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                Comer en una ventana de 8-10 horas y evitar cenar muy tarde
                                            </td>
                                            <td className="p-6 align-top text-zinc-600 leading-relaxed">
                                                Almacenamiento de grasa, peor control del azúcar y desincronización de órganos
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Infografía Interactiva solicitada */}
                        <InfografiaInteractiva />

                    </div>
                </TabsContent>

                <TabsContent value="analisis" className="m-0 focus-visible:outline-none">
                    <AnalisisCientificoTab />
                </TabsContent>

                <TabsContent value="aplicacion" className="m-0 focus-visible:outline-none overflow-hidden">
                    <SimuladorCircadianoAPP />
                </TabsContent>
            </Tabs>
        </div>
    );
}

