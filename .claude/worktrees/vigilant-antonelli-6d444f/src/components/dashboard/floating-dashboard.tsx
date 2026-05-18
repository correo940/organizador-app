'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Home, Shield, FileText, Bell, ChevronUp, ChevronDown, LogOut, Book, ChefHat, Pill, Car, Receipt, ShieldCheck, PiggyBank, Calendar, MessageCircle, Wallet, LayoutDashboard, BookOpen, Brain, Activity, Leaf, Bot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import JournalPanel from '@/components/journal/journal-panel';
import { useJournal } from '@/context/JournalContext';
import BrowserWidget from '@/components/journal/browser-widget';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

export default function FloatingDashboard() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeView, setActiveView] = useState<'menu' | 'apps'>('menu');
    const { isOpen: isJournalOpen, setIsOpen: setIsJournalOpen, width } = useJournal();
    const { user } = useAuth();
    const [shoppingCount, setShoppingCount] = useState(0);
    const [taskCount, setTaskCount] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    // Use window size for constraints
    const constraintsRef = React.useRef(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (isOpen &&
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!user) {
            setShoppingCount(0);
            setTaskCount(0);
            return;
        }

        fetchCounts(user.id);

        // Set up real-time subscription for immediate updates
        const channel = supabase
            .channel('dashboard_badges')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                fetchCounts(user.id);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => {
                fetchCounts(user.id);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchCounts = async (userId: string) => {
        // Shopping Count
        const { count: sCount } = await supabase
            .from('shopping_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_checked', false);

        if (sCount !== null) setShoppingCount(sCount);

        // Task Count
        const { count: tCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_completed', false);

        if (tCount !== null) setTaskCount(tCount);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.success('Sesión cerrada');
        router.refresh();
    };

    if (!mounted || !user) return null;

    const totalNotifications = shoppingCount + taskCount;

    return (
        <>
            <JournalPanel isOpen={isJournalOpen} onClose={() => setIsJournalOpen(false)} />
            <BrowserWidget />

            {/* Constraints area - invisible but covers screen */}
            <div ref={constraintsRef} className="fixed inset-4 pointer-events-none z-40" />

            <div className="fixed inset-0 pointer-events-none z-50 overflow-visible">
                {/* Menu Popup */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            ref={menuRef}
                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 20 }}
                            className="absolute pointer-events-auto bg-white/90 dark:bg-black/90 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                            style={{
                                bottom: '100px',
                                right: '16px',
                                zIndex: 60,
                                width: 'min(288px, calc(100vw - 32px))',
                            }}
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-lg">Mi Quioba</h3>
                                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                </div>
                                {activeView === 'apps' && (
                                    <Button variant="ghost" size="sm" onClick={() => setActiveView('menu')} className="h-8 w-8 p-0">
                                        <ChevronDown className="h-4 w-4 rotate-90" />
                                    </Button>
                                )}
                            </div>

                            <div className="p-2">
                                {activeView === 'menu' ? (
                                    <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                                        <div className="grid gap-2">
                                            <Link
                                                href="/"
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-3 p-4 rounded-xl hover:bg-primary/10 transition-colors bg-white/50 dark:bg-zinc-900/50 shadow-sm group text-left"
                                            >
                                                <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500 group-hover:scale-110 transition-transform">
                                                    <LayoutDashboard className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm">Mi Quioba</div>
                                                    <div className="text-xs text-muted-foreground">Tu hogar digital</div>
                                                </div>
                                            </Link>

                                            <button
                                                onClick={() => setActiveView('apps')}
                                                className="flex items-center gap-3 p-4 rounded-xl hover:bg-primary/10 transition-colors bg-white/50 dark:bg-zinc-900/50 shadow-sm group text-left"
                                            >
                                                <div className="p-3 bg-blue-500/10 rounded-full text-blue-500 group-hover:scale-110 transition-transform">
                                                    <Home className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm">Mis Aplicaciones</div>
                                                    <div className="text-xs text-muted-foreground">Accede a tus herramientas</div>
                                                </div>
                                                <ChevronDown className="w-4 h-4 ml-auto -rotate-90 text-muted-foreground" />
                                                {totalNotifications > 0 && (
                                                    <Badge variant="destructive" className="ml-2 rounded-full h-5 px-2">
                                                        {totalNotifications}
                                                    </Badge>
                                                )}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setIsJournalOpen(true);
                                                    setIsOpen(false);
                                                }}
                                                className="flex items-center gap-3 p-4 rounded-xl hover:bg-primary/10 transition-colors bg-white/50 dark:bg-zinc-900/50 shadow-sm group text-left"
                                            >
                                                <div className="p-3 bg-amber-500/10 rounded-full text-amber-500 group-hover:scale-110 transition-transform">
                                                    <Book className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm">Mis Apuntes</div>
                                                    <div className="text-xs text-muted-foreground">Diario y notas rápidas</div>
                                                </div>
                                            </button>

                                            <Link
                                                href="/apps/organizador"
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-3 p-4 rounded-xl hover:bg-primary/10 transition-colors bg-white/50 dark:bg-zinc-900/50 shadow-sm group text-left"
                                            >
                                                <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500 group-hover:scale-110 transition-transform">
                                                    <Bot className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm">Secretaria</div>
                                                    <div className="text-xs text-muted-foreground">Tu asistente diario</div>
                                                </div>
                                            </Link>

                                            <Link
                                                href="/apps/debate"
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-3 p-4 rounded-xl hover:bg-primary/10 transition-colors bg-white/50 dark:bg-zinc-900/50 shadow-sm group text-left"
                                            >
                                                <div className="p-3 bg-green-500/10 rounded-full text-green-500 group-hover:scale-110 transition-transform">
                                                    <MessageCircle className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm">El Debate</div>
                                                    <div className="text-xs text-muted-foreground">Sala de discusión</div>
                                                </div>
                                            </Link>

                                            <Link
                                                href="/apps/mi-hogar/confessions"
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-3 p-4 rounded-xl hover:bg-primary/10 transition-colors bg-white/50 dark:bg-zinc-900/50 shadow-sm group text-left"
                                            >
                                                <div className="p-3 bg-violet-500/10 rounded-full text-violet-500 group-hover:scale-110 transition-transform">
                                                    <span className="text-2xl leading-none">🤔</span>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm">Compartir Pensamientos</div>
                                                    <div className="text-xs text-muted-foreground">Di lo que no te atreves</div>
                                                </div>
                                            </Link>

                                            <Link
                                                href="/apps/organizador-vital"
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-3 p-4 rounded-xl hover:bg-primary/10 transition-colors bg-white/50 dark:bg-zinc-900/50 shadow-sm group text-left"
                                            >
                                                <div className="p-3 bg-blue-500/10 rounded-full text-blue-500 group-hover:scale-110 transition-transform">
                                                    <span className="text-2xl leading-none">📅</span>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm">Organizador Vital</div>
                                                    <div className="text-xs text-muted-foreground">Planifica tu semana</div>
                                                </div>
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-1">
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start mb-2 pl-2 gap-2 text-muted-foreground hover:text-foreground"
                                            onClick={() => setActiveView('menu')}
                                        >
                                            <ChevronDown className="h-4 w-4 rotate-90" />
                                            Volver al Menú
                                        </Button>

                                        <Link href="/apps/mi-hogar/shopping" className="flex items-center justify-between p-3 rounded-xl hover:bg-primary/10 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                                    <ShoppingCart className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-medium">Lista de Compra</span>
                                            </div>
                                            {shoppingCount > 0 && (
                                                <Badge variant="destructive" className="rounded-full h-5 px-2">
                                                    {shoppingCount}
                                                </Badge>
                                            )}
                                        </Link>

                                        {/* Task Link */}
                                        <Link href="/apps/mi-hogar/tasks" className="flex items-center justify-between p-3 rounded-xl hover:bg-primary/10 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                                                    <Bell className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-medium">Tareas</span>
                                            </div>
                                            {taskCount > 0 && (
                                                <Badge variant="destructive" className="rounded-full h-5 px-2">
                                                    {taskCount}
                                                </Badge>
                                            )}
                                        </Link>

                                        <Link href="/apps/mi-hogar/passwords" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                                                <Shield className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Contraseñas</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/pharmacy" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                                                <Pill className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Botiquín</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/garage" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                                <Car className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Garaje</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/insurance" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400">
                                                <Shield className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Seguros</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/warranties" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg text-pink-600 dark:text-pink-400">
                                                <Receipt className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Garantías</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/documents" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Caja Fuerte</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/expenses" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-800 dark:text-green-400">
                                                <Wallet className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Gastos Compartidos</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/savings" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                                                <PiggyBank className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Mi Economía</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/meditation" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-800 dark:text-green-400">
                                                <Brain className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Pausa</span>
                                        </Link>

                                        <Link href="/apps/huerto" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-800 dark:text-green-400">
                                                <Leaf className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Mi Huerto</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/roster" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg text-cyan-600 dark:text-cyan-400">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Cuadrante</span>
                                        </Link>

                                        <Link href="/apps/mi-hogar/manuals" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                                                <BookOpen className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Manual y Mantenimiento</span>
                                        </Link>

                                        <Link href="/apps/salud-ocupacional" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors">
                                            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400">
                                                <Activity className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-medium">Salud Ocupacional</span>
                                        </Link>
                                    </div>
                                )}
                            </div >

                            <div className="p-2 border-t border-white/10 bg-muted/30">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-muted-foreground hover:text-destructive"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Cerrar Sesión
                                </Button>
                            </div>
                        </motion.div >
                    )
                    }
                </AnimatePresence >

                {/* Draggable Button */}
                < motion.div
                    ref={buttonRef}
                    drag
                    dragConstraints={constraintsRef}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    dragMomentum={false}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={() => setIsOpen(!isOpen)}
                    className="fixed z-[100] pointer-events-auto cursor-grab active:cursor-grabbing text-foreground"
                    style={{ bottom: 24 }}
                    animate={{
                        right: isJournalOpen ? `calc(24px + ${width}%)` : '24px'
                    }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                >
                    <motion.div
                        animate={{
                            scale: [1, 1.05, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="relative w-16 h-16 rounded-full shadow-2xl border-4 border-white dark:border-zinc-800 bg-white dark:bg-black"
                    >
                        <div className="w-full h-full rounded-full overflow-hidden p-2 flex items-center justify-center">
                            <img
                                src="/images/logo.png"
                                alt="Quioba"
                                style={{ width: 'auto', height: '100%' }}
                                className="object-contain pointer-events-none"
                            />
                        </div>

                        {totalNotifications > 0 && !isOpen && (
                            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-black animate-pulse z-10" />
                        )}
                    </motion.div>

                    {/* Tooltip */}
                    <AnimatePresence>
                        {isHovered && !isOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="absolute bottom-full mb-3 right-0 mr-[-0.5rem] px-3 py-1 bg-black/80 text-white text-xs font-bold rounded-full whitespace-nowrap backdrop-blur-sm pointer-events-none"
                            >
                                Mi Quioba
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div >
            </div >
        </>
    );
}
