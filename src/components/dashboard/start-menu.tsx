'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Home, Shield, FileText, Bell, ChevronUp, ChevronDown, LogOut, Book, ChefHat, Pill, Car, Receipt, ShieldCheck, PiggyBank, Calendar, MessageCircle, Wallet, LayoutDashboard, BookOpen, Brain, CreditCard, Lock, LockOpen, Sparkles, Leaf, Bot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import JournalPanel from '@/components/journal/journal-panel';
import { useJournal } from '@/context/JournalContext';
import BrowserWidget from '@/components/journal/browser-widget';
import { useGlobalMenu } from '@/context/GlobalMenuContext';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import PurchaseDialog from '@/components/mobile/purchase-dialog';
import { MarketplaceApp } from '@/types/marketplace';

// App definition for the start menu
interface StartMenuApp {
    key: string;
    name: string;
    route: string;
    icon: React.ReactNode;
    color: string; // tailwind text color class
    bgColor: string; // tailwind bg color class
    isLocked: boolean;
    marketplaceId?: string;
    price?: number;
    description?: string;
}

// All possible apps (hardcoded icons for the desktop menu)
const ALL_APPS_CONFIG: { key: string; name: string; route: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
    { key: 'shopping', name: 'Compras', route: '/apps/mi-hogar/shopping', icon: <ShoppingCart className="w-4 h-4" />, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { key: 'tasks', name: 'Tareas', route: '/apps/mi-hogar/tasks', icon: <Bell className="w-4 h-4" />, color: 'text-green-800', bgColor: 'bg-green-800/10' },
    { key: 'passwords', name: 'Claves', route: '/apps/mi-hogar/passwords', icon: <Shield className="w-4 h-4" />, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { key: 'pharmacy', name: 'Salud', route: '/apps/mi-hogar/pharmacy', icon: <Pill className="w-4 h-4" />, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    { key: 'garage', name: 'Garaje', route: '/apps/mi-hogar/garage', icon: <Car className="w-4 h-4" />, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { key: 'expenses', name: 'Gastos Compartidos', route: '/apps/mi-hogar/expenses', icon: <Wallet className="w-4 h-4" />, color: 'text-green-800', bgColor: 'bg-green-800/10' },
    { key: 'savings', name: 'Mi Economía', route: '/apps/mi-hogar/savings', icon: <PiggyBank className="w-4 h-4" />, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { key: 'meditation', name: 'Pausa', route: '/apps/mi-hogar/meditation', icon: <Brain className="w-4 h-4" />, color: 'text-green-800', bgColor: 'bg-green-800/10' },
    { key: 'roster', name: 'Turnos', route: '/apps/mi-hogar/roster', icon: <Calendar className="w-4 h-4" />, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
    { key: 'chef-ia', name: 'Chef IA', route: '/apps/mi-hogar/chef', icon: <ChefHat className="w-4 h-4" />, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { key: 'huerto', name: 'Mis Plantas/Huerto', route: '/apps/huerto', icon: <Leaf className="w-4 h-4" />, color: 'text-green-800', bgColor: 'bg-green-800/10' },
    { key: 'documents', name: 'Documentos', route: '/apps/mi-hogar/documents', icon: <FileText className="w-4 h-4" />, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
    { key: 'assistant', name: 'Asistente', route: '/apps/mi-hogar/asistente', icon: <MessageCircle className="w-4 h-4" />, color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
    { key: 'secretary', name: 'Organizador', route: '/apps/organizador', icon: <Bot className="w-4 h-4" />, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
];

export default function StartMenu() {
    const { isStartMenuOpen, closeStartMenu } = useGlobalMenu();
    const [activeView, setActiveView] = useState<'menu' | 'apps'>('menu');
    const { isOpen: isJournalOpen, setIsOpen: setIsJournalOpen } = useJournal();
    const { user } = useAuth();
    const [userProfile, setUserProfile] = useState<any>(null);
    const [shoppingCount, setShoppingCount] = useState(0);
    const [taskCount, setTaskCount] = useState(0);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);

    // Marketplace state
    const [ownedAppKeys, setOwnedAppKeys] = useState<Set<string>>(new Set());
    const [marketplaceMap, setMarketplaceMap] = useState<Map<string, { id: string; price: number; description: string }>>(new Map());
    const [marketplaceLoaded, setMarketplaceLoaded] = useState(false);
    const [selectedAppForPurchase, setSelectedAppForPurchase] = useState<MarketplaceApp | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (isStartMenuOpen &&
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                !(event.target as Element).closest('#start-button')
            ) {
                closeStartMenu();
            }
        };

        if (isStartMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isStartMenuOpen, closeStartMenu]);

    const fetchMarketplace = async (userId: string) => {
        try {
            const { data: marketplaceApps, error: appsError } = await supabase
                .from('marketplace_apps')
                .select('*')
                .eq('is_active', true);

            if (appsError || !marketplaceApps || marketplaceApps.length === 0) {
                setOwnedAppKeys(new Set(ALL_APPS_CONFIG.map(a => a.key)));
                setMarketplaceLoaded(true);
                return;
            }

            // Build marketplace map
            const mMap = new Map<string, { id: string; price: number; description: string }>();
            marketplaceApps.forEach(app => {
                mMap.set(app.key, { id: app.id, price: app.price, description: app.description });
            });
            setMarketplaceMap(mMap);

            // Check if user is Premium (unlocks everything)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('subscription_tier')
                .eq('id', userId)
                .single();

            if (profileData?.subscription_tier === 'premium') {
                setOwnedAppKeys(new Set(ALL_APPS_CONFIG.map(a => a.key)));
                setMarketplaceLoaded(true);
                return;
            }

            // Get user active subscriptions (not expired)
            const { data: purchases } = await supabase
                .from('user_app_purchases')
                .select('app_id, expires_at')
                .eq('user_id', userId)
                .eq('status', 'active');

            const ownedIds = new Set(
                (purchases || [])
                    .filter(p => !p.expires_at || new Date(p.expires_at) > new Date())
                    .map(p => p.app_id)
            );

            // Determine owned keys (only by subscription, no free bypass)
            const ownedKeys = new Set<string>();
            marketplaceApps.forEach(app => {
                if (ownedIds.has(app.id)) {
                    ownedKeys.add(app.key);
                }
            });

            // Apps not in marketplace are considered unlocked (legacy apps)
            ALL_APPS_CONFIG.forEach(a => {
                if (!mMap.has(a.key)) {
                    ownedKeys.add(a.key);
                }
            });

            setOwnedAppKeys(ownedKeys);
        } catch (error) {
            console.error('StartMenu marketplace error:', error);
            setOwnedAppKeys(new Set(ALL_APPS_CONFIG.map(a => a.key)));
        } finally {
            setMarketplaceLoaded(true);
        }
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!user) {
            setShoppingCount(0);
            setTaskCount(0);
            setUserProfile(null);
            return;
        }

        fetchCounts(user.id);
        fetchMarketplace(user.id);

        supabase.from('profiles').select('custom_avatar_url, nickname').eq('id', user.id).single()
            .then(({ data }) => {
                if (data) {
                    setUserProfile({
                        ...user,
                        profile: data
                    });
                } else {
                    setUserProfile(user);
                }
            });

        const channel = supabase
            .channel('dashboard_badges_start')
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
        const { count: sCount } = await supabase
            .from('shopping_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_checked', false);

        if (sCount !== null) setShoppingCount(sCount);

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
        closeStartMenu();
    };

    const handleAppClick = (appConfig: typeof ALL_APPS_CONFIG[0]) => {
        const isOwned = ownedAppKeys.has(appConfig.key);
        if (!isOwned && marketplaceMap.has(appConfig.key)) {
            const mData = marketplaceMap.get(appConfig.key)!;
            setSelectedAppForPurchase({
                id: mData.id,
                key: appConfig.key,
                name: appConfig.name,
                description: mData.description,
                icon_key: '',
                route: appConfig.route,
                price: mData.price,
                category: 'utility' as const,
                is_active: true,
            });
        } else {
            router.push(appConfig.route);
            closeStartMenu();
        }
    };

    if (!mounted || !user) return null;

    const totalNotifications = shoppingCount + taskCount;

    return (
        <>
            <JournalPanel isOpen={isJournalOpen} onClose={() => setIsJournalOpen(false)} />
            <BrowserWidget />

            <AnimatePresence>
                {isStartMenuOpen && (
                    <div className="fixed inset-0 z-40 flex items-end justify-center pointer-events-none pb-24">
                        <motion.div
                            ref={menuRef}
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", bounce: 0.3, duration: 0.3 }}
                            className="pointer-events-auto bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden w-72 mx-auto mb-2"
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/50 dark:bg-black/50">
                                <div className="flex items-center gap-3">
                                    <Link href="/profile" onClick={closeStartMenu}>
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 ring-2 ring-white/20 hover:scale-105 transition-transform cursor-pointer">
                                            <img
                                                src={userProfile?.profile?.custom_avatar_url || userProfile?.user_metadata?.avatar_url || "/images/logo.png"}
                                                alt="User"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </Link>
                                    <div>
                                        <h3 className="font-bold text-sm">Mi Quioba</h3>
                                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{userProfile?.profile?.nickname || userProfile?.email}</p>
                                    </div>
                                </div>
                                {activeView === 'apps' && (
                                    <Button variant="ghost" size="sm" onClick={() => setActiveView('menu')} className="h-8 w-8 p-0">
                                        <ChevronDown className="h-4 w-4 rotate-90" />
                                    </Button>
                                )}
                            </div>

                            <div className="p-2 max-h-[60vh] overflow-y-auto">
                                {activeView === 'menu' ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Link
                                                href="/"
                                                onClick={() => closeStartMenu()}
                                                className="col-span-2 flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors bg-white/40 dark:bg-zinc-800/40 shadow-sm group"
                                            >
                                                <div className="p-2.5 bg-indigo-500/10 rounded-lg text-indigo-500">
                                                    <LayoutDashboard className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-sm">Inicio</div>
                                                </div>
                                            </Link>

                                            <button
                                                onClick={() => setActiveView('apps')}
                                                className="col-span-2 flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors bg-white/40 dark:bg-zinc-800/40 shadow-sm group text-left"
                                            >
                                                <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-500">
                                                    <Home className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-sm">Aplicaciones</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {totalNotifications > 0 && (
                                                        <Badge variant="destructive" className="rounded-full h-5 px-2">
                                                            {totalNotifications}
                                                        </Badge>
                                                    )}
                                                    <ChevronDown className="w-4 h-4 -rotate-90 text-muted-foreground" />
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setIsJournalOpen(true);
                                                    closeStartMenu();
                                                }}
                                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors bg-white/40 dark:bg-zinc-800/40 shadow-sm text-center"
                                            >
                                                <div className="p-2 bg-amber-500/10 rounded-full text-amber-500">
                                                    <Book className="w-6 h-6" />
                                                </div>
                                                <span className="text-xs font-medium">Apuntes</span>
                                            </button>

                                            <Link
                                                href="/apps/debate"
                                                onClick={() => closeStartMenu()}
                                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors bg-white/40 dark:bg-zinc-800/40 shadow-sm text-center"
                                            >
                                                <div className="p-2 bg-green-800/10 rounded-full text-green-800">
                                                    <MessageCircle className="w-6 h-6" />
                                                </div>
                                                <span className="text-xs font-medium">Debate</span>
                                            </Link>

                                            <Link
                                                href="/apps/mi-hogar/confessions"
                                                onClick={() => closeStartMenu()}
                                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors bg-white/40 dark:bg-zinc-800/40 shadow-sm text-center"
                                            >
                                                <div className="p-2 bg-violet-500/10 rounded-full text-violet-500">
                                                    <span className="text-xl">🤔</span>
                                                </div>
                                                <span className="text-xs font-medium">Pensar</span>
                                            </Link>

                                            <Link
                                                href="/apps/organizador-vital"
                                                onClick={() => closeStartMenu()}
                                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors bg-white/40 dark:bg-zinc-800/40 shadow-sm text-center"
                                            >
                                                <div className="p-2 bg-blue-500/10 rounded-full text-blue-500">
                                                    <span className="text-xl">📅</span>
                                                </div>
                                                <span className="text-xs font-medium">Agenda</span>
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid gap-1">
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start mb-2 pl-2 gap-2 text-muted-foreground hover:text-foreground"
                                            onClick={() => setActiveView('menu')}
                                        >
                                            <ChevronDown className="h-4 w-4 rotate-90" />
                                            Volver
                                        </Button>

                                        <div className="grid grid-cols-2 gap-2">
                                            {ALL_APPS_CONFIG.map(app => {
                                                const isOwned = ownedAppKeys.has(app.key);
                                                const mData = marketplaceMap.get(app.key);
                                                const isLocked = !isOwned && !!mData;

                                                return (
                                                    <button
                                                        key={app.key}
                                                        onClick={() => handleAppClick(app)}
                                                        className={`flex items-center gap-2 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-sm text-left relative ${isLocked ? 'opacity-70' : ''}`}
                                                    >
                                                        <span className={`${isLocked ? 'text-slate-400' : app.color}`}>
                                                            {app.icon}
                                                        </span>
                                                        <span className={isLocked ? 'text-slate-400' : ''}>{app.name}</span>
                                                        {isLocked ? (
                                                            <Lock className="ml-auto w-3.5 h-3.5 text-slate-400" />
                                                        ) : (
                                                            <>
                                                                {app.key === 'shopping' && shoppingCount > 0 && <Badge className="ml-auto h-4 px-1">{shoppingCount}</Badge>}
                                                                {app.key === 'tasks' && taskCount > 0 && <Badge className="ml-auto h-4 px-1">{taskCount}</Badge>}
                                                                {app.key !== 'shopping' && app.key !== 'tasks' && (
                                                                    <LockOpen className="ml-auto w-3 h-3 text-green-800" />
                                                                )}
                                                            </>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 border-t border-white/10 bg-muted/30 flex justify-between items-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-muted-foreground hover:text-destructive gap-2"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="w-3 h-3" />
                                    Cerrar Sesión
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Purchase Dialog */}
            <PurchaseDialog
                app={selectedAppForPurchase}
                open={!!selectedAppForPurchase}
                onClose={() => setSelectedAppForPurchase(null)}
                onPurchaseComplete={() => {
                    setSelectedAppForPurchase(null);
                    if (user?.id) fetchMarketplace(user.id);
                }}
            />
        </>
    );
}

