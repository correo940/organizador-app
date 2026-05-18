'use client';

import ShoppingList from '@/components/apps/mi-hogar/shopping/shopping-list';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function MiHogarShoppingPage() {
    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#020617] p-4 md:p-8 pb-nav relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-green-800/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-indigo-500/5 blur-[100px] pointer-events-none" />

            <div className="max-w-4xl mx-auto mb-10 relative z-10">
                {/* Premium Navigation */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 mb-8"
                >
                    <Link href="/">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-slate-200 dark:border-slate-800 rounded-full px-4 h-9 shadow-sm hover:shadow-md transition-all flex items-center gap-2 group"
                        >
                            <Home className="h-4 w-4 text-slate-500 group-hover:text-green-800 transition-colors" />
                            <span className="hidden sm:inline font-bold text-xs uppercase tracking-wider">Inicio</span>
                        </Button>
                    </Link>
                    <Link href="/apps/mi-hogar">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="bg-slate-100/30 dark:bg-slate-800/20 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 rounded-full px-4 h-9 flex items-center gap-2 transition-all group"
                        >
                            <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:-translate-x-1 transition-transform" />
                            <span className="font-bold text-xs uppercase tracking-wider">Mi Hogar</span>
                        </Button>
                    </Link>
                </motion.div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-800 dark:bg-green-900 rounded-xl shadow-lg shadow-green-800/20">
                                <ShoppingBag className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                Lista de la <span className="text-green-800">Compra</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-base font-medium ml-12">
                            Gestiona tus compras y reposiciones con IA proactiva.
                        </p>
                    </motion.div>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                <ShoppingList />
            </motion.div>
        </div>
    );
}
