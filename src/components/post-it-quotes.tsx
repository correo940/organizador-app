'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

type Category = 'mental' | 'physical' | 'finance';

interface Quote {
    text: string;
    author: string;
    category: Category;
    color: string;
}

const allQuotes: Quote[] = [
    // Salud Física
    {
        text: "Que tu medicina sea tu alimento, y el alimento tu medicina.",
        author: "Hipócrates",
        category: "physical",
        color: "bg-green-200",
    },
    {
        text: "Comer es una necesidad, pero comer de forma inteligente es un arte.",
        author: "La Rochefoucauld",
        category: "physical",
        color: "bg-green-200",
    },
    {
        text: "La primera riqueza es la salud.",
        author: "Ralph Waldo Emerson",
        category: "physical",
        color: "bg-lime-200",
    },
    {
        text: "Cuida tu cuerpo. Es el único lugar que tienes para vivir.",
        author: "Jim Rohn",
        category: "physical",
        color: "bg-green-100",
    },
    {
        text: "El movimiento es una medicina para crear el cambio físico, emocional y mental.",
        author: "Carol Welch",
        category: "physical",
        color: "bg-teal-200",
    },

    // Finanzas Personales
    {
        text: "Cuida de los pequeños gastos; un pequeño agujero hunde un barco.",
        author: "Benjamin Franklin",
        category: "finance",
        color: "bg-yellow-200",
    },
    {
        text: "No ahorres lo que te queda después de gastar, gasta lo que te queda después de ahorrar.",
        author: "Warren Buffett",
        category: "finance",
        color: "bg-amber-200",
    },
    {
        text: "El precio es lo que pagas. El valor es lo que obtienes.",
        author: "Warren Buffett",
        category: "finance",
        color: "bg-orange-200",
    },
    {
        text: "Invierte en ti mismo. Es la mejor inversión que harás.",
        author: "Anónimo",
        category: "finance",
        color: "bg-yellow-100",
    },
    {
        text: "La riqueza no consiste en tener grandes posesiones, sino en tener pocas necesidades.",
        author: "Epicteto",
        category: "finance",
        color: "bg-gold-200", // Note: tailwind might not have gold, fallback to yellow/orange
    },

    // Salud Mental
    {
        text: "La felicidad no es algo que pospones para el futuro; es algo que diseñas para el presente.",
        author: "Jim Rohn",
        category: "mental",
        color: "bg-purple-200",
    },
    {
        text: "No puedes controlar todo lo que te sucede, pero puedes controlar tu actitud hacia lo que te sucede.",
        author: "Brian Tracy",
        category: "mental",
        color: "bg-indigo-200",
    },
    {
        text: "La paz viene de adentro. No la busques afuera.",
        author: "Buda",
        category: "mental",
        color: "bg-violet-200",
    },
    {
        text: "Sé amable contigo mismo. Estás haciendo lo mejor que puedes.",
        author: "Anónimo",
        category: "mental",
        color: "bg-fuchsia-200",
    },
    {
        text: "A veces, lo más productivo que puedes hacer es relajarte.",
        author: "Mark Black",
        category: "mental",
        color: "bg-pink-200",
    }
];

const categoryLabels: Record<Category, string> = {
    mental: "Salud Mental",
    physical: "Salud Física",
    finance: "Finanzas"
};

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PostItQuotes({ compact = false }: { compact?: boolean }) {
    const [dailyQuotes, setDailyQuotes] = useState<Quote[]>([]);

    useEffect(() => {
        // Obtener la fecha actual
        const today = new Date();
        const dateString = today.toLocaleDateString();

        // Generar hash base del día
        let dayHash = 0;
        for (let i = 0; i < dateString.length; i++) {
            dayHash = ((dayHash << 5) - dayHash) + dateString.charCodeAt(i);
            dayHash |= 0;
        }

        const categories: Category[] = ['mental', 'physical', 'finance'];
        const selectedQuotes: Quote[] = [];

        categories.forEach((cat, index) => {
            const catQuotes = allQuotes.filter(q => q.category === cat);
            if (catQuotes.length > 0) {
                // Usar el hash del día + índice de categoría para variedad pero consistencia
                // Multiplicar index para "saltar" en el generador pseudo-aleatorio
                const quoteIndex = Math.abs(dayHash + index * 123) % catQuotes.length;
                selectedQuotes.push(catQuotes[quoteIndex]);
            }
        });

        setDailyQuotes(selectedQuotes);
    }, []);

    if (dailyQuotes.length === 0) return null;

    if (compact) {
        return (
            <Card className="h-full flex flex-col border-none shadow-md overflow-hidden dark:bg-slate-950">
                <CardHeader className="py-2 px-4 bg-green-50/50 dark:bg-green-800-950/10 border-b border-green-100 dark:border-green-950/30 shrink-0">
                    <CardTitle className="text-green-950 dark:text-green-400 font-headline text-lg">
                        Nevera de la Sabiduría
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-4 relative bg-white dark:bg-slate-950 flex flex-col">
                    {/* Textura de nevera sutil */}
                    <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]"></div>

                    <div className="flex flex-col gap-3 w-full relative z-10 items-center justify-between flex-1 min-h-0 overflow-hidden pb-1">
                        {dailyQuotes.map((quote, index) => (
                            <motion.div
                                key={`${quote.category}-${index}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1, rotate: index % 2 === 0 ? 1 : -1 }}
                                className={`relative p-3 ${quote.color} shadow-sm w-full max-w-[240px] flex-1 min-h-0 flex flex-col justify-between font-handwriting transform transition-transform hover:scale-105 duration-200 border border-black/5`}
                            >
                                {/* Imán de nevera pequeño */}
                                <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-gray-700 to-black shadow-sm border border-gray-600 z-20"></div>

                                {/* Etiqueta pequeña */}
                                <div className="absolute -top-1 -right-1 bg-white/80 px-1 py-0.5 text-[9px] font-bold text-slate-600 rotate-6 shadow-sm">
                                    {categoryLabels[quote.category]}
                                </div>

                                <div className="flex-grow flex items-center justify-center mt-1 overflow-hidden">
                                    <p className="text-xs text-slate-800 font-medium leading-tight font-sans text-center line-clamp-4 text-[11px]">
                                        "{quote.text}"
                                    </p>
                                </div>
                                <p className="text-right text-slate-700 text-[9px] font-bold italic font-sans mt-0.5 shrink-0">
                                    — {quote.author}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Default Layout (Full Page Section)
    return (
        <section className="py-16 bg-slate-200 relative overflow-hidden">
            {/* Textura de nevera */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]"></div>

            <div className="container mx-auto px-4 relative z-10">
                <h2 className="font-headline text-3xl font-bold mb-12 text-center text-slate-700 drop-shadow-sm">
                    La Nevera de la Sabiduría
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-6xl mx-auto">
                    {dailyQuotes.map((quote, index) => (
                        <div key={`${quote.category}-${index}`} className="flex justify-center">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, rotate: -5 + (index * 5) }} // Rotaciones variadas iniciales
                                animate={{ opacity: 1, scale: 1, rotate: index % 2 === 0 ? 2 : -2 }} // Alternar rotación final
                                transition={{ duration: 0.5, delay: index * 0.2 }}
                                className={`relative p-6 ${quote.color} shadow-xl w-full max-w-[280px] md:max-w-[300px] aspect-square flex flex-col justify-between font-handwriting transform transition-transform hover:scale-105 duration-300`}
                                style={{
                                    boxShadow: '10px 10px 25px rgba(0,0,0,0.2)'
                                }}
                            >
                                {/* Imán de nevera */}
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-black shadow-md border-2 border-gray-600 z-20 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-gray-400 opacity-50"></div>
                                </div>

                                {/* Etiqueta de categoría (estilo cinta adhesiva o sello) */}
                                <div className="absolute -top-2 -right-2 bg-white/80 px-2 py-1 text-xs font-bold text-slate-600 rotate-12 shadow-sm border border-white/50">
                                    {categoryLabels[quote.category]}
                                </div>

                                <div className="flex-grow flex items-center justify-center mt-4">
                                    <p className="text-xl text-slate-800 font-medium leading-relaxed font-sans text-center">
                                        "{quote.text}"
                                    </p>
                                </div>
                                <p className="text-right text-slate-700 text-sm font-bold italic font-sans mt-2">
                                    — {quote.author}
                                </p>
                            </motion.div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

