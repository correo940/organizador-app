'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { LogIn, User, LogOut, Loader2, Mail, Lock, LayoutDashboard, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translateAuthError } from '@/lib/utils';
import { useAi } from '@/context/AiContext';
import { useJournal } from '@/context/JournalContext';
import { getSecretarySettings, getAvatarById } from '@/lib/secretary-settings';
import { Mic, MicOff, Plus, CheckSquare, ShoppingCart, Wallet, Camera, Book } from 'lucide-react';
import NotificationSettingsDialog from '@/components/dashboard/notifications/notification-settings-dialog';
import { motion, AnimatePresence } from 'framer-motion';

const QUICK_ACTIONS = [
    { label: 'Nueva tarea', icon: CheckSquare, href: '/apps/mi-hogar/tasks?action=new', color: 'bg-blue-600' },
    { label: 'Lista compra', icon: ShoppingCart, href: '/apps/mi-hogar/shopping?action=new', color: 'bg-green-800' },
    { label: 'Nuevo gasto', icon: Wallet, href: '/apps/mi-hogar/expenses?action=new', color: 'bg-amber-600' },
    { label: 'Escanear', icon: Camera, href: '/apps/mi-hogar/shopping?action=scan', color: 'bg-slate-700' },
];

export default function HeaderAuth() {
    const { setIsOpen: setAiPanelOpen, isWakeWordEnabled, setIsWakeWordEnabled } = useAi();
    const { setIsOpen: setIsJournalOpen } = useJournal();
    const [user, setUser] = useState<any>(null);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session) setIsOpen(false); // Close dialog on successful login
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            toast.success('¡Bienvenido de nuevo!');
        } catch (error: any) {
            toast.error(translateAuthError(error.message) || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        if (!window.confirm('¿Seguro que quieres cerrar sesión?')) return;
        await supabase.auth.signOut();
        toast.success('Sesión cerrada');
        router.refresh();
    };

    if (user) {
        return (
            <div className="flex items-center gap-2 md:gap-3">
                {/* Global Quick Action Button (+) */}
                <div className="relative">
                    <button
                        onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-green-800 text-white shadow-md hover:scale-110 transition-transform"
                        title="Acciones Rápidas"
                    >
                        <motion.div animate={{ rotate: isActionMenuOpen ? 45 : 0 }}>
                            <Plus className="w-5 h-5" strokeWidth={3} />
                        </motion.div>
                    </button>

                    <AnimatePresence>
                        {isActionMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsActionMenuOpen(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-10 right-0 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50"
                                >
                                    {QUICK_ACTIONS.map((action) => (
                                        <Link
                                            key={action.label}
                                            href={action.href}
                                            onClick={() => setIsActionMenuOpen(false)}
                                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                                        >
                                            <div className={`w-8 h-8 rounded-lg ${action.color} text-white flex items-center justify-center`}>
                                                <action.icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{action.label}</span>
                                        </Link>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Journal / Notes Button */}
                <button
                    onClick={() => setIsJournalOpen(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-500 text-white shadow-md hover:scale-110 transition-transform"
                    title="Mis Apuntes"
                >
                    <Book className="w-4 h-4" />
                </button>

                {/* Wake Word / Mic Button */}
                <button
                    onClick={() => setIsWakeWordEnabled(!isWakeWordEnabled)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full shadow-md transition-colors ${isWakeWordEnabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-400'
                        }`}
                    title={isWakeWordEnabled ? "Micrófono IA activo" : "Micrófono IA desactivado"}
                >
                    {isWakeWordEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                {/* Quioba Bot Button */}
                <button
                    onClick={() => setAiPanelOpen(true)}
                    className="relative w-8 h-8 flex items-center justify-center rounded-full bg-green-800 shadow-md hover:scale-110 transition-transform overflow-hidden"
                    title="IA de Quioba"
                >
                    <div className="relative w-6 h-6 overflow-hidden rounded-full border border-indigo-200 bg-white flex items-center justify-center text-sm">
                        {typeof window !== 'undefined' ? getAvatarById(getSecretarySettings().avatarId).emoji : '🤖'}
                    </div>
                </button>

                {/* Notifications Button */}
                <NotificationSettingsDialog />

                <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

                <Button variant="default" size="sm" asChild className="hidden lg:flex bg-green-700 hover:bg-green-800 text-white h-8">
                    <Link href="/desktop">
                        <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
                        Mi Panel
                    </Link>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="h-9 w-9 rounded-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer text-xl">
                            {typeof window !== 'undefined' ? getAvatarById(getSecretarySettings().avatarId).emoji : '🤖'}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">Mi Cuenta</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/desktop" className="cursor-pointer">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                <span>Ir a Mi Panel</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Cerrar Sesión</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-2 bg-green-700 hover:bg-green-800 text-white rounded-full px-4">
                    <LogIn className="h-4 w-4" />
                    <span className="hidden sm:inline">Iniciar Sesión</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Acceso Mi Hogar</DialogTitle>
                    <DialogDescription>
                        Ingresa tus credenciales para acceder a tus aplicaciones.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type="email"
                                placeholder="Email"
                                className="pl-9"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Contraseña"
                                className="pl-9 pr-9"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                ) : (
                                    <Eye className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-green-700 hover:bg-green-800"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Iniciar Sesión
                    </Button>
                </form>
                <div className="mt-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        ¿No tienes cuenta?{' '}
                        <Link
                            href="/apps/mi-hogar/login"
                            className="text-primary hover:underline font-medium"
                            onClick={() => setIsOpen(false)}
                        >
                            Regístrate aquí
                        </Link>
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
